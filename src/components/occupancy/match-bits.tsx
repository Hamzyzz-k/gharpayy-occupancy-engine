/**
 * Shared bits for showing a match score.
 *
 * The reasons are not decoration. They're the product. A salesperson has to
 * be able to say "this one because it's ₹500 under your budget and free before
 * you move" on a phone call. A bare number can't be defended.
 */

import type { MatchReason } from '@/lib/occupancy/matching'
import { scoreBand } from '@/lib/occupancy/matching'

const RING_COLOR = { strong: '#48b878', decent: '#e5a135', weak: '#b9b3ad' } as const
const TEXT_COLOR = {
  strong: 'text-[var(--oc-green)]',
  decent: 'text-[var(--oc-amber)]',
  weak: 'text-[var(--oc-text-3)]',
} as const

/** Text colour for a bare score number. */
export function scoreText(score: number): string {
  return TEXT_COLOR[scoreBand(score)]
}

/**
 * Circular 0 to 100 gauge. Pass `color` to override the match banding, which
 * the lead page does to show risk rather than fit.
 */
export function ScoreRing({
  score,
  size = 58,
  color,
  label,
}: {
  score: number
  size?: number
  color?: string
  label?: string
}) {
  const r = size * 0.38
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, score))
  return (
    <div
      className="relative shrink-0"
      style={{ height: size, width: size }}
      role="img"
      aria-label={label ?? `Match score ${score} out of 100`}
    >
      <svg className="h-full w-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={5}
          style={{ stroke: 'var(--oc-divider)' }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color ?? RING_COLOR[scoreBand(score)]}
          strokeLinecap="round"
          strokeWidth={5}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display text-sm font-bold text-[var(--oc-text)]">{score}</span>
      </div>
    </div>
  )
}

function barColor(r: MatchReason): string {
  const pct = r.points / r.outOf
  if (pct >= 0.85) return 'bg-[#48b878]'
  if (pct >= 0.4) return 'bg-[#e5a135]'
  return 'bg-[#ef6a5b]'
}

/** The four scoring dimensions as mini bars, each with its plain-English reason. */
export function ReasonGrid({ reasons }: { reasons: MatchReason[] }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
      {reasons.map((r) => (
        <div key={r.label} className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px]">
            <span className="font-bold text-[var(--oc-text-2)]">{r.label}</span>
            <span className="font-bold tabular-nums text-[var(--oc-text)]">
              {Math.round(r.points)} / {r.outOf}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--oc-divider)]">
            <div
              className={`h-full rounded-full ${barColor(r)}`}
              style={{ width: `${Math.round((r.points / r.outOf) * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 line-clamp-2 text-[10px] leading-4 text-[var(--oc-text-3)]">{r.detail}</p>
        </div>
      ))}
    </div>
  )
}
