-- Migration Script: Apply 3 Safety Revisions
-- Run this if you already have the old schema deployed

-- ============================================================================
-- REVISION #1: Change plan default from 'free' to 'solo'
-- ============================================================================

-- Step 1: Update existing 'free' plan users to 'solo'
UPDATE public.profiles
SET plan = 'solo'
WHERE plan = 'free';

-- Step 2: Recreate the profiles table with new default and constraints
-- Note: This is a safe operation as we're just changing the default and CHECK constraint

-- Drop the old CHECK constraint
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_plan_check;

-- Add new CHECK constraint (only allows 'solo' and 'team')
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('solo', 'team'));

-- Change the default value for new users
ALTER TABLE public.profiles
ALTER COLUMN plan SET DEFAULT 'solo';

-- ============================================================================
-- REVISION #2: Remove email field from profiles
-- ============================================================================

-- Drop the email column (email already exists in auth.users)
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS email;

-- Update the trigger function to not include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- REVISION #3: Add security warnings for credit functions
-- ============================================================================

-- The functions themselves don't need to change, but we add clear comments
COMMENT ON FUNCTION public.deduct_credits IS 
'BACKEND USE ONLY - This function bypasses RLS and should ONLY be called from backend service with service role key. DO NOT expose to frontend.';

COMMENT ON FUNCTION public.add_credits IS 
'BACKEND USE ONLY - This function bypasses RLS and should ONLY be called from backend service with service role key. DO NOT expose to frontend.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify plan values
SELECT plan, COUNT(*) 
FROM public.profiles 
GROUP BY plan;
-- Expected result: Only 'solo' and 'team' values

-- Verify email column is removed
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles' 
  AND column_name = 'email';
-- Expected result: No rows (email column should not exist)

-- Verify function comments
SELECT routine_name, routine_comment 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('deduct_credits', 'add_credits');
-- Expected result: Both functions should have security warnings

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================

-- Uncomment and run this section ONLY if you need to rollback

-- -- Rollback Revision #2: Add email column back
-- ALTER TABLE public.profiles
-- ADD COLUMN email TEXT;
-- 
-- -- Rollback Revision #1: Allow 'free' plan again
-- ALTER TABLE public.profiles
-- DROP CONSTRAINT IF EXISTS profiles_plan_check;
-- 
-- ALTER TABLE public.profiles
-- ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'solo', 'team'));
-- 
-- ALTER TABLE public.profiles
-- ALTER COLUMN plan SET DEFAULT 'free';
