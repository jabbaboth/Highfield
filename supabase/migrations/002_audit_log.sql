-- Highfield Contract Planner — Security Hardening 2/2
-- Audit log for sensitive admin operations.
-- Run once against the Supabase project (SQL editor). Safe to re-run.

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  contract_id UUID NOT NULL,
  actor_id UUID,
  actor_name TEXT,
  action TEXT NOT NULL,          -- e.g. 'user.create', 'user.update', 'crew.remove', 'jobs.import'
  entity_type TEXT,              -- 'user' | 'crew' | 'jobs' | 'assignment' | 'completion'
  entity_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_contract_created_idx
  ON audit_log(contract_id, created_at DESC);

-- Clients may read and insert their own contract's audit rows.
-- Updates and deletes are not allowed.
GRANT SELECT, INSERT ON audit_log TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO anon, authenticated;
