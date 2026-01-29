-- Migration 009: Lead Enrichment
-- PRODUCT_SPEC 5.7: Add columns for enrichment data

ALTER TABLE public.lead_list_items
  ADD COLUMN IF NOT EXISTS social_links JSONB,
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT;

-- Optional: Add check constraint for enrichment_status
ALTER TABLE public.lead_list_items
  DROP CONSTRAINT IF EXISTS lead_list_items_enrichment_status_check;

ALTER TABLE public.lead_list_items
  ADD CONSTRAINT lead_list_items_enrichment_status_check
  CHECK (enrichment_status IS NULL OR enrichment_status IN ('success', 'failed'));
