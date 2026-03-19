# DentalOS — Backend & Database Setup Guide

## Stack
- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Fastify 4
- **Database**: PostgreSQL via Supabase (managed)
- **Auth**: Supabase Auth + JWT
- **Queue**: BullMQ + Redis (Upstash)
- **Notifications**: Twilio WhatsApp/SMS
- **Deploy**: Railway (backend) + Vercel (frontend)

---

## Project Structure

```
dentalos/
├── supabase/
│   └── migrations/
│       ├── 001_core_schema.sql        # Clinics, Professionals, RLS
│       ├── 002_patients.sql           # Patients + full-text search
│       ├── 003_appointments.sql       # Agenda + views
│       ├── 004_treatments.sql         # Treatments, Sessions, Odontogram
│       ├── 005_payments.sql           # Payments, Quotes, Cash views
│       ├── 006_notifications_consents_audit.sql
│       └── 007_seed.sql               # Consent templates + onboarding fn
├── src/
│   ├── server.ts                      # Fastify bootstrap
│   ├── lib/
│   │   └── supabase.ts                # DB client (anon + service_role)
│   ├── types/
│   │   └── database.ts                # TypeScript types for all tables
│   └── modules/
│       ├── auth/routes.ts             # Login, register, /me
│       ├── patients/routes.ts         # CRUD + search + balance
│       ├── appointments/routes.ts     # Calendar + status management
│       ├── payments/routes.ts         # Payments + quotes + cash report
│       ├── treatments/routes.ts       # Treatments + sessions + odontogram
│       └── notifications/
│           ├── routes.ts              # Manual send + bulk reminders
│           └── service.ts             # BullMQ queues + Twilio sender
├── scripts/
│   └── migrate.js                     # Migration runner
├── .env.example
├── package.json
├── tsconfig.json
└── railway.toml
```

---

## Step 1 — Supabase setup (15 min)

