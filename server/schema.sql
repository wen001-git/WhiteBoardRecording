CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  username_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_scheme TEXT NOT NULL DEFAULT 'static-sha256-v1' CHECK (password_scheme IN ('scrypt-v1','static-sha256-v1')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  max_devices SMALLINT NOT NULL DEFAULT 3 CHECK (max_devices BETWEEN 1 AND 20),
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS password_scheme TEXT;
UPDATE accounts SET password_scheme='scrypt-v1' WHERE password_scheme IS NULL;
ALTER TABLE accounts ALTER COLUMN password_scheme SET DEFAULT 'static-sha256-v1';
ALTER TABLE accounts ALTER COLUMN password_scheme SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='accounts_password_scheme_check' AND conrelid='accounts'::regclass
  ) THEN
    ALTER TABLE accounts ADD CONSTRAINT accounts_password_scheme_check
      CHECK (password_scheme IN ('scrypt-v1','static-sha256-v1'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS devices (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, device_id)
);

CREATE INDEX IF NOT EXISTS devices_account_id_idx ON devices(account_id);

CREATE TABLE IF NOT EXISTS login_events (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS login_events_account_time_idx ON login_events(account_id, logged_in_at DESC);
