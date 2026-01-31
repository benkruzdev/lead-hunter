-- Migration 015: Fix profiles is_active/status column sync
-- Resolves: "record 'new' has no field 'is_active'" trigger errors
-- Ensures both status and is_active columns exist and stay in sync

-- Ensure status column exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status boolean NOT NULL DEFAULT true;

-- Ensure is_active column exists (needed for backward compatibility and trigger safety)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Backfill: sync existing data
DO $$
BEGIN
    -- If status has data but is_active doesn't, copy status to is_active
    UPDATE public.profiles 
    SET is_active = status 
    WHERE is_active IS NULL OR is_active != status;
    
    -- If is_active has data but status doesn't, copy is_active to status
    UPDATE public.profiles 
    SET status = is_active 
    WHERE status IS NULL OR status != is_active;
END $$;

-- Drop any existing conflicting triggers to avoid duplicates
DROP TRIGGER IF EXISTS profiles_sync_status_is_active ON public.profiles;
DROP TRIGGER IF EXISTS sync_profiles_status_is_active_trigger ON public.profiles;

-- Create robust sync function that handles both columns
CREATE OR REPLACE FUNCTION public.profiles_sync_status_is_active()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure both fields exist and are synced
    -- Priority: use status as source of truth, fallback to is_active, default to true
    
    -- If status is provided/changed, sync to is_active
    IF NEW.status IS NOT NULL THEN
        NEW.is_active := NEW.status;
    -- If status is null but is_active is provided, sync to status
    ELSIF NEW.is_active IS NOT NULL THEN
        NEW.status := NEW.is_active;
    -- If both null, set both to true
    ELSE
        NEW.status := true;
        NEW.is_active := true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to keep fields in sync
CREATE TRIGGER profiles_sync_status_is_active
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.profiles_sync_status_is_active();

-- Verify trigger is active
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'profiles_sync_status_is_active' 
        AND tgrelid = 'public.profiles'::regclass
    ) THEN
        RAISE EXCEPTION 'Trigger profiles_sync_status_is_active was not created successfully';
    END IF;
    
    RAISE NOTICE 'Migration 015 completed: status and is_active columns synced';
END $$;
