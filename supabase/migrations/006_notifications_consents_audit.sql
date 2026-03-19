-- ============================================================
-- DentalOS · Migration 006 · Notifications, Consents, Audit
-- ============================================================

-- ──────────────────────────────────────────
-- NOTIFICATION QUEUE
-- BullMQ reads from here (or directly from
-- a Redis queue populated by triggers)
-- ──────────────────────────────────────────

CREATE TYPE notification_channel AS ENUM ('whatsapp', 'sms', 'email', 'push');
CREATE TYPE notification_status  AS ENUM ('queued', 'sent', 'delivered', 'failed', 'cancelled');
CREATE TYPE notification_type    AS ENUM (
  'appointment_reminder_24h',
  'appointment_reminder_2h',
  'appointment_confirmation',
  'appointment_cancelled',
  'payment_receipt',
  'quote_sent',
  'inactive_patient',
  'custom'
);

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,

  type            notification_type NOT NULL,
  channel         notification_channel NOT NULL,
  status          notification_status NOT NULL DEFAULT 'queued',

  -- Recipient
  to_phone        TEXT,
  to_email        TEXT,

  -- Content
  template_key    TEXT,                           -- e.g. 'reminder_24h'
  template_vars   JSONB NOT NULL DEFAULT '{}',   -- vars interpolated into template
  rendered_body   TEXT,                           -- final message after render

  -- Scheduling
  scheduled_for   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  failure_reason  TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  max_retries     INTEGER NOT NULL DEFAULT 3,

  -- Provider response
  provider        TEXT,                           -- 'twilio', 'meta', 'resend'
  provider_msg_id TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_queue    ON notifications(scheduled_for, status)
  WHERE status = 'queued';
CREATE INDEX idx_notif_patient  ON notifications(clinic_id, patient_id);
CREATE INDEX idx_notif_appt     ON notifications(appointment_id);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_isolation ON notifications FOR ALL USING (clinic_id = current_clinic_id());
CREATE POLICY notif_svc       ON notifications FOR ALL TO service_role USING (true);

-- ──────────────────────────────────────────
-- CONSENT FORMS (Consentimientos informados)
-- ──────────────────────────────────────────

CREATE TYPE consent_status AS ENUM ('pending', 'signed', 'declined');

CREATE TABLE consent_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                 -- 'Extracción', 'Implante', 'Blanqueamiento'
  content_html    TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE consents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  appointment_id  UUID REFERENCES appointments(id),
  template_id     UUID REFERENCES consent_templates(id),

  -- Snapshot of content at signing time (immutable)
  content_html    TEXT NOT NULL,

  status          consent_status NOT NULL DEFAULT 'pending',

  -- Signature
  signature_data  TEXT,                          -- base64 SVG or PNG
  signed_at       TIMESTAMPTZ,
  signer_ip       TEXT,
  signer_ua       TEXT,                          -- user agent

  declined_at     TIMESTAMPTZ,
  decline_reason  TEXT,

  created_by      UUID REFERENCES professionals(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consents_patient ON consents(clinic_id, patient_id);
CREATE INDEX idx_consents_appt    ON consents(appointment_id);

ALTER TABLE consent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents          ENABLE ROW LEVEL SECURITY;

CREATE POLICY consent_tmpl_isolation ON consent_templates FOR ALL USING (clinic_id = current_clinic_id());
CREATE POLICY consents_isolation     ON consents           FOR ALL USING (clinic_id = current_clinic_id());
CREATE POLICY consent_tmpl_svc       ON consent_templates FOR ALL TO service_role USING (true);
CREATE POLICY consents_svc           ON consents           FOR ALL TO service_role USING (true);

-- ──────────────────────────────────────────
-- AUDIT LOG
-- Immutable record of all sensitive changes.
-- Written via service_role only — never by user.
-- ──────────────────────────────────────────

CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  clinic_id       UUID,
  performed_by    UUID,                          -- professional id
  auth_user_id    UUID,                          -- supabase auth user
  action          TEXT NOT NULL,                 -- 'patient.create', 'payment.delete'…
  entity_type     TEXT NOT NULL,                 -- 'patient', 'appointment', 'payment'…
  entity_id       UUID,
  old_data        JSONB,
  new_data        JSONB,
  ip_address      INET,
  user_agent      TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log is append-only: no UPDATE or DELETE allowed
CREATE RULE no_update_audit AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_log DO INSTEAD NOTHING;

CREATE INDEX idx_audit_clinic  ON audit_log(clinic_id, occurred_at DESC);
CREATE INDEX idx_audit_entity  ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user    ON audit_log(performed_by);

-- ──────────────────────────────────────────
-- Generic audit trigger factory
-- Usage: SELECT create_audit_trigger('patients');
-- ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_old JSONB := NULL;
  v_new JSONB := NULL;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  ELSE
    v_new := to_jsonb(NEW);
  END IF;

  INSERT INTO audit_log (
    clinic_id, action, entity_type, entity_id, old_data, new_data
  ) VALUES (
    COALESCE(
      (v_new->>'clinic_id')::uuid,
      (v_old->>'clinic_id')::uuid
    ),
    LOWER(TG_OP),
    TG_TABLE_NAME,
    COALESCE(
      (v_new->>'id')::uuid,
      (v_old->>'id')::uuid
    ),
    v_old,
    v_new
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to sensitive tables
CREATE TRIGGER audit_patients
  AFTER INSERT OR UPDATE OR DELETE ON patients
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_appointments
  AFTER INSERT OR UPDATE OR DELETE ON appointments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
