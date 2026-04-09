-- Highfield Contract Planner — Security Hardening 1/2
-- Hash PINs with bcrypt, add rate-limit columns, create session tokens.
--
-- Run once against the Supabase project (SQL editor).
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS guards.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── users: hash the PIN + add rate-limit columns ─────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Backfill hashes from any remaining plaintext pin, then drop the plaintext column.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'users' AND column_name = 'pin') THEN
    UPDATE users SET pin_hash = crypt(pin, gen_salt('bf', 10))
      WHERE pin_hash IS NULL AND pin IS NOT NULL;
    ALTER TABLE users DROP COLUMN pin;
  END IF;
END $$;

-- Lock down direct read access to pin_hash. Clients should never see it.
REVOKE ALL ON users FROM anon;
REVOKE ALL ON users FROM authenticated;

-- Public-safe view of users (no pin_hash, no failed_attempts, no locked_until)
CREATE OR REPLACE VIEW users_public AS
  SELECT id, contract_id, name, role FROM users;

GRANT SELECT ON users_public TO anon, authenticated;

-- ─── sessions: server-side session tokens ────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

REVOKE ALL ON sessions FROM anon, authenticated;

-- ─── verify_pin: the only way clients can authenticate ───────────────────
-- Returns one row with a fresh 30-minute session token on success,
-- zero rows on wrong PIN, raises 'locked' when too many attempts.
CREATE OR REPLACE FUNCTION verify_pin(p_user_id UUID, p_pin TEXT)
RETURNS TABLE(token TEXT, user_id UUID, name TEXT, role TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  u RECORD;
  new_token TEXT;
  new_expires TIMESTAMPTZ;
BEGIN
  SELECT * INTO u FROM users WHERE users.id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Still locked?
  IF u.locked_until IS NOT NULL AND u.locked_until > now() THEN
    RAISE EXCEPTION 'locked' USING ERRCODE = 'P0001';
  END IF;

  -- Wrong PIN: increment counter, lock after 5
  IF u.pin_hash IS NULL OR u.pin_hash <> crypt(p_pin, u.pin_hash) THEN
    UPDATE users
      SET failed_attempts = failed_attempts + 1,
          locked_until = CASE
            WHEN failed_attempts + 1 >= 5 THEN now() + interval '10 minutes'
            ELSE locked_until
          END
      WHERE id = p_user_id;
    RETURN;
  END IF;

  -- Success: reset counter, mint a new session token valid 30 minutes
  UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = p_user_id;
  new_token := encode(gen_random_bytes(32), 'hex');
  new_expires := now() + interval '30 minutes';
  INSERT INTO sessions(token, user_id, contract_id, expires_at)
    VALUES (new_token, u.id, u.contract_id, new_expires);

  -- Opportunistically sweep old sessions
  DELETE FROM sessions WHERE expires_at < now() - interval '1 day';

  RETURN QUERY SELECT new_token, u.id, u.name, u.role, new_expires;
END $$;

-- ─── whoami: resolve a session token to a user (or nothing if invalid) ──
CREATE OR REPLACE FUNCTION whoami(p_token TEXT)
RETURNS TABLE(user_id UUID, name TEXT, role TEXT, contract_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.name, u.role, s.contract_id, s.expires_at
  FROM sessions s
  JOIN users u ON u.id = s.user_id
  WHERE s.token = p_token
    AND s.expires_at > now();
END $$;

-- ─── touch_session: idle-timeout refresh, extends expiry by 30 minutes ──
CREATE OR REPLACE FUNCTION touch_session(p_token TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_expires TIMESTAMPTZ;
BEGIN
  UPDATE sessions
    SET expires_at = now() + interval '30 minutes'
    WHERE token = p_token AND expires_at > now()
    RETURNING expires_at INTO new_expires;
  RETURN new_expires;
END $$;

-- ─── logout: delete a session token ──────────────────────────────────────
CREATE OR REPLACE FUNCTION logout(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM sessions WHERE token = p_token;
END $$;

-- ─── user management RPCs (admin-only, enforced server-side) ────────────
-- Direct writes to the users table are revoked, so these are the only way
-- to create/update/delete users. Each takes the caller's session token and
-- checks that the token belongs to an admin.

CREATE OR REPLACE FUNCTION _current_admin(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid UUID;
BEGIN
  SELECT u.id INTO uid
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = p_token
      AND s.expires_at > now()
      AND u.role = 'admin';
  IF uid IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'P0001';
  END IF;
  RETURN uid;
END $$;

CREATE OR REPLACE FUNCTION create_user(p_token TEXT, p_name TEXT, p_pin TEXT, p_role TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  caller_id UUID;
  caller_contract UUID;
  new_id UUID;
BEGIN
  caller_id := _current_admin(p_token);
  SELECT contract_id INTO caller_contract FROM users WHERE id = caller_id;

  IF p_role NOT IN ('admin', 'foreman', 'crew') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;
  IF p_pin IS NULL OR length(p_pin) < 4 THEN
    RAISE EXCEPTION 'pin too short';
  END IF;

  INSERT INTO users(contract_id, name, pin_hash, role)
    VALUES (caller_contract, p_name, crypt(p_pin, gen_salt('bf', 10)), p_role)
    RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION update_user_pin(p_token TEXT, p_user_id UUID, p_new_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM _current_admin(p_token);
  IF p_new_pin IS NULL OR length(p_new_pin) < 4 THEN
    RAISE EXCEPTION 'pin too short';
  END IF;
  UPDATE users
    SET pin_hash = crypt(p_new_pin, gen_salt('bf', 10)),
        failed_attempts = 0,
        locked_until = NULL
    WHERE id = p_user_id;
END $$;

CREATE OR REPLACE FUNCTION update_user_role(p_token TEXT, p_user_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM _current_admin(p_token);
  IF p_role NOT IN ('admin', 'foreman', 'crew') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;
  UPDATE users SET role = p_role WHERE id = p_user_id;
END $$;

CREATE OR REPLACE FUNCTION delete_user(p_token TEXT, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE caller_id UUID;
BEGIN
  caller_id := _current_admin(p_token);
  IF caller_id = p_user_id THEN
    RAISE EXCEPTION 'cannot delete yourself';
  END IF;
  DELETE FROM users WHERE id = p_user_id;
END $$;

-- Expose the RPCs to anon so unauthenticated clients can log in.
GRANT EXECUTE ON FUNCTION verify_pin(UUID, TEXT)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION whoami(TEXT)                       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION touch_session(TEXT)                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION logout(TEXT)                       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_user(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_user_pin(TEXT, UUID, TEXT)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_user_role(TEXT, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_user(TEXT, UUID)            TO anon, authenticated;
-- _current_admin is a helper; no direct grant.
