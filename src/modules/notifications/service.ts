// src/modules/notifications/service.ts
// BullMQ queues + Twilio WhatsApp sender

import { Queue, Worker, type Job } from 'bullmq'
import { supabaseAdmin } from '../../lib/supabase.js'

// ── Redis connection ──────────────────────────

const connection = {
  url: process.env.REDIS_URL!,
  // Upstash requires TLS
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
}

// ── Queues ────────────────────────────────────

export const reminderQueue = new Queue('appointment-reminders', { connection })
export const notificationQueue = new Queue('notifications', { connection })

// ── Schedule reminders when appointment is created ──

export async function scheduleReminders(
  appointmentId: string,
  startsAt:       string,
  patientId:      string,
  clinicId:       string
) {
  const apptTime = new Date(startsAt)
  const now      = new Date()

  // 24h reminder
  const remind24h = new Date(apptTime.getTime() - 24 * 60 * 60 * 1000)
  if (remind24h > now) {
    await reminderQueue.add(
      'reminder-24h',
      { appointmentId, patientId, clinicId, type: 'appointment_reminder_24h' },
      {
        delay: remind24h.getTime() - now.getTime(),
        jobId: `reminder-24h-${appointmentId}`,   // idempotent
        removeOnComplete: true,
        removeOnFail: 10,
      }
    )
  }

  // 2h reminder
  const remind2h = new Date(apptTime.getTime() - 2 * 60 * 60 * 1000)
  if (remind2h > now) {
    await reminderQueue.add(
      'reminder-2h',
      { appointmentId, patientId, clinicId, type: 'appointment_reminder_2h' },
      {
        delay: remind2h.getTime() - now.getTime(),
        jobId: `reminder-2h-${appointmentId}`,
        removeOnComplete: true,
        removeOnFail: 10,
      }
    )
  }
}

// ── Reminder templates ────────────────────────

const TEMPLATES = {
  appointment_reminder_24h: (vars: Record<string, string>) =>
    `Hola ${vars.patient_name} 👋 Te recordamos que mañana tenés turno con el Dr/a ${vars.professional_name} a las ${vars.time_str} en ${vars.clinic_name}.\n\nResponde *1* para confirmar o *2* para cancelar.`,

  appointment_reminder_2h: (vars: Record<string, string>) =>
    `${vars.patient_name}, tu turno en ${vars.clinic_name} es en 2 horas (${vars.time_str}). ¡Te esperamos! 🦷`,

  appointment_confirmation: (vars: Record<string, string>) =>
    `✅ Turno confirmado, ${vars.patient_name}. Te esperamos el ${vars.date_str} a las ${vars.time_str} en ${vars.clinic_name}.`,

  payment_receipt: (vars: Record<string, string>) =>
    `✅ ${vars.clinic_name}: Recibo N° ${vars.receipt_number}. Monto: $${vars.amount}. Gracias por tu pago, ${vars.patient_name}.`,
} as const

// ── Worker: processes notification jobs ───────

export function startNotificationWorker() {
  const worker = new Worker(
    'appointment-reminders',
    async (job: Job) => {
      const { appointmentId, patientId, clinicId, type } = job.data

      // Fetch appointment + patient + clinic details
      const { data: appt } = await supabaseAdmin
        .from('appointments')
        .select(`
          starts_at, status,
          patients(first_name, last_name, phone),
          professionals(first_name, last_name),
          clinics(name)
        `)
        .eq('id', appointmentId)
        .single()

      if (!appt || appt.status === 'cancelled') {
        console.log(`[Notif] Skipping ${type} for ${appointmentId} — cancelled`)
        return
      }

      const patient     = appt.patients as any
      const professional = appt.professionals as any
      const clinic      = appt.clinics as any

      const startsAt = new Date(appt.starts_at)
      const timeStr  = startsAt.toLocaleTimeString('es-AR', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires'
      })
      const dateStr = startsAt.toLocaleDateString('es-AR', {
        weekday: 'long', day: 'numeric', month: 'long',
        timeZone: 'America/Argentina/Buenos_Aires'
      })

      const vars = {
        patient_name:      `${patient.first_name} ${patient.last_name}`,
        professional_name: `${professional.first_name} ${professional.last_name}`,
        clinic_name:       clinic.name,
        time_str:          timeStr,
        date_str:          dateStr,
      }

      const body = TEMPLATES[type as keyof typeof TEMPLATES]?.(vars)
      if (!body) throw new Error(`Unknown template: ${type}`)

      // Send via Twilio WhatsApp
      await sendWhatsApp(patient.phone, body)

      // Update notification record in DB
      await supabaseAdmin
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('appointment_id', appointmentId)
        .eq('type', type)

      // Mark reminder as sent in appointment
      const field = type === 'appointment_reminder_24h'
        ? 'reminder_sent_24h' : 'reminder_sent_2h'
      await supabaseAdmin
        .from('appointments')
        .update({ [field]: true, reminder_sent_at: new Date().toISOString() })
        .eq('id', appointmentId)

      console.log(`[Notif] ✅ ${type} sent to ${patient.phone}`)
    },
    {
      connection,
      concurrency: 5,
      // Retry 3 times with exponential backoff
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 }
      }
    }
  )

  worker.on('failed', (job, err) => {
    console.error(`[Notif] ❌ Job ${job?.id} failed:`, err.message)
  })

  console.log('🔔 Notification worker started')
  return worker
}

// ── Twilio sender ─────────────────────────────

async function sendWhatsApp(toPhone: string, body: string): Promise<void> {
  if (!process.env.TWILIO_ACCOUNT_SID) {
    console.log(`[Twilio DEV] Would send to ${toPhone}: ${body.slice(0, 60)}…`)
    return
  }

  const twilio = (await import('twilio')).default
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  )

  // Normalize phone: ensure +549 format for Argentina
  const normalized = toPhone.startsWith('+') ? toPhone : `+54${toPhone}`

  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM!,
    to:   `whatsapp:${normalized}`,
    body,
  })
}
