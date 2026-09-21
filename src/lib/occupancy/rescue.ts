/**
 * The Rescue List: who to contact today, and why.
 *
 * Leads are lost to silence, not refusals. But silence alone is a poor
 * signal. Two days of it means nothing for someone moving in three months and
 * everything for someone moving in five days. So urgency leads, and silence
 * adds to it:
 *
 *   risk = urgency (up to 55) + silence (up to 35) + stage (up to 10)
 *
 * The parts are added, not multiplied. An earlier version multiplied them,
 * and ten days of silence alone could push any lead to the cap: on real data
 * that marked 62 of 123 active leads critical, 46 of them tied at 100, with a
 * lead silent for six weeks and moving in seven ranked level with one moving
 * in four days. Adding keeps urgency in charge and leaves room between scores.
 *
 * Silence stops counting at two weeks. Six weeks isn't three times worse than
 * two, it means the lead has gone cold, which is a different problem from an
 * urgent one. Those leads are banded separately so they don't crowd the call
 * list.
 */

import type { Lead } from './types'
import { STAGE_LABELS } from './types'

/** Leads no longer in the market, so nothing to rescue. */
const CLOSED_STAGES = ['booked', 'moved_in', 'lost']

/** Later stages carry more sunk effort, so losing them costs more. */
const STAGE_POINTS: Record<string, number> = {
  new: 0,
  contacted: 3,
  visit_scheduled: 6,
  visited: 8,
  negotiation: 10,
}

/** Silence stops adding risk after this many days. */
const SILENCE_CAP_DAYS = 14
const SILENCE_MAX_POINTS = 35

/** A never-contacted lead counts as a few days quieter than one reached once. */
const NEVER_CONTACTED_EXTRA_DAYS = 3

/** Silent this long, with no move-in inside the same window, means gone cold. */
const COLD_AFTER_DAYS = 21

export const CRITICAL_AT = 70
export const WARM_AT = 45

export type RescueBand = 'critical' | 'warm' | 'ok' | 'cold'

export interface RescueScore {
  /** 0-100. Higher = contact them sooner. */
  risk: number
  band: RescueBand
  daysSinceContact: number
  daysToMoveIn: number | null
  /** Short plain sentences explaining the score, for the UI. */
  reasons: string[]
  /** Unrounded score plus tie-breakers, used only for ordering. */
  sortKey: [number, number, number]
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function urgency(daysToMoveIn: number | null): { points: number; note: string } {
  if (daysToMoveIn === null) return { points: 15, note: 'No move-in date on record' }
  if (daysToMoveIn < 0) {
    const ago = Math.abs(daysToMoveIn)
    return {
      points: 30,
      note: `Move-in date passed ${ago} day${ago === 1 ? '' : 's'} ago, check they still need a bed`,
    }
  }
  if (daysToMoveIn <= 7) {
    return {
      points: 55,
      note: daysToMoveIn === 0 ? 'Needs a bed today' : `Needs a bed in ${daysToMoveIn} days`,
    }
  }
  if (daysToMoveIn <= 14) return { points: 42, note: `Moving in ${daysToMoveIn} days` }
  if (daysToMoveIn <= 30) return { points: 25, note: `Moving in ${daysToMoveIn} days` }
  return { points: 8, note: `Not moving for ${daysToMoveIn} days` }
}

export function rescueScore(lead: Lead): RescueScore {
  const reasons: string[] = []

  const sinceContact = daysSince(lead.last_contacted_at)
  const sinceCreated = daysSince(lead.created_at) ?? 0
  const never = sinceContact === null
  const daysSinceContact = sinceContact ?? sinceCreated
  const effectiveSilence = daysSinceContact + (never ? NEVER_CONTACTED_EXTRA_DAYS : 0)

  const daysToMoveIn = lead.move_in_date
    ? Math.ceil((new Date(lead.move_in_date).getTime() - Date.now()) / 86_400_000)
    : null

  const cold =
    effectiveSilence >= COLD_AFTER_DAYS && (daysToMoveIn === null || daysToMoveIn > COLD_AFTER_DAYS)

  const u = urgency(daysToMoveIn)
  const silencePoints =
    (Math.min(effectiveSilence, SILENCE_CAP_DAYS) / SILENCE_CAP_DAYS) * SILENCE_MAX_POINTS
  const stagePoints = STAGE_POINTS[lead.stage] ?? 0
  const raw = u.points + silencePoints + stagePoints

  if (cold) {
    reasons.push(
      `Gone cold: no contact in ${daysSinceContact} days${never ? ', never reached' : ''}`,
    )
    reasons.push(u.note)
  } else {
    if (never) {
      reasons.push(`Never contacted, waiting ${sinceCreated} day${sinceCreated === 1 ? '' : 's'}`)
    } else if (daysSinceContact === 0) {
      reasons.push('Contacted today')
    } else {
      reasons.push(`Silent for ${daysSinceContact} day${daysSinceContact === 1 ? '' : 's'}`)
    }
    reasons.push(u.note)
    if (stagePoints >= STAGE_POINTS.visit_scheduled!) {
      reasons.push(`Already at "${STAGE_LABELS[lead.stage]}", expensive to lose`)
    }
  }

  const band: RescueBand = cold
    ? 'cold'
    : raw >= CRITICAL_AT
      ? 'critical'
      : raw >= WARM_AT
        ? 'warm'
        : 'ok'

  return {
    risk: Math.round(raw),
    band,
    daysSinceContact,
    daysToMoveIn,
    reasons,
    // Silence stops scoring at two weeks, so equal scores are common among the
    // quietest leads. Break ties by who has waited longer, then who moves sooner.
    sortKey: [raw, effectiveSilence, -(daysToMoveIn ?? 999)],
  }
}

export interface RescueItem extends RescueScore {
  lead: Lead
}

function byUrgency(a: RescueItem, b: RescueItem): number {
  for (let i = 0; i < 3; i++) {
    const d = b.sortKey[i]! - a.sortKey[i]!
    if (d !== 0) return d
  }
  return 0
}

/**
 * Every lead still in the market, ranked. Gone-cold leads sort after the rest,
 * because they need a different kind of attention from today's calls.
 */
export function buildRescueList(leads: Lead[], limit = 25): RescueItem[] {
  const scored = leads
    .filter((l) => !CLOSED_STAGES.includes(l.stage))
    .map((lead) => ({ lead, ...rescueScore(lead) }))
  const active = scored.filter((r) => r.band !== 'cold').sort(byUrgency)
  const cold = scored.filter((r) => r.band === 'cold').sort(byUrgency)
  return [...active, ...cold].slice(0, limit)
}
