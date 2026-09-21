import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import {
  ArrowRight,
  BedDouble,
  Building2,
  CalendarDays,
  ChevronRight,
  MapPin,
  TrendingDown,
  Zap,
} from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import {
  CARD,
  PAGE,
  Dot,
  EmptyNote,
  ErrorNote,
  PageHeader,
  SectionTitle,
  Shimmer,
  StatTile,
  useToday,
} from '@/components/occupancy/ui'
import { useBedAvailability, computeStats } from '@/lib/occupancy/queries'
import { inr, inrK, inrShort, shortDate, shortProperty, daysUntil } from '@/lib/occupancy/format'

export const Route = createFileRoute('/occupancy/')({
  head: () => ({
    meta: [
      { title: 'Occupancy Engine — Gharpayy' },
      {
        name: 'description',
        content: 'Revenue at Risk: every empty bed, what it is costing, and who can fill it.',
      },
    ],
  }),
  component: OccupancyPage,
})

/** Bar colours for the loss-by-property chart, worst first. Lighter in dark mode. */
const LOSS_COLOURS = [1, 2, 3, 4, 5, 6].map((i) => `var(--oc-chart-${i})`)

/** Vacancy age buckets. Older is worse, so the colour deepens. */
const AGE_BUCKETS = [
  { label: '0-7', min: 0, max: 7, colour: 'bg-[#c9d8f1]' },
  { label: '8-14', min: 8, max: 14, colour: 'bg-[#7fa3dd]' },
  { label: '15-30', min: 15, max: 30, colour: 'bg-[#f4c024]' },
  { label: '31+', min: 31, max: Infinity, colour: 'bg-[#e12527]' },
]

