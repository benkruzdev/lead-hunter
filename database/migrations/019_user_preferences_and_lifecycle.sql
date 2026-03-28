-- Migration 019: User Preferences, Lifecycle Modeling, and System Events
-- Establishes the canonical schema boundary for full Settings/Account Center operations.

-- ============================================================================
-- 1. USER PREFERENCES MODEL
-- ============================================================================
-- Durable preferences storage, isolated from the core identity/profile table.

CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    
    -- Localization
    language TEXT NOT NULL DEFAULT 'tr',
    locale TEXT NOT NULL DEFAULT 'tr-TR',
    timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    
    -- App Defaults
    default_search_country TEXT NOT NULL DEFAULT 'TR',
    default_export_format TEXT NOT NULL DEFAULT 'xlsx' CHECK (default_export_format IN ('csv', 'xlsx', 'gsheets')),
    default_export_scope TEXT NOT NULL DEFAULT 'full' CHECK (default_export_scope IN ('compact', 'full')),
    
    -- Notifications & Alerts
    low_credit_warning_enabled BOOLEAN NOT NULL DEFAULT true,
    low_credit_warning_threshold INTEGER NOT NULL DEFAULT 100,
    product_updates_email_enabled BOOLEAN NOT NULL DEFAULT true,
    notifications_email_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
    ON public.user_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
    ON public.user_preferences FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all preferences"
    ON public.user_preferences FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Backfill preferences for existing users safely
INSERT INTO public.user_preferences (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;


-- ============================================================================
-- 2. EXPLICIT LIFECYCLE MODELING
-- ============================================================================
-- Moves beyond binary is_active / is_deleted into formal state definitions.

DO $$
BEGIN
    -- Add lifecycle columns safely if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'account_status') THEN
        ALTER TABLE public.profiles ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active' 
        CHECK (account_status IN ('active', 'inactive', 'soft_deleted', 'pending_hard_delete'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'deactivated_at') THEN
        ALTER TABLE public.profiles ADD COLUMN deactivated_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'reactivated_at') THEN
        ALTER TABLE public.profiles ADD COLUMN reactivated_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'hard_delete_requested_at') THEN
        ALTER TABLE public.profiles ADD COLUMN hard_delete_requested_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'hard_deleted_at') THEN
        ALTER TABLE public.profiles ADD COLUMN hard_deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'lifecycle_reason') THEN
        ALTER TABLE public.profiles ADD COLUMN lifecycle_reason TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'lifecycle_changed_by') THEN
        ALTER TABLE public.profiles ADD COLUMN lifecycle_changed_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Compatibility Backfill
-- Safe map from legacy fields (is_deleted, is_active, status) into canonical account_status without dropping old columns to prevent breaking code.
UPDATE public.profiles 
SET account_status = 'soft_deleted' 
WHERE is_deleted = true AND account_status != 'soft_deleted';

UPDATE public.profiles 
SET account_status = 'inactive' 
WHERE (is_active = false OR status = false) AND is_deleted = false AND account_status != 'inactive';


-- ============================================================================
-- 3. SECURITY & SYSTEM EVENTS BOUNDARY
-- ============================================================================
-- Capturing the missing system_events table schema used by admin logs and future security pages.
-- NOTE on user_sessions: Explicitly NOT created. Supabase auth.sessions handles this perfectly.
-- Re-inventing sessions internally bloats the local database. Event logging is sufficient.

CREATE TABLE IF NOT EXISTS public.system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'success')),
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name TEXT,
    actor_email TEXT,
    subject_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    subject_name TEXT,
    subject_email TEXT,
    target_type TEXT,
    target_id TEXT,
    message TEXT NOT NULL,
    credit_delta INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient chronological and user audit querying
CREATE INDEX IF NOT EXISTS system_events_event_type_idx ON public.system_events(event_type);
CREATE INDEX IF NOT EXISTS system_events_actor_user_id_idx ON public.system_events(actor_user_id);
CREATE INDEX IF NOT EXISTS system_events_subject_user_id_idx ON public.system_events(subject_user_id);
CREATE INDEX IF NOT EXISTS system_events_created_at_idx ON public.system_events(created_at DESC);

-- Enable RLS for system_events
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

-- Users can theoretically view their own security events (read-only)
CREATE POLICY "Users can view own security events"
    ON public.system_events FOR SELECT
    USING (auth.uid() = actor_user_id OR auth.uid() = subject_user_id);

-- Admins can view all events (Audit log view)
CREATE POLICY "Admins can view all system events"
    ON public.system_events FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ──────────────────────────────────────────────────────────────
-- NO INSERT POLICY PROVIDED FOR SYSTEM_EVENTS
-- We intentionally omit general INSERT policies to enforce strict 
-- backend-only event logging via the Supabase Service Role key,
-- preventing malicious or accidental client-side spoofing of audit logs.
-- ──────────────────────────────────────────────────────────────
