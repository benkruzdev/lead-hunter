-- ============================================================================
-- Migration 018: Search Cache Tables (Cache-First Architecture)
-- ============================================================================
-- Adds shared platform-wide cache tables for query/page/place data.
-- search_sessions is extended additively (no columns removed).
-- ============================================================================

-- 1. Add query_key to search_sessions (additive, backward-compatible)
ALTER TABLE search_sessions
    ADD COLUMN IF NOT EXISTS query_key TEXT;

CREATE INDEX IF NOT EXISTS idx_search_sessions_query_key
    ON search_sessions (query_key);

-- 2. Search query cache (one row per unique query)
CREATE TABLE IF NOT EXISTS search_query_cache (
    query_key   TEXT PRIMARY KEY,
    -- Human-readable decomposition for admin UI
    province    TEXT,
    district    TEXT,
    category    TEXT,
    keyword     TEXT,
    min_rating  NUMERIC,
    min_reviews INTEGER,
    -- Result metadata
    total_results   INTEGER NOT NULL DEFAULT 0,
    all_place_ids   TEXT[]  NOT NULL DEFAULT '{}',  -- ordered full ID list for pagination
    -- Cache metadata
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
    hit_count   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_search_query_cache_expires
    ON search_query_cache (expires_at);

-- 3. Per-page results cache
CREATE TABLE IF NOT EXISTS search_query_pages (
    query_key   TEXT    NOT NULL,
    page_number INTEGER NOT NULL,
    results_json JSONB  NOT NULL,   -- render-ready SearchResult[] array
    place_ids   TEXT[]  NOT NULL DEFAULT '{}',  -- place IDs on this specific page
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
    hit_count   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (query_key, page_number)
);

CREATE INDEX IF NOT EXISTS idx_search_query_pages_expires
    ON search_query_pages (expires_at);

-- 4. Place-level cache (shared across all queries)
CREATE TABLE IF NOT EXISTS place_cache (
    place_id    TEXT PRIMARY KEY,
    data_json   JSONB NOT NULL,     -- mapped SearchResult shape (no hours/isOpen)
    cached_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
    hit_count   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_place_cache_expires
    ON place_cache (expires_at);

-- 5. Helper RPCs for atomic hit_count increments (used by backend/search.js)

CREATE OR REPLACE FUNCTION increment_place_cache_hits(p_place_ids TEXT[])
RETURNS VOID LANGUAGE SQL AS $$
    UPDATE place_cache SET hit_count = hit_count + 1
    WHERE place_id = ANY(p_place_ids);
$$;

CREATE OR REPLACE FUNCTION increment_query_cache_hit(p_query_key TEXT)
RETURNS VOID LANGUAGE SQL AS $$
    UPDATE search_query_cache SET hit_count = hit_count + 1
    WHERE query_key = p_query_key;
$$;

CREATE OR REPLACE FUNCTION increment_page_cache_hit(p_query_key TEXT, p_page_number INTEGER)
RETURNS VOID LANGUAGE SQL AS $$
    UPDATE search_query_pages SET hit_count = hit_count + 1
    WHERE query_key = p_query_key AND page_number = p_page_number;
$$;