function OccupancyPage() {
  const { data: beds, isLoading, error } = useBedAvailability()
  const today = useToday()
  const stats = useMemo(() => computeStats(beds ?? []), [beds])

  const vacant = useMemo(
    () =>
      (beds ?? [])
        .filter((b) => b.status === 'vacant')
        .sort((a, b) => Number(b.revenue_lost) - Number(a.revenue_lost)),
    [beds],
  )

  const onNotice = useMemo(
    () =>
      (beds ?? [])
        .filter((b) => b.status === 'occupied' && b.expected_move_out_date)
        .sort(
          (a, b) =>
            new Date(a.expected_move_out_date!).getTime() -
            new Date(b.expected_move_out_date!).getTime(),
        ),
    [beds],
  )

  const lossByProperty = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of vacant) {
      m.set(b.property_name, (m.get(b.property_name) ?? 0) + Number(b.revenue_lost))
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [vacant])
  const maxLoss = lossByProperty[0]?.[1] ?? 0

  const ageCounts = useMemo(
    () =>
      AGE_BUCKETS.map(
        (bk) => vacant.filter((b) => b.days_vacant >= bk.min && b.days_vacant <= bk.max).length,
      ),
    [vacant],
  )
  const maxAge = Math.max(1, ...ageCounts)

  return (
    <AppShell>
      <div className={PAGE}>
        <PageHeader
          eyebrow={today || 'Occupancy'}
          title="Stop the bleed."
          subtitle="Every empty bed is revenue that can never be recovered. Here is where the loss is happening right now."
        />

        {error ? <ErrorNote error={error} /> : null}

        {/* ---- Hero + stat tiles ------------------------------------------ */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <div className="relative overflow-hidden rounded-3xl bg-[#0943a0] p-5 text-white shadow-[0_16px_34px_rgba(9,67,160,0.28)] sm:p-7">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[38px] border-[#f4c024]/25" />
            <div className="absolute -bottom-24 right-20 h-44 w-44 rounded-full border-[24px] border-[#f4c024]/15" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f4c024] text-[#171b20]">
                    <TrendingDown className="h-4 w-4" />
                  </span>
                  Money lost to empty beds
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">
                  Right now
                </span>
              </div>
              {isLoading ? (
                <div className="mt-9 h-[72px] w-56 animate-pulse rounded-xl bg-white/10" />
              ) : (
                <p className="mt-9 font-display text-[52px] font-bold leading-none tracking-[-0.06em] text-white sm:text-[72px]">
                  {inrShort(stats.revenueAtRisk)}
                </p>
              )}
              <p className="mt-3 max-w-sm text-sm leading-6 text-white/75">
                Already lost from beds that have sat empty. That number grows every day.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-xl bg-[#e12527]/15 px-3 py-2 text-xs font-semibold text-[#ffc2bd]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#e12527]" />
                  {inr(stats.monthlyRentIdle / 30)} more every day
                </span>
                <span className="text-xs text-white/65">
                  Beds sit empty {stats.avgDaysVacant.toFixed(0)} days on average
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <StatTile
              icon={Building2}
              tone="green"
              label="Occupancy"
              value={`${Math.round(stats.occupancyPct)}%`}
              sub={`${stats.occupiedBeds} of ${stats.totalBeds} beds filled`}
            />
            <StatTile
              icon={BedDouble}
              tone="red"
              label="Empty beds"
              value={stats.vacantBeds}
              sub={`${inrShort(stats.monthlyRentIdle)} rent missed a month`}
            />
            <StatTile
              icon={CalendarDays}
              tone="blue"
              label="On notice"
              value={stats.bedsOnNotice}
              sub="Tenants leaving soon"
            />
            <StatTile
              icon={Zap}
              tone="amber"
              label="Lost per day"
              value={inr(stats.monthlyRentIdle / 30)}
              sub="Until the beds are filled"
            />
          </div>
        </section>

        {/* ---- Charts ------------------------------------------------------ */}
        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <div className={`${CARD} p-5 sm:p-6`}>
            <SectionTitle kicker="By property" title="Where money is lost" />
            <div className="mt-6 space-y-4">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} className="h-3" />)
                : lossByProperty.map(([name, loss], i) => (
                    <div
                      key={name}
                      className="grid grid-cols-[112px_minmax(0,1fr)_64px] items-center gap-3 text-xs sm:grid-cols-[160px_minmax(0,1fr)_72px]"
                    >
                      <span className="truncate font-semibold text-[var(--oc-text-2)]">
                        {shortProperty(name)}
                      </span>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--oc-divider)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(4, (loss / maxLoss) * 100)}%`,
                            backgroundColor: LOSS_COLOURS[Math.min(i, LOSS_COLOURS.length - 1)],
                          }}
                        />
                      </div>
                      <span className="text-right font-bold tabular-nums text-[var(--oc-text)]">
                        {inrK(loss)}
                      </span>
                    </div>
                  ))}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-[var(--oc-divider)] pt-4 text-xs">
              <span className="text-[var(--oc-text-3)]">Total lost</span>
              <span className="font-bold text-[var(--oc-red)]">{inr(stats.revenueAtRisk)}</span>
            </div>
          </div>

          <div className={`${CARD} p-5 sm:p-6`}>
            <SectionTitle
              kicker="Empty for"
              title="How long beds sit empty"
              aside={
                <span className="shrink-0 rounded-lg bg-[var(--oc-brand-soft)] px-2 py-1 text-[10px] font-bold text-[var(--oc-brand)]">
                  {stats.vacantBeds} beds
                </span>
              }
            />
            <div className="mt-8 flex h-[118px] items-end gap-3 px-1">
              {AGE_BUCKETS.map((bk, i) => (
                <div key={bk.label} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] font-bold tabular-nums text-[var(--oc-text-2)]">
                    {isLoading ? '' : ageCounts[i]}
                  </span>
                  <div className="flex h-[80px] w-full items-end">
                    <div
                      className={`w-full rounded-t-lg ${bk.colour}`}
                      style={{
                        height: isLoading ? '10%' : `${Math.max(6, (ageCounts[i]! / maxAge) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-[var(--oc-text-3)]">{bk.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-[10px] text-[var(--oc-text-3)]">days empty</p>
            <div className="mt-4 border-t border-[var(--oc-divider)] pt-4 text-xs text-[var(--oc-text-2)]">
              On average a bed sits empty for{' '}
              <span className="font-bold text-[var(--oc-text)]">
                {stats.avgDaysVacant.toFixed(0)} days
              </span>
              .
            </div>
          </div>
        </section>

        {/* ---- Empty beds + on notice ------------------------------------- */}
        <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.5fr)]">
          <div className={`${CARD} overflow-hidden`}>
            <div className="flex items-start justify-between gap-3 border-b border-[var(--oc-divider)] p-5 sm:p-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-xl font-bold tracking-[-0.035em]">Empty beds</h2>
                  <span className="rounded-full bg-[var(--oc-red-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--oc-red)]">
                    {stats.vacantBeds}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--oc-text-3)]">
                  Worst first. Tap one to see who could fill it.
                </p>
              </div>
              <Link
                to="/occupancy/inventory"
                className="hidden items-center gap-1.5 text-xs font-bold text-[var(--oc-brand)] sm:flex"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[var(--oc-divider)]">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4 sm:px-6">
                      <Shimmer className="h-10" />
                    </div>
                  ))
                : vacant.slice(0, 8).map((b, i) => (
                    <Link
                      key={b.bed_id}
                      to="/occupancy/bed/$bedId"
                      params={{ bedId: b.bed_id }}
                      className="group grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-4 transition hover:bg-[var(--oc-hover)] lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.6fr)_minmax(0,0.55fr)_minmax(0,0.55fr)_auto] lg:items-center sm:px-6"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="h-8 w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: LOSS_COLOURS[Math.min(i, LOSS_COLOURS.length - 1)] }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[var(--oc-text)] group-hover:text-[var(--oc-brand)]">
                            {b.property_name}
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--oc-text-3)]">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {b.locality}
                              <Dot />
                              Room {b.room_number}
                              {b.bed_label}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="hidden lg:block">
                        <p className="text-[11px] text-[var(--oc-text-3)]">Rent / month</p>
                        <p className="mt-1 text-xs font-bold">{inr(b.monthly_rent)}</p>
                      </div>
                      <div className="hidden lg:block">
                        <p className="text-[11px] text-[var(--oc-text-3)]">Empty for</p>
                        <p className="mt-1 text-xs font-bold text-[var(--oc-red)]">{b.days_vacant} days</p>
                      </div>
                      <div className="text-right lg:text-left">
                        <p className="text-[11px] text-[var(--oc-text-3)]">Lost</p>
                        <p className="mt-1 text-sm font-bold text-[var(--oc-red)]">
                          {inr(Number(b.revenue_lost))}
                        </p>
                      </div>
                      <ChevronRight className="hidden h-4 w-4 text-[var(--oc-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--oc-brand)] lg:block" />
                    </Link>
                  ))}
              {!isLoading && vacant.length === 0 ? (
                <div className="p-6">
                  <EmptyNote>No empty beds. That&apos;s 100% occupancy. Enjoy it.</EmptyNote>
                </div>
              ) : null}
            </div>
          </div>

          <div className={`${CARD} bg-[var(--oc-hover)] p-5 sm:p-6`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--oc-red-soft)] text-[var(--oc-red)]">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <h2 className="font-display text-xl font-bold tracking-[-0.035em]">On notice</h2>
              </div>
              <Link to="/occupancy/radar" className="text-xs font-bold text-[var(--oc-brand)]">
                Radar <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
              </Link>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--oc-text-2)]">
              Not empty yet. Fill them before the tenant leaves.
            </p>
            <div className="mt-5 space-y-3">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} className="h-20" />)
                : onNotice.slice(0, 4).map((b) => {
                    const days = daysUntil(b.expected_move_out_date)
                    return (
                      <Link
                        key={b.bed_id}
                        to="/occupancy/bed/$bedId"
                        params={{ bedId: b.bed_id }}
                        className="block rounded-xl border border-[var(--oc-divider)] bg-[var(--oc-card)] p-3.5 transition hover:border-[var(--oc-brand-line)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold">{b.current_tenant}</p>
                            <p className="mt-1 truncate text-[11px] text-[var(--oc-text-3)]">
                              {shortProperty(b.property_name)} · {b.room_number}
                              {b.bed_label}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-md bg-[var(--oc-amber-soft)] px-1.5 py-1 text-[10px] font-bold text-[var(--oc-amber)]">
                            {days !== null && days <= 0 ? 'Today' : `${days} days`}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-[var(--oc-divider)] pt-2.5 text-[11px]">
                          <span className="text-[var(--oc-text-3)]">Move-out</span>
                          <span className="font-bold text-[var(--oc-text)]">
                            {shortDate(b.expected_move_out_date)}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
              {!isLoading && onNotice.length === 0 ? (
                <EmptyNote>Nobody on notice right now.</EmptyNote>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
