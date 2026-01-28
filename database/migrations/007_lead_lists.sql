-- PRODUCT_SPEC 5.5: Lead Lists
-- Migration 007: Lead Lists and Items

-- Lead Lists table
CREATE TABLE IF NOT EXISTS public.lead_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lead List Items table
CREATE TABLE IF NOT EXISTS public.lead_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    list_id UUID NOT NULL REFERENCES public.lead_lists(id) ON DELETE CASCADE,
    place_id TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    website TEXT,
    email TEXT,
    rating NUMERIC(2,1),
    reviews_count INTEGER,
    score TEXT,
    pipeline TEXT,
    note TEXT,
    tags TEXT[],
    raw JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_list_place UNIQUE(list_id, place_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lead_lists_user_id ON public.lead_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_list_items_user_id ON public.lead_list_items(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_list_items_list_id ON public.lead_list_items(list_id);

-- RLS Policies
ALTER TABLE public.lead_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_list_items ENABLE ROW LEVEL SECURITY;

-- lead_lists policies
CREATE POLICY "Users can view their own lists"
    ON public.lead_lists FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own lists"
    ON public.lead_lists FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lists"
    ON public.lead_lists FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lists"
    ON public.lead_lists FOR DELETE
    USING (auth.uid() = user_id);

-- lead_list_items policies
CREATE POLICY "Users can view their own list items"
    ON public.lead_list_items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own list items"
    ON public.lead_list_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own list items"
    ON public.lead_list_items FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own list items"
    ON public.lead_list_items FOR DELETE
    USING (auth.uid() = user_id);
