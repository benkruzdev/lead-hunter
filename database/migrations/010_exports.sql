-- Migration 010: Exports
-- PRODUCT_SPEC 5.8: Export tracking and history

CREATE TABLE IF NOT EXISTS public.exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    list_id UUID NOT NULL REFERENCES public.lead_lists(id) ON DELETE CASCADE,
    format TEXT NOT NULL CHECK (format IN ('csv', 'xlsx')),
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    lead_count INTEGER NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for user queries
CREATE INDEX IF NOT EXISTS idx_exports_user_id ON public.exports(user_id);
CREATE INDEX IF NOT EXISTS idx_exports_created_at ON public.exports(created_at DESC);

-- RLS Policies
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exports"
    ON public.exports FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own exports"
    ON public.exports FOR INSERT
    WITH CHECK (auth.uid() = user_id);
