-- supabase/migrations/20260421000005_enable_messages_realtime.sql
-- ============================================================
-- Enable Supabase Realtime CDC on the messages table so that
-- client-side postgres_changes INSERT subscriptions receive new
-- chat messages without needing the custom Socket.io server.
-- ============================================================

-- REPLICA IDENTITY FULL makes the full row available in the
-- Realtime payload.  Required so the filter
-- (filter: `trade_id=eq.<uuid>`) on INSERT events works correctly.
ALTER TABLE messages REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
