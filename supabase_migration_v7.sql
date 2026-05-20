-- supabase_migration_v7.sql
-- Fix 403 Forbidden issues by recreating correct RLS policies and usage_tracking table

DROP POLICY IF EXISTS "own profile" ON profiles;
DROP POLICY IF EXISTS "own prompts" ON prompts;
DROP POLICY IF EXISTS "own sessions" ON sessions;

CREATE POLICY "own profile" ON profiles
FOR ALL USING (auth.uid() = id);

CREATE POLICY "own prompts" ON prompts  
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "own sessions" ON sessions
FOR ALL USING (auth.uid() = user_id);

-- Also fix usage_tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  user_id uuid references auth.users primary key,
  prompts_used integer default 0,
  updated_at timestamptz default now()
);
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own usage" ON usage_tracking;
CREATE POLICY "own usage" ON usage_tracking
FOR ALL USING (auth.uid() = user_id);
