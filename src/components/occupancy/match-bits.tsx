/**
 * Shared bits for showing a match score.
 *
 * The reasons list is not decoration — it's the product. A salesperson has to
 * be able to say "this one because it's ₹500 under your budget and free before
 * you move" on a phone call. A bare number can't be defended.
 */

import { Check, Minus, X } from 'lucide-react'
import type { MatchReason } from '@/lib/occupancy/matching'
import { scoreBand } from '@/lib/occupancy/matching'

export function ScorePill({ score }: { score: number }) {
  const band = scoreBand(score)
  const cls =
    band === 'strong'
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      : band === 'decent'
        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
        : 'bg-muted text-muted-foreground border-border'

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}
    >
      {score}
      <span className="ml-0.5 opacity-60">/100</span>
    </span>
  )
}

export function ScoreBar({ score }: { score: number }) {
  const band = scoreBand(score)
  const cls =
    band === 'strong' ? 'bg-emerald-500' : band === 'decent' ? 'bg-amber-500' : 'bg-muted-foreground/40'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${cls}`} style={{ width: `${score}%` }} />
    </div>
  )
}

export function ReasonList({ reasons }: { reasons: MatchReason[] }) {
  return (
    <ul className="mt-2 space-y-1">
      {reasons.map((r) => {
        const Icon = r.tone === 'good' ? Check : r.tone === 'partial' ? Minus : X
        const color =
          r.tone === 'good'
            ? 'text-emerald-500'
            : r.tone === 'partial'
              ? 'text-amber-500'
              : 'text-muted-foreground'
        return (
          <li key={r.label} className="flex items-start gap-2 text-xs">
            <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${color}`} />
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{r.label}:</span> {r.detail}
            </span>
            <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
              {Math.round(r.points)}/{r.outOf}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
