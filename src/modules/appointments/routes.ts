// src/modules/appointments/routes.ts
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseForUser } from '../../lib/supabase.js'
import { scheduleReminders } from '../notifications/service.js'

// ── Schemas ───────────────────────────────────

const CreateAppointmentSchema = z.object({
  patient_id: z.string().uuid(),
  professional_id: z.string().uuid(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }).optional(),
  duration_minutes: z.number().int().min(15).max(240).default(45),
  appointment_type: z.string().max(100).optional(),
  chief_complaint: z.string().max(500).optional(),
  internal_notes: z.string().max(500).optional(),
  treatment_id: z.string().uuid().optional(),
  treatment_session: z.number().int().min(1).optional(),
})

const UpdateAppointmentSchema = z.object({
  starts_at: z.string().datetime({ offset: true }).optional(),
  ends_at: z.string().datetime({ offset: true }).optional(),
  status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'absent', 'cancelled']).optional(),
  clinical_notes: z.string().max(2000).optional(),
  appointment_type: z.string().max(100).optional(),
  cancelled_reason: z.string().max(500).optional(),
})

const CalendarQuerySchema = z.object({
  from: z.string().date(),             // YYYY-MM-DD
  to: z.string().date(),
  professional_id: z.string().uuid().optional(),
})

async function sendImmediateReminder(
  appointmentId: string,
  startsAt: string,
  patientId: string,
  token: string
) {
  const { supabaseAdmin } = await import('../../lib/supabase.js')

  const { data: appt } = await supabaseAdmin
    .from('appointments')
    .select(`
      starts_at,
      patients(first_name, last_name, phone),
      professionals(first_name, last_name),
      clinics(name)
    `)
    .eq('id', appointmentId)
    .single()

  if (!appt) return

  const patient = appt.patients as any
  const professional = appt.professionals as any
  const clinic = appt.clinics as any

  const startsAtDate = new Date(appt.starts_at)
  const dateStr = startsAtDate.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
    timeZone: 'America/Argentina/Buenos_Aires'
  })
  const timeStr = startsAtDate.toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires'
  })

  const message = `Hola ${patient.first_name} 👋 Te confirmamos tu turno en *${clinic.name}* con el/la Dr/a *${professional.last_name}* el *${dateStr}* a las *${timeStr}*. ¡Te esperamos! 🦷`

  // Normalizar teléfono argentino
  let phone = patient.phone.replace(/\D/g, '')
  if (phone.startsWith('0')) phone = phone.slice(1)
  if (!phone.startsWith('54')) phone = `54${phone}`

  if (!process.env.TWILIO_ACCOUNT_SID) {
    console.log(`[Twilio DEV] Would send to ${phone}: ${message}`)
    return
  }

  const twilio = (await import('twilio')).default
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM!,
    to: `whatsapp:+${phone}`,
    body: message,
  })

  console.log(`[Twilio] ✅ Confirmación enviada a +${phone}`)
}

// ── Routes ────────────────────────────────────

export async function appointmentsRoutes(app: FastifyInstance) {

  app.addHook('onRequest', (app as any).authenticate)

  // ── GET /appointments?from=&to= ───────────
  // Weekly/daily calendar view
  app.get('/', async (request, reply) => {
    const { from, to, professional_id } = CalendarQuerySchema.parse(request.query)
    const clinicId = (request as any).clinicId as string
    const db = supabaseForUser(request.headers.authorization)

    let query = db
      .from('v_daily_agenda')
      .select('*')
      .eq('clinic_id', clinicId)
      .gte('starts_at', `${from}T00:00:00+00:00`)
      .lte('starts_at', `${to}T23:59:59+00:00`)
      .order('starts_at', { ascending: true })

    if (professional_id) {
      query = query.eq('professional_id', professional_id)
    }

    const { data, error } = await query
    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

  // ── GET /appointments/today ────────────────
  app.get('/today', async (request, reply) => {
    const clinicId = (request as any).clinicId as string
    const db = supabaseForUser(request.headers.authorization)
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await db
      .from('v_daily_agenda')
      .select('*')
      .eq('clinic_id', clinicId)
      .gte('starts_at', `${today}T00:00:00+00:00`)
      .lte('starts_at', `${today}T23:59:59+00:00`)
      .order('starts_at', { ascending: true })

    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

  // ── POST /appointments ─────────────────────
  app.post('/', async (request, reply) => {
    const body = CreateAppointmentSchema.parse(request.body)
    const clinicId = (request as any).clinicId as string
    const createdBy = (request as any).professionalId as string
    const db = supabaseForUser(request.headers.authorization)

    // Calculate ends_at if not provided
    const startsAt = new Date(body.starts_at)
    const endsAt = body.ends_at
      ? new Date(body.ends_at)
      : new Date(startsAt.getTime() + body.duration_minutes * 60000)

    // Check availability
    const { data: available } = await db.rpc('check_professional_availability', {
      p_professional_id: body.professional_id,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
    })

    if (!available) {
      return reply.code(409).send({ error: 'Professional has an overlapping appointment at that time' })
    }

    const { duration_minutes: _, ...bodyWithoutDuration } = body

    const { data, error } = await db
      .from('appointments')
      .insert({
        ...bodyWithoutDuration,
        clinic_id: clinicId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })

    // Schedule WhatsApp/SMS reminders asynchronously
    // Envío directo sin cola
    sendImmediateReminder(data.id, data.starts_at, data.patient_id, token).catch(console.error)

    return reply.code(201).send({ data })
  })

  // ── PATCH /appointments/:id ────────────────
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = UpdateAppointmentSchema.parse(request.body)
    const db = supabaseForUser(request.headers.authorization)

    const updateData: Record<string, unknown> = { ...body }

    // Auto-set cancelled_at when status is cancelled
    if (body.status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString()
      updateData.cancelled_by = (request as any).professionalId
    }

    const { data, error } = await db
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error?.code === 'PGRST116') return reply.code(404).send({ error: 'Appointment not found' })
    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

  // ── POST /appointments/:id/complete ───────
  // Marks appointment as done, accepts clinical notes
  app.post('/:id/complete', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { clinical_notes } = z.object({
      clinical_notes: z.string().max(5000).optional()
    }).parse(request.body)
    const db = supabaseForUser(request.headers.authorization)

    const { data, error } = await db
      .from('appointments')
      .update({ status: 'completed', clinical_notes })
      .eq('id', id)
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

  // ── GET /appointments/stats/summary ───────
  // Dashboard stats: today's income, absences, etc.
  app.get('/stats/today', async (request, reply) => {
    const clinicId = (request as any).clinicId as string
    const db = supabaseForUser(request.headers.authorization)
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await db
      .from('appointments')
      .select('status')
      .eq('clinic_id', clinicId)
      .gte('starts_at', `${today}T00:00:00+00:00`)
      .lte('starts_at', `${today}T23:59:59+00:00`)

    if (error) return reply.code(500).send({ error: error.message })

    const stats = (data ?? []).reduce((acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1
      acc.total++
      return acc
    }, { total: 0 } as Record<string, number>)

    return { data: stats }
  })

  // ── GET /appointments/:id ──────────────────
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = supabaseForUser(request.headers.authorization)

    const { data, error } = await db
      .from('appointments')
      .select(`*, patients(first_name, last_name, phone, allergies, insurance_name), professionals(first_name, last_name)`)
      .eq('id', id)
      .single()

    if (error?.code === 'PGRST116') return reply.code(404).send({ error: 'Appointment not found' })
    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

}
