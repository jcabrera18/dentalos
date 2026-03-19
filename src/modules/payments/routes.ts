// src/modules/payments/routes.ts
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseForUser } from '../../lib/supabase.js'

const CreatePaymentSchema = z.object({
  patient_id:         z.string().uuid(),
  appointment_id:     z.string().uuid().optional(),
  quote_id:           z.string().uuid().optional(),
  treatment_id:       z.string().uuid().optional(),
  amount:             z.number().positive(),
  method:             z.enum(['cash','bank_transfer','debit_card','credit_card','insurance','qr','other']),
  installments:       z.number().int().min(1).max(48).default(1),
  reference_number:   z.string().max(100).optional(),
  insurance_coverage: z.number().optional(),
  patient_copay:      z.number().optional(),
  notes:              z.string().max(500).optional(),
  paid_at:            z.string().datetime({ offset: true }).optional(),
})

const CreateQuoteSchema = z.object({
  patient_id:      z.string().uuid(),
  items:           z.array(z.object({
    description:   z.string(),
    quantity:      z.number().int().min(1).default(1),
    unit_price:    z.number().positive(),
    discount_pct:  z.number().min(0).max(100).default(0),
  })).min(1),
  installments:    z.number().int().min(1).default(1),
  notes:           z.string().max(500).optional(),
  valid_until:     z.string().date().optional(),
  treatment_id:    z.string().uuid().optional(),
})

export async function paymentsRoutes(app: FastifyInstance) {

  app.addHook('onRequest', (app as any).authenticate)

  // ── GET /payments ─────────────────────────
  app.get('/', async (request, reply) => {
    const { from, to, patient_id, method, limit = 50, offset = 0 } =
      request.query as Record<string, string>
    const clinicId = (request as any).clinicId as string
    const db = supabaseForUser(request.headers.authorization)

    let query = db
      .from('payments')
      .select(`
        *,
        patients(first_name, last_name, phone),
        appointments(starts_at, appointment_type)
      `)
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .order('paid_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1)

    if (from)       query = query.gte('paid_at', `${from}T00:00:00+00:00`)
    if (to)         query = query.lte('paid_at', `${to}T23:59:59+00:00`)
    if (patient_id) query = query.eq('patient_id', patient_id)
    if (method)     query = query.eq('method', method)

    const { data, error } = await query
    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

  // ── POST /payments ────────────────────────
  app.post('/', async (request, reply) => {
    const body           = CreatePaymentSchema.parse(request.body)
    const clinicId       = (request as any).clinicId as string
    const professionalId = (request as any).professionalId as string
    const db = supabaseForUser(request.headers.authorization)

    // Auto-generate receipt number
    const receiptNumber = `R-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`

    const { data, error } = await db
      .from('payments')
      .insert({
        ...body,
        clinic_id:       clinicId,
        professional_id: professionalId,
        receipt_number:  receiptNumber,
        installment_amount: body.installments > 1
          ? body.amount / body.installments
          : null,
      })
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send({ data })
  })

  // ── GET /payments/cash-summary ────────────
  // Daily cash register report
  app.get('/cash-summary', async (request, reply) => {
    const { date } = z.object({ date: z.string().date().default(
      new Date().toISOString().split('T')[0]
    )}).parse(request.query)
    const clinicId = (request as any).clinicId as string
    const db = supabaseForUser(request.headers.authorization)

    const { data, error } = await db
      .from('v_daily_cash')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('day', date)

    if (error) return reply.code(500).send({ error: error.message })

    // Aggregate totals
    const summary = {
      date,
      by_method: data,
      total: (data ?? []).reduce((sum, r) => sum + Number(r.total), 0),
      transactions: (data ?? []).reduce((sum, r) => sum + Number(r.transactions), 0),
    }

    return { data: summary }
  })

  // ── POST /quotes ──────────────────────────
  app.post('/quotes', async (request, reply) => {
    const body           = CreateQuoteSchema.parse(request.body)
    const clinicId       = (request as any).clinicId as string
    const professionalId = (request as any).professionalId as string
    const db = supabaseForUser(request.headers.authorization)

    // Calculate totals from items
    const itemsWithSubtotals = body.items.map(item => {
      const subtotal = item.quantity * item.unit_price * (1 - item.discount_pct / 100)
      return { ...item, subtotal }
    })
    const subtotal = itemsWithSubtotals.reduce((s, i) => s + i.subtotal, 0)

    const { data, error } = await db
      .from('quotes')
      .insert({
        clinic_id:          clinicId,
        professional_id:    professionalId,
        patient_id:         body.patient_id,
        items:              itemsWithSubtotals,
        subtotal,
        discount_amount:    0,
        total:              subtotal,
        installments:       body.installments,
        installment_amount: body.installments > 1 ? subtotal / body.installments : null,
        notes:              body.notes,
        valid_until:        body.valid_until,
        treatment_id:       body.treatment_id,
        status:             'draft',
      })
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send({ data })
  })

  // ── PATCH /quotes/:id/status ──────────────
  app.patch('/quotes/:id/status', async (request, reply) => {
    const { id }    = request.params as { id: string }
    const { status } = z.object({
      status: z.enum(['sent', 'accepted', 'rejected'])
    }).parse(request.body)
    const db = supabaseForUser(request.headers.authorization)

    const ts: Record<string, string> = {
      sent:     'sent_at',
      accepted: 'accepted_at',
      rejected: 'rejected_at',
    }

    const { data, error } = await db
      .from('quotes')
      .update({ status, [ts[status]]: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })
}
