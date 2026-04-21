// src/types/messages.ts
// Mirrors the messages table in supabase/migrations/20260420000000_create_messages.sql

export interface Message {
  id: string
  trade_id: string
  sender_id: string
  content: string
  sent_at: string // ISO-8601
  created_at: string // ISO-8601
}
