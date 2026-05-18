-- Cloasta v1.0 Migration — Add Missing Columns
-- Run this in Supabase SQL Editor BEFORE deploying

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS 
  onboarding_completed boolean default false;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS 
  favourite_tools text;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS 
  communication_style text;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS 
  active_context text;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS 
  behavioral_memory text;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS 
  never_forget text;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS 
  target_ai text default 'All';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS 
  prompts_used_today integer default 0;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS 
  prompts_reset_date date default current_date;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS 
  passport_count integer default 0;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS 
  passport_text text;
