-- Notifications — homeowner contact reminders
-- Auto-created when jobs with notify requirements are assigned.

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  contract_id UUID NOT NULL,
  job_id INTEGER NOT NULL,
  notify_type TEXT,
  notify_date DATE,
  contacted BOOLEAN NOT NULL DEFAULT false,
  contacted_at TIMESTAMPTZ,
  contacted_by TEXT,
  contact_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contract_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_contract ON notifications(contract_id);
CREATE INDEX IF NOT EXISTS idx_notifications_date ON notifications(notify_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE notifications_id_seq TO anon, authenticated;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_anon_select" ON notifications FOR SELECT TO anon USING (true);
CREATE POLICY "notif_anon_insert" ON notifications FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "notif_anon_update" ON notifications FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "notif_anon_delete" ON notifications FOR DELETE TO anon USING (true);
