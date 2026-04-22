// src/lib/agents/sentiment.ts
// Sentiment agent — analyzes a review comment and star rating to produce
// a sentiment score 0–100. Pure inference function: no DB access.
// DB writes from the result happen in actions/reviews.ts.

import { callGroq, GroqError } from './groq-client'
import { redactPii } from './safety'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface SentimentAgentInput {
  review_id: string // audit correlation only — never sent to Groq
  star_rating: number // 1–5
  comment: string | null
}

export interface SentimentAgentOutput {
  sentiment_score: number // 0–100
  confidence: number // 0.0–1.0
  reasoning: string
}

// ---------------------------------------------------------------------------
// Safe default returned when the model response cannot be parsed.
// Neutral score (50) so no reviewer is unfairly penalized by a parse error.
// ---------------------------------------------------------------------------
const PARSE_ERROR_DEFAULT: SentimentAgentOutput = {
  sentiment_score: 50,
  confidence: 0,
  reasoning: 'Sentiment agent could not parse the model response. Neutral score applied.',
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a review sentiment scoring agent for NeighborSwap, a hyper-local resource exchange platform.

Your job is to evaluate a review left after a completed trade. The review has a star rating (1–5) and an optional text comment. Combine both signals to produce a sentiment score from 0 to 100.

Base score from star rating (before comment adjustment):
- 1 star → 20 base score
- 2 stars → 40 base score
- 3 stars → 60 base score
- 4 stars → 80 base score
- 5 stars → 100 base score

Adjust the base score up or down (±0–20 points) based on the tone and content of the comment:
- Very positive comment → add up to 10 points
- Neutral or absent comment → no adjustment
- Negative language in comment → subtract up to 10 points
- Contradicts the star rating significantly → bring closer to the comment's implied sentiment
- Clamp final score to [0, 100]

You must respond with a single JSON object — no markdown, no explanation outside the object.

Response schema:
{
  "sentiment_score": <integer 0–100>,
  "confidence": <number 0.0–1.0>,
  "reasoning": "<one or two sentences explaining the score>"
}

Confidence rules:
- Use 0.9+ when both star rating and comment agree and provide clear signal.
- Use 0.5–0.89 when only a star rating is provided or signals are mixed.
- Use 0.0–0.49 when the comment is too short or ambiguous to interpret.

Important: Do not include any PII in the reasoning field. Do not reference specific names, phone numbers, or addresses.`

function buildUserPrompt(input: SentimentAgentInput): string {
  const starBase = Math.round((input.star_rating / 5) * 100)
  const commentText = input.comment !== null ? redactPii(input.comment) : '(no comment provided)'

  return `Star rating: ${input.star_rating}/5 (base score: ${starBase})

Review comment:
${commentText}`
}

// ---------------------------------------------------------------------------
// parseResponse
//
// Attempts to extract a valid SentimentAgentOutput from the raw model string.
// Returns PARSE_ERROR_DEFAULT on any failure — never throws.
// ---------------------------------------------------------------------------
function parseResponse(raw: string): SentimentAgentOutput {
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

  const { sentiment_score, confidence, reasoning } = parsed as Record<string, unknown>

  if (typeof sentiment_score !== 'number' || sentiment_score < 0 || sentiment_score > 100) {
    return PARSE_ERROR_DEFAULT
  }

  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    return PARSE_ERROR_DEFAULT
  }

  if (typeof reasoning !== 'string' || reasoning.trim() === '') {
    return PARSE_ERROR_DEFAULT
  }

  return {
    sentiment_score: Math.round(sentiment_score),
    confidence,
    reasoning,
  }
}

// ---------------------------------------------------------------------------
// runSentiment — the exported agent function
// ---------------------------------------------------------------------------
export async function runSentiment(input: SentimentAgentInput): Promise<SentimentAgentOutput> {
  let raw: string

  try {
    raw = await callGroq(SYSTEM_PROMPT, buildUserPrompt(input))
  } catch (err) {
    const message = err instanceof GroqError ? err.message : 'Unknown error contacting Groq API'
    return {
      sentiment_score: 50,
      confidence: 0,
      reasoning: `Sentiment agent unavailable — neutral score applied. (${message})`,
    }
  }

  return parseResponse(raw)
}
