-- ============================================
-- Cloasta v1.2 Production Migration
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Ensure profiles table has all required columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_mode TEXT DEFAULT 'founder';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_ai TEXT DEFAULT 'Common AI';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_context TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS behavioral_memory TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS never_forget TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS passport_text TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tour_completed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favourite_tools TEXT;

-- 2. Create usage_tracking table if not exists
CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    prompts_used INTEGER DEFAULT 0,
    ai_generations INTEGER DEFAULT 0,
    uploads INTEGER DEFAULT 0,
    reset_date TIMESTAMPTZ DEFAULT NOW(),
    quota_usage JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create subscriptions table if not exists
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    current_period_end TIMESTAMPTZ,
    razorpay_payment_id TEXT,
    razorpay_order_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create prompts table if not exists
CREATE TABLE IF NOT EXISTS prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    input_text TEXT,
    generated_prompt TEXT,
    memory_mode TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create sessions table if not exists
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_input TEXT,
    context_block TEXT,
    session_type TEXT DEFAULT 'sync',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create memory_modes table if not exists
CREATE TABLE IF NOT EXISTS memory_modes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mode_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Enable RLS on all tables
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_modes ENABLE ROW LEVEL SECURITY;

-- 8. RLS policies — users can read/write their own data
-- usage_tracking
DROP POLICY IF EXISTS "Users can view own usage" ON usage_tracking;
CREATE POLICY "Users can view own usage" ON usage_tracking FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own usage" ON usage_tracking;
CREATE POLICY "Users can insert own usage" ON usage_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own usage" ON usage_tracking;
CREATE POLICY "Users can update own usage" ON usage_tracking FOR UPDATE USING (auth.uid() = user_id);

-- subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- prompts
DROP POLICY IF EXISTS "Users can manage own prompts" ON prompts;
CREATE POLICY "Users can manage own prompts" ON prompts FOR ALL USING (auth.uid() = user_id);

-- sessions
DROP POLICY IF EXISTS "Users can manage own sessions" ON sessions;
CREATE POLICY "Users can manage own sessions" ON sessions FOR ALL USING (auth.uid() = user_id);

-- memory_modes
DROP POLICY IF EXISTS "Users can manage own modes" ON memory_modes;
CREATE POLICY "Users can manage own modes" ON memory_modes FOR ALL USING (auth.uid() = user_id);

-- profiles (ensure own-data policies exist)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 9. Fix existing users: set subscription_plan for any nulls
UPDATE profiles SET subscription_plan = 'free' WHERE subscription_plan IS NULL;
UPDATE profiles SET active_mode = 'founder' WHERE active_mode IS NULL;

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_modes_user_id ON memory_modes(user_id);
