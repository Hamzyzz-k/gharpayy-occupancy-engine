import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Building2, ChevronDown, ChevronRight } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useBedAvailability } from '@/lib/occupancy/queries'
import { inr, shortDate } from '@/lib/occupancy/format'
import type { BedAvailability } from '@/lib/occupancy/types'

export const Route = createFileRoute('/occupancy/inventory')({
  head: () => ({
    meta: [
      { title: 'Inventory — Gharpayy' },
      {
        name: 'description',
        content: 'Bed-level inventory across every property, with live availability.',
      },
    ],
  }),
  component: InventoryPage,
})

interface PropertyGroup {
  propertyId: string
  name: string
  locality: string
  beds: BedAvailability[]
  vacant: number
  onNotice: number
  occupancyPct: number
  idleRent: number
}

function InventoryPage() {
  const { data: beds, isLoading } = useBedAvailability()
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const groups = useMemo<PropertyGroup[]>(() => {
    const m = new Map<string, BedAvailability[]>()
    for (const b of beds ?? []) {
      const arr = m.get(b.property_id) ?? []
      arr.push(b)
      m.set(b.property_id, arr)
    }
    return Array.from(m.entries())
      .map(([propertyId, rows]) => {
        const vacant = rows.filter((r) => r.status === 'vacant')
        const onNotice = rows.filter(
          (r) => r.status === 'occupied' && r.expected_move_out_date,
        ).length
        return {
          propertyId,
          name: rows[0].property_name,
          locality: rows[0].locality,
          beds: rows.sort((a, b) =>
            (a.room_number + a.bed_label).localeCompare(b.room_number + b.bed_label),
          ),
          vacant: vacant.length,
          onNotice,
          occupancyPct: ((rows.length - vacant.length) / rows.length) * 100,
          idleRent: vacant.reduce((s, r) => s + Number(r.monthly_rent), 0),
        }
      })
      .sort((a, b) => a.occupancyPct - b.occupancyPct) // worst first — that's where the work is
  }, [beds])

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
        <header className="mb-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-accent" />
            <h1 className="text-2xl font-display font-bold">Inventory</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Property → room → bed. The unit we sell is a bed, so that&apos;s the level
            we track. Sorted by worst occupancy first.
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => {
              const isOpen = open[g.propertyId] ?? false
              const Chevron = isOpen ? ChevronDown : ChevronRight
              return (
                <Card key={g.propertyId} className="overflow-hidden">
                  <button
                    onClick={() =>
                      setOpen((s) => ({ ...s, [g.propertyId]: !isOpen }))
                    }
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <Chevron className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{g.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {g.locality} · {g.beds.length} beds
                      </div>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <div className="text-xs text-muted-foreground">idle rent</div>
                      <div className="text-sm tabular-nums">
                        {g.idleRent ? inr(g.idleRent) : '—'}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div
                        className={`text-lg font-semibold tabular-nums ${
                          g.occupancyPct >= 90
                            ? 'text-emerald-500'
                            : g.occupancyPct >= 75
                              ? 'text-amber-500'
                              : 'text-red-500'
                        }`}
                      >
                        {g.occupancyPct.toFixed(0)}%
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {g.vacant} empty · {g.onNotice} on notice
                      </div>
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="grid gap-2 border-t bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-3">
                      {g.beds.map((b) => (
                        <Link
                          key={b.bed_id}
                          to="/occupancy/bed/$bedId"
                          params={{ bedId: b.bed_id }}
                          className="rounded-lg border bg-background p-3 transition-colors hover:bg-muted/50"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {b.room_number}
                              {b.bed_label}
                            </span>
                            <Badge
                              variant={
                                b.status === 'vacant'
                                  ? 'destructive'
                                  : b.expected_move_out_date
                                    ? 'secondary'
                                    : 'outline'
                              }
                              className="text-[10px]"
                            >
                              {b.status === 'vacant'
                                ? `empty ${b.days_vacant}d`
                                : b.expected_move_out_date
                                  ? `leaving ${shortDate(b.expected_move_out_date)}`
                                  : 'occupied'}
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {b.sharing_type} · {b.gender} · {inr(b.monthly_rent)}/mo
                          </div>
                          {b.current_tenant ? (
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">
                              {b.current_tenant}
                            </div>
                          ) : (
                            <div className="mt-0.5 text-xs text-red-500">
                              −{inr(Number(b.revenue_lost))} lost
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
