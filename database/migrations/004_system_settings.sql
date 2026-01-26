-- Migration: Create system_settings table for admin configuration
-- Date: 2026-01-26
-- Purpose: Store reCAPTCHA and Google OAuth settings

-- Create system_settings table (singleton pattern)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  
  -- reCAPTCHA v3 settings
  recaptcha_enabled BOOLEAN NOT NULL DEFAULT false,
  recaptcha_site_key TEXT,
  recaptcha_secret_key TEXT,
  
  -- Google OAuth settings
  google_oauth_enabled BOOLEAN NOT NULL DEFAULT false,
  google_client_id TEXT,
  google_client_secret TEXT,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default row
INSERT INTO public.system_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Block all direct client access (only server-side supabaseAdmin can access)
CREATE POLICY "Block client SELECT on system_settings"
  ON public.system_settings
  FOR SELECT
  USING (false);

CREATE POLICY "Block client INSERT on system_settings"
  ON public.system_settings
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Block client UPDATE on system_settings"
  ON public.system_settings
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Block client DELETE on system_settings"
  ON public.system_settings
  FOR DELETE
  USING (false);
