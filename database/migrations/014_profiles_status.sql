-- Migration 014: Add profiles.status column and sync with is_active
-- SPEC 6.3: Admin user management requires status field

-- Add status column if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status boolean NOT NULL DEFAULT true;

-- Backfill status from is_active (if is_active exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'is_active'
    ) THEN
        UPDATE public.profiles SET status = COALESCE(is_active, true);
    END IF;
END $$;

-- Create sync function to keep status and is_active in sync
CREATE OR REPLACE FUNCTION public.sync_profiles_status_is_active()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync both columns to the same value
    -- Priority: use whichever is explicitly set, or default to true
    NEW.status := COALESCE(NEW.status, NEW.is_active, true);
    NEW.is_active := COALESCE(NEW.is_active, NEW.status, true);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS sync_profiles_status_is_active_trigger ON public.profiles;

CREATE TRIGGER sync_profiles_status_is_active_trigger
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profiles_status_is_active();
