import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ArrowRight, BedDouble, Building2, CalendarDays, ChevronDown, CircleAlert } from 'lucide-react'
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
import { useBedAvailability, computeStats } from '@/lib/occupancy/queries'
import { inr, shortDate } from '@/lib/occupancy/format'
import type { BedAvailability } from '@/lib/occupancy/types'

export const Route = createFileRoute('/occupancy/inventory')({
  head: () => ({
    meta: [
      { title: 'Inventory | Gharpayy' },
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

function occTone(pct: number) {
  if (pct >= 90) return { bar: 'bg-[#48b878]', text: 'text-[var(--oc-green)]', icon: 'bg-[var(--oc-green-soft)] text-[var(--oc-green)]' }
  if (pct >= 80) return { bar: 'bg-[#e5a135]', text: 'text-[var(--oc-amber)]', icon: 'bg-[var(--oc-amber-soft)] text-[var(--oc-amber)]' }
  return { bar: 'bg-[#e12527]', text: 'text-[var(--oc-red)]', icon: 'bg-[var(--oc-red-soft)] text-[var(--oc-red)]' }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function InventoryPage() {
  const { data: beds, isLoading, error } = useBedAvailability()
  const stats = useMemo(() => computeStats(beds ?? []), [beds])
  // null = nothing toggled yet, in which case the worst property starts open.
  const [open, setOpen] = useState<Record<string, boolean> | null>(null)

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
        return {
          propertyId,
          name: rows[0]!.property_name,
          locality: rows[0]!.locality,
          beds: [...rows].sort((a, b) =>
            (a.room_number + a.bed_label).localeCompare(b.room_number + b.bed_label),
          ),
          vacant: vacant.length,
          onNotice: rows.filter((r) => r.status === 'occupied' && r.expected_move_out_date).length,
          occupancyPct: ((rows.length - vacant.length) / rows.length) * 100,
          idleRent: vacant.reduce((s, r) => s + Number(r.monthly_rent), 0),
        }
      })
      .sort((a, b) => a.occupancyPct - b.occupancyPct) // worst first, since that's where the work is
  }, [beds])

  const isOpen = (id: string, index: number) => (open ? Boolean(open[id]) : index === 0)
  const toggle = (id: string, index: number) =>
    setOpen((s) => {
      const base = s ?? (groups[0] ? { [groups[0].propertyId]: true } : {})
      return { ...base, [id]: !isOpen(id, index) }
    })

  return (
    <AppShell>
      <div className={PAGE}>
        <PageHeader
          eyebrow="Bed inventory"
          title="Know every bed by property."
          subtitle="The unit we sell is a bed, so that's the level we track. Sorted by worst occupancy, then every room, bed and status."
          actions={
            <span className="rounded-xl border border-[var(--oc-border)] bg-[var(--oc-card)] px-4 py-2.5 text-xs font-bold text-[var(--oc-text-2)]">
              Sorted: worst occupancy first
            </span>
          }
        />

        {error ? <ErrorNote error={error} /> : null}

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Building2} tone="grey" label="Properties" value={groups.length} sub="Across Bengaluru" />
          <StatTile icon={BedDouble} tone="green" label="Beds" value={stats.totalBeds} sub={`${stats.occupiedBeds} filled (${Math.round(stats.occupancyPct)}%)`} />
          <StatTile icon={CircleAlert} tone="red" label="Empty" value={stats.vacantBeds} sub={`${inr(stats.monthlyRentIdle)} rent missed a month`} />
          <StatTile icon={CalendarDays} tone="blue" label="On notice" value={stats.bedsOnNotice} sub="Tenants leaving soon" />
        </section>

        <section className="mt-6 space-y-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} className="h-20" />)
            : groups.map((g, gi) => {
                const t = occTone(g.occupancyPct)
                const expanded = isOpen(g.propertyId, gi)
                return (
                  <div
                    key={g.propertyId}
                    className={`${CARD} overflow-hidden ${gi === 0 ? 'border-[var(--oc-brand-line)]' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(g.propertyId, gi)}
                      aria-expanded={expanded}
                      className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-[var(--oc-hover)] sm:p-5"
                    >
                      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${t.icon}`}>
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-sm font-bold sm:text-base">{g.name}</h2>
                          <FactChip>{g.locality}</FactChip>
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--oc-text-3)]">
                          {g.beds.length} beds
                          <Dot />
                          {g.vacant} empty
                          <Dot />
                          {g.onNotice} on notice
                        </p>
                      </div>
                      <div className="hidden items-center gap-7 sm:flex">
                        <div className="w-32">
                          <div className="mb-1.5 flex justify-between text-[10px] font-bold">
                            <span className="text-[var(--oc-text-3)]">Occupancy</span>
                            <span className={t.text}>{Math.round(g.occupancyPct)}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--oc-divider)]">
                            <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${g.occupancyPct}%` }} />
                          </div>
                        </div>
                        <div className="w-20 text-right">
                          <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--oc-text-3)]">Rent missed</p>
                          <p className={`mt-1 text-xs font-bold ${g.idleRent ? 'text-[var(--oc-red)]' : 'text-[var(--oc-text-3)]'}`}>
                            {g.idleRent ? inr(g.idleRent) : 'None'}
                          </p>
                        </div>
                      </div>
                      <p className={`font-display text-lg font-bold sm:hidden ${t.text}`}>
                        {g.occupancyPct.toFixed(0)}%
                      </p>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-[var(--oc-text-3)] transition ${expanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {expanded ? (
                      <div className="border-t border-[var(--oc-divider)] bg-[var(--oc-sunken)] p-3 sm:p-4">
                        <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,0.65fr)_minmax(0,0.6fr)_minmax(0,0.9fr)_auto] gap-3 px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--oc-text-3)] lg:grid">
                          <span>Room / bed</span>
                          <span>Type</span>
                          <span>Rent</span>
                          <span>Status</span>
                          <span className="w-12" />
                        </div>
                        <div className="space-y-2">
                          {g.beds.map((b) => {
                            const vacant = b.status === 'vacant'
                            const leaving = !vacant && b.expected_move_out_date
                            return (
                              <Link
                                key={b.bed_id}
                                to="/occupancy/bed/$bedId"
                                params={{ bedId: b.bed_id }}
                                className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-[var(--oc-divider)] bg-[var(--oc-card)] p-3 transition hover:border-[var(--oc-brand-line)] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.65fr)_minmax(0,0.6fr)_minmax(0,0.9fr)_auto] lg:gap-3"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--oc-chip)] text-[var(--oc-text-2)]">
                                    <BedDouble className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold group-hover:text-[var(--oc-brand)]">
                                      Room {b.room_number}
                                      {b.bed_label}
                                    </p>
                                    <p className="mt-1 truncate text-[10px] text-[var(--oc-text-3)]">
                                      {b.current_tenant ?? `${cap(b.gender)} bed`}
                                    </p>
                                  </div>
                                </div>
                                <span className="hidden text-[11px] font-semibold text-[var(--oc-text-2)] lg:block">
                                  {cap(b.sharing_type)}
                                </span>
                                <span className="hidden text-[11px] font-semibold text-[var(--oc-text-2)] lg:block">
                                  {inr(b.monthly_rent)}
                                </span>
                                <span
                                  className={`w-fit rounded-md px-2 py-1 text-[10px] font-bold ${
                                    vacant
                                      ? 'bg-[var(--oc-red-soft)] text-[var(--oc-red)]'
                                      : leaving
                                        ? 'bg-[var(--oc-amber-soft)] text-[var(--oc-amber)]'
                                        : 'bg-[var(--oc-green-soft)] text-[var(--oc-green)]'
                                  }`}
                                >
                                  {vacant
                                    ? `${b.days_vacant} days empty`
                                    : leaving
                                      ? `Leaving ${shortDate(b.expected_move_out_date)}`
                                      : 'Occupied'}
                                </span>
                                <span className="hidden w-12 text-right text-xs font-bold text-[var(--oc-brand)] lg:block">
                                  Open
                                  <ArrowRight className="ml-1 inline h-3 w-3" />
                                </span>
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
        </section>
      </div>
    </AppShell>
  )
}
