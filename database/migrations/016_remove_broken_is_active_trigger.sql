-- Migration 016: Remove broken is_active trigger
-- Fixes: "record 'new' has no field 'is_active'" on all profile updates
-- Solution: Drop trigger/function referencing non-existent is_active column

-- Drop the broken trigger
DROP TRIGGER IF EXISTS sync_profiles_status_is_active_trigger ON public.profiles;

-- Drop the broken function
DROP FUNCTION IF EXISTS public.sync_profiles_status_is_active();

-- Verify cleanup
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'sync_profiles_status_is_active_trigger'
    ) THEN
        RAISE EXCEPTION 'Failed to drop sync_profiles_status_is_active_trigger';
    END IF;
    
    IF EXISTS (
        SELECT 1 
        FROM pg_proc 
        WHERE proname = 'sync_profiles_status_is_active'
    ) THEN
        RAISE EXCEPTION 'Failed to drop sync_profiles_status_is_active function';
    END IF;
    
    RAISE NOTICE 'Migration 016 completed: Removed broken is_active trigger and function';
    RAISE NOTICE 'profiles table now uses status column only';
END $$;
