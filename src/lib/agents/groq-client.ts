// src/lib/agents/groq-client.ts
// The single entry point for all Groq API calls.
// This file is the only place in the codebase that reads GROQ_API_KEY.
// It must never be imported from client-side code ('use client' components).

import Groq from 'groq-sdk'

// ---------------------------------------------------------------------------
// Typed error for callers to distinguish Groq failures from logic errors.
// ---------------------------------------------------------------------------
export class GroqError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'GroqError'
  }
}

const DEFAULT_MODEL = 'llama3-8b-8192'

// ---------------------------------------------------------------------------
// callGroq
//
// Sends a system + user prompt to Groq and returns the raw text response.
// All agents call this function — none import the Groq SDK directly.
//
// Throws GroqError on:
//   - non-2xx API responses
//   - empty or missing response content
// ---------------------------------------------------------------------------
export async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  // Guard: server-only — catches accidental calls from a browser bundle.
  if (typeof window !== 'undefined') {
    throw new GroqError(
      '[groq-client] This module must only be used on the server. ' +
        'Do not call it inside a "use client" component.'
    )
  }

  if (!process.env.GROQ_API_KEY) {
    throw new GroqError(
      '[groq-client] GROQ_API_KEY environment variable is not set. ' +
        'Add it to .env.local (server-only — never prefix with NEXT_PUBLIC_).'
    )
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  let completion: Groq.Chat.ChatCompletion

  try {
    completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1, // low temperature for deterministic moderation verdicts
    })
  } catch (err) {
    throw new GroqError('Groq API request failed', err)
  }

  const content = completion.choices[0]?.message?.content

  if (!content || content.trim() === '') {
    throw new GroqError('Groq returned an empty response', completion)
  }

  return content
}
