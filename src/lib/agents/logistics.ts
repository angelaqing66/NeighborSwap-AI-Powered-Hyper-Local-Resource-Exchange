// src/lib/agents/logistics.ts
// Logistics agent — infers pickup/delivery method and scheduling from listing context.
// Pure inference function: no DB access, no Supabase imports.
// DB writes from the result happen in actions/trades.ts.

import { callGroq, GroqError } from './groq-client'
import { redactPii } from './safety'
import type { LogisticsData } from '@/types/trades'

// ---------------------------------------------------------------------------
// Interfaces — canonical shapes defined in CLAUDE.md Agent Conventions
// ---------------------------------------------------------------------------

export interface LogisticsAgentInput {
  trade_id: string // audit correlation only — never sent to Groq
  listing_title: string
  listing_description: string
  agreed_terms: string | null
}

export interface LogisticsAgentOutput extends LogisticsData {}

// ---------------------------------------------------------------------------
// Safe default — returned when the model response cannot be parsed.
// Defaults to pickup in 3 days so the trade can still proceed.
// ---------------------------------------------------------------------------
function defaultOutput(): LogisticsAgentOutput {
  return {
    method: 'pickup',
    scheduled_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    notes:
      'Logistics agent could not determine scheduling. Please coordinate directly with the other party.',
  }
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a logistics coordination agent for NeighborSwap, a hyper-local resource exchange platform.

Your job is to analyze a listing and its agreed trade terms to recommend the best logistics method and schedule for the exchange.

You must respond with a single JSON object — no markdown, no explanation outside the object.

Response schema:
{
  "method": "pickup" | "delivery" | "digital",
  "scheduled_at": "<ISO-8601 datetime string>",
  "location": {
    "lat": <number>,
    "lng": <number>,
    "label": "<human-readable location label>"
  },
  "notes": "<optional short coordination note for both parties>"
}

Method rules:
- "pickup"  — physical item; the borrower collects from the lender's location.
- "delivery" — physical item; the lender delivers to the borrower's location.
- "digital" — files, accounts, software licenses, or skills exchanged online. Omit the location field entirely.

Scheduling rules:
- Set scheduled_at to a plausible future time within the next 7 days based on any scheduling hints in the agreed terms.
- If no scheduling hints exist, default to 3 days from now at 10:00 AM UTC.
- Always return a valid ISO-8601 datetime string (e.g. "2026-04-23T10:00:00Z").

Location rules:
- For pickup or delivery, provide a generic label (e.g. "Lender's front porch") if no specific address is mentioned.
- Use approximate coordinates (0, 0) when no real location can be inferred — the label is what matters.
- Never include raw PII (phone numbers, full names, exact street addresses) in the location label.`

function buildUserPrompt(input: LogisticsAgentInput): string {
  const terms = input.agreed_terms ?? '(none provided)'
  return `Listing title: ${redactPii(input.listing_title)}

Listing description:
${redactPii(input.listing_description)}

Agreed trade terms:
${redactPii(terms)}`
}

// ---------------------------------------------------------------------------
// parseResponse
//
// Attempts to extract a valid LogisticsAgentOutput from the raw model string.
// Returns defaultOutput() on any failure — never throws.
// ---------------------------------------------------------------------------
function parseResponse(raw: string): LogisticsAgentOutput {
  let parsed: unknown

  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    return defaultOutput()
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return defaultOutput()
  }

  const obj = parsed as Record<string, unknown>
  const { method, scheduled_at } = obj

  if (method !== 'pickup' && method !== 'delivery' && method !== 'digital') {
    return defaultOutput()
  }

  if (typeof scheduled_at !== 'string' || scheduled_at.trim() === '') {
    return defaultOutput()
  }

  const result: LogisticsAgentOutput = { method, scheduled_at }

  if (method !== 'digital' && typeof obj.location === 'object' && obj.location !== null) {
    const loc = obj.location as Record<string, unknown>
    if (
      typeof loc.lat === 'number' &&
      typeof loc.lng === 'number' &&
      typeof loc.label === 'string' &&
      loc.label.trim().length > 0
    ) {
      result.location = { lat: loc.lat, lng: loc.lng, label: loc.label }
    }
  }

  if (typeof obj.notes === 'string' && obj.notes.trim().length > 0) {
    result.notes = obj.notes
  }

  return result
}

// ---------------------------------------------------------------------------
// runLogistics — the exported agent function
// ---------------------------------------------------------------------------
export async function runLogistics(input: LogisticsAgentInput): Promise<LogisticsAgentOutput> {
  let raw: string

  try {
    raw = await callGroq(SYSTEM_PROMPT, buildUserPrompt(input))
  } catch (err) {
    const message = err instanceof GroqError ? err.message : 'Unknown error contacting Groq API'
    return {
      ...defaultOutput(),
      notes: `Logistics agent unavailable — default scheduling applied. (${message})`,
    }
  }

  return parseResponse(raw)
}
