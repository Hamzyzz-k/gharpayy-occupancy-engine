import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { ArrowLeft, Radar, Target } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useBedAvailability, useLeads } from '@/lib/occupancy/queries'
import { bestLeadsForBed } from '@/lib/occupancy/matching'
import { inr, shortDate, daysUntil } from '@/lib/occupancy/format'

export const Route = createFileRoute('/occupancy/radar')({
  head: () => ({
    meta: [
      { title: 'Vacancy Radar — Gharpayy' },
      {
        name: 'description',
        content:
          'Beds that are about to empty, each pre-matched to waiting leads. Fill them on day zero.',
      },
    ],
  }),
  component: RadarPage,
})

/** Time buckets for the forward view. */
const BUCKETS = [
  { label: 'Already empty', max: 0 },
  { label: 'Next 15 days', max: 15 },
  { label: '16–30 days', max: 30 },
  { label: '31–60 days', max: 60 },
]

function RadarPage() {
  const { data: beds, isLoading } = useBedAvailability()
  const { data: leads } = useLeads()

  /** Every sellable bed: empty now, or emptying because notice was given. */
  const sellable = useMemo(() => {
    return (beds ?? [])
      .filter((b) => b.available_from !== null)
      .map((b) => ({
        bed: b,
        days: b.status === 'vacant' ? 0 : (daysUntil(b.expected_move_out_date) ?? 0),
        matches: leads ? bestLeadsForBed(b, leads, 5) : [],
      }))
      .filter((x) => x.days <= 60)
      .sort((a, b) => a.days - b.days)
  }, [beds, leads])

  const grouped = useMemo(() => {
    return BUCKETS.map((bucket, i) => {
      const prevMax = i === 0 ? -Infinity : BUCKETS[i - 1].max
      return {
        ...bucket,
        items: sellable.filter((x) => x.days > prevMax && x.days <= bucket.max),
      }
    })
  }, [sellable])

  const futureRent = useMemo(
    () =>
      sellable
        .filter((x) => x.days > 0)
        .reduce((s, x) => s + Number(x.bed.monthly_rent), 0),
    [sellable],
  )

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
        <Link
          to="/occupancy"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Occupancy Engine
        </Link>

        <header className="mb-6">
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-accent" />
            <h1 className="text-2xl font-display font-bold">Vacancy Radar</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            A bed isn&apos;t only inventory once it&apos;s empty. The moment a tenant
            gives notice it becomes sellable, so we start selling it then, not on the
            day it empties. Every bed below already has matched leads attached.
          </p>
          {futureRent > 0 ? (
            <p className="mt-2 text-sm">
              <span className="font-semibold">{inr(futureRent)}/month</span>{' '}
              <span className="text-muted-foreground">
                of rent is about to come up for renewal in the next 60 days.
              </span>
            </p>
          ) : null}
        </header>

        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-4">
            {grouped.map((g) => (
              <div key={g.label}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{g.label}</h2>
                  <Badge variant="secondary" className="text-[10px]">
                    {g.items.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {g.items.map(({ bed, matches }) => (
                    <Link
                      key={bed.bed_id}
                      to="/occupancy/bed/$bedId"
                      params={{ bedId: bed.bed_id }}
                      className="block"
                    >
                      <Card className="p-3 transition-colors hover:bg-muted/50">
                        <div className="truncate text-sm font-medium">
                          {bed.property_name}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Room {bed.room_number}
                          {bed.bed_label} · {inr(bed.monthly_rent)}/mo
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {bed.status === 'vacant' ? (
                            <span className="text-red-500">
                              empty {bed.days_vacant}d · −{inr(Number(bed.revenue_lost))}
                            </span>
                          ) : (
                            <>
                              {bed.current_tenant} leaves{' '}
                              {shortDate(bed.expected_move_out_date)}
                            </>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 border-t pt-2">
                          <Target className="h-3 w-3 text-accent" />
                          <span className="text-xs">
                            {matches.length === 0 ? (
                              <span className="text-muted-foreground">no match yet</span>
                            ) : (
                              <>
                                <span className="font-medium">{matches.length}</span>{' '}
                                <span className="text-muted-foreground">
                                  matched lead{matches.length === 1 ? '' : 's'}
                                </span>
                                {matches[0] ? (
                                  <span className="text-muted-foreground">
                                    {' '}
                                    · best {matches[0].score}/100
                                  </span>
                                ) : null}
                              </>
                            )}
                          </span>
                        </div>
                      </Card>
                    </Link>
                  ))}
                  {g.items.length === 0 ? (
                    <Card className="p-4 text-center text-xs text-muted-foreground">
                      Nothing in this window
                    </Card>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
