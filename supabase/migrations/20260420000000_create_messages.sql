-- supabase/migrations/20260420000000_create_messages.sql
-- ============================================================
-- NeighborSwap — Messages table
-- Persists trade chat messages. One row per message; partitioned
-- by trade_id for efficient per-trade queries.
-- ============================================================


-- ----------------------------------------------------------------
-- 1. TABLE: messages
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id    UUID        NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  sender_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ----------------------------------------------------------------
-- 2. INDEXES
-- ----------------------------------------------------------------

-- "Load all messages for trade X, oldest first"
CREATE INDEX idx_messages_trade_id_sent_at
  ON messages (trade_id, sent_at ASC);

-- "Show all messages sent by user Y" (for moderation / audit)
CREATE INDEX idx_messages_sender_id
  ON messages (sender_id, sent_at DESC);


-- ----------------------------------------------------------------
-- 3. ROW-LEVEL SECURITY
-- Only parties to the parent trade may read or insert messages.
-- ----------------------------------------------------------------
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_trade_participant"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trades t
      WHERE t.id = messages.trade_id
        AND (t.initiator_id = auth.uid() OR t.counterparty_id = auth.uid())
    )
  );

CREATE POLICY "messages_insert_trade_participant"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.trades t
      WHERE t.id = trade_id
        AND (t.initiator_id = auth.uid() OR t.counterparty_id = auth.uid())
    )
  );

-- No update or delete for regular users — messages are immutable once sent.
CREATE POLICY "messages_no_user_update"
  ON messages FOR UPDATE
  USING (false);

CREATE POLICY "messages_no_user_delete"
  ON messages FOR DELETE
  USING (false);


-- ----------------------------------------------------------------
-- 4. COLUMN COMMENTS
-- ----------------------------------------------------------------
COMMENT ON TABLE  messages           IS 'Chat messages exchanged within a trade negotiation.';
COMMENT ON COLUMN messages.trade_id  IS 'The trade this message belongs to.';
COMMENT ON COLUMN messages.sender_id IS 'User who sent the message.';
COMMENT ON COLUMN messages.content   IS 'Message body; max 2000 characters.';
COMMENT ON COLUMN messages.sent_at   IS 'Client-supplied send timestamp; used for display ordering.';
