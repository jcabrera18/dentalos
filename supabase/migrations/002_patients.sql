-- ============================================================
-- DentalOS · Migration 002 · Patients
-- ============================================================

CREATE TABLE patients (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,

  -- Identity
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  document_type       TEXT NOT NULL DEFAULT 'DNI',  -- DNI, CUIT, Pasaporte
  document_number     TEXT,
  date_of_birth       DATE,
  gender              TEXT,                          -- M / F / otro

  -- Contact (phone is primary key for search)
  phone               TEXT NOT NULL,
  phone_alt           TEXT,
  email               TEXT,
  address             TEXT,
  city                TEXT,

  -- Insurance
  insurance_name      TEXT,                          -- OSDE, PAMI, Swiss Medical…
  insurance_plan      TEXT,                          -- 310, 210…
  insurance_number    TEXT,                          -- nro afiliado

  -- Medical alerts (sensitive — encrypted at rest via Supabase Vault in prod)
  allergies           TEXT,
  current_medications TEXT,
  medical_notes       TEXT,                          -- antecedentes relevantes
  blood_type          TEXT,

  -- Metadata
  referral_source     TEXT,                          -- cómo nos conoció
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  last_appointment_at TIMESTAMPTZ,                   -- updated by trigger
  created_by          UUID REFERENCES professionals(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ                    -- soft delete
);

-- Search indexes
CREATE INDEX idx_patients_clinic       ON patients(clinic_id);
CREATE INDEX idx_patients_phone        ON patients(clinic_id, phone);
CREATE INDEX idx_patients_document     ON patients(clinic_id, document_number);
CREATE INDEX idx_patients_name         ON patients USING gin(
  to_tsvector('spanish', first_name || ' ' || last_name)
);
CREATE INDEX idx_patients_last_appt    ON patients(clinic_id, last_appointment_at);
CREATE INDEX idx_patients_active       ON patients(clinic_id, is_active);

-- Updated_at trigger
CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY patients_isolation ON patients
  FOR ALL USING (clinic_id = current_clinic_id());

CREATE POLICY patients_service_role ON patients
  FOR ALL TO service_role USING (true);

-- ──────────────────────────────────────────
-- Full-text search helper
-- Used by API: GET /patients?q=gomez
-- ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_patients(
  p_clinic_id UUID,
  p_query     TEXT,
  p_limit     INT DEFAULT 20,
  p_offset    INT DEFAULT 0
)
RETURNS TABLE (
  id          UUID,
  first_name  TEXT,
  last_name   TEXT,
  phone       TEXT,
  email       TEXT,
  insurance_name TEXT,
  last_appointment_at TIMESTAMPTZ,
  rank        REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pat.id, pat.first_name, pat.last_name,
    pat.phone, pat.email, pat.insurance_name,
    pat.last_appointment_at,
    ts_rank(
      to_tsvector('spanish', pat.first_name || ' ' || pat.last_name || ' ' || COALESCE(pat.phone,'')),
      plainto_tsquery('spanish', p_query)
    ) AS rank
  FROM patients pat
  WHERE
    pat.clinic_id = p_clinic_id
    AND pat.deleted_at IS NULL
    AND (
      to_tsvector('spanish', pat.first_name || ' ' || pat.last_name)
        @@ plainto_tsquery('spanish', p_query)
      OR pat.phone ILIKE '%' || p_query || '%'
      OR pat.document_number ILIKE '%' || p_query || '%'
    )
  ORDER BY rank DESC, pat.last_name ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
