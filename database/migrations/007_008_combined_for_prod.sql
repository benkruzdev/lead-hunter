-- Run this SQL in Supabase SQL Editor if tables don't exist
-- This is migration 007 + 008 combined

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
DROP POLICY IF EXISTS "Users can view their own lists" ON public.lead_lists;
CREATE POLICY "Users can view their own lists"
    ON public.lead_lists FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own lists" ON public.lead_lists;
CREATE POLICY "Users can create their own lists"
    ON public.lead_lists FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own lists" ON public.lead_lists;
CREATE POLICY "Users can update their own lists"
    ON public.lead_lists FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own lists" ON public.lead_lists;
CREATE POLICY "Users can delete their own lists"
    ON public.lead_lists FOR DELETE
    USING (auth.uid() = user_id);

-- lead_list_items policies
DROP POLICY IF EXISTS "Users can view their own list items" ON public.lead_list_items;
CREATE POLICY "Users can view their own list items"
    ON public.lead_list_items FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own list items" ON public.lead_list_items;
CREATE POLICY "Users can create their own list items"
    ON public.lead_list_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own list items" ON public.lead_list_items;
CREATE POLICY "Users can update their own list items"
    ON public.lead_list_items FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own list items" ON public.lead_list_items;
CREATE POLICY "Users can delete their own list items"
    ON public.lead_list_items FOR DELETE
    USING (auth.uid() = user_id);

-- RPC Function for atomic add
CREATE OR REPLACE FUNCTION public.add_leads_to_list_atomic(
    p_user_id UUID,
    p_list_id UUID,
    p_leads JSONB,
    p_dry_run BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_list_exists BOOLEAN;
    v_existing_place_ids TEXT[];
    v_lead JSONB;
    v_place_id TEXT;
    v_to_insert JSONB[] := '{}';
    v_credit_cost INTEGER := 0;
    v_current_credits INTEGER;
    v_inserted_count INTEGER := 0;
    v_error_detail JSONB;
BEGIN
    IF jsonb_typeof(p_leads) != 'array' THEN
        RAISE EXCEPTION 'INVALID_PAYLOAD';
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM public.lead_lists
        WHERE id = p_list_id AND user_id = p_user_id
    ) INTO v_list_exists;

    IF NOT v_list_exists THEN
        RAISE EXCEPTION 'LIST_NOT_FOUND';
    END IF;

    SELECT COALESCE(ARRAY_AGG(place_id), ARRAY[]::TEXT[])
    INTO v_existing_place_ids
    FROM public.lead_list_items
    WHERE list_id = p_list_id;

    FOR v_lead IN SELECT * FROM jsonb_array_elements(p_leads)
    LOOP
        v_place_id := COALESCE(v_lead->>'place_id', v_lead->>'id');
        
        IF v_place_id IS NULL THEN
            RAISE EXCEPTION 'INVALID_LEAD'
                USING DETAIL = 'missing_place_id';
        END IF;

        IF NOT (v_place_id = ANY(v_existing_place_ids)) THEN
            v_to_insert := array_append(v_to_insert, v_lead);
        END IF;
    END LOOP;

    v_credit_cost := COALESCE(array_length(v_to_insert, 1), 0);

    IF p_dry_run THEN
        RETURN jsonb_build_object(
            'creditCost', v_credit_cost,
            'wouldAddCount', v_credit_cost,
            'wouldSkipCount', jsonb_array_length(p_leads) - v_credit_cost
        );
    END IF;

    IF v_credit_cost = 0 THEN
        RETURN jsonb_build_object(
            'addedCount', 0,
            'skippedCount', jsonb_array_length(p_leads)
        );
    END IF;

    SELECT credits INTO v_current_credits
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_current_credits IS NULL OR v_current_credits < v_credit_cost THEN
        v_error_detail := jsonb_build_object(
            'available', COALESCE(v_current_credits, 0),
            'required', v_credit_cost
        );
        RAISE EXCEPTION 'INSUFFICIENT_CREDITS'
            USING DETAIL = v_error_detail::TEXT;
    END IF;

    UPDATE public.profiles
    SET credits = credits - v_credit_cost
    WHERE id = p_user_id;

    FOR v_lead IN SELECT * FROM unnest(v_to_insert)
    LOOP
        v_place_id := COALESCE(v_lead->>'place_id', v_lead->>'id');
        
        INSERT INTO public.lead_list_items (
            user_id,
            list_id,
            place_id,
            name,
            phone,
            website,
            email,
            rating,
            reviews_count,
            raw
        ) VALUES (
            p_user_id,
            p_list_id,
            v_place_id,
            v_lead->>'name',
            v_lead->>'phone',
            v_lead->>'website',
            v_lead->>'email',
            (v_lead->>'rating')::NUMERIC,
            COALESCE((v_lead->>'reviews')::INTEGER, (v_lead->>'reviews_count')::INTEGER),
            v_lead
        );
        
        v_inserted_count := v_inserted_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'addedCount', v_inserted_count,
        'skippedCount', jsonb_array_length(p_leads) - v_inserted_count
    );
END;
$$;
