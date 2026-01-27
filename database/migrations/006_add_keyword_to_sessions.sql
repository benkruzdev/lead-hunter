-- ============================================================================
-- Migration 006: Add keyword column to search_sessions
-- Purpose: PRODUCT_SPEC 5.4 - Search History display filters
-- ============================================================================

ALTER TABLE public.search_sessions
ADD COLUMN IF NOT EXISTS keyword TEXT;
