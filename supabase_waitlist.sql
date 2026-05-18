-- Create cloasta_waitlist table
CREATE TABLE IF NOT EXISTS public.cloasta_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.cloasta_waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert waitlist signups
CREATE POLICY "Allow anonymous inserts to waitlist" 
ON public.cloasta_waitlist 
FOR INSERT 
TO anon 
WITH CHECK (true);

-- Restrict read/update/delete to service role or authenticated admins if needed
CREATE POLICY "Restrict select to authenticated users" 
ON public.cloasta_waitlist 
FOR SELECT 
TO authenticated 
USING (true);
