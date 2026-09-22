import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import {
  BedDouble,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Radar,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import {
  CARD,
  PAGE,
  Dot,
  ErrorNote,
  FactChip,
  PageHeader,
  Shimmer,
  StatTile,
} from '@/components/occupancy/ui'
import { scoreText } from '@/components/occupancy/match-bits'
import { useBedAvailability, useLeads } from '@/lib/occupancy/queries'
import { bestLeadsForBed } from '@/lib/occupancy/matching'
import { inr, inrShort, shortDate, shortProperty, daysUntil } from '@/lib/occupancy/format'

export const Route = createFileRoute('/occupancy/radar')({
  head: () => ({
    meta: [
      { title: 'Vacancy Radar | Gharpayy' },
      {
        name: 'description',
        content:
          'Beds that are about to empty, each pre-matched to waiting leads. Fill them on day zero.',
      },
    ],
  }),
  component: RadarPage,
})

/** The forward view, nearest first. `max` is days until the bed is free. */
const BUCKETS = [
  { label: 'Already empty', hint: 'Losing money every day', max: 0, dot: 'bg-[#e12527]', hintCls: 'text-[var(--oc-red)]' },
  { label: 'Next 15 days', hint: 'Sell before the keys come back', max: 15, dot: 'bg-[#0943a0]', hintCls: 'text-[var(--oc-brand)]' },
  { label: '16 to 30 days', hint: 'Start matching now', max: 30, dot: 'bg-[#e5a135]', hintCls: 'text-[var(--oc-amber)]' },
  { label: '31 to 60 days', hint: 'Build the early pipeline', max: 60, dot: 'bg-[#48b878]', hintCls: 'text-[var(--oc-green)]' },
]

function RadarPage() {
  const { data: beds, isLoading, error } = useBedAvailability()
  const { data: leads } = useLeads()

  /** Every sellable bed: empty now, or emptying because notice was given. */
  const sellable = useMemo(
    () =>
      (beds ?? [])
        .filter((b) => b.available_from !== null)
        .map((b) => ({
          bed: b,
          days: b.status === 'vacant' ? 0 : Math.max(0, daysUntil(b.expected_move_out_date) ?? 0),
          matches: leads ? bestLeadsForBed(b, leads, 5) : [],
        }))
        .filter((x) => x.days <= 60)
        .sort((a, b) =>
          a.days === b.days
            ? Number(b.bed.revenue_lost) - Number(a.bed.revenue_lost)
            : a.days - b.days,
        ),
    [beds, leads],
  )

  const grouped = useMemo(
    () =>
      BUCKETS.map((bucket, i) => {
        // Bucket 0 is everything already empty. The rest split beds on notice by
        // days until free; a tenant leaving today lands in "Next 15 days".
        const prevMax = i <= 1 ? -1 : BUCKETS[i - 1]!.max
        const items = sellable.filter((x) =>
          i === 0
            ? x.bed.status === 'vacant'
            : x.bed.status !== 'vacant' && x.days > prevMax && x.days <= bucket.max,
        )
        const total =
          i === 0
            ? items.reduce((s, x) => s + Number(x.bed.revenue_lost), 0)
            : items.reduce((s, x) => s + Number(x.bed.monthly_rent), 0)
        return { ...bucket, items, total }
      }),
    [sellable],
  )

  const upcoming = sellable.filter((x) => x.bed.status !== 'vacant')
  const empty = sellable.filter((x) => x.bed.status === 'vacant')
  const rentComingUp = upcoming.reduce((s, x) => s + Number(x.bed.monthly_rent), 0)
  const bestFuture = Math.max(0, ...upcoming.map((x) => x.matches[0]?.score ?? 0))

  return (
    <AppShell>
      <div className={PAGE}>
        <PageHeader
          eyebrow="Vacancy radar"
          title="Sell the next empty bed early."
          subtitle="When a tenant gives notice, their bed will be free soon. Match someone now, so the bed never sits empty."
          actions={
            <span className="hidden items-center rounded-xl border border-[var(--oc-border)] bg-[var(--oc-card)] px-3 py-2 text-xs font-semibold text-[var(--oc-text-2)] sm:flex">
              <CalendarDays className="mr-2 h-3.5 w-3.5" />
              Next 60 days
            </span>
          }
        />

        {error ? <ErrorNote error={error} /> : null}

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Radar} tone="blue" label="Leaving soon" value={`${upcoming.length} beds`} sub="In the next 60 days" />
          <StatTile icon={TrendingUp} tone="amber" label="Rent to refill" value={inrShort(rentComingUp)} sub="A month, from those beds" />
          <StatTile icon={Target} tone="green" label="Best match" value={`${bestFuture} / 100`} sub="For a bed freeing up" />
          <StatTile icon={CircleAlert} tone="red" label="Empty now" value={`${empty.length} beds`} sub="Losing money today" />
        </section>

        <section className="mt-7">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-[#f4c024]" />
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--oc-text-2)]">
              Inventory timeline
            </p>
            <div className="h-px flex-1 bg-[var(--oc-border)]" />
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Shimmer key={i} className="h-28" />
              ))}
            </div>
          ) : (
            <div className="relative space-y-6 before:absolute before:bottom-8 before:left-[13px] before:top-2 before:w-px before:bg-[var(--oc-border)] lg:before:left-[145px]">
              {grouped.map((g, gi) => (
                <div key={g.label} className="relative grid grid-cols-1 gap-4 lg:grid-cols-[150px_minmax(0,1fr)] lg:gap-6">
                  <div className="relative">
                    <span
                      className={`absolute left-[7px] top-1.5 h-3 w-3 rounded-full border-4 border-background lg:left-[139px] ${g.dot}`}
                    />
                    <div className="pl-8 lg:pl-0 lg:pr-6">
                      <p className="font-display text-lg font-bold tracking-[-0.03em]">{g.label}</p>
                      <p className={`mt-1 text-xs font-semibold ${g.hintCls}`}>{g.hint}</p>
                      <p className="mt-2 text-[11px] font-bold text-[var(--oc-text-3)]">
                        {g.items.length} bed{g.items.length === 1 ? '' : 's'}
                        {g.items.length > 0
                          ? gi === 0
                            ? `, ${inr(g.total)} lost`
                            : `, ${inr(g.total)}/mo`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5 pl-8 lg:pl-0">
                    {g.items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[var(--oc-border)] px-4 py-5 text-xs text-[var(--oc-text-3)]">
                        Nothing in this window.
                      </div>
                    ) : (
                      g.items.map(({ bed, days, matches }) => {
                        const vacant = bed.status === 'vacant'
                        const best = matches[0]?.score
                        return (
                          <Link
                            key={bed.bed_id}
                            to="/occupancy/bed/$bedId"
                            params={{ bedId: bed.bed_id }}
                            className={`group block ${CARD} p-4 transition hover:-translate-y-0.5 hover:border-[var(--oc-brand-line)] sm:p-5`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                                  vacant ? 'bg-[var(--oc-red-soft)] text-[var(--oc-red)]' : 'bg-[var(--oc-brand-soft)] text-[var(--oc-brand)]'
                                }`}
                              >
                                <BedDouble className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="min-w-0 break-words text-sm font-bold group-hover:text-[var(--oc-brand)]">
                                    {shortProperty(bed.property_name)} · {bed.room_number}
                                    {bed.bed_label}
                                  </h3>
                                  <FactChip>{inr(bed.monthly_rent)} / mo</FactChip>
                                </div>
                                <p className="mt-1 text-[11px] text-[var(--oc-text-3)]">
                                  {vacant ? (
                                    <>
                                      Empty now
                                      <Dot />
                                      {bed.days_vacant} days empty
                                    </>
                                  ) : (
                                    <>
                                      {bed.current_tenant}
                                      <Dot />
                                      leaves {shortDate(bed.expected_move_out_date)}, in {days} days
                                    </>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p
                                    className={`font-display text-lg font-bold ${
                                      best !== undefined ? scoreText(best) : 'text-[var(--oc-faint)]'
                                    }`}
                                  >
                                    {best ?? '–'}
                                  </p>
                                  <p className="text-[10px] text-[var(--oc-text-3)]">best match</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-[var(--oc-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--oc-brand)]" />
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--oc-divider)] pt-3 text-[11px]">
                              <span className="flex items-center gap-1.5 text-[var(--oc-text-2)]">
                                <Users className="h-3.5 w-3.5 text-[var(--oc-text-3)]" />
                                {matches.length === 0
                                  ? 'No matched leads yet'
                                  : `${matches.length} matched lead${matches.length === 1 ? '' : 's'}`}
                              </span>
                              {vacant ? (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--oc-red-soft)] px-2 py-1 text-xs font-bold text-[var(--oc-red)]">
                                  <TrendingDown className="h-3.5 w-3.5" />
                                  {inr(Number(bed.revenue_lost))}
                                </span>
                              ) : matches.length > 0 ? (
                                <span className="flex items-center gap-1.5 font-semibold text-[var(--oc-green)]">
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Sell before it empties
                                </span>
                              ) : null}
                            </div>
                          </Link>
                        )
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
