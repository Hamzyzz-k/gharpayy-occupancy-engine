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
  'rounded-2xl border border-[#e4e0dd] bg-white shadow-[0_8px_24px_rgba(42,30,21,0.035)]'

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
      className="inline-flex items-center gap-1.5 rounded-full border border-[#d3def0] bg-[#f6f8fc] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.11em] text-[#0943a0]"
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
      className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-[#8b8f95] transition hover:text-[#0943a0]"
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
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0943a0]">
            {eyebrow}
          </span>
          <DemoBadge />
        </div>
        <h1 className="font-display text-[30px] font-bold leading-[1.08] tracking-[-0.045em] text-[#171b20] sm:text-[38px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#646971]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export type Tone = 'blue' | 'yellow' | 'green' | 'red' | 'amber' | 'grey'

export const TONE_CHIP: Record<Tone, string> = {
  blue: 'bg-[#eaf0fa] text-[#0943a0]',
  yellow: 'bg-[#fdf3cf] text-[#8a6a00]',
  green: 'bg-[#edf8f1] text-[#24805b]',
  red: 'bg-[#fff0ee] text-[#d53a35]',
  amber: 'bg-[#fff7e7] text-[#c98218]',
  grey: 'bg-[#f2f0ed] text-[#646971]',
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
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.11em] text-[#8b8f95]">
        {label}
      </p>
      <p className="mt-1 font-display text-[25px] font-bold tracking-[-0.04em] text-[#171b20]">
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-[#777c83]">{sub}</p> : null}
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
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8b8f95]">{kicker}</p>
        ) : null}
        <h2 className="mt-1 font-display text-xl font-bold tracking-[-0.035em] text-[#171b20]">
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
      className={`grid shrink-0 place-items-center bg-[#dfe8f7] font-bold text-[#0943a0] ${s}`}
      aria-hidden
    >
      {initials(name)}
    </div>
  )
}

const STAGE_CHIP: Record<LeadStage, string> = {
  new: 'bg-[#f7f3ef] text-[#737a82]',
  contacted: 'bg-[#eaf0fa] text-[#0943a0]',
  visit_scheduled: 'bg-[#fff7e7] text-[#c98218]',
  visited: 'bg-[#e6f4f5] text-[#237a86]',
  negotiation: 'bg-[#f3effb] text-[#7457a8]',
  booked: 'bg-[#edf8f1] text-[#24805b]',
  moved_in: 'bg-[#edf8f1] text-[#24805b]',
  lost: 'bg-[#fff0ee] text-[#d53a35]',
}

export const STAGE_DOT: Record<LeadStage, string> = {
  new: 'bg-[#8b8f95]',
  contacted: 'bg-[#0943a0]',
  visit_scheduled: 'bg-[#e5a135]',
  visited: 'bg-[#237a86]',
  negotiation: 'bg-[#7457a8]',
  booked: 'bg-[#48b878]',
  moved_in: 'bg-[#24805b]',
  lost: 'bg-[#d53a35]',
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
    <span className="rounded-md bg-[#f7f3ef] px-1.5 py-1 text-[10px] font-bold text-[#737a82]">
      {children}
    </span>
  )
}

export function Dot() {
  return <span className="mx-1 text-[#d0cbc5]">•</span>
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#e4e0dd] bg-white/60 px-4 py-8 text-center text-xs text-[#8b8f95]">
      {children}
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  return (
    <div className="mb-5 rounded-2xl border border-[#f5c6c2] bg-[#fff0ee] p-4 text-sm">
      <p className="font-bold text-[#d53a35]">Could not reach the database</p>
      <p className="mt-1 text-xs text-[#8a4a45]">
        {(error as Error)?.message}. Check that VITE_SUPABASE_URL and
        VITE_SUPABASE_PUBLISHABLE_KEY point at your project and that the migrations have been run.
      </p>
    </div>
  )
}

export function Shimmer({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[#f0ebe6] ${className}`} />
}
