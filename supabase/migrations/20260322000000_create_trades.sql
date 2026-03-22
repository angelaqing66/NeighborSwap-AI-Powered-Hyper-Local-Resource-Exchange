-- supabase/migrations/20260322000000_create_trades.sql
-- ============================================================
-- NeighborSwap — Trades table
-- Tracks the full lifecycle of a resource exchange between two
-- neighbors, from initial offer through completion or cancellation.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. ENUM: trade_status
--
-- Lifecycle:
--   pending_offer → negotiating → accepted → [flagged] → scheduled
--   → in_progress → completed   (success)
--                → cancelled    (withdrawn before in_progress)
--                → disputed     (problem after in_progress)
--
-- Terminal statuses: completed | cancelled | disputed | flagged
-- ----------------------------------------------------------------
CREATE TYPE trade_status AS ENUM (
  'pending_offer',  -- Initiator sent an offer; counterparty hasn't responded.
  'negotiating',    -- Counterparty engaged; terms are being refined via chat.
  'accepted',       -- Both parties agreed. AI agent pipeline fires here.
  'flagged',        -- Safety agent returned 'block'; trade frozen for review.
  'scheduled',      -- Logistics agent confirmed time + location.
  'in_progress',    -- Physical exchange or service delivery is underway.
  'completed',      -- Both parties confirmed successful exchange.
  'cancelled',      -- A party withdrew before in_progress.
  'disputed'        -- Problem reported; escalated to moderator / AI review.
);


-- ----------------------------------------------------------------
-- 2. TABLE: trades
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trades (
  -- Primary key
  id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties
  -- ON DELETE RESTRICT prevents orphaned trades on account deletion.
  initiator_id            UUID            NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  counterparty_id         UUID            NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Listing being exchanged.
  -- FK to listings(id) added in a later migration once that table exists,
  -- keeping migrations independently deployable.
  listing_id              UUID            NOT NULL,

  -- Status
  status                  trade_status    NOT NULL DEFAULT 'pending_offer',

  -- Agreed exchange description (e.g. "3 hrs lawn mowing for one bicycle").
  -- Updated during 'negotiating'; frozen at 'accepted'.
  agreed_terms            TEXT,

  -- ----------------------------------------------------------------
  -- AI Moderation — populated when status reaches 'accepted'.
  -- Mirrors AgentOutput from src/lib/agents/safety.ts.
  -- ----------------------------------------------------------------
  moderation_verdict      TEXT            CHECK (moderation_verdict IN ('allow', 'block', 'review')),
  moderation_confidence   NUMERIC(4, 3)   CHECK (moderation_confidence BETWEEN 0 AND 1),
  moderation_reasoning    TEXT,
  moderated_at            TIMESTAMPTZ,

  -- ----------------------------------------------------------------
  -- Vibe / trust signal — from src/lib/agents/vibe.ts.
  -- Score 0–100 computed at 'accepted'; applied to user trust
  -- profiles when status reaches 'completed'.
  -- ----------------------------------------------------------------
  vibe_score              SMALLINT        CHECK (vibe_score BETWEEN 0 AND 100),

  -- ----------------------------------------------------------------
  -- Logistics — JSONB output from src/lib/agents/logistics.ts.
  -- Shape: { method, scheduled_at, location: { lat, lng, label }, notes }
  -- JSONB keeps this extensible without future schema migrations.
  -- scheduled_at is also denormalized below for fast range queries.
  -- ----------------------------------------------------------------
  logistics_data          JSONB,

  -- Cancellation / dispute context
  cancellation_reason     TEXT,           -- set when status = 'cancelled'
  dispute_reason          TEXT,           -- set when status = 'disputed'

  -- Timestamps
  created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),
  accepted_at             TIMESTAMPTZ,    -- when status first became 'accepted'
  scheduled_at            TIMESTAMPTZ,    -- mirrors logistics_data.scheduled_at for fast range queries
  completed_at            TIMESTAMPTZ,    -- when status became 'completed'
  cancelled_at            TIMESTAMPTZ,    -- when status became 'cancelled'

  -- A user cannot trade with themselves
  CONSTRAINT trades_no_self_trade CHECK (initiator_id <> counterparty_id)
);


-- ----------------------------------------------------------------
-- 3. INDEXES
-- ----------------------------------------------------------------

