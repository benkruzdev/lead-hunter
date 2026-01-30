-- Migration 012: Settings - Account Soft Delete
-- PRODUCT_SPEC 5.10: Ayarlar

-- Add soft delete columns to profiles if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'is_deleted'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END $$;

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON public.profiles(is_deleted);

-- Update RLS policies to exclude deleted profiles
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recreate with soft delete check
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id AND is_deleted = false);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id AND is_deleted = false)
    WITH CHECK (auth.uid() = id AND is_deleted = false);

-- Allow users to soft delete their own profile
CREATE POLICY "Users can soft delete own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
