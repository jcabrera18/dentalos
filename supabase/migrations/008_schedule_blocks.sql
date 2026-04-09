-- ============================================================
-- DentalOS · Migration 008 · Schedule Blocks
-- Allows professionals to block time ranges in their agenda
-- ============================================================

CREATE TABLE schedule_blocks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_block_timing CHECK (ends_at > starts_at)
);

-- ── INDEXES ──────────────────────────────────

CREATE INDEX idx_schedule_blocks_lookup ON schedule_blocks(
  professional_id, starts_at, ends_at
);

CREATE INDEX idx_schedule_blocks_clinic ON schedule_blocks(clinic_id, starts_at);

-- ── GRANTS ───────────────────────────────────

GRANT SELECT, INSERT, DELETE ON schedule_blocks TO authenticated;
GRANT ALL ON schedule_blocks TO service_role;

-- ── RLS ──────────────────────────────────────

ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY blocks_isolation ON schedule_blocks
  FOR ALL USING (clinic_id = current_clinic_id());

CREATE POLICY blocks_service_role ON schedule_blocks
  FOR ALL TO service_role USING (true);
