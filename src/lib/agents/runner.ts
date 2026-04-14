// src/lib/agents/runner.ts
// Parallel agent runner — invokes all three agents concurrently via
// Promise.allSettled so a failure in one never blocks the others.
// Called from actions/trades.ts when a trade reaches 'accepted' status.

import { runSafety } from './safety'
import type { SafetyAgentOutput } from './safety'
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
  logistics: LogisticsData | null // null — logistics agent not yet implemented
  vibe: number | null // null — vibe agent not yet implemented
  errors: Record<string, unknown> // keyed by agent name; populated on rejection
}

// ---------------------------------------------------------------------------
// Stubs for agents not yet implemented.
// Returning null keeps the runner's Promise.allSettled shape uniform and
// allows actions/trades.ts to handle missing results without branching.
// Replace each stub with the real import once the agent is implemented.
// ---------------------------------------------------------------------------

async function runLogistics(_input: AgentRunnerInput): Promise<LogisticsData | null> {
  // TODO: implement src/lib/agents/logistics.ts
  return null
}

async function runVibe(_input: AgentRunnerInput): Promise<number | null> {
  // TODO: implement src/lib/agents/vibe.ts
  return null
}

// ---------------------------------------------------------------------------
// runAgents
//
// Runs all three agents in parallel. Each settled result is mapped into the
// typed AgentRunnerResult — a rejection sets the field to null and records
// the error. The function always resolves; it never throws.
// ---------------------------------------------------------------------------
export async function runAgents(input: AgentRunnerInput): Promise<AgentRunnerResult> {
  const [safetyResult, logisticsResult, vibeResult] = await Promise.allSettled([
    runSafety(input),
    runLogistics(input),
    runVibe(input),
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
    result.logistics = logisticsResult.value
  } else {
    result.errors.logistics = logisticsResult.reason
  }

  if (vibeResult.status === 'fulfilled') {
    result.vibe = vibeResult.value
  } else {
    result.errors.vibe = vibeResult.reason
  }

  return result
}
