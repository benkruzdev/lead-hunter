-- ============================================================================
-- Migration 005: Search Sessions & Credit System
-- Purpose: Track search sessions for credit optimization (Section 5.3)
-- NOT for Search History UI (Section 5.4 - future phase)
-- ============================================================================

-- ============================================================================
-- SEARCH SESSIONS TABLE
-- ============================================================================

-- Table to track which pages a user has viewed in a search
-- Purpose: Avoid charging credits twice for same page (credit optimization)
CREATE TABLE IF NOT EXISTS public.search_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Search parameters (for credit deduplication)
    province TEXT,
    district TEXT,
    category TEXT,
    min_rating NUMERIC(2,1),
    min_reviews INTEGER,
    
    -- Results metadata
    total_results INTEGER NOT NULL DEFAULT 0, -- Total count from search API
    
    -- Viewed pages tracking (for "already viewed = free" logic)
    viewed_pages INTEGER[] DEFAULT '{}', -- Page numbers user has already paid for
    
    -- Timestamps (30 days = PRODUCT_SPEC requirement)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    
    -- Constraints
    CONSTRAINT valid_rating CHECK (min_rating >= 0 AND min_rating <= 5)
);

-- Index for user lookups
CREATE INDEX idx_search_sessions_user_id ON public.search_sessions(user_id);

-- Index for expiry cleanup (cron job in future)
CREATE INDEX idx_search_sessions_expires_at ON public.search_sessions(expires_at);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.search_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own search sessions"
    ON public.search_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own search sessions"
    ON public.search_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own search sessions"
    ON public.search_sessions
    FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================================================
-- CREDIT DEDUCTION FUNCTION
-- ============================================================================

-- Idempotent credit deduction function
-- Used by backend to safely deduct credits without going negative
CREATE OR REPLACE FUNCTION public.decrement_credits(
    user_id UUID,
    amount INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_credits INTEGER;
BEGIN
    -- Update credits and return new value
    -- GREATEST ensures credits never go negative
    UPDATE public.profiles
    SET credits = GREATEST(credits - amount, 0)
    WHERE id = user_id
    RETURNING credits INTO new_credits;
    
    -- Return new credit balance
    RETURN new_credits;
END;
$$;

-- Grant execute to authenticated users (backend will use service role)
GRANT EXECUTE ON FUNCTION public.decrement_credits(UUID, INTEGER) TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================

-- Check table exists
-- SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'search_sessions');

-- Check RLS enabled
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'search_sessions';

-- Check function exists
-- SELECT proname FROM pg_proc WHERE proname = 'decrement_credits';
