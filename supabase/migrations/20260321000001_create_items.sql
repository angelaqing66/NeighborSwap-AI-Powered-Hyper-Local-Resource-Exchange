-- supabase/migrations/20260321000001_create_items.sql
-- ============================================================
-- NeighborSwap — Items table
-- Stores the listings (tools, resources) that providers are offering.
-- ============================================================

CREATE TYPE item_status AS ENUM (
  'available',
  'borrowed',
  'unlisted'
);

CREATE TABLE IF NOT EXISTS public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Provider relationship
  provider_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Item details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  
  -- NeighborSwap specific fields
  borrowing_rules TEXT,         -- E.g., "Return within 3 days", "Handle with care"
  status item_status NOT NULL DEFAULT 'available',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_items_provider_id ON public.items (provider_id);
CREATE INDEX idx_items_status ON public.items (status);

-- Trigger to keep updated_at current
CREATE TRIGGER items_set_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS Policies
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_select_all"
  ON public.items FOR SELECT
  USING (status != 'unlisted' OR auth.uid() = provider_id);

CREATE POLICY "items_insert_provider"
  ON public.items FOR INSERT
  WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "items_update_provider"
  ON public.items FOR UPDATE
  USING (auth.uid() = provider_id)
  WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "items_delete_provider"
  ON public.items FOR DELETE
  USING (auth.uid() = provider_id);

COMMENT ON TABLE public.items IS 'Resources available for lending on the platform.';
