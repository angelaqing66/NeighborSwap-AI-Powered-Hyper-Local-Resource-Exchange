-- supabase/migrations/20260422000000_widen_review_score_to_100.sql
-- Widen reviews.score constraint from 1–5 to 1–100 so users can give
-- a fine-grained score. recalculate_trust_score updated for the new scale.

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_score_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_score_check CHECK (score BETWEEN 1 AND 100);

-- Recalculate trust_score directly on the 1-100 scale (was: avg/5*100)
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
    SET trust_score = LEAST(100, GREATEST(0, ROUND(avg_score)))
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
