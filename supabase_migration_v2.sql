-- Mindwave v2.0 Production Migration

-- 1. Add Monetization Columns to Profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan_tier text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS prompts_used_today integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS prompts_reset_date text DEFAULT '',
ADD COLUMN IF NOT EXISTS passport_count integer DEFAULT 0;

-- 2. Add New 6-Layer Passport Columns to Profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS communication_style text,
ADD COLUMN IF NOT EXISTS active_context text,
ADD COLUMN IF NOT EXISTS behavioral_memory text,
ADD COLUMN IF NOT EXISTS never_forget text,
ADD COLUMN IF NOT EXISTS target_ai text DEFAULT 'All';

-- 3. Create Sessions table (if not exists) for Session Sync
CREATE TABLE IF NOT EXISTS public.sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_input text,
    context_block text,
    session_type text DEFAULT 'sync',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS on Sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own sessions."
    ON public.sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own sessions."
    ON public.sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions."
    ON public.sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions."
    ON public.sessions FOR DELETE
    USING (auth.uid() = user_id);
