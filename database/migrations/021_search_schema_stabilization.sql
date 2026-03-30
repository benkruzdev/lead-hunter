-- ============================================================================
-- Migration 021: Search Schema Stabilization
-- Purpose: Formalize country_code in search tracking surfaces to prevent
-- frontend/backend drift, while maintaining strict backward compatibility.
-- ============================================================================

-- 1. Formalize country_code on search_sessions
-- Existing rows default to 'TR' gracefully, preserving historical behaviour.
ALTER TABLE public.search_sessions
  ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'TR';

-- 2. Formalize country_code on search_query_cache
-- Useful for admin cache analytics (filtering operations by country).
ALTER TABLE public.search_query_cache
  ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'TR';

-- 3. Formalize country_code on search_query_pages
-- Propagates country alignment to individual pages in the query
ALTER TABLE public.search_query_pages
  ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'TR';

-- ============================================================================
-- NOTE ON API PRODUCERS:
-- The canonical backend `/api/search` route ALWAYS supplies this value.
-- Any future direct DB inserts into these tables (e.g. cron jobs, internal
-- admin tools) MUST ensure `country_code` is explicitly parsed or populated.
-- ============================================================================
