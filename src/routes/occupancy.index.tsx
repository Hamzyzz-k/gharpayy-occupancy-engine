import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  CalendarClock,
  Gauge,
  IndianRupee,
  TrendingDown,
} from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useBedAvailability, computeStats } from '@/lib/occupancy/queries'
import { inr, inrShort, shortDate, daysUntil } from '@/lib/occupancy/format'
import type { BedAvailability } from '@/lib/occupancy/types'

export const Route = createFileRoute('/occupancy/')({
  head: () => ({
    meta: [
      { title: 'Occupancy Engine — Gharpayy' },
      {
        name: 'description',
        content:
          'Revenue at Risk: every empty bed, what it is costing, and who can fill it.',
      },
    ],
  }),
  component: OccupancyPage,
})

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'default',
}: {
  icon: typeof Gauge
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'danger' | 'warn' | 'good'
}) {
  const toneRing =
    tone === 'danger'
      ? 'text-red-500'
      : tone === 'warn'
        ? 'text-amber-500'
        : tone === 'good'
          ? 'text-emerald-500'
          : 'text-muted-foreground'

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${toneRing}`} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </Card>
  )
}

function OccupancyPage() {
  const { data: beds, isLoading, error } = useBedAvailability()

  const stats = useMemo(() => computeStats(beds ?? []), [beds])

  /** Empty beds, worst bleed first. */
  const bleeding = useMemo(
    () =>
      (beds ?? [])
        .filter((b) => b.status === 'vacant')
        .sort((a, b) => Number(b.revenue_lost) - Number(a.revenue_lost))
        .slice(0, 12),
    [beds],
  )

  /** Beds that aren't empty yet: someone has given notice. Future inventory. */
  const upcoming = useMemo(
    () =>
      (beds ?? [])
        .filter((b) => b.status === 'occupied' && b.expected_move_out_date)
        .sort(
          (a, b) =>
            new Date(a.expected_move_out_date!).getTime() -
            new Date(b.expected_move_out_date!).getTime(),
        )
        .slice(0, 8),
    [beds],
  )

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
        <header className="mb-6">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-accent" />
            <h1 className="text-2xl font-display font-bold">Occupancy Engine</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A PG doesn&apos;t sell leads. It sells bed-nights, and a bed-night is
            perishable. An empty bed last night can never be sold again. This screen
            shows what that is costing right now.
          </p>
        </header>

        {error ? (
          <Card className="border-red-500/40 bg-red-500/5 p-4 text-sm">
            <div className="flex items-center gap-2 font-medium text-red-500">
              <AlertTriangle className="h-4 w-4" />
              Could not reach the database
            </div>
            <p className="mt-1 text-muted-foreground">
              {(error as Error).message}. Check that{' '}
              <code className="rounded bg-muted px-1">VITE_SUPABASE_URL</code> and{' '}
              <code className="rounded bg-muted px-1">VITE_SUPABASE_PUBLISHABLE_KEY</code>{' '}
              point at your project and that the migrations have been run.
            </p>
          </Card>
        ) : null}

        {/* ---- The headline number ------------------------------------- */}
        <Card className="mb-4 overflow-hidden border-red-500/30 bg-gradient-to-br from-red-500/10 via-transparent to-transparent p-6">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-red-500">
            <TrendingDown className="h-4 w-4" />
            Revenue at Risk
          </div>
          {isLoading ? (
            <Skeleton className="mt-3 h-12 w-56" />
          ) : (
            <div className="mt-2 text-5xl font-bold tabular-nums">
              {inrShort(stats.revenueAtRisk)}
            </div>
          )}
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Already lost across {stats.vacantBeds} empty bed
            {stats.vacantBeds === 1 ? '' : 's'}, averaging{' '}
            {stats.avgDaysVacant.toFixed(0)} days vacant. Every further day adds{' '}
            <span className="font-medium text-foreground">
              {inr(stats.monthlyRentIdle / 30)}
            </span>
            .
          </p>
        </Card>

        {/* ---- Supporting stats ---------------------------------------- */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            icon={Gauge}
            label="Occupancy"
            value={`${stats.occupancyPct.toFixed(1)}%`}
            sub={`${stats.occupiedBeds} of ${stats.totalBeds} beds filled`}
            tone={stats.occupancyPct >= 90 ? 'good' : 'warn'}
          />
          <StatTile
            icon={BedDouble}
            label="Empty beds"
            value={String(stats.vacantBeds)}
            sub={`${inr(stats.monthlyRentIdle)}/mo of idle rent`}
            tone="danger"
          />
          <StatTile
            icon={CalendarClock}
            label="On notice"
            value={String(stats.bedsOnNotice)}
            sub="Future inventory, sell these now"
            tone="warn"
          />
          <StatTile
            icon={IndianRupee}
            label="Daily bleed"
            value={inr(stats.monthlyRentIdle / 30)}
            sub="Added to the loss every day"
            tone="danger"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          {/* ---- Bleeding beds ----------------------------------------- */}
          <Card className="lg:col-span-3">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Where the money is going</h2>
              <p className="text-xs text-muted-foreground">
                Empty beds ranked by what they&apos;ve already cost. Click one to see
                who could fill it.
              </p>
            </div>
            <div className="divide-y">
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="px-4 py-3">
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))
                : bleeding.map((b) => <BleedingRow key={b.bed_id} bed={b} />)}
              {!isLoading && bleeding.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No empty beds. That&apos;s 100% occupancy. Enjoy it.
                </div>
              ) : null}
            </div>
          </Card>

          {/* ---- Vacancy Radar ----------------------------------------- */}
          <Card className="lg:col-span-2">
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Vacancy Radar</h2>
                <Link
                  to="/occupancy/radar"
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  Full radar <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                Beds that aren&apos;t empty yet. Fill them on day zero.
              </p>
            </div>
            <div className="divide-y">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-4 py-3">
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ))
                : upcoming.map((b) => {
                    const days = daysUntil(b.expected_move_out_date)
                    return (
                      <Link
                        key={b.bed_id}
                        to="/occupancy/bed/$bedId"
                        params={{ bedId: b.bed_id }}
                        className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {b.property_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Room {b.room_number}
                            {b.bed_label} · {b.current_tenant} leaving{' '}
                            {shortDate(b.expected_move_out_date)}
                          </div>
                        </div>
                        <Badge variant={days !== null && days <= 14 ? 'destructive' : 'secondary'}>
                          {days !== null && days <= 0 ? 'now' : `${days}d`}
                        </Badge>
                      </Link>
                    )
                  })}
              {!isLoading && upcoming.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nobody on notice right now.
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}

function BleedingRow({ bed }: { bed: BedAvailability }) {
  return (
    <Link
      to="/occupancy/bed/$bedId"
      params={{ bedId: bed.bed_id }}
      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{bed.property_name}</span>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {bed.locality}
          </Badge>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Room {bed.room_number}
          {bed.bed_label} · {bed.sharing_type} · {bed.gender} · {inr(bed.monthly_rent)}/mo
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold tabular-nums text-red-500">
          −{inr(Number(bed.revenue_lost))}
        </div>
        <div className="text-xs text-muted-foreground">{bed.days_vacant}d empty</div>
      </div>
    </Link>
  )
}
