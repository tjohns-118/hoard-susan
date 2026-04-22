-- Link app_users to Supabase auth.users for production auth.
-- auth_user_id is set lazily on first login (email match).

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS app_users_auth_user_id_idx ON app_users (auth_user_id);
