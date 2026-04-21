// src/modules/booking/routes.ts
// Public booking routes — no authentication required
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseAdmin } from '../../lib/supabase.js'

const SLOT_DURATION = 30 // minutes (fixed)
const MAX_DAYS_AHEAD = 90

// Default working hours per weekday (0=Sun closed)
const WORK_HOURS: Record<number, { start: number; end: number } | null> = {
  0: null,                    // Sunday: closed
  1: { start: 8, end: 20 },  // Monday
  2: { start: 8, end: 20 },  // Tuesday
  3: { start: 8, end: 20 },  // Wednesday
  4: { start: 8, end: 20 },  // Thursday
  5: { start: 8, end: 20 },  // Friday
  6: { start: 8, end: 20 },  // Saturday
}

function generateSlots(date: string, hours: { start: number; end: number }): string[] {
  const slots: string[] = []
  let current = hours.start * 60
  const end = hours.end * 60

  while (current + SLOT_DURATION <= end) {
    const hh = String(Math.floor(current / 60)).padStart(2, '0')
    const mm = String(current % 60).padStart(2, '0')
    slots.push(`${date}T${hh}:${mm}:00-03:00`)
    current += SLOT_DURATION
  }

  return slots
}

const APPOINTMENT_TYPES = [
  'Consulta', 'Limpieza', 'Endodoncia', 'Exodoncia',
  'Ortodoncia', 'Implante', 'Operatoria', 'Prótesis',
  'Blanqueamiento', 'Urgencia', 'Control', 'Armonización facial', 'Otro'
]

export async function bookingRoutes(app: FastifyInstance) {

  // ── GET /public/booking/:professionalId ───────────────
  // Returns professional + clinic info for the booking page header
  app.get('/:professionalId', async (request, reply) => {
    const { professionalId } = request.params as { professionalId: string }

    const { data, error } = await supabaseAdmin
      .from('professionals')
      .select('id, first_name, last_name, specialty, color, clinic_id, clinics(name)')
      .eq('id', professionalId)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      return reply.code(404).send({ error: 'Profesional no encontrado' })
    }

    return { data }
  })

  // ── GET /public/booking/:professionalId/slots?date=YYYY-MM-DD ───
  // Returns available 30-min slots for a given date
  app.get('/:professionalId/slots', async (request, reply) => {
    const { professionalId } = request.params as { professionalId: string }

    const { date } = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    }).parse(request.query)

    // Validate date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(`${date}T00:00:00`)
    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + MAX_DAYS_AHEAD)

    if (target < today || target > maxDate) {
      return reply.code(400).send({ error: 'Fecha fuera de rango' })
    }

    // Check working hours for that day of week
    const dow = target.getDay()
    const hours = WORK_HOURS[dow]
    if (!hours) {
      return { data: [] }
    }

    // Fetch existing (non-cancelled) appointments for that day
    const { data: existing } = await supabaseAdmin
      .from('appointments')
      .select('starts_at, ends_at')
      .eq('professional_id', professionalId)
      .neq('status', 'cancelled')
      .gte('starts_at', `${date}T00:00:00-03:00`)
      .lte('starts_at', `${date}T23:59:59-03:00`)

    const booked = existing ?? []
    const now = new Date()

    const available = generateSlots(date, hours).filter(slot => {
      const slotStart = new Date(slot)
      const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION * 60_000)

      if (slotStart <= now) return false

      return !booked.some(b => {
        const bStart = new Date(b.starts_at)
        const bEnd = new Date(b.ends_at)
        return slotStart < bEnd && slotEnd > bStart
      })
    })

    return { data: available }
  })

  // ── POST /public/booking/:professionalId ──────────────
  // Creates a booking: matches or creates patient, then creates appointment
  app.post('/:professionalId', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    const { professionalId } = request.params as { professionalId: string }

    const body = z.object({
      first_name:       z.string().min(1).max(100).trim(),
      last_name:        z.string().min(1).max(100).trim(),
      phone:            z.string().min(6).max(30).trim(),
      email:            z.string().email().optional().or(z.literal('')),
      appointment_type: z.enum(APPOINTMENT_TYPES as [string, ...string[]]),
      starts_at:        z.string().datetime({ offset: true }),
      chief_complaint:  z.string().max(500).trim().optional(),
    }).parse(request.body)

    // Get professional + clinic
    const { data: professional, error: profError } = await supabaseAdmin
      .from('professionals')
      .select('id, clinic_id')
      .eq('id', professionalId)
      .eq('is_active', true)
      .single()

    if (profError || !professional) {
      return reply.code(404).send({ error: 'Profesional no encontrado' })
    }

    const clinicId = professional.clinic_id

    // Try to match existing patient by phone, then by email
    let patientId: string | null = null

    try {
      if (body.phone) {
        const { data: byPhone } = await supabaseAdmin
          .from('patients')
          .select('id')
          .eq('clinic_id', clinicId)
          .eq('phone', body.phone)
          .is('deleted_at', null)
          .limit(1)
          .single()

        if (byPhone) patientId = byPhone.id
      }

      if (!patientId && body.email) {
        const { data: byEmail } = await supabaseAdmin
          .from('patients')
          .select('id')
          .eq('clinic_id', clinicId)
          .eq('email', body.email)
          .is('deleted_at', null)
          .limit(1)
          .single()

        if (byEmail) patientId = byEmail.id
      }
    } catch {
      // Matching errors are non-blocking — will create a new patient below
    }

    // Create new patient if no match found
    if (!patientId) {
      const { data: newPatient, error: patientErr } = await supabaseAdmin
        .from('patients')
        .insert({
          clinic_id:  clinicId,
          first_name: body.first_name,
          last_name:  body.last_name,
          phone:      body.phone,
          email:      body.email || null,
        })
        .select('id')
        .single()

      if (patientErr || !newPatient) {
        return reply.code(500).send({ error: 'Error al registrar los datos del paciente' })
      }

      patientId = newPatient.id
    }

    // Check slot availability
    const startsAt = new Date(body.starts_at)
    const endsAt   = new Date(startsAt.getTime() + SLOT_DURATION * 60_000)

    const { data: available } = await supabaseAdmin.rpc('check_professional_availability', {
      p_professional_id: professionalId,
      p_starts_at:       startsAt.toISOString(),
      p_ends_at:         endsAt.toISOString(),
    })

    if (!available) {
      return reply.code(409).send({ error: 'El turno ya no está disponible. Por favor elegí otro horario.' })
    }

    // Create appointment as pending
    const { data: appointment, error: apptErr } = await supabaseAdmin
      .from('appointments')
      .insert({
        clinic_id:        clinicId,
        patient_id:       patientId,
        professional_id:  professionalId,
        starts_at:        startsAt.toISOString(),
        ends_at:          endsAt.toISOString(),
        appointment_type: body.appointment_type,
        chief_complaint:  body.chief_complaint || null,
        status:           'confirmed',
      })
      .select('id, starts_at, ends_at, appointment_type, status')
      .single()

    if (apptErr || !appointment) {
      return reply.code(500).send({ error: 'Error al reservar el turno' })
    }

    return reply.code(201).send({ data: appointment })
  })
}
