// src/lib/agents/runner.ts
// Parallel agent runner — invokes all three agents concurrently via
// Promise.allSettled so a failure in one never blocks the others.
// Called from actions/trades.ts when a trade reaches 'accepted' status.

import { runSafety } from './safety'
import { runLogistics } from './logistics'
import { runVibe } from './vibe'
import type { SafetyAgentOutput } from './safety'
import type { LogisticsAgentOutput } from './logistics'
import type { VibeAgentOutput } from './vibe'
import type { LogisticsData } from '@/types/trades'

// ---------------------------------------------------------------------------
// Interfaces — canonical shapes defined in CLAUDE.md Agent Conventions
// ---------------------------------------------------------------------------

export interface AgentRunnerInput {
  trade_id: string
  initiator_id: string
  listing_title: string
  listing_description: string
  agreed_terms: string | null
}

export interface AgentRunnerResult {
  safety: SafetyAgentOutput | null // null if the agent rejected
  logistics: LogisticsData | null // null if the agent rejected
  vibe: number | null // null if the agent rejected
  errors: Record<string, unknown> // keyed by agent name; populated on rejection
}

// ---------------------------------------------------------------------------
// runAgents
//
// Runs all three agents in parallel. Each settled result is mapped into the
// typed AgentRunnerResult — a rejection sets the field to null and records
// the error. The function always resolves; it never throws.
// ---------------------------------------------------------------------------
export async function runAgents(input: AgentRunnerInput): Promise<AgentRunnerResult> {
  const agentInput = {
    trade_id: input.trade_id,
    listing_title: input.listing_title,
    listing_description: input.listing_description,
    agreed_terms: input.agreed_terms,
  }

  const [safetyResult, logisticsResult, vibeResult] = await Promise.allSettled([
    runSafety(input),
    runLogistics(agentInput),
    runVibe(agentInput),
  ])

  const result: AgentRunnerResult = {
    safety: null,
    logistics: null,
    vibe: null,
    errors: {},
  }

  if (safetyResult.status === 'fulfilled') {
    result.safety = safetyResult.value
  } else {
    result.errors.safety = safetyResult.reason
  }

  if (logisticsResult.status === 'fulfilled') {
    result.logistics = logisticsResult.value as LogisticsAgentOutput
  } else {
    result.errors.logistics = logisticsResult.reason
  }

  if (vibeResult.status === 'fulfilled') {
    result.vibe = (vibeResult.value as VibeAgentOutput).score
  } else {
    result.errors.vibe = vibeResult.reason
  }

  return result
}
