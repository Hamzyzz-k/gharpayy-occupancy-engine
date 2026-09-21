/**
 * The Rescue List: lead decay, weighted by move-in urgency.
 *
 * Most CRMs sort follow-ups by "last contacted" and get this exactly backwards.
 * Two days of silence means completely different things:
 *
 *   moving in 5 days,   silent 2 days  ->  emergency
 *   moving in 3 months, silent 2 days  ->  entirely fine
 *
 * So we decay by silence, then multiply by how soon they need a bed and how
 * far down the pipeline they already are. A lead who has already visited and
 * gone quiet is a much more expensive loss than one who just enquired.
 */

import type { Lead } from './types'
import { STAGE_LABELS } from './types'

/** Leads no longer in the market, so nothing to rescue. */
const CLOSED_STAGES = ['booked', 'moved_in', 'lost']

/** Later pipeline stages have more sunk effort, so silence costs more. */
const STAGE_MULTIPLIER: Record<string, number> = {
  new: 1.0,
  contacted: 1.15,
  visit_scheduled: 1.35,
  visited: 1.45,
  negotiation: 1.6,
}

export interface RescueScore {
  /** 0-100. Higher = call them sooner. */
  risk: number
  band: 'critical' | 'warm' | 'ok'
  daysSinceContact: number
  daysToMoveIn: number | null
  /** Short human sentences explaining the score, for the UI. */
  reasons: string[]
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function urgencyMultiplier(daysToMoveIn: number | null): { mul: number; note: string } {
  if (daysToMoveIn === null) return { mul: 1.0, note: 'No move-in date on record' }
  if (daysToMoveIn < 0)
    return { mul: 2.2, note: `Move-in date passed ${Math.abs(daysToMoveIn)} days ago` }
  if (daysToMoveIn <= 7) return { mul: 3.0, note: `Needs a bed in ${daysToMoveIn} days` }
  if (daysToMoveIn <= 14) return { mul: 2.0, note: `Moving in ${daysToMoveIn} days` }
  if (daysToMoveIn <= 30) return { mul: 1.3, note: `Moving in ${daysToMoveIn} days` }
  return { mul: 0.8, note: `Not moving for ${daysToMoveIn} days` }
}

export function rescueScore(lead: Lead): RescueScore {
  const reasons: string[] = []

  // Never contacted? Measure silence from when they came in. That's worse,
  // not better, than a lead who was contacted once and went quiet.
  const sinceContact = daysSince(lead.last_contacted_at)
  const sinceCreated = daysSince(lead.created_at) ?? 0
  const daysSinceContact = sinceContact ?? sinceCreated

  if (sinceContact === null) {
    reasons.push(`Never contacted, sitting for ${sinceCreated} days`)
  } else {
    reasons.push(
      daysSinceContact === 0
        ? 'Contacted today'
        : `Silent for ${daysSinceContact} day${daysSinceContact === 1 ? '' : 's'}`,
    )
  }

  const daysToMoveIn = lead.move_in_date
    ? Math.ceil((new Date(lead.move_in_date).getTime() - Date.now()) / 86_400_000)
    : null

  const { mul: urgencyMul, note } = urgencyMultiplier(daysToMoveIn)
  reasons.push(note)

  const stageMul = STAGE_MULTIPLIER[lead.stage] ?? 1.0
  if (stageMul >= 1.35) {
    reasons.push(`Already at "${STAGE_LABELS[lead.stage]}", expensive to lose`)
  }

  // Never-contacted leads carry a penalty floor so a brand-new lead that nobody
  // has touched still surfaces on day one.
  const base = daysSinceContact * 7 + (sinceContact === null ? 18 : 0)
  const risk = Math.max(0, Math.min(100, Math.round(base * urgencyMul * stageMul)))

  return {
    risk,
    band: risk >= 70 ? 'critical' : risk >= 40 ? 'warm' : 'ok',
    daysSinceContact,
    daysToMoveIn,
    reasons,
  }
}

export interface RescueItem extends RescueScore {
  lead: Lead
}

/** Today's ranked "who to save" list. The software decides; the human executes. */
export function buildRescueList(leads: Lead[], limit = 25): RescueItem[] {
  return leads
    .filter((l) => !CLOSED_STAGES.includes(l.stage))
    .map((lead) => ({ lead, ...rescueScore(lead) }))
    .filter((r) => r.risk > 0)
    .sort((a, b) => b.risk - a.risk)
    .slice(0, limit)
}
