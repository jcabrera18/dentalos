-- ============================================================
-- DentalOS · Migration 001 · Core Schema
-- Clinics, Professionals, Roles
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────
-- ENUMS
-- ──────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'professional', 'receptionist');
CREATE TYPE plan_type AS ENUM ('free', 'basic', 'pro', 'clinic', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'paused');

-- ──────────────────────────────────────────
-- CLINICS
-- Single row per tenant. All other tables
-- reference clinic_id for RLS isolation.
-- ──────────────────────────────────────────

CREATE TABLE clinics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,          -- used in URLs: dentalos.app/c/slug
  address         TEXT,
  city            TEXT,
  country         TEXT NOT NULL DEFAULT 'AR',
  phone           TEXT,
  email           TEXT,
  timezone        TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  currency        TEXT NOT NULL DEFAULT 'ARS',
  logo_url        TEXT,

  -- Subscription
  plan            plan_type NOT NULL DEFAULT 'free',
  sub_status      subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at   TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  sub_ends_at     TIMESTAMPTZ,
  stripe_customer_id TEXT,

  -- Config
  settings        JSONB NOT NULL DEFAULT '{
    "appointment_duration_default": 45,
    "working_hours": {
      "mon": {"start": "08:00", "end": "18:00"},
      "tue": {"start": "08:00", "end": "18:00"},
      "wed": {"start": "08:00", "end": "18:00"},
      "thu": {"start": "08:00", "end": "18:00"},
      "fri": {"start": "08:00", "end": "17:00"},
      "sat": null,
      "sun": null
    },
    "reminder_hours_before": [24, 2],
    "whatsapp_enabled": true,
    "sms_enabled": false
  }'::jsonb,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ                          -- soft delete
);

CREATE INDEX idx_clinics_slug ON clinics(slug);
CREATE INDEX idx_clinics_plan ON clinics(plan);

-- ──────────────────────────────────────────
-- PROFESSIONALS (staff members)
-- Links Supabase auth.users → clinic
-- ──────────────────────────────────────────

CREATE TABLE professionals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,

  -- Supabase auth link (nullable: receptionist may not have login)
  auth_user_id    UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Personal info
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  avatar_url      TEXT,

  -- Professional data
  role            user_role NOT NULL DEFAULT 'professional',
  specialty       TEXT,                           -- e.g. 'Ortodoncia', 'Endodoncia'
  license_number  TEXT,                           -- matrícula

  -- Schedule config (overrides clinic defaults)
  schedule_config JSONB,                          -- same shape as clinic.settings.working_hours

  -- Appointment defaults
  default_duration_minutes INTEGER NOT NULL DEFAULT 45,
  color           TEXT NOT NULL DEFAULT '#4f8ef7', -- calendar color

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_professionals_clinic ON professionals(clinic_id);
CREATE INDEX idx_professionals_auth   ON professionals(auth_user_id);
CREATE INDEX idx_professionals_active ON professionals(clinic_id, is_active);

-- ──────────────────────────────────────────
-- UPDATED_AT trigger (reused across tables)
-- ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clinics_updated_at
  BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_professionals_updated_at
  BEFORE UPDATE ON professionals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────

ALTER TABLE clinics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;

-- Helper function: get clinic_id from current JWT
-- The JWT custom claim 'clinic_id' is set during login
CREATE OR REPLACE FUNCTION current_clinic_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb->>'clinic_id')::uuid,
    NULL
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: get current user role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb->>'role')::user_role,
    'receptionist'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Clinics: user can only see their own clinic
CREATE POLICY clinics_isolation ON clinics
  FOR ALL USING (id = current_clinic_id());

-- Professionals: scoped to clinic
CREATE POLICY professionals_isolation ON professionals
  FOR ALL USING (clinic_id = current_clinic_id());

-- Service role bypasses RLS (used by backend)
CREATE POLICY clinics_service_role ON clinics
  FOR ALL TO service_role USING (true);

CREATE POLICY professionals_service_role ON professionals
  FOR ALL TO service_role USING (true);
