-- WA colors + contract map PDF

ALTER TABLE work_authorities ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS map_pdf_path TEXT;
GRANT UPDATE ON contracts TO anon, authenticated;
