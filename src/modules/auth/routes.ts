// src/modules/auth/routes.ts
// Auth flow:
// 1. Frontend calls POST /auth/login → gets Supabase JWT
// 2. Backend verifies JWT on every request
// 3. Custom claims (clinic_id, role) set via Supabase hook

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseAnon, supabaseAdmin } from '../../lib/supabase.js'

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
})

const RegisterClinicSchema = z.object({
  // Clinic info
  clinic_name:    z.string().min(2).max(100),
  clinic_address: z.string().optional(),
  clinic_phone:   z.string().optional(),
  timezone:       z.string().default('America/Argentina/Buenos_Aires'),
  // Owner info
  email:          z.string().email(),
  password:       z.string().min(8),
  first_name:     z.string().min(1),
  last_name:      z.string().min(1),
  license_number: z.string().optional(),
})

export async function authRoutes(app: FastifyInstance) {

  // ── POST /auth/login ───────────────────────
  app.post('/login', async (request, reply) => {
    const { email, password } = LoginSchema.parse(request.body)

    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email, password
    })

    if (error) return reply.code(401).send({ error: error.message })

    return {
      access_token:  data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      expires_at:    data.session?.expires_at,
      user: {
        id:    data.user?.id,
        email: data.user?.email,
        // Custom claims injected by Supabase hook
        ...data.user?.user_metadata,
      }
    }
  })

  // ── POST /auth/refresh ─────────────────────
  app.post('/refresh', async (request, reply) => {
    const { refresh_token } = z.object({
      refresh_token: z.string()
    }).parse(request.body)

    const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token })
    if (error) return reply.code(401).send({ error: error.message })

    return {
      access_token:  data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      expires_at:    data.session?.expires_at,
    }
  })

  // ── POST /auth/register ────────────────────
  // Creates clinic + owner professional in one transaction
  app.post('/register', async (request, reply) => {
    const body = RegisterClinicSchema.parse(request.body)

    // 1. Create Supabase auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email:             body.email,
      password:          body.password,
      email_confirm:     true,         // skip email confirmation in dev
      user_metadata: {
        first_name: body.first_name,
        last_name:  body.last_name,
      }
    })

    if (authError) return reply.code(400).send({ error: authError.message })

    // 2. Create clinic
    const slug = body.clinic_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      + '-' + Date.now().toString(36)

    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .insert({
        name:     body.clinic_name,
        slug,
        address:  body.clinic_address,
        phone:    body.clinic_phone,
        timezone: body.timezone,
      })
      .select()
      .single()

    if (clinicError) {
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return reply.code(500).send({ error: clinicError.message })
    }

    // 3. Create professional (owner)
    const { data: professional, error: profError } = await supabaseAdmin
      .from('professionals')
      .insert({
        clinic_id:      clinic.id,
        auth_user_id:   authData.user.id,
        first_name:     body.first_name,
        last_name:      body.last_name,
        email:          body.email,
        role:           'owner',
        license_number: body.license_number,
      })
      .select()
      .single()

    if (profError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return reply.code(500).send({ error: profError.message })
    }

    // 4. Update auth user metadata with clinic_id + role
    // This gets embedded in the JWT as custom claims
    await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
      user_metadata: {
        clinic_id:       clinic.id,
        professional_id: professional.id,
        role:            'owner',
        first_name:      body.first_name,
        last_name:       body.last_name,
      }
    })

    // 5. Run onboarding (copy default consent templates)
    await supabaseAdmin.rpc('onboard_clinic', {
      p_clinic_id:      clinic.id,
      p_professional_id: professional.id,
    })

    return reply.code(201).send({
      message: 'Clinic registered successfully',
      clinic:  { id: clinic.id, name: clinic.name, slug: clinic.slug },
      professional: { id: professional.id, email: body.email }
    })
  })

  // ── GET /auth/me ───────────────────────────
  app.get('/me', {
    onRequest: [(app as any).authenticate]
  }, async (request, reply) => {
    const professionalId = (request as any).professionalId as string
    const clinicId = (request as any).clinicId as string

    const { data, error } = await supabaseAdmin
      .from('professionals')
      .select('*, clinics(id, name, slug, plan, settings)')
      .eq('id', professionalId)
      .eq('clinic_id', clinicId)
      .single()

    if (error) return reply.code(404).send({ error: 'Professional not found' })
    return { data }
  })
}
