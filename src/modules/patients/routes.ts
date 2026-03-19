// src/modules/patients/routes.ts
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseForUser, supabaseAdmin } from '../../lib/supabase.js'

// ── Validation schemas ────────────────────────

const CreatePatientSchema = z.object({
  first_name:          z.string().min(1).max(100),
  last_name:           z.string().min(1).max(100),
  phone:               z.string().min(6).max(20),
  document_type:       z.enum(['DNI', 'CUIT', 'Pasaporte']).default('DNI'),
  document_number:     z.string().max(20).optional(),
  date_of_birth:       z.string().date().optional(),       // YYYY-MM-DD
  gender:              z.enum(['M', 'F', 'otro']).optional(),
  email:               z.string().email().optional(),
  address:             z.string().max(200).optional(),
  insurance_name:      z.string().max(100).optional(),
  insurance_plan:      z.string().max(50).optional(),
  insurance_number:    z.string().max(50).optional(),
  allergies:           z.string().max(500).optional(),
  current_medications: z.string().max(500).optional(),
  medical_notes:       z.string().max(1000).optional(),
  referral_source:     z.string().max(100).optional(),
})

const UpdatePatientSchema = CreatePatientSchema.partial()

const QuerySchema = z.object({
  q:       z.string().optional(),        // full-text search
  limit:   z.coerce.number().min(1).max(100).default(20),
  offset:  z.coerce.number().min(0).default(0),
  inactive: z.coerce.boolean().optional(), // filter inactive patients
})

// ── Route handlers ────────────────────────────

export async function patientsRoutes(app: FastifyInstance) {

  // All patient routes require authentication
  app.addHook('onRequest', (app as any).authenticate)

  // ── GET /patients ──────────────────────────
  app.get('/', async (request, reply) => {
    const { q, limit, offset, inactive } = QuerySchema.parse(request.query)
    const clinicId = (request as any).clinicId as string

    const db = supabaseForUser(request.headers.authorization)

    if (q && q.length >= 2) {
      // Full-text search via DB function
      const { data, error } = await db.rpc('search_patients', {
        p_clinic_id: clinicId,
        p_query:     q,
        p_limit:     limit,
        p_offset:    offset
      })
      if (error) return reply.code(500).send({ error: error.message })
      return { data, meta: { limit, offset, q } }
    }

    // Standard list
    let query = db
      .from('patients')
      .select('id, first_name, last_name, phone, email, insurance_name, last_appointment_at, is_active, created_at')
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)
      .order('last_name', { ascending: true })
      .range(offset, offset + limit - 1)

    if (inactive !== undefined) {
      query = query.eq('is_active', !inactive)
    }

    const { data, error, count } = await query
    if (error) return reply.code(500).send({ error: error.message })
    return { data, meta: { limit, offset, total: count } }
  })

  // ── GET /patients/:id ──────────────────────
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = supabaseForUser(request.headers.authorization)

    const { data, error } = await db
      .from('patients')
      .select(`
        *,
        appointments(id, starts_at, status, appointment_type, professional_id),
        treatments(id, name, status, sessions_planned, sessions_done, total_quoted, total_paid),
        odontogram(tooth_number, condition, notes)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error?.code === 'PGRST116') return reply.code(404).send({ error: 'Patient not found' })
    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

  // ── POST /patients ─────────────────────────
  app.post('/', async (request, reply) => {
    const body    = CreatePatientSchema.parse(request.body)
    const clinicId = (request as any).clinicId as string
    const professionalId = (request as any).professionalId as string
    const db = supabaseForUser(request.headers.authorization)

    const { data, error } = await db
      .from('patients')
      .insert({ ...body, clinic_id: clinicId, created_by: professionalId })
      .select()
      .single()

    if (error?.code === '23505') {
      return reply.code(409).send({ error: 'Patient with this phone/document already exists' })
    }
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send({ data })
  })

  // ── PATCH /patients/:id ────────────────────
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body   = UpdatePatientSchema.parse(request.body)
    const db = supabaseForUser(request.headers.authorization)

    const { data, error } = await db
      .from('patients')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error?.code === 'PGRST116') return reply.code(404).send({ error: 'Patient not found' })
    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

  // ── DELETE /patients/:id (soft delete) ────
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = supabaseForUser(request.headers.authorization)

    const { error } = await db
      .from('patients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })

  // ── GET /patients/:id/balance ──────────────
  app.get('/:id/balance', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = supabaseForUser(request.headers.authorization)

    const { data, error } = await db
      .from('v_patient_balance')
      .select('*')
      .eq('patient_id', id)
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

  // ── GET /patients/inactive ──────────────────
  // Patients with no appointment in X days (for alert system)
  app.get('/alerts/inactive', async (request, reply) => {
    const { days = 90 } = request.query as { days?: number }
    const clinicId = (request as any).clinicId as string
    const db = supabaseForUser(request.headers.authorization)

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - Number(days))

    const { data, error } = await db
      .from('patients')
      .select('id, first_name, last_name, phone, email, last_appointment_at')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .lt('last_appointment_at', cutoff.toISOString())
      .order('last_appointment_at', { ascending: true })
      .limit(50)

    if (error) return reply.code(500).send({ error: error.message })
    return { data, meta: { days, cutoff } }
  })
}
