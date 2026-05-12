-- Highfield Contract Planner — Multi-contract support
-- Creates a contracts registry and a create_contract RPC that
-- auto-clones the calling admin into the new contract.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the existing contract so it appears in the picker.
INSERT INTO contracts (id, name)
VALUES ('55f5f5c6-250b-414c-a6fb-7799bec59d12', 'Highfield')
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON contracts TO anon, authenticated;

-- RPC: create a new contract + clone the calling admin into it.
CREATE OR REPLACE FUNCTION create_contract(p_token TEXT, p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  caller RECORD;
  new_contract_id UUID;
BEGIN
  SELECT u.* INTO caller
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = p_token
      AND s.expires_at > now()
      AND u.role = 'admin';
  IF caller.id IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 1 THEN
    RAISE EXCEPTION 'contract name required';
  END IF;

  INSERT INTO contracts (name) VALUES (trim(p_name))
    RETURNING id INTO new_contract_id;

  INSERT INTO users (contract_id, name, pin_hash, role)
    VALUES (new_contract_id, caller.name, caller.pin_hash, 'admin');

  RETURN new_contract_id;
END $$;

GRANT EXECUTE ON FUNCTION create_contract(TEXT, TEXT) TO anon, authenticated;
