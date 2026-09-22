import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { BedDouble, Building2, CheckCircle2, CircleAlert, IndianRupee, Undo2 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import {
  CARD,
  PAGE,
  EmptyNote,
  ErrorNote,
  FactChip,
  PageHeader,
  Shimmer,
  StatTile,
} from '@/components/occupancy/ui'
import { SellDialog, type SellTarget } from '@/components/occupancy/sell-dialog'
import { useBedAvailability, useMarkBedVacant } from '@/lib/occupancy/queries'
import { inr, shortDate } from '@/lib/occupancy/format'
import type { BedAvailability } from '@/lib/occupancy/types'

export const Route = createFileRoute('/occupancy/owner')({
  validateSearch: (s: Record<string, unknown>): { property?: string } => ({
    property: typeof s.property === 'string' ? s.property : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Owner Portal | Gharpayy' },
      { name: 'description', content: 'Property owners mark rooms as sold the moment they are booked.' },
    ],
  }),
  component: OwnerPage,
})

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

interface RoomGroup {
  roomId: string
  roomNumber: string
  sharing: string
  gender: string
  beds: BedAvailability[]
}

function OwnerPage() {
  const { property: selected } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: beds, isLoading, error } = useBedAvailability()
  const markVacant = useMarkBedVacant()
  const [sellTarget, setSellTarget] = useState<SellTarget | null>(null)

  const properties = useMemo(() => {
    const m = new Map<string, { id: string; name: string; locality: string }>()
    for (const b of beds ?? []) {
      m.set(b.property_id, { id: b.property_id, name: b.property_name, locality: b.locality })
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [beds])

  const propertyId =
    selected && properties.some((p) => p.id === selected) ? selected : properties[0]?.id
  const property = properties.find((p) => p.id === propertyId)
  const mine = useMemo(
    () => (beds ?? []).filter((b) => b.property_id === propertyId),
    [beds, propertyId],
  )

  const rooms = useMemo<RoomGroup[]>(() => {
    const m = new Map<string, RoomGroup>()
    for (const b of mine) {
      const g = m.get(b.room_id) ?? {
        roomId: b.room_id,
        roomNumber: b.room_number,
        sharing: b.sharing_type,
        gender: b.gender,
        beds: [],
      }
      g.beds.push(b)
      m.set(b.room_id, g)
    }
    for (const g of m.values()) g.beds.sort((a, b) => a.bed_label.localeCompare(b.bed_label))
    return [...m.values()].sort((a, b) =>
      a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }),
    )
  }, [mine])

  const sold = mine.filter((b) => b.status === 'occupied')
  const empty = mine.filter((b) => b.status === 'vacant')
  const rentRoll = sold.reduce((s, b) => s + Number(b.monthly_rent), 0)
  const rentMissed = empty.reduce((s, b) => s + Number(b.monthly_rent), 0)

  const vacate = (b: BedAvailability) => {
    const who = b.current_tenant ?? 'The tenant'
    if (!window.confirm(`Mark Room ${b.room_number}${b.bed_label} as empty? ${who} will be recorded as moved out today.`)) {
      return
    }
    markVacant.mutate(b.bed_id, {
      onSuccess: () => toast.success(`Room ${b.room_number}${b.bed_label} is back on sale`),
      onError: (e) => toast.error((e as Error).message),
    })
  }

  return (
    <AppShell>
      <div className={PAGE}>
        <PageHeader
          eyebrow="Owner portal"
          title="Your rooms, at a glance."
          subtitle="Mark a room as sold the moment it's booked. The sales team sees it straight away, so nobody pitches a bed that's gone."
        />

        {error ? <ErrorNote error={error} /> : null}

        {/* Without logins, the owner picks which property is theirs. */}
        <div
          className={`${CARD} mb-5 flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--oc-brand-soft)] text-[var(--oc-brand)]">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-[var(--oc-text-3)]">
                Viewing as owner of
              </p>
              <p className="truncate text-sm font-bold">
                {property ? `${property.name}, ${property.locality}` : 'Loading'}
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-[var(--oc-text-2)]">
            <span className="shrink-0">Switch property</span>
            <select
              value={propertyId ?? ''}
              onChange={(e) => navigate({ search: { property: e.target.value } })}
              aria-label="Choose property"
              className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--oc-border)] bg-[var(--oc-card)] px-3 text-xs font-bold text-[var(--oc-text)] outline-none focus:border-[var(--oc-brand)] lg:w-64 lg:flex-none"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon={BedDouble} tone="grey" label="Beds" value={mine.length} sub={`${rooms.length} rooms`} />
          <StatTile
            icon={CheckCircle2}
            tone="green"
            label="Sold"
            value={sold.length}
            sub={mine.length ? `${Math.round((sold.length / mine.length) * 100)}% full` : undefined}
          />
          <StatTile icon={CircleAlert} tone="red" label="Empty" value={empty.length} sub={`${inr(rentMissed)} missed a month`} />
          <StatTile icon={IndianRupee} tone="blue" label="Rent coming in" value={inr(rentRoll)} sub="Per month, sold beds" />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <Shimmer key={i} className="h-48" />)
            : rooms.map((room) => {
                const vacantBeds = room.beds.filter((b) => b.status === 'vacant')
                const full = vacantBeds.length === 0
                return (
                  <div key={room.roomId} className={`${CARD} flex flex-col p-4 sm:p-5`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-display text-lg font-bold tracking-[-0.03em]">Room {room.roomNumber}</h2>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <FactChip>{cap(room.sharing)}</FactChip>
                          <FactChip>{cap(room.gender)}</FactChip>
                        </div>
                      </div>
                      {full ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--oc-green-soft)] px-2 py-1 text-[11px] font-bold text-[var(--oc-green)]">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Sold out
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-lg bg-[var(--oc-red-soft)] px-2 py-1 text-[11px] font-bold text-[var(--oc-red)]">
                          {vacantBeds.length} of {room.beds.length} empty
                        </span>
                      )}
                    </div>

                    <ul className="mt-4 flex-1 space-y-2">
                      {room.beds.map((b) => {
                        const vacant = b.status === 'vacant'
                        const leaving = !vacant && b.expected_move_out_date
                        return (
                          <li
                            key={b.bed_id}
                            className="flex items-center gap-3 rounded-xl border border-[var(--oc-divider)] bg-[var(--oc-sunken)] p-2.5"
                          >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--oc-card)] text-xs font-bold text-[var(--oc-text-2)]">
                              {b.bed_label}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold">
                                {vacant ? `Empty ${b.days_vacant} days` : (b.current_tenant ?? 'Sold')}
                              </p>
                              <p
                                className={`mt-0.5 truncate text-[10px] ${
                                  vacant
                                    ? 'text-[var(--oc-red)]'
                                    : leaving
                                      ? 'text-[var(--oc-amber)]'
                                      : 'text-[var(--oc-text-3)]'
                                }`}
                              >
                                {inr(b.monthly_rent)}/mo
                                {vacant
                                  ? `, ${inr(Number(b.revenue_lost))} lost`
                                  : leaving
                                    ? `, leaving ${shortDate(b.expected_move_out_date)}`
                                    : ''}
                              </p>
                            </div>
                            {vacant ? (
                              <button
                                type="button"
                                onClick={() => setSellTarget({ beds: [b], label: `Room ${b.room_number}${b.bed_label}` })}
                                className="h-8 shrink-0 rounded-lg bg-[#f4c024] px-2.5 text-[11px] font-bold text-[#171b20] transition hover:brightness-105"
                              >
                                Mark sold
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => vacate(b)}
                                disabled={markVacant.isPending}
                                aria-label={`Mark Room ${b.room_number}${b.bed_label} as empty`}
                                title="Tenant moved out"
                                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--oc-border)] text-[var(--oc-text-3)] transition hover:border-[var(--oc-red)] hover:text-[var(--oc-red)] disabled:opacity-50"
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>

                    {vacantBeds.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setSellTarget({ beds: vacantBeds, label: `Room ${room.roomNumber}` })}
                        className="mt-3 h-10 rounded-xl border border-[var(--oc-brand)] text-xs font-bold text-[var(--oc-brand)] transition hover:bg-[var(--oc-brand-soft)]"
                      >
                        Mark whole room sold ({vacantBeds.length} beds)
                      </button>
                    ) : null}
                  </div>
                )
              })}
        </section>

        {!isLoading && rooms.length === 0 && !error ? (
          <EmptyNote>No rooms found for this property.</EmptyNote>
        ) : null}

        <SellDialog target={sellTarget} onClose={() => setSellTarget(null)} />
      </div>
    </AppShell>
  )
}
