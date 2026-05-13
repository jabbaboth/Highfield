-- Work Authorities — tracks WA coverage per feeder per day
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT).

CREATE TABLE IF NOT EXISTS work_authorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL,
  wa_number TEXT NOT NULL,
  feeder TEXT NOT NULL,
  dates DATE[] NOT NULL DEFAULT '{}',
  pdf_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_contract ON work_authorities(contract_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON work_authorities TO anon, authenticated;

ALTER TABLE work_authorities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_anon_select" ON work_authorities FOR SELECT TO anon USING (true);
CREATE POLICY "wa_anon_insert" ON work_authorities FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "wa_anon_update" ON work_authorities FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "wa_anon_delete" ON work_authorities FOR DELETE TO anon USING (true);

-- Storage bucket for WA PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-authorities', 'work-authorities', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "wa_anon_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'work-authorities');
CREATE POLICY "wa_anon_select" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'work-authorities');
