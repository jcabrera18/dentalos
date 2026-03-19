-- ============================================================
-- DentalOS · Migration 004 · Treatments & Odontogram
-- ============================================================

CREATE TYPE treatment_status AS ENUM (
  'quoted',       -- presupuestado, no aceptado aún
  'accepted',     -- paciente aceptó
  'in_progress',  -- sesiones en curso
  'completed',    -- finalizado
  'abandoned'     -- paciente no continuó
);

-- ──────────────────────────────────────────
-- TREATMENTS
-- One treatment = one clinical plan (e.g. "Endodoncia piezas 45-46")
-- Can span multiple appointments/sessions
-- ──────────────────────────────────────────

CREATE TABLE treatments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  professional_id     UUID NOT NULL REFERENCES professionals(id),

  name                TEXT NOT NULL,              -- 'Endodoncia', 'Blanqueamiento'…
  description         TEXT,
  status              treatment_status NOT NULL DEFAULT 'accepted',

  -- Tooth references (FDI notation: 11-48, 51-85 for primary)
  tooth_numbers       INTEGER[] DEFAULT '{}',     -- e.g. {45, 46}
  tooth_surfaces      JSONB,                      -- e.g. {"45": ["M","O"], "46": ["D"]}

  -- Session tracking
  sessions_planned    INTEGER,
  sessions_done       INTEGER NOT NULL DEFAULT 0,

  -- Timeline
  started_at          DATE,
  estimated_end_date  DATE,
  completed_at        DATE,
  abandoned_at        DATE,
  abandon_reason      TEXT,

  -- Financial link
  quote_id            UUID,                       -- FK added in migration 005
  total_quoted        NUMERIC(12,2),
  total_paid          NUMERIC(12,2) NOT NULL DEFAULT 0,

  created_by          UUID REFERENCES professionals(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_treatments_patient   ON treatments(clinic_id, patient_id);
CREATE INDEX idx_treatments_status    ON treatments(clinic_id, status);
CREATE INDEX idx_treatments_teeth     ON treatments USING gin(tooth_numbers);

CREATE TRIGGER trg_treatments_updated_at
  BEFORE UPDATE ON treatments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────
-- TREATMENT SESSIONS
-- Each appointment that is part of a treatment
-- creates a session record
-- ──────────────────────────────────────────

CREATE TABLE treatment_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  treatment_id    UUID NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,

  session_number  INTEGER NOT NULL,
  performed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes           TEXT,                           -- work done this session
  next_steps      TEXT,                           -- instructions for next session

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_treatment ON treatment_sessions(treatment_id, session_number);
CREATE INDEX idx_sessions_appt      ON treatment_sessions(appointment_id);

-- Link appointments → treatments (FK deferred until here)
ALTER TABLE appointments
  ADD CONSTRAINT fk_appt_treatment
  FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE SET NULL;

-- Trigger: update sessions_done count
CREATE OR REPLACE FUNCTION update_treatment_sessions_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE treatments
  SET
    sessions_done = (
      SELECT COUNT(*) FROM treatment_sessions
      WHERE treatment_id = NEW.treatment_id
    ),
    updated_at = NOW()
  WHERE id = NEW.treatment_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_session_count
  AFTER INSERT OR DELETE ON treatment_sessions
  FOR EACH ROW EXECUTE FUNCTION update_treatment_sessions_count();

-- ──────────────────────────────────────────
-- ODONTOGRAM
-- Persistent state of each tooth per patient
-- Each row = 1 tooth for 1 patient
-- ──────────────────────────────────────────

CREATE TYPE tooth_condition AS ENUM (
  'healthy',
  'cavity',
  'filled',
  'root_canal',
  'crown',
  'missing',
  'implant',
  'bridge_abutment',
  'extraction_needed',
  'fracture',
  'other'
);

CREATE TABLE odontogram (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  tooth_number    INTEGER NOT NULL CHECK (
    (tooth_number BETWEEN 11 AND 18) OR  -- upper right
    (tooth_number BETWEEN 21 AND 28) OR  -- upper left
    (tooth_number BETWEEN 31 AND 38) OR  -- lower left
    (tooth_number BETWEEN 41 AND 48) OR  -- lower right
    (tooth_number BETWEEN 51 AND 55) OR  -- primary upper right
    (tooth_number BETWEEN 61 AND 65) OR  -- primary upper left
    (tooth_number BETWEEN 71 AND 75) OR  -- primary lower left
    (tooth_number BETWEEN 81 AND 85)     -- primary lower right
  ),

  condition       tooth_condition NOT NULL DEFAULT 'healthy',
  surfaces        TEXT[],                         -- ['M','D','O','V','L']
  notes           TEXT,
  treatment_id    UUID REFERENCES treatments(id),

  -- Audit
  recorded_by     UUID REFERENCES professionals(id),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (patient_id, tooth_number)               -- one state per tooth per patient
);

CREATE INDEX idx_odontogram_patient ON odontogram(clinic_id, patient_id);

CREATE TRIGGER trg_odontogram_updated_at
  BEFORE UPDATE ON odontogram
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ──────────────────────────────────

ALTER TABLE treatments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE odontogram        ENABLE ROW LEVEL SECURITY;

CREATE POLICY treatments_isolation        ON treatments         FOR ALL USING (clinic_id = current_clinic_id());
CREATE POLICY treatment_sessions_isolation ON treatment_sessions FOR ALL USING (clinic_id = current_clinic_id());
CREATE POLICY odontogram_isolation        ON odontogram         FOR ALL USING (clinic_id = current_clinic_id());

CREATE POLICY treatments_svc         ON treatments         FOR ALL TO service_role USING (true);
CREATE POLICY treatment_sessions_svc ON treatment_sessions FOR ALL TO service_role USING (true);
CREATE POLICY odontogram_svc         ON odontogram         FOR ALL TO service_role USING (true);
