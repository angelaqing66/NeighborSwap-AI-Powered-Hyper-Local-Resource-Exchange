-- supabase/migrations/20260421000001_messages_add_event_type.sql
-- ============================================================
-- NeighborSwap — Add event_type to messages
--
-- Allows system-generated event messages to coexist with user chat
-- messages in the same table. NULL = regular chat message.
-- Non-null values use the format 'status:<new_status>', e.g.:
--   status:accepted, status:in_progress, status:completed,
--   status:cancelled, status:disputed
--
-- System event messages are inserted by updateTradeStatusAction
-- (src/actions/trades.ts) to provide a persistent in-chat record
-- of possession-transfer milestones.
-- ============================================================

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS event_type TEXT;

COMMENT ON COLUMN messages.event_type IS
  'System event type (e.g. status:in_progress). NULL for regular user chat messages.';
