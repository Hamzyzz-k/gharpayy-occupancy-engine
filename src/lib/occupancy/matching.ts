/**
 * The Match Engine.
 *
 * Scores how well a lead and a bed fit each other, 0-100.
 *
 * Deliberately arithmetic, not AI. Every point is traceable to a reason, which
 * means a salesperson can justify a recommendation to a customer on the phone.
 * A black box can't do that, and in this business trust is the product.
 *
 * The same function powers both directions:
 *   lead -> best beds   (what every CRM does)
 *   bed  -> best leads  (what almost none do, and the far more useful one)
 */

import type { BedAvailability, Lead } from './types'

export const MATCH_WEIGHTS = {
  budget: 35,
  locality: 25,
  availability: 25,
  sharing: 15,
} as const

/** How far over budget still counts as a stretch rather than unaffordable. */
export const BUDGET_STRETCH = 0.1

export const MAX_SCORE =
  MATCH_WEIGHTS.budget +
  MATCH_WEIGHTS.locality +
  MATCH_WEIGHTS.availability +
  MATCH_WEIGHTS.sharing // = 100

/**
 * Bangalore localities that people genuinely treat as substitutes.
 * Someone set on HSR will usually look at Koramangala; they will not look at
 * Whitefield. This is domain knowledge, and it's why a generic CRM can't do
 * this well out of the box.
 */
const NEARBY: Record<string, string[]> = {
  Koramangala: ['HSR Layout', 'BTM Layout', 'Indiranagar'],
  'HSR Layout': ['Koramangala', 'BTM Layout', 'Marathahalli'],
  'BTM Layout': ['Koramangala', 'HSR Layout', 'Electronic City'],
  Indiranagar: ['Koramangala', 'Marathahalli'],
  Marathahalli: ['Whitefield', 'HSR Layout', 'Indiranagar'],
  Whitefield: ['Marathahalli'],
  'Electronic City': ['BTM Layout'],
}

export interface MatchReason {
  label: string
  /** Points awarded for this dimension. */
  points: number
  /** Points that were available. */
  outOf: number
  detail: string
  tone: 'good' | 'partial' | 'poor'
}

export interface MatchResult {
  score: number
  /** False when a hard filter (not sellable, gender, unaffordable) rules this pairing out. */
  eligible: boolean
  /** Populated when eligible is false. */
  disqualifiedBecause?: string
  reasons: MatchReason[]
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}

function tone(points: number, outOf: number): MatchReason['tone'] {
  if (points >= outOf * 0.85) return 'good'
  if (points > 0) return 'partial'
  return 'poor'
}

