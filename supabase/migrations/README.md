# Database Migrations

These SQL files harden the Highfield database. **Run them against your Supabase project via SQL Editor** (Dashboard → SQL Editor → paste → Run). They are safe to re-run — all statements use `IF NOT EXISTS` / `IF EXISTS` / `OR REPLACE` guards.

**Run in order, and only once you have deployed the matching client code**, because the schema changes will break the old client.

## `001_hash_pins.sql`

- Hashes every PIN in the `users` table with `bcrypt` (via `pgcrypto`).
- Drops the plaintext `pin` column.
- Adds `failed_attempts` + `locked_until` for rate limiting (5 wrong attempts = 10-minute lockout).
- Creates a `sessions` table for server-side session tokens (30-minute rolling expiry).
- Creates a `users_public` view so the client can read names/roles without seeing `pin_hash`.
- Revokes direct writes on `users`. All user management now goes through SECURITY DEFINER RPCs.
- Exposes these RPCs to the `anon` role:
  - `verify_pin(user_id, pin)` — the only way to log in.
  - `whoami(token)` — validates a stored session token.
  - `touch_session(token)` — extends expiry (used for idle timeout).
  - `logout(token)` — deletes a session token.
  - `create_user(token, name, pin, role)` — admin only.
  - `update_user_pin(token, user_id, new_pin)` — admin only.
  - `update_user_role(token, user_id, role)` — admin only.
  - `delete_user(token, user_id)` — admin only.

## `002_audit_log.sql`

- Creates an `audit_log` table that records sensitive operations (user create/update/delete, crew add/remove, job import).
- The client inserts rows directly after each mutation succeeds; the Settings page reads the last 50 rows and renders them under **Admin Activity**.

## `003_crew_profiles.sql`

- Adds `crew_type` (`'hs' | 'ewp' | 'chip'`) and `ewp_size` (`'30m' | '36m'`) columns to the `crews` table.
- The AI Scheduler uses these to route jobs to the right crew: H&S work goes to `crew_type='hs'`, 30m EWP jobs go to a `crew_type='ewp'` crew with `ewp_size='30m'`, and so on.
- Legacy crews stay `NULL` until an admin fills them in via **Settings → Crew Profiles**. The AI Scheduler shows a blocking banner if any crew is missing a type.

## `004_contracts.sql`

- Creates a `contracts` table (`id UUID`, `name TEXT`, `created_at`).
- Seeds the existing Highfield contract so it appears in the contract picker immediately.
- Adds a `create_contract(token, name)` RPC (admin only) that creates a new contract and clones the calling admin into it (same name, same PIN hash).

## After running migrations

1. Every user's **existing plaintext PIN will still work** — the migration hashes it in place, it doesn't reset it.
2. Log in, confirm the session works normally (you should see "Checking session…" briefly on reload while `whoami()` validates the token).
3. Enter the wrong PIN 5 times on purpose to confirm the lockout works.
4. Add / remove a user from Settings and confirm a row appears in **Admin Activity**.