-- "Show me all trades I'm involved in, newest first"
CREATE INDEX idx_trades_initiator_id_status
  ON trades (initiator_id, status, created_at DESC);

CREATE INDEX idx_trades_counterparty_id_status
  ON trades (counterparty_id, status, created_at DESC);

-- "Are there active trades on this listing?"
CREATE INDEX idx_trades_listing_id_status
  ON trades (listing_id, status);

-- At most one active or completed trade per listing.
-- Multiple pending_offer / negotiating rows are allowed simultaneously
-- (neighbors can express concurrent interest). Once a trade reaches
-- in_progress the listing is effectively locked.
CREATE UNIQUE INDEX idx_trades_listing_one_active
  ON trades (listing_id)
  WHERE status IN ('in_progress', 'completed');

-- AI moderation review queue
CREATE INDEX idx_trades_flagged
  ON trades (status, moderated_at)
  WHERE status = 'flagged';

-- Incremental sync / polling
CREATE INDEX idx_trades_updated_at
  ON trades (updated_at DESC);


-- ----------------------------------------------------------------
-- 4. TRIGGER: keep updated_at current
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trades_set_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ----------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY
--
-- The browser Supabase client (lib/supabase/client.ts) is bound by
-- these policies. The server-side service role key (used only in
-- Server Actions via lib/supabase/server.ts) bypasses RLS — this
-- matches the security model in CLAUDE.md.
-- ----------------------------------------------------------------
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Only parties to the trade can read it.
CREATE POLICY "trades_select_participant"
  ON trades FOR SELECT
  USING (
    auth.uid() = initiator_id
    OR auth.uid() = counterparty_id
  );

-- Only the initiator can create a trade offer.
CREATE POLICY "trades_insert_initiator"
  ON trades FOR INSERT
  WITH CHECK (auth.uid() = initiator_id);

-- Either party can update while the trade is in a mutable phase.
-- Terminal statuses are write-locked for regular users.
-- Fine-grained transition rules (e.g. only counterparty can move
-- pending_offer → negotiating) are enforced in actions/trades.ts,
-- not here, for testability.
CREATE POLICY "trades_update_participant"
  ON trades FOR UPDATE
  USING (
    (auth.uid() = initiator_id OR auth.uid() = counterparty_id)
    AND status NOT IN ('completed', 'cancelled', 'disputed', 'flagged')
  )
  WITH CHECK (
    auth.uid() = initiator_id
    OR auth.uid() = counterparty_id
  );

-- No hard deletes for regular users. Trades are an immutable audit
-- trail; use status = 'cancelled' instead of deleting rows.
CREATE POLICY "trades_no_user_delete"
  ON trades FOR DELETE
  USING (false);


-- ----------------------------------------------------------------
-- 6. COLUMN COMMENTS
-- ----------------------------------------------------------------
COMMENT ON TABLE  trades                       IS 'Full lifecycle of a resource exchange between two neighbors.';
COMMENT ON COLUMN trades.initiator_id          IS 'User who created the trade offer.';
COMMENT ON COLUMN trades.counterparty_id       IS 'User who owns the listing or accepts the barter.';
COMMENT ON COLUMN trades.listing_id            IS 'The listing being exchanged. FK to listings(id) added in a later migration.';
COMMENT ON COLUMN trades.status                IS 'Current lifecycle phase (see trade_status enum).';
COMMENT ON COLUMN trades.agreed_terms          IS 'Human-readable exchange description; frozen at accepted.';
COMMENT ON COLUMN trades.moderation_verdict    IS 'Safety agent verdict: allow | block | review.';
COMMENT ON COLUMN trades.moderation_confidence IS 'Safety agent confidence score 0.0–1.0.';
COMMENT ON COLUMN trades.moderation_reasoning  IS 'Safety agent plain-language explanation.';
COMMENT ON COLUMN trades.vibe_score            IS 'Vibe/trust agent score 0–100; applied to user profiles on completion.';
COMMENT ON COLUMN trades.logistics_data        IS 'Logistics agent output: method, scheduled_at, location, notes (JSONB).';
COMMENT ON COLUMN trades.cancellation_reason   IS 'Why the trade was cancelled; set only when status = cancelled.';
COMMENT ON COLUMN trades.dispute_reason        IS 'Problem description; set only when status = disputed.';
COMMENT ON COLUMN trades.scheduled_at          IS 'Mirrors logistics_data.scheduled_at for fast range queries.';
