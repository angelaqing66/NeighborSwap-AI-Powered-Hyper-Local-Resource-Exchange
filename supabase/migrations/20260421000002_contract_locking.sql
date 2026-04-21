-- supabase/migrations/20260421000002_contract_locking.sql
-- ============================================================
-- NeighborSwap — Contract locking for agreed_terms
--
-- The "digital contract" is locked when a trade transitions to
-- 'accepted' (i.e. when either party clicks "Request Swap").
-- After that point, agreed_terms must not change — any UPDATE
-- that attempts to modify the column while the trade is past the
-- negotiation phase is rejected at the DB layer.
--
-- This is a defense-in-depth layer below the application-level
-- guard in updateAgreedTermsAction (src/actions/trades.ts).
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_agreed_terms_modification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- No-op when agreed_terms is not changing.
  IF OLD.agreed_terms IS NOT DISTINCT FROM NEW.agreed_terms THEN
    RETURN NEW;
  END IF;

  -- Terms may only change while the trade is still in a
  -- pre-acceptance phase. Once the contract is locked (status
  -- moves to 'accepted' or beyond), the field is immutable.
  IF OLD.status NOT IN ('pending_offer', 'negotiating') THEN
    RAISE EXCEPTION
      'Trade %: agreed_terms is locked once the contract is accepted (current status: "%").',
      OLD.id, OLD.status
    USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trades_lock_agreed_terms
  BEFORE UPDATE ON trades
  FOR EACH ROW
  EXECUTE FUNCTION prevent_agreed_terms_modification();
