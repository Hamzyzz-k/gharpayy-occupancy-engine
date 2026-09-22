import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import {
  ArrowRight,
  ArrowRightLeft,
  BedDouble,
  CalendarCheck,
  ClipboardList,
  IndianRupee,
  MapPin,
  MessageCircle,
  NotebookPen,
  Phone,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import {
  CARD,
  PAGE,
  Avatar,
  EmptyNote,
  ErrorNote,
  PageHeader,
  SectionTitle,
  Shimmer,
  StatTile,
  STAGE_DOT,
  useToday,
} from '@/components/occupancy/ui'
import {
  computeStats,
  useBedAvailability,
  useLeads,
  useOpenTasks,
  useRecentActivity,
  useRecentBookings,
} from '@/lib/occupancy/queries'
import { rescueScore } from '@/lib/occupancy/rescue'
import { inr, inrShort, relativeDays, shortDate, shortProperty } from '@/lib/occupancy/format'
import { LEAD_STAGES, STAGE_LABELS } from '@/lib/occupancy/types'
import type { Activity, BedAvailability, LeadStage } from '@/lib/occupancy/types'

export const Route = createFileRoute('/occupancy/admin')({
  head: () => ({
    meta: [
      { title: 'Admin | Gharpayy' },
      { name: 'description', content: 'Every property, lead, booking and task in one view.' },
    ],
  }),
  component: AdminPage,
})

const ACTIVITY_ICON: Record<Activity['type'], typeof Phone> = {
  call: Phone,
  whatsapp: MessageCircle,
  email: NotebookPen,
  visit: MapPin,
  note: NotebookPen,
  stage_change: ArrowRightLeft,
}

function occTone(pct: number) {
  if (pct >= 90) return { bar: 'bg-[#48b878]', text: 'text-[var(--oc-green)]' }
  if (pct >= 80) return { bar: 'bg-[#e5a135]', text: 'text-[var(--oc-amber)]' }
  return { bar: 'bg-[#e12527]', text: 'text-[var(--oc-red)]' }
}

function activityLine(a: Activity): string {
  if (a.type === 'stage_change' && a.outcome && a.outcome in STAGE_LABELS) {
    return `moved to ${STAGE_LABELS[a.outcome as LeadStage]}`
  }
  if (a.notes) return a.notes
  const kind = a.type === 'whatsapp' ? 'WhatsApp' : a.type
  return a.outcome ? `${kind}, ${a.outcome.replace(/_/g, ' ')}` : kind
}

function AdminPage() {
  const today = useToday()
  const { data: beds, isLoading: bedsLoading, error } = useBedAvailability()
  const { data: leads, isLoading: leadsLoading } = useLeads()
  const { data: tasks } = useOpenTasks()
  const { data: activity, isLoading: activityLoading } = useRecentActivity(20)
  const { data: bookings, isLoading: bookingsLoading } = useRecentBookings(8)

  const stats = useMemo(() => computeStats(beds ?? []), [beds])
  const rentRoll = useMemo(
    () => (beds ?? []).filter((b) => b.status === 'occupied').reduce((s, b) => s + Number(b.monthly_rent), 0),
    [beds],
  )

  const properties = useMemo(() => {
    const m = new Map<string, BedAvailability[]>()
    for (const b of beds ?? []) m.set(b.property_id, [...(m.get(b.property_id) ?? []), b])
    return [...m.entries()]
      .map(([id, rows]) => {
        const vacant = rows.filter((r) => r.status === 'vacant')
        const occupied = rows.filter((r) => r.status === 'occupied')
        return {
          id,
          name: rows[0]!.property_name,
          locality: rows[0]!.locality,
          beds: rows.length,
          sold: occupied.length,
          empty: vacant.length,
          notice: occupied.filter((r) => r.expected_move_out_date).length,
          pct: (occupied.length / rows.length) * 100,
          rentRoll: occupied.reduce((s, r) => s + Number(r.monthly_rent), 0),
          lost: rows.reduce((s, r) => s + Number(r.revenue_lost ?? 0), 0),
        }
      })
      .sort((a, b) => a.pct - b.pct)
  }, [beds])

  const funnel = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of leads ?? []) counts.set(l.stage, (counts.get(l.stage) ?? 0) + 1)
    return LEAD_STAGES.map((s) => ({ stage: s, count: counts.get(s) ?? 0 }))
  }, [leads])
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count))

  const team = useMemo(() => {
    const m = new Map<string, { name: string; leads: number; won: number; critical: number }>()
    for (const l of leads ?? []) {
      const key = l.owner_name ?? 'Unassigned'
      const row = m.get(key) ?? { name: key, leads: 0, won: 0, critical: 0 }
      row.leads++
      if (l.stage === 'booked' || l.stage === 'moved_in') row.won++
      else if (l.stage !== 'lost' && rescueScore(l).band === 'critical') row.critical++
      m.set(key, row)
    }
    return [...m.values()].sort((a, b) => b.won - a.won || b.leads - a.leads)
  }, [leads])

  const totalLeads = leads?.length ?? 0
  const won = funnel.filter((f) => f.stage === 'booked' || f.stage === 'moved_in').reduce((s, f) => s + f.count, 0)
  const active = funnel.filter((f) => !['booked', 'moved_in', 'lost'].includes(f.stage)).reduce((s, f) => s + f.count, 0)
  const overdue = (tasks ?? []).filter((t) => new Date(t.due_at).getTime() < Date.now()).length
  const loading = bedsLoading || leadsLoading

  return (
    <AppShell>
      <div className={PAGE}>
        <PageHeader
          eyebrow={today ? `Admin · ${today}` : 'Admin'}
          title="Everything, in one place."
          subtitle="Every property, every lead, the sales team and what just happened. Live from the database."
          actions={
            <Link
              to="/occupancy/owner"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--oc-ink)] px-4 py-2.5 text-xs font-bold text-[var(--oc-ink-fg)] transition hover:bg-[var(--oc-ink-hover)]"
            >
              Owner portal <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />

        {error ? <ErrorNote error={error} /> : null}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile icon={BedDouble} tone="green" label="Occupancy" value={`${Math.round(stats.occupancyPct)}%`} sub={`${stats.occupiedBeds} of ${stats.totalBeds} beds`} />
          <StatTile icon={IndianRupee} tone="blue" label="Rent roll" value={inrShort(rentRoll)} sub="A month, sold beds" />
          <StatTile icon={TrendingDown} tone="red" label="Money lost" value={inrShort(stats.revenueAtRisk)} sub={`${stats.vacantBeds} empty beds`} />
          <StatTile icon={Users} tone="grey" label="Active leads" value={active} sub={`${totalLeads} in total`} />
          <StatTile icon={TrendingUp} tone="yellow" label="Conversion" value={totalLeads ? `${((won / totalLeads) * 100).toFixed(1)}%` : '0%'} sub={`${won} booked or moved in`} />
          <StatTile icon={ClipboardList} tone="amber" label="Open tasks" value={tasks?.length ?? 0} sub={`${overdue} overdue`} />
        </section>

        {/* ---- Properties -------------------------------------------------- */}
        <section className={`${CARD} mt-4 overflow-hidden`}>
          <div className="border-b border-[var(--oc-divider)] p-5 sm:p-6">
            <SectionTitle kicker="Portfolio" title="Every property" />
            <p className="mt-1 text-xs text-[var(--oc-text-3)]">Worst occupancy first. Open one to manage its rooms.</p>
          </div>
          {loading ? (
            <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, i) => <Shimmer key={i} className="h-10" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-[var(--oc-sunken)] text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--oc-text-3)]">
                  <tr>
                    <th className="px-5 py-3">Property</th>
                    <th className="px-3 py-3">Beds</th>
                    <th className="px-3 py-3">Sold</th>
                    <th className="px-3 py-3">Empty</th>
                    <th className="px-3 py-3">On notice</th>
                    <th className="px-3 py-3">Occupancy</th>
                    <th className="px-3 py-3 text-right">Rent roll</th>
                    <th className="px-5 py-3 text-right">Lost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--oc-divider)] text-xs">
                  {properties.map((p) => {
                    const t = occTone(p.pct)
                    return (
                      <tr key={p.id} className="transition hover:bg-[var(--oc-hover)]">
                        <td className="px-5 py-3">
                          <Link
                            to="/occupancy/owner"
                            search={{ property: p.id }}
                            className="font-bold hover:text-[var(--oc-brand)]"
                          >
                            {shortProperty(p.name)}
                          </Link>
                          <p className="mt-0.5 text-[10px] text-[var(--oc-text-3)]">{p.locality}</p>
                        </td>
                        <td className="px-3 py-3 font-semibold">{p.beds}</td>
                        <td className="px-3 py-3 font-semibold text-[var(--oc-green)]">{p.sold}</td>
                        <td className="px-3 py-3 font-semibold text-[var(--oc-red)]">{p.empty}</td>
                        <td className="px-3 py-3 font-semibold text-[var(--oc-amber)]">{p.notice}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--oc-divider)]">
                              <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${p.pct}%` }} />
                            </div>
                            <span className={`font-bold ${t.text}`}>{Math.round(p.pct)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold">{inr(p.rentRoll)}</td>
                        <td className="px-5 py-3 text-right font-bold text-[var(--oc-red)]">{p.lost ? inr(p.lost) : '–'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* ---- Pipeline ------------------------------------------------- */}
          <section className={`${CARD} p-5 sm:p-6`}>
            <SectionTitle
              kicker="Pipeline"
              title="Leads by stage"
              aside={
                <Link to="/occupancy/pipeline" className="shrink-0 text-xs font-bold text-[var(--oc-brand)]">
                  Open <ArrowRight className="ml-0.5 inline h-3.5 w-3.5" />
                </Link>
              }
            />
            <div className="mt-5 space-y-2.5">
              {funnel.map((f) => (
                <div key={f.stage} className="grid grid-cols-[112px_minmax(0,1fr)_36px] items-center gap-3 text-xs">
                  <span className="flex items-center gap-2 font-semibold text-[var(--oc-text-2)]">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${STAGE_DOT[f.stage]}`} />
                    <span className="truncate">{STAGE_LABELS[f.stage]}</span>
                  </span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[var(--oc-divider)]">
                    <div className={`h-full rounded-full ${STAGE_DOT[f.stage]}`} style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
                  </div>
                  <span className="text-right font-bold tabular-nums">{f.count}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ---- Team ----------------------------------------------------- */}
          <section className={`${CARD} p-5 sm:p-6`}>
            <SectionTitle kicker="Sales team" title="Who owns what" />
            <div className="mt-4 divide-y divide-[var(--oc-divider)]">
              {team.map((m) => (
                <div key={m.name} className="flex items-center gap-3 py-2.5">
                  <Avatar name={m.name} size="sm" />
                  <p className="min-w-0 flex-1 truncate text-xs font-bold">{m.name}</p>
                  <div className="flex shrink-0 gap-4 text-right text-[11px]">
                    <div>
                      <p className="font-bold tabular-nums">{m.leads}</p>
                      <p className="text-[var(--oc-text-3)]">leads</p>
                    </div>
                    <div>
                      <p className="font-bold tabular-nums text-[var(--oc-green)]">{m.won}</p>
                      <p className="text-[var(--oc-text-3)]">booked</p>
                    </div>
                    <div>
                      <p className="font-bold tabular-nums text-[var(--oc-red)]">{m.critical}</p>
                      <p className="text-[var(--oc-text-3)]">critical</p>
                    </div>
                  </div>
                </div>
              ))}
              {!leadsLoading && team.length === 0 ? <EmptyNote>No leads yet.</EmptyNote> : null}
            </div>
          </section>

          {/* ---- Bookings ------------------------------------------------- */}
          <section className={`${CARD} p-5 sm:p-6`}>
            <SectionTitle kicker="Latest" title="Recent bookings" />
            <div className="mt-4 divide-y divide-[var(--oc-divider)]">
              {bookingsLoading
                ? Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} className="my-2 h-9" />)
                : (bookings ?? []).map((b) => (
                    <div key={b.id} className="flex items-center gap-3 py-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--oc-green-soft)] text-[var(--oc-green)]">
                        <CalendarCheck className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{b.tenant_name}</p>
                        <p className="mt-0.5 truncate text-[10px] text-[var(--oc-text-3)]">
                          {b.beds?.rooms?.properties?.name ? shortProperty(b.beds.rooms.properties.name) : 'Bed'}
                          {b.beds ? ` · ${b.beds.rooms?.room_number ?? ''}${b.beds.bed_label}` : ''} · moves in {shortDate(b.move_in_date)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-bold">{inr(b.monthly_rent)}</span>
                    </div>
                  ))}
            </div>
          </section>

          {/* ---- Activity feed -------------------------------------------- */}
          <section className={`${CARD} p-5 sm:p-6`}>
            <SectionTitle kicker="Live" title="What just happened" />
            <div className="mt-4 max-h-[340px] space-y-3.5 overflow-y-auto pr-1">
              {activityLoading
                ? Array.from({ length: 5 }).map((_, i) => <Shimmer key={i} className="h-8" />)
                : (activity ?? []).map((a) => {
                    const Icon = ACTIVITY_ICON[a.type]
                    return (
                      <div key={a.id} className="flex gap-3">
                        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--oc-brand-soft)] text-[var(--oc-brand)]">
                          <Icon className="h-3 w-3" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs">
                            <Link
                              to="/occupancy/lead/$leadId"
                              params={{ leadId: a.lead_id }}
                              className="font-bold hover:text-[var(--oc-brand)]"
                            >
                              {a.leads?.name ?? 'A lead'}
                            </Link>{' '}
                            <span className="text-[var(--oc-text-2)]">{activityLine(a)}</span>
                          </p>
                          <p className="mt-0.5 text-[10px] text-[var(--oc-text-3)]">
                            {a.created_by ?? 'Someone'} · {relativeDays(a.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
