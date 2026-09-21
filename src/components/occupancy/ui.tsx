/**
 * Shared building blocks for the Occupancy screens.
 *
 * Colours follow Gharpayy's brand from gharpayy.com: blue #0943a0, yellow
 * #f4c024 (their primary theme colour, used for call-to-action buttons with
 * dark text) and cream. Red, green and amber are kept for meaning, not brand:
 * loss, good and warning. Written out as hex because these screens use
 * tints that the app's theme tokens don't
 * define. The app has no dark mode, so nothing here needs a dark variant.
 */

import { Link } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, type LucideIcon } from 'lucide-react'
import type { LeadStage } from '@/lib/occupancy/types'
import { STAGE_LABELS } from '@/lib/occupancy/types'
import { initials } from '@/lib/occupancy/format'

export const CARD =
  'rounded-2xl border border-[var(--oc-border)] bg-[var(--oc-card)] shadow-[0_8px_24px_rgba(42,30,21,0.035)]'

export const PAGE = 'mx-auto w-full max-w-[1536px] px-4 py-6 sm:px-7 sm:py-8 lg:px-10'

/** Today's date, rendered only after mount so server and client HTML agree. */
export function useToday(): string {
  const [label, setLabel] = useState('')
  useEffect(() => {
    setLabel(
      new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
    )
  }, [])
  return label
}

export function DemoBadge() {
  return (
    <span
      title="Made-up properties and leads, live backend"
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--oc-brand-line)] bg-[var(--oc-hover)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.11em] text-[var(--oc-brand)]"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#f4c024]" />
      Demo data
    </span>
  )
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-[var(--oc-text-3)] transition hover:text-[var(--oc-brand)]"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {children}
    </Link>
  )
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--oc-brand)]">
            {eyebrow}
          </span>
          <DemoBadge />
        </div>
        <h1 className="font-display text-[30px] font-bold leading-[1.08] tracking-[-0.045em] text-[var(--oc-text)] sm:text-[38px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--oc-text-2)]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export type Tone = 'blue' | 'yellow' | 'green' | 'red' | 'amber' | 'grey'

export const TONE_CHIP: Record<Tone, string> = {
  blue: 'bg-[var(--oc-brand-soft)] text-[var(--oc-brand)]',
  yellow: 'bg-[var(--oc-yellow-soft)] text-[var(--oc-yellow-text)]',
  green: 'bg-[var(--oc-green-soft)] text-[var(--oc-green)]',
  red: 'bg-[var(--oc-red-soft)] text-[var(--oc-red)]',
  amber: 'bg-[var(--oc-amber-soft)] text-[var(--oc-amber)]',
  grey: 'bg-[var(--oc-chip)] text-[var(--oc-text-2)]',
}

export function StatTile({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: LucideIcon
  tone: Tone
  label: string
  value: ReactNode
  sub?: ReactNode
}) {
  return (
    <div className={`${CARD} p-4 sm:p-5`}>
      <div className={`grid h-9 w-9 place-items-center rounded-xl ${TONE_CHIP[tone]}`}>
        <Icon className="h-[17px] w-[17px]" />
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.11em] text-[var(--oc-text-3)]">
        {label}
      </p>
      <p className="mt-1 font-display text-[25px] font-bold tracking-[-0.04em] text-[var(--oc-text)]">
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-[var(--oc-text-2)]">{sub}</p> : null}
    </div>
  )
}

export function SectionTitle({
  kicker,
  title,
  aside,
}: {
  kicker?: string
  title: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {kicker ? (
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--oc-text-3)]">{kicker}</p>
        ) : null}
        <h2 className="mt-1 font-display text-xl font-bold tracking-[-0.035em] text-[var(--oc-text)]">
          {title}
        </h2>
      </div>
      {aside}
    </div>
  )
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const s =
    size === 'lg'
      ? 'h-14 w-14 rounded-2xl font-display text-lg'
      : size === 'sm'
        ? 'h-8 w-8 rounded-full text-[10px]'
        : 'h-10 w-10 rounded-full text-xs'
  return (
    <div
      className={`grid shrink-0 place-items-center bg-[var(--oc-brand-soft)] font-bold text-[var(--oc-brand)] ${s}`}
      aria-hidden
    >
      {initials(name)}
    </div>
  )
}

const STAGE_CHIP: Record<LeadStage, string> = {
  new: 'bg-[var(--oc-chip)] text-[var(--oc-text-2)]',
  contacted: 'bg-[var(--oc-brand-soft)] text-[var(--oc-brand)]',
  visit_scheduled: 'bg-[var(--oc-amber-soft)] text-[var(--oc-amber)]',
  visited: 'bg-[var(--oc-teal-soft)] text-[var(--oc-teal)]',
  negotiation: 'bg-[var(--oc-purple-soft)] text-[var(--oc-purple)]',
  booked: 'bg-[var(--oc-green-soft)] text-[var(--oc-green)]',
  moved_in: 'bg-[var(--oc-green-soft)] text-[var(--oc-green)]',
  lost: 'bg-[var(--oc-red-soft)] text-[var(--oc-red)]',
}

export const STAGE_DOT: Record<LeadStage, string> = {
  new: 'bg-[var(--oc-text-3)]',
  contacted: 'bg-[#0943a0]',
  visit_scheduled: 'bg-[#e5a135]',
  visited: 'bg-[var(--oc-teal)]',
  negotiation: 'bg-[var(--oc-purple)]',
  booked: 'bg-[#48b878]',
  moved_in: 'bg-[var(--oc-green)]',
  lost: 'bg-[var(--oc-red)]',
}

export function StageChip({ stage }: { stage: LeadStage }) {
  return (
    <span className={`rounded-md px-1.5 py-1 text-[10px] font-bold ${STAGE_CHIP[stage]}`}>
      {STAGE_LABELS[stage]}
    </span>
  )
}

/** Grey chip for plain facts like "₹18,400 / mo" or a locality. */
export function FactChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-[var(--oc-chip)] px-1.5 py-1 text-[10px] font-bold text-[var(--oc-text-2)]">
      {children}
    </span>
  )
}

export function Dot() {
  return <span className="mx-1 text-[var(--oc-faint)]">•</span>
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--oc-border)] bg-[var(--oc-card)]/60 px-4 py-8 text-center text-xs text-[var(--oc-text-3)]">
      {children}
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  return (
    <div className="mb-5 rounded-2xl border border-[var(--oc-red-line)] bg-[var(--oc-red-soft)] p-4 text-sm">
      <p className="font-bold text-[var(--oc-red)]">Could not reach the database</p>
      <p className="mt-1 text-xs text-[var(--oc-red-text)]">
        {(error as Error)?.message}. Check that VITE_SUPABASE_URL and
        VITE_SUPABASE_PUBLISHABLE_KEY point at your project and that the migrations have been run.
      </p>
    </div>
  )
}

export function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[var(--oc-shimmer)] ${className}`} />
}
