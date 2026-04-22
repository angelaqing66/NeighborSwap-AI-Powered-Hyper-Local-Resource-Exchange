-- Add is_admin flag to public.users.
-- The admin account (neighborswapAdmin@gmail.com) is created separately via
-- the Supabase dashboard or seed script. Only the database can set this flag.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
