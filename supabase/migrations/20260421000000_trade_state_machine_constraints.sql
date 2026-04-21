-- supabase/migrations/20260421000000_trade_state_machine_constraints.sql
-- ============================================================
-- NeighborSwap — Trade state machine DB-level enforcement
--
-- Adds a BEFORE UPDATE trigger that validates every status change,
-- mirroring VALID_TRANSITIONS in src/types/trades.ts.
--
-- Transition graph (4 user-visible milestones mapped to DB statuses):
--   INQUIRY phase:  pending_offer ──► negotiating
--                   pending_offer ──► cancelled
--                   negotiating   ──► accepted
--                   negotiating   ──► cancelled
--   REQUESTED:      accepted      ──► in_progress   (user-initiated)
--                   accepted      ──► scheduled     (logistics agent)
--                   accepted      ──► flagged        (safety agent)
--                   accepted      ──► disputed
--   PICKED_UP:      scheduled     ──► in_progress
--   RETURNED:       in_progress   ──► completed
--                   in_progress   ──► disputed
--   Terminal:       completed, cancelled, disputed, flagged → ∅
-- ============================================================

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
    (OLD.status = 'pending_offer'  AND NEW.status IN ('negotiating', 'cancelled'))                        OR
    (OLD.status = 'negotiating'    AND NEW.status IN ('accepted', 'cancelled'))                           OR
    (OLD.status = 'accepted'       AND NEW.status IN ('in_progress', 'scheduled', 'flagged', 'disputed')) OR
    (OLD.status = 'scheduled'      AND NEW.status IN ('in_progress'))                                     OR
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

CREATE TRIGGER trades_validate_transition
  BEFORE UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION validate_trade_transition();