### 1.1 Create project
1. Ir a [supabase.com](https://supabase.com) → New project
2. Elegir región: **South America (São Paulo)** para menor latencia
3. Guardar la contraseña de DB

### 1.2 Get credentials
En **Settings → API**:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← SECRETO, nunca al cliente
```

En **Settings → Database → Connection string**:
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

En **Settings → API → JWT Secret**:
```
JWT_SECRET=tu-jwt-secret
```

### 1.3 Configure custom JWT claims
Para que `clinic_id` y `role` estén disponibles en el JWT, crear un hook en Supabase:

**Authentication → Hooks → Custom Access Token Hook**:

```sql
-- Pegar en el SQL Editor de Supabase primero:
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  v_user_id   UUID := (event->>'user_id')::uuid;
  v_prof      RECORD;
  v_claims    jsonb;
BEGIN
  v_claims := event->'claims';

  -- Get professional data for this auth user
  SELECT p.id, p.clinic_id, p.role
  INTO v_prof
  FROM professionals p
  WHERE p.auth_user_id = v_user_id
  LIMIT 1;

  IF v_prof IS NOT NULL THEN
    v_claims := jsonb_set(v_claims, '{clinic_id}',       to_jsonb(v_prof.clinic_id::text));
    v_claims := jsonb_set(v_claims, '{professional_id}', to_jsonb(v_prof.id::text));
    v_claims := jsonb_set(v_claims, '{role}',            to_jsonb(v_prof.role::text));
  END IF;

  RETURN jsonb_set(event, '{claims}', v_claims);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute to supabase_auth_admin
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
```

Luego en **Authentication → Hooks**:
- Hook type: `Custom Access Token`
- Function: `public.custom_access_token_hook`

---

## Step 2 — Redis setup (5 min)

1. Ir a [upstash.com](https://upstash.com) → Create Database
2. Región: **US-East-1** (o la más cercana)
3. Copiar **Redis URL** (formato `rediss://...`)

```
REDIS_URL=rediss://default:PASSWORD@xxxxx.upstash.io:6379
```

---

## Step 3 — Local development

```bash
# Clonar e instalar
git clone https://github.com/tu-user/dentalos-api
cd dentalos-api
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Correr migraciones
npm run migrate

# Iniciar en modo dev (hot reload)
npm run dev
```

El servidor arranca en `http://localhost:3000`
Swagger docs en `http://localhost:3000/docs`

### Verificar que funciona
```bash
curl http://localhost:3000/health
# {"status":"ok","ts":"2025-03-18T...","env":"development"}
```

---

## Step 4 — Correr migraciones

```bash
# Primera vez: aplica todos los archivos SQL en orden
npm run migrate

# Output esperado:
# ✅ Connected to database
# 🔄 Running 001_core_schema.sql...
# ✅ 001_core_schema.sql applied
# 🔄 Running 002_patients.sql...
# ...
# 🎉 Applied 7 migration(s) successfully

# Si algo falla y querés empezar de cero (SOLO EN DEV):
npm run migrate:reset
```

---

## Step 5 — API Quick Reference

### Auth
```
POST /auth/register     → Crear clínica + profesional owner
POST /auth/login        → Login → devuelve JWT
POST /auth/refresh      → Renovar token
GET  /auth/me           → Perfil del usuario autenticado
```

### Patients
```
GET    /patients                     → Listar (con ?q= para buscar)
GET    /patients/:id                 → Detalle completo + turnos + tratamientos
POST   /patients                     → Crear
PATCH  /patients/:id                 → Actualizar
DELETE /patients/:id                 → Soft delete
GET    /patients/:id/balance         → Saldo pendiente
GET    /patients/alerts/inactive     → Pacientes sin turno en +90 días
```

### Appointments
```
GET    /appointments?from=&to=       → Vista semanal
GET    /appointments/today           → Agenda del día
GET    /appointments/:id             → Detalle
POST   /appointments                 → Crear (auto-agenda recordatorios)
PATCH  /appointments/:id             → Actualizar estado / notas
POST   /appointments/:id/complete    → Marcar como atendido + notas clínicas
GET    /appointments/stats/today     → Stats del día para dashboard
```

### Payments
```
GET    /payments                     → Historial (con filtros)
POST   /payments                     → Registrar cobro
GET    /payments/cash-summary?date=  → Cierre de caja del día
POST   /payments/quotes              → Crear presupuesto
PATCH  /payments/quotes/:id/status   → Aceptar / rechazar presupuesto
```

### Treatments
```
GET    /treatments?patient_id=       → Tratamientos (por paciente)
GET    /treatments/:id               → Detalle completo con sesiones
POST   /treatments                   → Crear tratamiento
PATCH  /treatments/:id               → Actualizar estado
POST   /treatments/:id/sessions      → Agregar sesión
GET    /treatments/odontogram/:pid   → Odontograma del paciente
PUT    /treatments/odontogram/:pid   → Actualizar pieza dental
```

### Notifications
```
GET    /notifications                → Historial de notificaciones
POST   /notifications/send           → Envío manual (WhatsApp/email)
POST   /notifications/reminders/bulk → Disparar recordatorios de mañana
```

---

## Step 6 — Deploy a Railway

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Crear proyecto
railway init

# Configurar variables de entorno en Railway dashboard
# (mismo contenido que tu .env)

# Deploy
railway up

# Ver logs en vivo
railway logs
```

La URL del backend será algo como `https://dentalos-api-production.up.railway.app`

---

## Step 7 — Conectar el frontend

En el frontend (Next.js), configurar:
```env
# .env.local
NEXT_PUBLIC_API_URL=https://dentalos-api-production.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Todas las llamadas al API llevan el header:
```
Authorization: Bearer <supabase_jwt>
```

---

## Checklist de go-live

- [ ] Supabase proyecto creado (región São Paulo)
- [ ] 7 migraciones aplicadas sin errores
- [ ] Custom JWT hook configurado en Supabase Auth
- [ ] Redis creado en Upstash
- [ ] Variables de entorno configuradas en Railway
- [ ] `npm run migrate` exitoso contra DB de producción
- [ ] `GET /health` responde 200
- [ ] `POST /auth/register` crea clínica correctamente
- [ ] `POST /auth/login` devuelve JWT con `clinic_id` en claims
- [ ] Twilio Sandbox configurado (para WhatsApp en dev)
- [ ] Frontend apuntando al API de Railway
- [ ] RLS verificado: un clinic_id no puede leer datos de otro

---

## Monitoreo

- **Logs**: Railway dashboard → Deployments → Logs
- **DB**: Supabase dashboard → Table Editor / SQL Editor
- **Queues**: BullMQ Board (agregar `bull-board` para UI visual)
- **Errores**: configurar Sentry con `npm install @sentry/node`

---

## Próximos pasos (post-MVP)

1. **Facturación**: integrar AFIP (argentina) con `afip.ts`
2. **Pagos online**: Mercado Pago SDK para cobros con QR
3. **Multi-professional**: ya está en el schema, solo falta el UI
4. **App mobile**: mismo API, agregar Expo frontend
5. **Reportes**: agregar `/reports` con métricas mensuales
