-- Supabase Database Migration V3 for Mindwave (Auth & Subscription Rebuild)

-- 1. PROFILES TABLE
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  avatar_url text,
  subscription_plan text default 'free',
  subscription_status text default 'active',
  razorpay_customer_id text,
  credits int default 0,
  -- Application Specific Fields
  role text,
  goals text,
  communication_style text,
  active_context text,
  behavioral_memory text,
  never_forget text,
  target_ai text,
  passport_text text,
  active_mode text,
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_login timestamptz default now()
);

-- 2. SUBSCRIPTIONS TABLE
create table if not exists subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  plan_name text not null,
  status text not null,
  current_period_end timestamptz,
  razorpay_payment_id text,
  razorpay_order_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. USAGE TRACKING TABLE
create table if not exists usage_tracking (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  prompts_used int default 0,
  ai_generations int default 0,
  uploads int default 0,
  quota_usage jsonb default '{}'::jsonb,
  reset_date date default now()
);

-- Existing tables for application features
create table if not exists prompts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  input_text text,
  generated_prompt text,
  memory_mode text,
  created_at timestamptz default now()
);

create table if not exists memory_modes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  mode_name text,
  context text,
  updated_at timestamptz default now()
);

create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  session_input text,
  context_block text,
  source_ai text,
  target_ai text,
  session_type text,
  created_at timestamptz default now()
);

-- 4. RLS POLICIES
alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table usage_tracking enable row level security;
alter table prompts enable row level security;
alter table memory_modes enable row level security;
alter table sessions enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id);
create policy "own subscriptions" on subscriptions for select using (auth.uid() = user_id);
create policy "own usage" on usage_tracking for select using (auth.uid() = user_id);
create policy "own prompts" on prompts for all using (auth.uid() = user_id);
create policy "own modes" on memory_modes for all using (auth.uid() = user_id);
create policy "own sessions" on sessions for all using (auth.uid() = user_id);

-- 5. TRIGGERS & AUTOMATIC PROFILE CREATION
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 
    new.email, 
    new.raw_user_meta_data->>'avatar_url'
  );
  
  insert into public.usage_tracking (user_id)
  values (new.id);
  
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Automatic updated_at triggers
create or replace function update_modified_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists update_profiles_modtime on profiles;
create trigger update_profiles_modtime before update on profiles for each row execute procedure update_modified_column();

drop trigger if exists update_subscriptions_modtime on subscriptions;
create trigger update_subscriptions_modtime before update on subscriptions for each row execute procedure update_modified_column();

-- Indexes
create index if not exists idx_profiles_email on profiles(email);
create index if not exists idx_subscriptions_user_id on subscriptions(user_id);
create index if not exists idx_usage_user_id on usage_tracking(user_id);

-- RPC to increment prompts used safely
create or replace function increment_prompts_used(user_id_param uuid)
returns void as $$
begin
  update usage_tracking
  set prompts_used = prompts_used + 1
  where user_id = user_id_param;
end;
$$ language plpgsql security definer;
