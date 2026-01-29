-- Migration 011: Billing System
-- PRODUCT_SPEC 5.9: Faturalandırma

-- ============================================================================
-- TABLES
-- ============================================================================

-- Plans (Solo, Team)
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name_tr TEXT NOT NULL,
    display_name_en TEXT NOT NULL,
    user_limit INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credit Packages
CREATE TABLE IF NOT EXISTS public.credit_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name_tr TEXT NOT NULL,
    display_name_en TEXT NOT NULL,
    credits INTEGER NOT NULL,
    price_try DECIMAL(10,2) NOT NULL,
    price_usd DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES public.credit_packages(id) ON DELETE RESTRICT,
    payment_method TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TRY',
    credits INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_reference TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Plans: Public read access
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are viewable by everyone"
    ON public.plans FOR SELECT
    USING (true);

-- Credit Packages: Public read access (only active)
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active credit packages are viewable by everyone"
    ON public.credit_packages FOR SELECT
    USING (is_active = true);

-- Orders: Users can view own orders, service role can insert/update
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
    ON public.orders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
    ON public.orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- RPC FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_order_and_add_credits(
    p_order_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_credits_added INTEGER;
BEGIN
    -- Fetch order and validate
    SELECT user_id, credits, status INTO v_order
    FROM public.orders
    WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_INVALID' USING MESSAGE = 'Order not found';
    END IF;
    
    IF v_order.status != 'pending' THEN
        RAISE EXCEPTION 'ORDER_INVALID' USING MESSAGE = 'Order is not pending';
    END IF;
    
    -- Update order status
    UPDATE public.orders
    SET status = 'completed', completed_at = NOW()
    WHERE id = p_order_id;
    
    -- Increment user credits
    UPDATE public.profiles
    SET credits = credits + v_order.credits
    WHERE id = v_order.user_id;
    
    -- Insert credit transaction if table exists
    IF to_regclass('public.credit_transactions') IS NOT NULL THEN
        INSERT INTO public.credit_transactions (user_id, amount, type, description)
        VALUES (v_order.user_id, v_order.credits, 'purchase', 'Credit purchase from order #' || p_order_id);
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'userId', v_order.user_id,
        'creditsAdded', v_order.credits
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Seed plans (Safe with ON CONFLICT)
INSERT INTO public.plans (name, display_name_tr, display_name_en, user_limit, is_active)
VALUES 
    ('solo', 'Solo', 'Solo', 1, true),
    ('team', 'Team', 'Team', 3, true)
ON CONFLICT (name) DO NOTHING;

-- Seed credit packages
INSERT INTO public.credit_packages (name, display_name_tr, display_name_en, credits, price_try, price_usd, is_active, sort_order)
VALUES 
    ('starter', 'Başlangıç', 'Starter', 1000, 99.00, 10.00, true, 1),
    ('growth', 'Büyüme', 'Growth', 5000, 399.00, 40.00, true, 2),
    ('pro', 'Profesyonel', 'Professional', 15000, 999.00, 100.00, true, 3)
ON CONFLICT (name) DO NOTHING;
