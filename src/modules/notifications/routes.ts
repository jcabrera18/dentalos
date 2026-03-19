// src/modules/notifications/routes.ts
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseForUser, supabaseAdmin } from '../../lib/supabase.js'
import { notificationQueue } from './service.js'

export async function notificationsRoutes(app: FastifyInstance) {

  app.addHook('onRequest', (app as any).authenticate)

  // ── GET /notifications ─────────────────────
  // Recent notification history for the clinic
  app.get('/', async (request, reply) => {
    const { limit = 50, status } = request.query as Record<string, string>
    const clinicId = (request as any).clinicId as string
    const db = supabaseForUser(request.headers.authorization)

    let query = db
      .from('notifications')
      .select('*, patients(first_name, last_name, phone)')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(Number(limit))

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

  // ── POST /notifications/send ───────────────
  // Manual send (e.g. custom message or reminder burst)
  app.post('/send', async (request, reply) => {
    const body = z.object({
      patient_id: z.string().uuid(),
      channel:    z.enum(['whatsapp', 'sms', 'email']).default('whatsapp'),
      message:    z.string().min(1).max(1600),
      type:       z.literal('custom').default('custom'),
    }).parse(request.body)

    const clinicId = (request as any).clinicId as string
    const db = supabaseForUser(request.headers.authorization)

    // Get patient contact
    const { data: patient } = await db
      .from('patients')
      .select('first_name, last_name, phone, email')
      .eq('id', body.patient_id)
      .single()

    if (!patient) return reply.code(404).send({ error: 'Patient not found' })

    // Insert notification record
    const { data: notif, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        clinic_id:     clinicId,
        patient_id:    body.patient_id,
        type:          'custom',
        channel:       body.channel,
        status:        'queued',
        to_phone:      patient.phone,
        to_email:      patient.email,
        rendered_body: body.message,
        scheduled_for: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })

    // Enqueue for immediate delivery
    await notificationQueue.add('send-custom', {
      notificationId: notif.id,
      channel:        body.channel,
      to:             body.channel === 'email' ? patient.email : patient.phone,
      body:           body.message,
    }, { priority: 1 })

    return reply.code(202).send({ data: notif, message: 'Notification queued' })
  })

  // ── POST /notifications/reminders/bulk ────
  // Send reminders for all tomorrow's appointments (manual trigger)
  app.post('/reminders/bulk', async (request, reply) => {
    const clinicId = (request as any).clinicId as string
    const db = supabaseForUser(request.headers.authorization)

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const date = tomorrow.toISOString().split('T')[0]

    const { data: appointments, error } = await db
      .from('appointments')
      .select('id, starts_at, patient_id, reminder_sent_24h')
      .eq('clinic_id', clinicId)
      .in('status', ['pending', 'confirmed'])
      .gte('starts_at', `${date}T00:00:00+00:00`)
      .lte('starts_at', `${date}T23:59:59+00:00`)
      .eq('reminder_sent_24h', false)

    if (error) return reply.code(500).send({ error: error.message })

    let queued = 0
    for (const appt of appointments ?? []) {
      await notificationQueue.add('reminder-24h', {
        appointmentId: appt.id,
        patientId:     appt.patient_id,
        clinicId,
        type:          'appointment_reminder_24h',
      }, { priority: 2 })
      queued++
    }

    return { data: { queued, date } }
  })
}
