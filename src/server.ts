// src/server.ts
import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

import { patientsRoutes }     from './modules/patients/routes.js'
import { appointmentsRoutes } from './modules/appointments/routes.js'
import { paymentsRoutes }     from './modules/payments/routes.js'
import { treatmentsRoutes }   from './modules/treatments/routes.js'
import { notificationsRoutes } from './modules/notifications/routes.js'
import { authRoutes }         from './modules/auth/routes.js'

import jwksRsa from 'jwks-rsa'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined
  },
  // Trust Railway/Vercel proxy for correct IP
  trustProxy: true
})

// ── Security ──────────────────────────────────

await app.register(helmet, {
  contentSecurityPolicy: false // API-only, no HTML
})

await app.register(cors, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3001'],
  credentials: true
})

await app.register(rateLimit, {
  global: true,
  max: 200,           // 200 req/min per IP (global)
  timeWindow: '1 minute',
  // Stricter limit for auth routes (set per-route)
})

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
)

await app.register(jwt, {
  secret: 'dummy-not-used',
})

// ── Docs (only in dev) ────────────────────────

if (process.env.NODE_ENV !== 'production') {
  await app.register(swagger, {
    openapi: {
      info: { title: 'DentalOS API', version: '1.0.0', description: 'REST API para gestión dental' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
        }
      },
      security: [{ bearerAuth: [] }]
    }
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })
}

// ── Auth decorator ────────────────────────────

// Adds request.user after verifying Supabase JWT
app.decorate('authenticate', async (request: any, reply: any) => {
  try {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing authorization header' })
    }

    const token = authHeader.replace('Bearer ', '')
    const { payload } = await jwtVerify(token, JWKS)

    const user = payload as any
    const clinic_id        = user.user_metadata?.clinic_id       ?? user.clinic_id
    const professional_id  = user.user_metadata?.professional_id ?? user.sub
    const role             = user.user_metadata?.role            ?? user.role

    if (!clinic_id) {
      return reply.code(401).send({ error: 'Token missing clinic_id claim' })
    }

    request.clinicId       = clinic_id
    request.professionalId = professional_id
    request.userRole       = role
    request.user           = payload
  } catch (err: any) {
    console.error('JWT ERROR:', err.message)
    reply.code(401).send({ error: 'Invalid or expired token' })
  }
})

// ── Routes ────────────────────────────────────

await app.register(authRoutes,          { prefix: '/auth' })
await app.register(patientsRoutes,      { prefix: '/patients' })
await app.register(appointmentsRoutes,  { prefix: '/appointments' })
await app.register(paymentsRoutes,      { prefix: '/payments' })
await app.register(treatmentsRoutes,    { prefix: '/treatments' })
await app.register(notificationsRoutes, { prefix: '/notifications' })

// ── Health check ──────────────────────────────

app.get('/health', async () => ({
  status: 'ok',
  ts: new Date().toISOString(),
  env: process.env.NODE_ENV
}))

// ── Global error handler ──────────────────────

app.setErrorHandler((error, _req, reply) => {
  const code = error.statusCode ?? 500
  app.log.error(error)
  reply.code(code).send({
    error:   error.message ?? 'Internal server error',
    code:    error.code,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  })
})

// ── Boot ──────────────────────────────────────

const PORT = Number(process.env.PORT) || 3000

try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`🦷 DentalOS API running on http://localhost:${PORT}`)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📚 Swagger docs → http://localhost:${PORT}/docs`)
  }
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

export default app
