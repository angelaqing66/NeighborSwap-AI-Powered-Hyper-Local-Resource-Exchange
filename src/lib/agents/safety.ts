// src/lib/agents/safety.ts
// Safety agent — PII redaction + content moderation.
// Pure inference function: no DB access, no Supabase imports.
// DB writes from the result happen in actions/trades.ts.

import { callGroq, GroqError } from './groq-client'
import type { ModerationVerdict } from '@/types/trades'

// ---------------------------------------------------------------------------
// Interfaces — canonical shapes defined in CLAUDE.md Agent Conventions
// ---------------------------------------------------------------------------

export interface SafetyAgentInput {
  trade_id: string // audit correlation only — never sent to Groq
  initiator_id: string // audit correlation only — never sent to Groq
  listing_title: string
  listing_description: string
  agreed_terms: string | null
}

export interface SafetyAgentOutput {
  verdict: ModerationVerdict // 'allow' | 'block' | 'review'
  confidence: number // 0.0–1.0
  reasoning: string
  redacted_description: string | null // PII replaced with [REDACTED]; null when verdict is 'allow'
}

// ---------------------------------------------------------------------------
// Safe default returned when the model response cannot be parsed.
// Deliberately conservative: routes to human review rather than blocking
// or auto-approving an unreadable response.
// ---------------------------------------------------------------------------
const PARSE_ERROR_DEFAULT: SafetyAgentOutput = {
  verdict: 'review',
  confidence: 0,
  reasoning: 'Safety agent could not parse the model response. Routed for manual review.',
  redacted_description: null,
}

// ---------------------------------------------------------------------------
// PII redaction — client-side pre-pass
//
// Strips known PII patterns before content is sent to Groq so that raw
// personal data never leaves the server in a prompt.
// The model is then asked to redact anything this pass may have missed.
//
// Each pattern is applied in order; earlier passes cannot re-introduce
// PII that later passes would miss.
// ---------------------------------------------------------------------------

const PII_PATTERNS: RegExp[] = [
  // Phone numbers — North American formats:
  //   +1 (408) 555-0199 | (408) 555-0199 | 408-555-0199
  //   408.555.0199      | 4085550199     | +14085550199
  /(\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]\d{4}/g,

  // Phone numbers — digit-only runs (10 or 11 digits, no separators):
  //   14085550199 | 4085550199
  /\b(\+?1)?\d{10}\b/g,

  // Email addresses
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,

  // SSNs — formatted with dashes or spaces: 123-45-6789 | 123 45 6789
  /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g,

  // Physical street addresses: "123 Main St", "456 Oak Avenue Apt 2B"
  // Matches: house number + 1–3 words + street-type keyword + optional unit
  /\b\d+\s+[A-Za-z]+(?:\s+[A-Za-z]+){0,2}\s+(?:Street|Avenue|Boulevard|Road|Drive|Lane|Court|Place|Way|Circle|Terrace|Trail|Square|St|Ave|Blvd|Rd|Dr|Ln|Ct|Pl)\.?(?:\s+(?:Apt|Suite|Unit|Ste)\.?\s*[\w-]+)?\b/gi,
]

