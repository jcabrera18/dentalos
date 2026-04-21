# DentalOS - Documentación Completa

## Descripción del Proyecto

DentalOS es un sistema completo de gestión para clínicas dentales que incluye tanto el frontend (aplicación web) como el backend (API REST). Permite gestionar pacientes, citas, tratamientos, pagos, notificaciones y más, todo en un solo lugar.

## Stack Tecnológico

### Backend (dentalos-api)
- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Fastify 4
- **Base de Datos**: PostgreSQL via Supabase (managed)
- **Autenticación**: Supabase Auth + JWT
- **Colas**: BullMQ + Redis (Upstash)
- **Notificaciones**: Twilio WhatsApp/SMS
- **Despliegue**: Railway

### Frontend (web)
- **Framework**: Next.js 16 (App Router)
- **Lenguaje**: TypeScript
- **UI**: React 19, Tailwind CSS 4
- **Base de Datos**: Supabase (SSR)
- **Analytics**: PostHog
- **Iconos**: Lucide React
- **Gráficos**: Recharts
- **Despliegue**: Vercel

## Estructura del Proyecto

### Raíz (dentalos/)
```
dentalos/
├── supabase/
│   └── migrations/          # Migraciones de base de datos
│       ├── 001_core_schema.sql        # Esquemas base: clínicas, profesionales, RLS
│       ├── 002_patients.sql           # Pacientes + búsqueda de texto completo
│       ├── 003_appointments.sql       # Agenda + vistas
│       ├── 004_treatments.sql         # Tratamientos, sesiones, odontograma
│       ├── 005_payments.sql           # Pagos, presupuestos, vistas de caja
│       ├── 006_notifications_consents_audit.sql
│       └── 007_seed.sql               # Plantillas de consentimiento + función de onboarding
├── web/                     # Frontend Next.js
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── providers.tsx
│   │   ├── booking/[professionalId]/page.tsx
│   │   ├── dashboard/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── agenda/page.tsx
│   │   │   ├── patients/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── appointment/page.tsx
│   │   │   └── payments/page.tsx
│   │   ├── providers/
│   │   │   ├── pageview.tsx
│   │   │   └── posthog.tsx
│   │   └── register/page.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   └── supabase.ts
│   └── public/
├── package.json
├── railway.toml
├── README.md
└── tsconfig.json
```

### Backend (dentalos-api/)
```
dentalos-api/
├── src/
│   ├── server.ts            # Bootstrap de Fastify
│   ├── lib/
│   │   └── supabase.ts      # Cliente de DB (anon + service_role)
│   ├── types/
│   │   └── database.ts      # Tipos TypeScript para todas las tablas
│   └── modules/
│       ├── auth/routes.ts             # Login, registro, /me
│       ├── patients/routes.ts         # CRUD + búsqueda + balance
│       ├── appointments/routes.ts     # Calendario + gestión de estados
│       ├── payments/routes.ts         # Pagos + presupuestos + reporte de caja
│       ├── treatments/routes.ts       # Tratamientos + sesiones + odontograma
│       ├── notifications/
│       │   ├── routes.ts              # Envío manual + recordatorios masivos
│       │   └── service.ts             # Colas BullMQ + envío Twilio
│       ├── expenses/routes.ts
│       ├── integrations/routes.ts
│       ├── booking/routes.ts          # Booking público (sin auth)
│       └── schedule-blocks/routes.ts
├── scripts/
│   └── migrate.js          # Ejecutor de migraciones
├── .env
├── package.json
├── tsconfig.json
└── railway.toml
```

## Funcionalidades Principales

### Gestión de Pacientes
- CRUD completo de pacientes
- Búsqueda de texto completo
- Balance de cuenta por paciente

### Agenda y Citas
- Calendario interactivo
- Gestión de estados de citas
- Bloques de horario

### Tratamientos
- Gestión de tratamientos
- Sesiones de tratamiento
- Odontograma

### Pagos y Finanzas
- Registro de pagos
- Presupuestos
- Reportes de caja
- Gastos

### Notificaciones
- Envío manual de mensajes
- Recordatorios automáticos
- Integración con Twilio (WhatsApp/SMS)

### Autenticación y Autorización
- Autenticación via Supabase Auth
- JWT con verificación JWKS
- Roles y permisos por clínica

### Booking Público
- Reserva de citas sin autenticación
- Integración con frontend

## Cómo Ejecutar el Proyecto

### Backend (dentalos-api)
1. Instalar dependencias: `npm install`
2. Configurar variables de entorno (copiar `.env.example` a `.env`)
3. Ejecutar migraciones: `npm run migrate`
4. Ejecutar en desarrollo: `npm run dev`
5. Ejecutar tests: `npm test`

### Frontend (web)
1. Instalar dependencias: `npm install`
2. Configurar variables de entorno
3. Ejecutar en desarrollo: `npm run dev` (puerto 3001)
4. Construir para producción: `npm run build`

### Base de Datos
- Las migraciones se ejecutan via script en el backend
- Usa Supabase para hosting managed de PostgreSQL

## Despliegue
- **Backend**: Railway
- **Frontend**: Vercel
- **Base de Datos**: Supabase

## API Endpoints Principales
- `/auth/*` - Autenticación
- `/patients/*` - Gestión de pacientes
- `/appointments/*` - Agenda y citas
- `/payments/*` - Pagos y finanzas
- `/treatments/*` - Tratamientos
- `/notifications/*` - Notificaciones
- `/public/booking/*` - Booking público

## Seguridad
- Rate limiting global (200 req/min por IP)
- CORS configurado
- Helmet para headers de seguridad
- Autenticación JWT con Supabase
- RLS (Row Level Security) en base de datos

## Desarrollo
- TypeScript en todo el proyecto
- ESLint para linting
- Vitest para tests
- Pino para logging
- Swagger UI para documentación de API en desarrollo (`/docs`)

## Variables de Entorno
### Backend
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET` (dummy, usa JWKS)
- `REDIS_URL`
- `TWILIO_*` (para notificaciones)
- `ALLOWED_ORIGINS`
- `PORT`

### Frontend
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_API_URL`

## Notas Adicionales
- El proyecto usa Railway para despliegue del backend y Vercel para el frontend.
- Supabase maneja la base de datos y autenticación.
- Integración con PostHog para analytics.
- Soporte para WhatsApp/SMS via Twilio.
- Arquitectura modular con Fastify para el backend.</content>
<parameter name="filePath">/Users/juanignaciocabrera/Documents/GitHub/dentalos/claude.md