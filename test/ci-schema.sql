-- Disposable CI database only, not a production migration.
CREATE TABLE accounts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),username text NOT NULL,email text UNIQUE NOT NULL,password_hash text NOT NULL);
CREATE UNIQUE INDEX accounts_username_ci ON accounts(lower(username));
CREATE TABLE player_progress(account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,ship text NOT NULL,credits bigint NOT NULL DEFAULT 0,uridium bigint NOT NULL DEFAULT 0,experience bigint NOT NULL DEFAULT 0,honor bigint NOT NULL DEFAULT 0,level integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE player_sessions(token_hash text PRIMARY KEY,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL);
CREATE TABLE player_inventory(account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,item_code text NOT NULL,PRIMARY KEY(account_id,item_code));
