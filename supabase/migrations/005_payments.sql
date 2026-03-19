-- ============================================================
-- DentalOS · Migration 005 · Payments & Quotes
-- ============================================================

CREATE TYPE payment_method AS ENUM (
  'cash',           -- efectivo
  'bank_transfer',  -- transferencia
  'debit_card',     -- débito
  'credit_card',    -- crédito
  'insurance',      -- obra social
  'qr',             -- Mercado Pago QR, etc.
  'other'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'completed',
  'refunded',
  'failed'
);

CREATE TYPE quote_status AS ENUM (
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired'
);

-- ──────────────────────────────────────────
-- QUOTES (Presupuestos)
-- ──────────────────────────────────────────

CREATE TABLE quotes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  professional_id     UUID NOT NULL REFERENCES professionals(id),

  status              quote_status NOT NULL DEFAULT 'draft',
  quote_number        TEXT,                       -- e.g. 'Q-2025-0042'

  -- Line items stored as JSONB for flexibility
  -- [{description, quantity, unit_price, discount_pct, subtotal}]
  items               JSONB NOT NULL DEFAULT '[]'::jsonb,

  subtotal            NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total               NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Installment agreement
  installments        INTEGER NOT NULL DEFAULT 1,
  installment_amount  NUMERIC(12,2),

  notes               TEXT,
  valid_until         DATE,

  sent_at             TIMESTAMPTZ,
  accepted_at         TIMESTAMPTZ,
  rejected_at         TIMESTAMPTZ,

  -- Link to treatment created from this quote
  treatment_id        UUID REFERENCES treatments(id),

  created_by          UUID REFERENCES professionals(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-generate quote number
CREATE SEQUENCE quote_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL THEN
    NEW.quote_number := 'Q-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                        LPAD(nextval('quote_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quote_number
  BEFORE INSERT ON quotes
  FOR EACH ROW EXECUTE FUNCTION generate_quote_number();

CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Link treatments → quotes (FK deferred)
ALTER TABLE treatments
  ADD CONSTRAINT fk_treatment_quote
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────
-- PAYMENTS
-- Every money movement goes here.
-- Can link to: appointment, quote, or standalone (debt payment)
-- ──────────────────────────────────────────

CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  professional_id     UUID NOT NULL REFERENCES professionals(id),

  -- What this payment is for (at least one must be set, all optional)
  appointment_id      UUID REFERENCES appointments(id) ON DELETE SET NULL,
  quote_id            UUID REFERENCES quotes(id) ON DELETE SET NULL,
  treatment_id        UUID REFERENCES treatments(id) ON DELETE SET NULL,

  -- Amount
  amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency            TEXT NOT NULL DEFAULT 'ARS',

  -- Payment details
  method              payment_method NOT NULL,
  status              payment_status NOT NULL DEFAULT 'completed',

  -- Credit card specific
  installments        INTEGER NOT NULL DEFAULT 1,
  installment_amount  NUMERIC(12,2),

  -- Reference / receipt
  reference_number    TEXT,                       -- nro transacción, comprobante
  receipt_number      TEXT,                       -- nro recibo interno

  -- Insurance specific
  insurance_coverage  NUMERIC(12,2),             -- cuánto cubre la OS
  patient_copay       NUMERIC(12,2),             -- lo que pagó el paciente

  notes               TEXT,
  paid_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Refund tracking
  refunded_at         TIMESTAMPTZ,
  refund_reason       TEXT,
  original_payment_id UUID REFERENCES payments(id),

  created_by          UUID REFERENCES professionals(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_clinic     ON payments(clinic_id, paid_at DESC);
CREATE INDEX idx_payments_patient    ON payments(clinic_id, patient_id, paid_at DESC);
CREATE INDEX idx_payments_appt       ON payments(appointment_id);
CREATE INDEX idx_payments_quote      ON payments(quote_id);
CREATE INDEX idx_payments_date       ON payments(clinic_id, paid_at);
CREATE INDEX idx_payments_method     ON payments(clinic_id, method);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────
-- TRIGGER: update treatment.total_paid when payment added
-- ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_treatment_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.treatment_id IS NOT NULL THEN
    UPDATE treatments
    SET
      total_paid = (
        SELECT COALESCE(SUM(amount), 0)
        FROM payments
        WHERE treatment_id = NEW.treatment_id
          AND status = 'completed'
      ),
      updated_at = NOW()
    WHERE id = NEW.treatment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_update_treatment
  AFTER INSERT OR UPDATE OF status ON payments
  FOR EACH ROW EXECUTE FUNCTION update_treatment_paid();

-- ──────────────────────────────────────────
-- VIEW: patient balance (outstanding debt)
-- ──────────────────────────────────────────

CREATE OR REPLACE VIEW v_patient_balance AS
SELECT
  pat.id          AS patient_id,
  pat.clinic_id,
  pat.first_name || ' ' || pat.last_name AS patient_name,
  pat.phone,
  COALESCE(q.total_quoted, 0)  AS total_quoted,
  COALESCE(p.total_paid, 0)    AS total_paid,
  COALESCE(q.total_quoted, 0)
    - COALESCE(p.total_paid, 0) AS balance_due
FROM patients pat
LEFT JOIN (
  SELECT patient_id, SUM(total) AS total_quoted
  FROM quotes
  WHERE status = 'accepted'
  GROUP BY patient_id
) q ON q.patient_id = pat.id
LEFT JOIN (
  SELECT patient_id, SUM(amount) AS total_paid
  FROM payments
  WHERE status = 'completed'
  GROUP BY patient_id
) p ON p.patient_id = pat.id
WHERE pat.deleted_at IS NULL;

-- ──────────────────────────────────────────
-- VIEW: daily cash summary (for reports)
-- ──────────────────────────────────────────

CREATE OR REPLACE VIEW v_daily_cash AS
SELECT
  clinic_id,
  DATE(paid_at AT TIME ZONE 'America/Argentina/Buenos_Aires') AS day,
  method,
  COUNT(*)                     AS transactions,
  SUM(amount)                  AS total,
  SUM(CASE WHEN installments > 1 THEN amount ELSE 0 END) AS credit_total
FROM payments
WHERE status = 'completed'
GROUP BY clinic_id, day, method;

-- ── RLS ──────────────────────────────────

ALTER TABLE quotes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments  ENABLE ROW LEVEL SECURITY;

CREATE POLICY quotes_isolation   ON quotes   FOR ALL USING (clinic_id = current_clinic_id());
CREATE POLICY payments_isolation ON payments FOR ALL USING (clinic_id = current_clinic_id());

CREATE POLICY quotes_svc   ON quotes   FOR ALL TO service_role USING (true);
CREATE POLICY payments_svc ON payments FOR ALL TO service_role USING (true);
