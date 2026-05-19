-- Cloasta v1.1 Migration — Fix onboarding_completed for existing returning users
-- Run this query inside your Supabase SQL Editor:

UPDATE profiles 
SET onboarding_completed = true 
WHERE full_name IS NOT NULL 
AND onboarding_completed IS NOT DISTINCT FROM false;
