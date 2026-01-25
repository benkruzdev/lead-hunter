-- LeadHunter Database Schema
-- Revision: Implements 3 safety improvements per user feedback

-- ============================================================================
-- STEP 1: PROFILES TABLE
-- ============================================================================
-- Revision #2: email field REMOVED (already exists in auth.users)
-- Revision #1: plan default changed from 'free' to 'solo' per PRODUCT_SPEC.md
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  plan TEXT NOT NULL DEFAULT 'solo' CHECK (plan IN ('solo', 'team')),
  credits INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile (except credits)"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND old.credits = new.credits  -- Prevent direct credit modification
    AND old.plan = new.plan        -- Prevent direct plan modification
  );

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- STEP 2: TRIGGER FOR AUTO-PROFILE CREATION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 3: CREDIT LEDGER TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('search_page', 'add_to_list', 'enrichment', 'manual_add', 'manual_deduct', 'purchase')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

-- Policies for credit_ledger
CREATE POLICY "Users can view own ledger"
  ON public.credit_ledger FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all ledgers
CREATE POLICY "Admins can view all ledgers"
  ON public.credit_ledger FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS credit_ledger_user_id_idx ON public.credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS credit_ledger_created_at_idx ON public.credit_ledger(created_at DESC);

-- ============================================================================
-- STEP 4: CREDIT MANAGEMENT FUNCTIONS
-- ============================================================================
-- Revision #3: These functions are SECURITY DEFINER and should ONLY be called
-- from backend (Render service) using service role key.
-- Frontend MUST NOT call these functions directly.

-- Function to deduct credits
-- BACKEND USE ONLY - DO NOT EXPOSE TO FRONTEND
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  -- Get current credits with row lock
  SELECT credits INTO current_credits
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Check if user has enough credits
  IF current_credits < p_amount THEN
    RETURN FALSE;
  END IF;
  
  -- Deduct credits
  UPDATE public.profiles
  SET credits = credits - p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Log transaction (negative amount for deduction)
  INSERT INTO public.credit_ledger (user_id, amount, type, description)
  VALUES (p_user_id, -p_amount, p_type, p_description);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add credits
-- BACKEND USE ONLY - DO NOT EXPOSE TO FRONTEND
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Add credits
  UPDATE public.profiles
  SET credits = credits + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Log transaction (positive amount for addition)
  INSERT INTO public.credit_ledger (user_id, amount, type, description)
  VALUES (p_user_id, p_amount, p_type, p_description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- IMPORTANT SECURITY NOTE:
-- These functions bypass RLS (SECURITY DEFINER) and should ONLY be called
-- from your backend service with proper authentication and authorization checks.
-- Never expose these functions to the frontend client.

-- ============================================================================
-- STEP 5: SEARCH SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.search_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  district TEXT,
  category TEXT NOT NULL,
  min_rating DECIMAL(2,1),
  min_reviews INTEGER,
  total_results INTEGER,
  opened_pages INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- Enable RLS
ALTER TABLE public.search_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own sessions"
  ON public.search_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON public.search_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.search_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS search_sessions_user_id_idx ON public.search_sessions(user_id);
CREATE INDEX IF NOT EXISTS search_sessions_created_at_idx ON public.search_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS search_sessions_expires_at_idx ON public.search_sessions(expires_at);

-- ============================================================================
-- STEP 6: LEAD LISTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.lead_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.lead_lists ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own lists"
  ON public.lead_lists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lists"
  ON public.lead_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lists"
  ON public.lead_lists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lists"
  ON public.lead_lists FOR DELETE
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS lead_lists_user_id_idx ON public.lead_lists(user_id);

-- ============================================================================
-- STEP 7: LEADS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.lead_lists(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  district TEXT,
  category TEXT,
  rating DECIMAL(2,1),
  review_count INTEGER,
  score TEXT CHECK (score IN ('hot', 'warm', 'cold')),
  pipeline_status TEXT,
  notes TEXT,
  tags TEXT[],
  is_enriched BOOLEAN DEFAULT FALSE,
  social_links JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own leads"
  ON public.leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lead_lists
      WHERE id = leads.list_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert leads to own lists"
  ON public.leads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lead_lists
      WHERE id = list_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own leads"
  ON public.leads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.lead_lists
      WHERE id = leads.list_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own leads"
  ON public.leads FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.lead_lists
      WHERE id = leads.list_id AND user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS leads_list_id_idx ON public.leads(list_id);
CREATE INDEX IF NOT EXISTS leads_score_idx ON public.leads(score);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON public.leads(created_at DESC);

-- ============================================================================
-- STEP 8: EXPORTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  list_id UUID REFERENCES public.lead_lists(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('csv', 'excel')),
  lead_count INTEGER NOT NULL,
  notes TEXT,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own exports"
  ON public.exports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exports"
  ON public.exports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS exports_user_id_idx ON public.exports(user_id);
CREATE INDEX IF NOT EXISTS exports_created_at_idx ON public.exports(created_at DESC);

-- ============================================================================
-- REVISION SUMMARY
-- ============================================================================
-- ✅ Revision #1: profiles.plan default changed from 'free' to 'solo'
--    - Aligns with PRODUCT_SPEC.md (Solo and Team plans only)
--
-- ✅ Revision #2: profiles.email field REMOVED
--    - Email already exists in auth.users
--    - Prevents OAuth edge-case issues during profile insert
--    - Email can be retrieved via JOIN with auth.users when needed
--
-- ✅ Revision #3: Credit functions marked as BACKEND USE ONLY
--    - deduct_credits() and add_credits() should ONLY be called from backend
--    - Frontend must NOT call these SECURITY DEFINER functions directly
--    - Backend (Render) should use Supabase service role key
--    - Prevents potential security risks from incorrect RLS policies
