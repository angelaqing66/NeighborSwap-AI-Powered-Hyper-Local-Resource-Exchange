// src/types/trades.ts
// Mirrors the trade_status enum and trades table in
// supabase/migrations/20260322000000_create_trades.sql

// ---------------------------------------------------------------------------
// trade_status — mirrors the PostgreSQL ENUM of the same name
// ---------------------------------------------------------------------------
export type TradeStatus =
  | 'pending_offer'  // Initiator sent an offer; counterparty hasn't responded.
  | 'negotiating'    // Counterparty engaged; terms are being refined via chat.
  | 'accepted'       // Both parties agreed. AI agent pipeline fires here.
  | 'flagged'        // Safety agent returned 'block'; trade frozen for review.
  | 'scheduled'      // Logistics agent confirmed time + location.
  | 'in_progress'    // Physical exchange or service delivery is underway.
  | 'completed'      // Both parties confirmed successful exchange.
  | 'cancelled'      // A party withdrew before in_progress.
  | 'disputed';      // Problem reported; escalated to moderator / AI review.

export const TERMINAL_STATUSES = [
  'completed',
  'cancelled',
  'disputed',
  'flagged',
] as const satisfies readonly TradeStatus[];

export type TerminalTradeStatus = (typeof TERMINAL_STATUSES)[number];

// ---------------------------------------------------------------------------
// LogisticsData — typed shape of the logistics_data JSONB column.
// Produced by src/lib/agents/logistics.ts.
// ---------------------------------------------------------------------------
export type LogisticsMethod = 'pickup' | 'delivery' | 'digital';

export interface LogisticsData {
  method: LogisticsMethod;
  scheduled_at: string;        // ISO-8601
  location?: {
    lat: number;
    lng: number;
    label: string;
  };
  notes?: string;
}

// ---------------------------------------------------------------------------
// ModerationVerdict — mirrors the CHECK constraint on moderation_verdict.
// Produced by src/lib/agents/safety.ts.
// ---------------------------------------------------------------------------
export type ModerationVerdict = 'allow' | 'block' | 'review';

// ---------------------------------------------------------------------------
// Trade — mirrors every column in the trades table.
//
// Nullable columns that the DB leaves as NULL until a lifecycle phase is
// reached are typed as `string | null`, `number | null`, etc.
// ---------------------------------------------------------------------------
export interface Trade {
  // Identity
  id: string;                          // UUID

  // Parties
  initiator_id: string;                // UUID → auth.users
  counterparty_id: string;             // UUID → auth.users

  // Listing (FK to listings.id added in a later migration)
  listing_id: string;                  // UUID

  // Status
  status: TradeStatus;

  // Terms
  agreed_terms: string | null;

  // AI Moderation (populated at 'accepted')
  moderation_verdict: ModerationVerdict | null;
  moderation_confidence: number | null; // 0.0–1.0
  moderation_reasoning: string | null;
  moderated_at: string | null;          // ISO-8601

  // Vibe / trust (populated at 'accepted')
  vibe_score: number | null;            // 0–100

  // Logistics (populated at 'scheduled')
  logistics_data: LogisticsData | null;

  // Cancellation / dispute context
  cancellation_reason: string | null;
  dispute_reason: string | null;

  // Timestamps
  created_at: string;                   // ISO-8601, NOT NULL
  updated_at: string;                   // ISO-8601, NOT NULL
  accepted_at: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

// ---------------------------------------------------------------------------
// Insertion / mutation shapes used by Server Actions in actions/trades.ts
// ---------------------------------------------------------------------------

/** Payload for creating a new trade offer (status defaults to 'pending_offer'). */
export type CreateTradeInput = Pick<
  Trade,
  'initiator_id' | 'counterparty_id' | 'listing_id'
> & {
  agreed_terms?: string;
};

/** Payload for updating mutable fields during negotiation. */
export type UpdateTradeInput = Partial<
  Pick<Trade, 'status' | 'agreed_terms' | 'cancellation_reason' | 'dispute_reason'>
>;

/** Payload written by the AI agent runner after moderation completes. */
export type ModerationUpdate = Required<
  Pick<
    Trade,
    | 'moderation_verdict'
    | 'moderation_confidence'
    | 'moderation_reasoning'
    | 'moderated_at'
  >
>;

/** Payload written by the logistics agent after scheduling. */
export type LogisticsUpdate = Required<
  Pick<Trade, 'logistics_data' | 'scheduled_at'>
>;