function formatINR(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

/**
 * Score one lead against one bed.
 *
 * Hard filters run first and short-circuit. A male lead in a female room isn't
 * "a low score", it's not a match at all, and showing it at 40/100 would be
 * worse than useless.
 */
export function scoreMatch(lead: Lead, bed: BedAvailability): MatchResult {
  // ---- Hard filter 1: is this bed sellable at all? --------------------------
  if (bed.available_from === null) {
    return {
      score: 0,
      eligible: false,
      disqualifiedBecause: 'Bed is occupied with no notice given',
      reasons: [],
    }
  }

  // ---- Hard filter 2: gender ------------------------------------------------
  if (bed.gender !== 'unisex' && lead.gender && bed.gender !== lead.gender) {
    return {
      score: 0,
      eligible: false,
      disqualifiedBecause: `Room is ${bed.gender}-only`,
      reasons: [],
    }
  }

  // ---- Hard filter 3: affordability -----------------------------------------
  // Someone who cannot afford the bed is not a weak match, they are not a
  // match. Scoring them let a lead at half the rent rank 65/100 on locality
  // and dates alone, which is exactly the kind of result nobody can defend.
  if (lead.budget_max != null && bed.monthly_rent > lead.budget_max * (1 + BUDGET_STRETCH)) {
    return {
      score: 0,
      eligible: false,
      disqualifiedBecause: `${formatINR(bed.monthly_rent - lead.budget_max)} over budget`,
      reasons: [],
    }
  }

  const reasons: MatchReason[] = []

  // ---- Budget (35) ----------------------------------------------------------
  // Full marks within budget. A small stretch scales down rather than dropping
  // to zero, because people do go slightly over for the right place.
  {
    const w = MATCH_WEIGHTS.budget
    let points = 0
    let detail: string

    if (lead.budget_max == null) {
      points = w * 0.5
      detail = 'No budget on record'
    } else if (bed.monthly_rent <= lead.budget_max) {
      points = w
      const headroom = lead.budget_max - bed.monthly_rent
      detail =
        headroom > 0
          ? `${formatINR(bed.monthly_rent)}, ${formatINR(headroom)} under budget`
          : `${formatINR(bed.monthly_rent)}, exactly at budget`
    } else {
      // Only reachable within the stretch band; beyond it the hard filter
      // above has already ruled the bed out.
      const overBy = bed.monthly_rent - lead.budget_max
      const stretch = overBy / lead.budget_max
      points = w * (1 - stretch / BUDGET_STRETCH) * 0.6
      detail = `${formatINR(overBy)} over budget, a stretch`
    }
    reasons.push({ label: 'Budget', points, outOf: w, detail, tone: tone(points, w) })
  }

  // ---- Locality (25) --------------------------------------------------------
  {
    const w = MATCH_WEIGHTS.locality
    const prefs = lead.preferred_localities ?? []
    let points = 0
    let detail: string

    if (prefs.length === 0) {
      points = w * 0.5
      detail = 'No locality preference'
    } else if (prefs.includes(bed.locality)) {
      points = w
      detail = `${bed.locality}, exactly what they asked for`
    } else if (prefs.some((p) => (NEARBY[p] ?? []).includes(bed.locality))) {
      // Name the preference it is actually near, not simply the first one.
      const near = prefs.find((p) => (NEARBY[p] ?? []).includes(bed.locality))
      points = w * 0.5
      detail = `${bed.locality}, next to ${near}`
    } else {
      points = w * 0.15
      detail = `${bed.locality}, but they wanted ${prefs.join(' or ')}`
    }
    reasons.push({ label: 'Locality', points, outOf: w, detail, tone: tone(points, w) })
  }

  // ---- Availability (25) ----------------------------------------------------
  // Free before they need it = full marks. Late scales down over three weeks.
  {
    const w = MATCH_WEIGHTS.availability
    let points = 0
    let detail: string

    const availableFrom = new Date(bed.available_from)

    if (!lead.move_in_date) {
      points = w * 0.5
      detail = 'No move-in date on record'
    } else {
      const wanted = new Date(lead.move_in_date)
      const lateBy = daysBetween(availableFrom, wanted)

      if (lateBy <= 0) {
        points = w
        detail =
          bed.status === 'vacant'
            ? 'Free right now'
            : `Free ${availableFrom.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, before they need it`
      } else if (lateBy <= 21) {
        points = w * (1 - lateBy / 21)
        detail = `Free ${lateBy} day${lateBy === 1 ? '' : 's'} after they want to move`
      } else {
        points = 0
        detail = `Not free for another ${lateBy} days`
      }
    }
    reasons.push({ label: 'Availability', points, outOf: w, detail, tone: tone(points, w) })
  }

  // ---- Sharing type (15) ----------------------------------------------------
  {
    const w = MATCH_WEIGHTS.sharing
    let points = 0
    let detail: string
    const pref = lead.preferred_sharing

    if (!pref || pref === 'any') {
      points = w
      detail = 'Open to any sharing type'
    } else if (pref === bed.sharing_type) {
      points = w
      detail = `${bed.sharing_type}, as requested`
    } else {
      points = w * 0.25
      detail = `${bed.sharing_type}, they asked for ${pref}`
    }
    reasons.push({ label: 'Sharing', points, outOf: w, detail, tone: tone(points, w) })
  }

  const score = Math.round(reasons.reduce((sum, r) => sum + r.points, 0))
  return { score, eligible: true, reasons }
}

export interface ScoredBed extends MatchResult {
  bed: BedAvailability
}

export interface ScoredLead extends MatchResult {
  lead: Lead
}

/** DIRECTION 1: lead arrives, which beds should we show them? */
export function bestBedsForLead(
  lead: Lead,
  beds: BedAvailability[],
  limit = 5,
): ScoredBed[] {
  return beds
    .map((bed) => ({ bed, ...scoreMatch(lead, bed) }))
    .filter((m) => m.eligible && m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * DIRECTION 2: a bed opens up, who's waiting who'd take it?
 *
 * This is the one nobody builds, because if you think of the product as a lead
 * CRM the lead is always the starting point. Leads already booked, moved in or
 * lost are excluded because they're not in the market any more.
 */
export function bestLeadsForBed(
  bed: BedAvailability,
  leads: Lead[],
  limit = 5,
): ScoredLead[] {
  const inMarket = leads.filter(
    (l) => !['booked', 'moved_in', 'lost'].includes(l.stage),
  )
  return inMarket
    .map((lead) => ({ lead, ...scoreMatch(lead, bed) }))
    .filter((m) => m.eligible && m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Buckets for colouring a score in the UI. */
export function scoreBand(score: number): 'strong' | 'decent' | 'weak' {
  if (score >= 75) return 'strong'
  if (score >= 50) return 'decent'
  return 'weak'
}
