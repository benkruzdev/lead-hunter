-- Migration: Add role column to profiles table (if not exists)
-- Date: 2026-01-26
-- Purpose: Enable admin role for configuration management

-- Add role column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create index for admin queries
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);

-- Set admin role for authorized user
-- Replace email with actual admin email
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'ibrahim.ozturhan@outlook.com'
  LIMIT 1
);
