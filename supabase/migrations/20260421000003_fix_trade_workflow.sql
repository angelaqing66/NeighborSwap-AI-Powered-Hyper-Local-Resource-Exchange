-- supabase/migrations/20260421000003_fix_trade_workflow.sql
-- ============================================================
-- NeighborSwap — Trade workflow corrections
--
-- Three targeted fixes:
--
-- 1. Allow pending_offer → accepted (lender accepts a swap request
--    directly without the two-step Start Inquiry → Request Swap flow).
--
-- 2. Allow accepted → cancelled (either party can back out between
--    acceptance and physical pickup).
--
-- 3. Fix the item-lock unique index so it covers only in_progress,
--    NOT completed.  Previously a completed trade permanently blocked
--    the item from ever being borrowed again.
-- ============================================================

-- ── 1 & 2: Update the state machine trigger ──────────────────────────────────

CREATE OR REPLACE FUNCTION validate_trade_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- No-op when status is unchanged (e.g. updating logistics_data only)
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Terminal statuses are immutable
  IF OLD.status IN ('completed', 'cancelled', 'disputed', 'flagged') THEN
    RAISE EXCEPTION
      'Trade %: status "%" is terminal and cannot be changed.',
      OLD.id, OLD.status
    USING ERRCODE = 'check_violation';
  END IF;

  -- Validate the specific transition
  IF NOT (
    -- INQUIRY phase: lender can accept directly (new) or start negotiation (legacy)
    (OLD.status = 'pending_offer'  AND NEW.status IN ('negotiating', 'accepted', 'cancelled'))             OR
    (OLD.status = 'negotiating'    AND NEW.status IN ('accepted', 'cancelled'))                            OR
    -- ACCEPTED: initiator confirms pickup; either party can cancel before pickup (new) or dispute
    (OLD.status = 'accepted'       AND NEW.status IN ('in_progress', 'scheduled', 'flagged', 'disputed', 'cancelled')) OR
    -- SCHEDULED: logistics agent placed this; initiator confirms pickup
    (OLD.status = 'scheduled'      AND NEW.status IN ('in_progress'))                                      OR
    -- IN_PROGRESS: lender confirms return; either party can dispute
    (OLD.status = 'in_progress'    AND NEW.status IN ('completed', 'disputed'))
  ) THEN
    RAISE EXCEPTION
      'Trade %: invalid transition "%" → "%".',
      OLD.id, OLD.status, NEW.status
    USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3: Fix item-lock index (in_progress only, not completed) ─────────────────
--
-- Drop the old index that locked items permanently after completion, then
-- recreate it covering only the in_progress status.  After a lender
-- confirms return (→ completed) the item becomes available for new swaps.

DROP INDEX IF EXISTS idx_trades_item_one_active;

CREATE UNIQUE INDEX idx_trades_item_one_active
  ON trades (item_id)
  WHERE status = 'in_progress';
