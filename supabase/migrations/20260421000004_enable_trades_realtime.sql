-- supabase/migrations/20260421000004_enable_trades_realtime.sql
-- ============================================================
-- Enable Supabase Realtime CDC on the trades table so that
-- client-side postgres_changes subscriptions receive status
-- update events without needing the custom Socket.io server.
-- ============================================================

-- REPLICA IDENTITY FULL makes the full row available in the
-- Realtime payload (old + new).  Required for row-level filters
-- (filter: `id=eq.<uuid>`) to work on UPDATE events.
ALTER TABLE trades REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE trades;
