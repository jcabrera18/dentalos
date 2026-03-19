-- ============================================================
-- DentalOS · Migration 003 · Appointments (Agenda)
-- ============================================================

CREATE TYPE appointment_status AS ENUM (
  'pending',      -- agendado, sin confirmar
  'confirmed',    -- confirmó por WhatsApp/SMS
  'in_progress',  -- en consultorio ahora
  'completed',    -- atendido
  'absent',       -- no se presentó
  'cancelled'     -- cancelado (con motivo)
);

CREATE TABLE appointments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  professional_id     UUID NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,

  -- Timing
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ NOT NULL,
  duration_minutes    INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60
  ) STORED,

  -- Status
  status              appointment_status NOT NULL DEFAULT 'pending',
  cancelled_reason    TEXT,
  cancelled_at        TIMESTAMPTZ,
  cancelled_by        UUID REFERENCES professionals(id),

  -- Content
  appointment_type    TEXT,                          -- 'Limpieza', 'Endodoncia', 'Control'…
  chief_complaint     TEXT,                          -- motivo de consulta
  clinical_notes      TEXT,                          -- notas post-atención (encrypted in prod)
  internal_notes      TEXT,                          -- notas internas (secretaria)

  -- Treatment link (optional)
  treatment_id        UUID,                          -- FK added in migration 004
  treatment_session   INTEGER,                       -- nro de sesión

  -- Reminders
  reminder_sent_24h   BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_sent_2h    BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_sent_at    TIMESTAMPTZ,
  confirmed_at        TIMESTAMPTZ,
  confirmation_channel TEXT,                         -- 'whatsapp', 'sms', 'manual'

  -- Metadata
  created_by          UUID REFERENCES professionals(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────

-- Most critical: calendar view (range query by date)
CREATE INDEX idx_appt_calendar ON appointments(
  clinic_id, professional_id, starts_at, status
);

-- Patient history
CREATE INDEX idx_appt_patient ON appointments(clinic_id, patient_id, starts_at DESC);

-- Reminder worker: find pending reminders
CREATE INDEX idx_appt_reminders ON appointments(starts_at)
  WHERE status IN ('pending', 'confirmed')
    AND reminder_sent_24h = FALSE;

-- Status filter
CREATE INDEX idx_appt_status ON appointments(clinic_id, status, starts_at);

-- ── CONSTRAINTS ──────────────────────────

-- ends_at must be after starts_at
ALTER TABLE appointments
  ADD CONSTRAINT chk_appt_timing CHECK (ends_at > starts_at);

-- No overlapping appointments per professional
-- (partial index trick — enforced in app layer too)
CREATE OR REPLACE FUNCTION check_professional_availability(
  p_professional_id UUID,
  p_starts_at       TIMESTAMPTZ,
  p_ends_at         TIMESTAMPTZ,
  p_exclude_id      UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM appointments a
    WHERE
      a.professional_id = p_professional_id
      AND a.status NOT IN ('cancelled', 'absent')
      AND a.id != COALESCE(p_exclude_id, uuid_nil())
      AND tstzrange(a.starts_at, a.ends_at) && tstzrange(p_starts_at, p_ends_at)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── TRIGGER: update patient.last_appointment_at ──

CREATE OR REPLACE FUNCTION update_patient_last_appointment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE patients
    SET last_appointment_at = NEW.starts_at,
        updated_at = NOW()
    WHERE id = NEW.patient_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_appt_update_patient
  AFTER UPDATE OF status ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_patient_last_appointment();

CREATE TRIGGER trg_appt_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ──────────────────────────────────

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY appt_isolation ON appointments
  FOR ALL USING (clinic_id = current_clinic_id());

CREATE POLICY appt_service_role ON appointments
  FOR ALL TO service_role USING (true);

-- ──────────────────────────────────────────
-- VIEW: daily agenda (used by dashboard API)
-- ──────────────────────────────────────────

CREATE OR REPLACE VIEW v_daily_agenda AS
SELECT
  a.id,
  a.clinic_id,
  a.starts_at,
  a.ends_at,
  a.duration_minutes,
  a.status,
  a.appointment_type,
  a.chief_complaint,
  -- Patient
  a.patient_id,
  p.first_name  || ' ' || p.last_name AS patient_name,
  p.phone       AS patient_phone,
  p.insurance_name,
  -- Professional
  a.professional_id,
  pr.first_name || ' ' || pr.last_name AS professional_name,
  pr.color      AS professional_color,
  -- Reminders
  a.reminder_sent_24h,
  a.reminder_sent_2h,
  a.confirmed_at
FROM appointments a
JOIN patients     p  ON p.id  = a.patient_id
JOIN professionals pr ON pr.id = a.professional_id;