export function redactPii(text: string): string {
  return PII_PATTERNS.reduce((redacted, pattern) => redacted.replace(pattern, '[REDACTED]'), text)
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a content safety and PII redaction agent for NeighborSwap, a hyper-local resource exchange platform.

Your job is to evaluate a listing and its agreed trade terms for two things:
1. PII (Personally Identifiable Information): phone numbers, email addresses, physical addresses, and full names.
2. Prohibited content: weapons, controlled substances, counterfeit goods, adult content, or anything illegal.

You must respond with a single JSON object — no markdown, no explanation outside the object.

Response schema:
{
  "verdict": "allow" | "block" | "review",
  "confidence": <number between 0.0 and 1.0>,
  "reasoning": "<one or two sentences explaining the verdict>",
  "redacted_description": "<listing description with all PII replaced by [REDACTED], or null if no PII was found>"
}

Verdict rules:
- "allow"  — content is clean, no PII, no prohibited items.
- "block"  — content contains prohibited items (weapons, drugs, illegal goods). Set confidence >= 0.85.
- "review" — content contains PII that could not be fully redacted, ambiguous items, or anything uncertain.

For redacted_description:
- Replace every phone number, email, street address, and full name with [REDACTED].
- If no PII is present, return null.
- Never include the original PII value anywhere in your response.`

function buildUserPrompt(input: SafetyAgentInput): string {
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
// Attempts to extract a valid SafetyAgentOutput from the raw model string.
// Returns PARSE_ERROR_DEFAULT on any failure — never throws.
// ---------------------------------------------------------------------------
function parseResponse(raw: string): SafetyAgentOutput {
  let parsed: unknown

  try {
    // Strip accidental markdown fences the model may add despite instructions
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    return PARSE_ERROR_DEFAULT
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('verdict' in parsed) ||
    !('confidence' in parsed) ||
    !('reasoning' in parsed)
  ) {
    return PARSE_ERROR_DEFAULT
  }

  const { verdict, confidence, reasoning, redacted_description } = parsed as Record<string, unknown>

  if (verdict !== 'allow' && verdict !== 'block' && verdict !== 'review') {
    return PARSE_ERROR_DEFAULT
  }

  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    return PARSE_ERROR_DEFAULT
  }

  if (typeof reasoning !== 'string' || reasoning.trim() === '') {
    return PARSE_ERROR_DEFAULT
  }

  return {
    verdict,
    confidence,
    reasoning,
    redacted_description: typeof redacted_description === 'string' ? redacted_description : null,
  }
}

// ---------------------------------------------------------------------------
// Message safety — interfaces, prompts, parser, and agent function
//
// Distinct from runSafety (listing-level) — this function scans a single
// chat message for PII and phishing links in real time.
// ---------------------------------------------------------------------------

export interface MessageSafetyInput {
  trade_id: string // audit correlation only — not sent to Groq
  sender_id: string // audit correlation only — not sent to Groq
  content: string // raw message text from the sender
}

export interface MessageSafetyOutput {
  verdict: ModerationVerdict // 'allow' | 'block' | 'review'
  confidence: number // 0.0–1.0
  reasoning: string
  redacted_content: string // message with PII replaced; equals original if nothing found
  has_phishing_link: boolean // true when a suspicious/phishing URL is detected
}

const MESSAGE_SAFETY_SYSTEM_PROMPT = `You are a real-time chat safety agent for NeighborSwap, a hyper-local resource exchange platform.

Your job is to scan a single chat message and:
1. Redact any PII (personally identifiable information): SSNs (xxx-xx-xxxx), physical street addresses, phone numbers, and email addresses.
2. Detect suspicious or phishing URLs: lookalike brand domains, IP-address URLs, URL shorteners used suspiciously, or links with suspicious TLDs (.xyz, .tk, .ml, .cf, .ga, .gq) that appear transactional.

You must respond with a single JSON object — no markdown, no explanation outside the object.

Response schema:
{
  "verdict": "allow" | "block" | "review",
  "confidence": <number between 0.0 and 1.0>,
  "reasoning": "<one or two sentences explaining the verdict>",
  "redacted_content": "<full message with any PII replaced by [REDACTED] — return the original text unchanged if no PII is found>",
  "has_phishing_link": <true | false>
}

Verdict rules:
- "allow"  — message is clean: no PII, no suspicious links.
- "block"  — message contains an obvious phishing link or clearly malicious content. Set confidence >= 0.85.
- "review" — message contains redacted PII, an ambiguous URL, or anything requiring human review.

Redaction rules:
- Replace every SSN, street address, phone number, and email with [REDACTED].
- If no PII is present, return the original message text unchanged in "redacted_content".
- Never include the original PII value anywhere in your response.

Phishing detection:
- Set has_phishing_link: true if a URL: (a) mimics a known brand with a slight misspelling, (b) uses a raw IP address instead of a domain, (c) uses suspicious TLDs for what appears to be a transactional link, or (d) is used in a suspicious context.
- Legitimate URLs like google.com, amazon.com, maps.google.com, youtube.com are not phishing links.`

const MESSAGE_PARSE_ERROR_DEFAULT: Omit<MessageSafetyOutput, 'redacted_content'> = {
  verdict: 'review',
  confidence: 0,
  reasoning: 'Safety agent could not parse the model response. Message routed for review.',
  has_phishing_link: false,
}

function parseMessageResponse(raw: string, fallbackContent: string): MessageSafetyOutput {
  let parsed: unknown

  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    return { ...MESSAGE_PARSE_ERROR_DEFAULT, redacted_content: fallbackContent }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ...MESSAGE_PARSE_ERROR_DEFAULT, redacted_content: fallbackContent }
  }

  const { verdict, confidence, reasoning, redacted_content, has_phishing_link } = parsed as Record<
    string,
    unknown
  >

  if (verdict !== 'allow' && verdict !== 'block' && verdict !== 'review') {
    return { ...MESSAGE_PARSE_ERROR_DEFAULT, redacted_content: fallbackContent }
  }

  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    return { ...MESSAGE_PARSE_ERROR_DEFAULT, redacted_content: fallbackContent }
  }

  if (typeof reasoning !== 'string' || reasoning.trim() === '') {
    return { ...MESSAGE_PARSE_ERROR_DEFAULT, redacted_content: fallbackContent }
  }

  const finalContent =
    typeof redacted_content === 'string' && redacted_content.trim() !== ''
      ? redacted_content
      : fallbackContent

  return {
    verdict,
    confidence,
    reasoning,
    redacted_content: finalContent,
    has_phishing_link: has_phishing_link === true,
  }
}

export async function runMessageSafety(input: MessageSafetyInput): Promise<MessageSafetyOutput> {
  // Client-side pre-pass: strip known PII patterns before content reaches Groq.
  const prePassContent = redactPii(input.content)

  let raw: string

  try {
    raw = await callGroq(MESSAGE_SAFETY_SYSTEM_PROMPT, `Chat message:\n${prePassContent}`)
  } catch (err) {
    const message = err instanceof GroqError ? err.message : 'Unknown error contacting Groq API'
    return {
      verdict: 'review',
      confidence: 0,
      reasoning: `Message safety agent unavailable — routed for review. (${message})`,
      redacted_content: prePassContent,
      has_phishing_link: false,
    }
  }

  return parseMessageResponse(raw, prePassContent)
}

// ---------------------------------------------------------------------------
// runSafety — the exported agent function
// ---------------------------------------------------------------------------
export async function runSafety(input: SafetyAgentInput): Promise<SafetyAgentOutput> {
  let raw: string

  try {
    raw = await callGroq(SYSTEM_PROMPT, buildUserPrompt(input))
  } catch (err) {
    // Groq API failure: degrade to 'review' so a human can inspect the trade.
    const message = err instanceof GroqError ? err.message : 'Unknown error contacting Groq API'

    return {
      verdict: 'review',
      confidence: 0,
      reasoning: `Safety agent unavailable — routed for manual review. (${message})`,
      redacted_description: null,
    }
  }

  return parseResponse(raw)
}
