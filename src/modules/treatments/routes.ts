// src/modules/treatments/routes.ts
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseForUser } from '../../lib/supabase.js'

const CreateTreatmentSchema = z.object({
  patient_id:          z.string().uuid(),
  name:                z.string().min(1).max(200),
  description:         z.string().max(1000).optional(),
  tooth_numbers:       z.array(z.number().int().min(11).max(85)).default([]),
  tooth_surfaces:      z.record(z.array(z.string())).optional(),
  sessions_planned:    z.number().int().min(1).optional(),
  started_at:          z.string().date().optional(),
  estimated_end_date:  z.string().date().optional(),
  total_quoted:        z.number().positive().optional(),
  quote_id:            z.string().uuid().optional(),
})

const AddSessionSchema = z.object({
  appointment_id: z.string().uuid().optional(),
  notes:          z.string().max(2000).optional(),
  next_steps:     z.string().max(500).optional(),
  performed_at:   z.string().datetime({ offset: true }).optional(),
})

const UpdateOdontogramSchema = z.object({
  tooth_number: z.number().int().min(11).max(85),
  condition:    z.enum([
    'healthy','cavity','filled','root_canal','crown',
    'missing','implant','bridge_abutment','extraction_needed','fracture','other'
  ]),
  surfaces:     z.array(z.string()).optional(),
  notes:        z.string().max(500).optional(),
  treatment_id: z.string().uuid().optional(),
})

export async function treatmentsRoutes(app: FastifyInstance) {

  app.addHook('onRequest', (app as any).authenticate)

  // ── GET /treatments?patient_id= ───────────
  app.get('/', async (request, reply) => {
    const { patient_id, status } = request.query as Record<string, string>
    const clinicId = (request as any).clinicId as string
    const db = supabaseForUser(request.headers.authorization)

    let query = db
      .from('treatments')
      .select(`
        *,
        patients(first_name, last_name),
        professionals(first_name, last_name),
        treatment_sessions(id, session_number, performed_at, notes)
      `)
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })

    if (patient_id) query = query.eq('patient_id', patient_id)
    if (status)     query = query.eq('status', status)

    const { data, error } = await query
    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

  // ── GET /treatments/:id ────────────────────
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const db = supabaseForUser(request.headers.authorization)

    const { data, error } = await db
      .from('treatments')
      .select(`
        *,
        patients(first_name, last_name, phone, allergies),
        professionals(first_name, last_name),
        treatment_sessions(*, appointments(starts_at, appointment_type)),
        quotes(quote_number, total, installments, status)
      `)
      .eq('id', id)
      .single()

    if (error?.code === 'PGRST116') return reply.code(404).send({ error: 'Treatment not found' })
    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

  // ── POST /treatments ───────────────────────
  app.post('/', async (request, reply) => {
    const body           = CreateTreatmentSchema.parse(request.body)
    const clinicId       = (request as any).clinicId as string
    const professionalId = (request as any).professionalId as string
    const db = supabaseForUser(request.headers.authorization)

    const { data, error } = await db
      .from('treatments')
      .insert({
        ...body,
        clinic_id:       clinicId,
        professional_id: professionalId,
        status:          'accepted',
        sessions_done:   0,
      })
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send({ data })
  })

  // ── PATCH /treatments/:id ──────────────────
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = z.object({
      status:             z.enum(['quoted','accepted','in_progress','completed','abandoned']).optional(),
      sessions_planned:   z.number().int().optional(),
      estimated_end_date: z.string().date().optional(),
      completed_at:       z.string().date().optional(),
      abandoned_at:       z.string().date().optional(),
      abandon_reason:     z.string().max(500).optional(),
    }).parse(request.body)
    const db = supabaseForUser(request.headers.authorization)

    const { data, error } = await db
      .from('treatments')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

  // ── POST /treatments/:id/sessions ─────────
  // Add a new session (linked to an appointment)
  app.post('/:id/sessions', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body   = AddSessionSchema.parse(request.body)
    const clinicId = (request as any).clinicId as string
    const db = supabaseForUser(request.headers.authorization)

    // Get current session count
    const { data: treatment } = await db
      .from('treatments')
      .select('sessions_done, sessions_planned')
      .eq('id', id)
      .single()

    if (!treatment) return reply.code(404).send({ error: 'Treatment not found' })

    const { data, error } = await db
      .from('treatment_sessions')
      .insert({
        clinic_id:      clinicId,
        treatment_id:   id,
        appointment_id: body.appointment_id,
        session_number: (treatment.sessions_done ?? 0) + 1,
        notes:          body.notes,
        next_steps:     body.next_steps,
        performed_at:   body.performed_at ?? new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })

    // Auto-complete treatment if all sessions done
    if (
      treatment.sessions_planned &&
      (treatment.sessions_done ?? 0) + 1 >= treatment.sessions_planned
    ) {
      await db
        .from('treatments')
        .update({ status: 'completed', completed_at: new Date().toISOString().split('T')[0] })
        .eq('id', id)
    }

    return reply.code(201).send({ data })
  })

  // ── GET /treatments/odontogram/:patient_id ──
  app.get('/odontogram/:patient_id', async (request, reply) => {
    const { patient_id } = request.params as { patient_id: string }
    const db = supabaseForUser(request.headers.authorization)

    const { data, error } = await db
      .from('odontogram')
      .select('tooth_number, condition, surfaces, notes, treatment_id, updated_at')
      .eq('patient_id', patient_id)
      .order('tooth_number')

    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

  // ── PUT /treatments/odontogram/:patient_id ──
  // Upsert a single tooth state
  app.put('/odontogram/:patient_id', async (request, reply) => {
    const { patient_id } = request.params as { patient_id: string }
    const body           = UpdateOdontogramSchema.parse(request.body)
    const clinicId       = (request as any).clinicId as string
    const professionalId = (request as any).professionalId as string
    const db = supabaseForUser(request.headers.authorization)

    const { data, error } = await db
      .from('odontogram')
      .upsert({
        clinic_id:    clinicId,
        patient_id,
        recorded_by:  professionalId,
        recorded_at:  new Date().toISOString(),
        ...body,
      }, {
        onConflict: 'patient_id,tooth_number'
      })
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })
}
