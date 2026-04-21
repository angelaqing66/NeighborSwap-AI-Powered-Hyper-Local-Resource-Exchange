// src/lib/agents/vibe.ts
// Vibe agent — community trust and social scoring for a trade listing.
// Pure inference function: no DB access, no Supabase imports.
// DB writes from the result happen in actions/trades.ts.

import { callGroq, GroqError } from './groq-client'
import { redactPii } from './safety'

// ---------------------------------------------------------------------------
// Interfaces — canonical shapes defined in CLAUDE.md Agent Conventions
// ---------------------------------------------------------------------------

export interface VibeAgentInput {
  trade_id: string // audit correlation only — never sent to Groq
  listing_title: string
  listing_description: string
  agreed_terms: string | null
}

export interface VibeAgentOutput {
  score: number // 0–100 community trust / vibe score
  confidence: number // 0.0–1.0
  reasoning: string
}

// ---------------------------------------------------------------------------
// Safe default returned when the model response cannot be parsed.
// Neutral score (50) so no trade is unfairly penalized by a parse error.
// ---------------------------------------------------------------------------
const PARSE_ERROR_DEFAULT: VibeAgentOutput = {
  score: 50,
  confidence: 0,
  reasoning: 'Vibe agent could not parse the model response. Neutral score applied.',
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a community trust and vibe scoring agent for NeighborSwap, a hyper-local resource exchange platform.

Your job is to evaluate the "vibe" of a listing and trade terms — how trustworthy, clear, and community-friendly the exchange appears — and return a score from 0 to 100.

You must respond with a single JSON object — no markdown, no explanation outside the object.

Response schema:
{
  "score": <integer 0–100>,
  "confidence": <number 0.0–1.0>,
  "reasoning": "<one or two sentences explaining the score>"
}

Scoring guide:
- 80–100: Excellent. Detailed, honest description; fair, mutual terms; friendly tone; clearly benefits the neighborhood.
- 60–79: Good. Adequate description and terms; nothing concerning; positive community fit.
- 40–59: Neutral. Description or terms are vague but not suspicious; standard exchange.
- 20–39: Below average. Sparse or one-sided; minor red flags; terms favor only one party.
- 0–19: Poor. Very vague, suspicious patterns, highly asymmetric terms, or strong red flags.

Confidence rules:
- Use 0.9+ when the listing gives enough signal to score confidently.
- Use 0.5–0.89 when the listing is thin but scoreable.
- Use 0.0–0.49 when the listing is too sparse to score reliably.

Important: Do not include any PII in the reasoning field. Do not reference specific names, phone numbers, or addresses.`

function buildUserPrompt(input: VibeAgentInput): string {
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
// Attempts to extract a valid VibeAgentOutput from the raw model string.
// Returns PARSE_ERROR_DEFAULT on any failure — never throws.
// ---------------------------------------------------------------------------
function parseResponse(raw: string): VibeAgentOutput {
  let parsed: unknown

  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    return PARSE_ERROR_DEFAULT
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return PARSE_ERROR_DEFAULT
  }

  const { score, confidence, reasoning } = parsed as Record<string, unknown>

  if (typeof score !== 'number' || score < 0 || score > 100) {
    return PARSE_ERROR_DEFAULT
  }

  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    return PARSE_ERROR_DEFAULT
  }

  if (typeof reasoning !== 'string' || reasoning.trim() === '') {
    return PARSE_ERROR_DEFAULT
  }

  return {
    score: Math.round(score),
    confidence,
    reasoning,
  }
}

// ---------------------------------------------------------------------------
// runVibe — the exported agent function
// ---------------------------------------------------------------------------
export async function runVibe(input: VibeAgentInput): Promise<VibeAgentOutput> {
  let raw: string

  try {
    raw = await callGroq(SYSTEM_PROMPT, buildUserPrompt(input))
  } catch (err) {
    const message = err instanceof GroqError ? err.message : 'Unknown error contacting Groq API'
    return {
      score: 50,
      confidence: 0,
      reasoning: `Vibe agent unavailable — neutral score applied. (${message})`,
    }
  }

  return parseResponse(raw)
}
