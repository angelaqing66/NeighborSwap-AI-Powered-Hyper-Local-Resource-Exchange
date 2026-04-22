-- supabase/migrations/20260421000006_create_reviews.sql
-- ============================================================
-- NeighborSwap — Reviews table
-- Counterparty (lender) can leave a 1–5 star review of the
-- initiator (borrower) after a trade is completed.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  sentiment_score SMALLINT, -- 0–100, produced by the sentiment agent
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trade_id, reviewer_id) -- one review per reviewer per trade
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Reviewer can insert their own review
CREATE POLICY "reviews_insert_own"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

-- Anyone can read reviews
CREATE POLICY "reviews_select_all"
  ON public.reviews FOR SELECT
  USING (true);

-- Function to recalculate trust_score from all reviews received
CREATE OR REPLACE FUNCTION public.recalculate_trust_score(p_user_id UUID)
RETURNS void AS $$
DECLARE
  avg_score NUMERIC;
BEGIN
  SELECT AVG(score) INTO avg_score
  FROM public.reviews
  WHERE reviewee_id = p_user_id;

  IF avg_score IS NOT NULL THEN
    UPDATE public.users
    SET trust_score = LEAST(100, GREATEST(0, ROUND((avg_score / 5.0) * 100)))
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
