import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ChevronRight, Search, TrendingUp, X } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import {
  CARD,
  PAGE,
  Avatar,
  EmptyNote,
  ErrorNote,
  PageHeader,
  Shimmer,
  StageChip,
  STAGE_DOT,
} from '@/components/occupancy/ui'
import { useLeads } from '@/lib/occupancy/queries'
import { inr, relativeDays, shortDate } from '@/lib/occupancy/format'
import { LEAD_STAGES, STAGE_LABELS } from '@/lib/occupancy/types'
import type { LeadStage } from '@/lib/occupancy/types'
import { rescueScore } from '@/lib/occupancy/rescue'

export const Route = createFileRoute('/occupancy/pipeline')({
  head: () => ({
    meta: [
      { title: 'Lead Pipeline — Gharpayy' },
      {
        name: 'description',
        content: 'Every lead, every stage, backed by Postgres. Filter, search, drill in.',
      },
    ],
  }),
  component: PipelinePage,
})

const SOURCE_LABEL: Record<string, string> = {
  housing: 'Housing',
  nobroker: 'NoBroker',
  instagram: 'Instagram',
  walkin: 'Walk-in',
  referral: 'Referral',
  website: 'Website',
  other: 'Other',
}

function PipelinePage() {
  const { data: leads, isLoading, error } = useLeads()
  const navigate = useNavigate()
  const [stage, setStage] = useState<LeadStage | 'all'>('all')
  const [q, setQ] = useState('')

  const total = leads?.length ?? 0

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of leads ?? []) m.set(l.stage, (m.get(l.stage) ?? 0) + 1)
    return m
  }, [leads])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (leads ?? [])
      .filter((l) => {
        if (stage !== 'all' && l.stage !== stage) return false
        if (!needle) return true
        return (
          l.name.toLowerCase().includes(needle) ||
          (l.phone ?? '').includes(needle) ||
          (l.preferred_localities ?? []).some((p) => p.toLowerCase().includes(needle))
        )
      })
      .map((l) => ({ lead: l, atRisk: rescueScore(l).band === 'critical' }))
  }, [leads, stage, q])

  const won = (counts.get('booked') ?? 0) + (counts.get('moved_in') ?? 0)
  const conversion = total ? (won / total) * 100 : 0

  const tiles: { key: LeadStage | 'all'; label: string; count: number; dot: string }[] = [
    { key: 'all', label: 'All leads', count: total, dot: 'bg-[#171b20]' },
    ...LEAD_STAGES.map((s) => ({
      key: s,
      label: STAGE_LABELS[s],
      count: counts.get(s) ?? 0,
      dot: STAGE_DOT[s],
    })),
  ]

  return (
    <AppShell>
      <div className={PAGE}>
        <PageHeader
          eyebrow="Lead pipeline"
          title="See every lead, at a glance."
          subtitle="Follow the full journey from first touch to move-in, with risk flags where the next action matters most."
        />

        {error ? <ErrorNote error={error} /> : null}

        {/* ---- Funnel filters --------------------------------------------- */}
        <section className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:grid-cols-9">
          {tiles.map((t) => {
            const active = stage === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setStage(active && t.key !== 'all' ? 'all' : t.key)}
                aria-pressed={active}
                className={`rounded-2xl border p-3 text-left transition sm:p-4 ${
                  active
                    ? 'border-[#0943a0] bg-[#eef3fb] shadow-[0_8px_24px_rgba(9,67,160,0.08)]'
                    : 'border-[#e4e0dd] bg-white hover:border-[#bccdea]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`h-2 w-2 rounded-full ${t.dot}`} />
                  <span className="text-[10px] font-bold text-[#8b8f95]">
                    {total ? Math.round((t.count / total) * 100) : 0}%
                  </span>
                </div>
                <p className="mt-3 font-display text-2xl font-bold tracking-[-0.04em]">
                  {isLoading ? '–' : t.count}
                </p>
                <p className="mt-1 truncate text-[11px] font-semibold text-[#777c83]">{t.label}</p>
              </button>
            )
          })}
        </section>

        {/* ---- Table ------------------------------------------------------ */}
        <section className={`${CARD} mt-4`}>
          <div className="flex flex-col gap-3 border-b border-[#eee9e5] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <label className="flex items-center gap-2 rounded-xl border border-[#e4e0dd] bg-[#fcf9f7] px-3 py-2.5 focus-within:border-[#0943a0] sm:w-[320px]">
              <Search className="h-4 w-4 shrink-0 text-[#8b8f95]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, phone or locality"
                aria-label="Search leads"
                className="w-full bg-transparent text-xs outline-none placeholder:text-[#a5a9ae]"
              />
            </label>
            <div className="flex items-center gap-2">
              {stage !== 'all' ? (
                <button
                  type="button"
                  onClick={() => setStage('all')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#e4e0dd] px-3 py-2 text-xs font-bold text-[#646971] hover:border-[#0943a0]"
                >
                  {STAGE_LABELS[stage]}
                  <X className="h-3 w-3" />
                </button>
              ) : null}
              <span className="text-xs text-[#8b8f95]">{rows.length} shown</span>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Shimmer key={i} className="h-10" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-5">
              <EmptyNote>No leads match that filter.</EmptyNote>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] text-left">
                  <thead className="bg-[#fcf9f7] text-[10px] font-bold uppercase tracking-[0.12em] text-[#8b8f95]">
                    <tr>
                      <th className="px-5 py-3">Lead</th>
                      <th className="px-3 py-3">Budget</th>
                      <th className="px-3 py-3">Move-in</th>
                      <th className="px-3 py-3">Source</th>
                      <th className="px-3 py-3">Owner</th>
                      <th className="px-3 py-3">Last contacted</th>
                      <th className="px-3 py-3">Stage</th>
                      <th className="px-5 py-3">
                        <span className="sr-only">Risk</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0ece8]">
                    {rows.map(({ lead, atRisk }) => (
                      <tr
                        key={lead.id}
                        onClick={() =>
                          navigate({ to: '/occupancy/lead/$leadId', params: { leadId: lead.id } })
                        }
                        className="cursor-pointer transition hover:bg-[#f6f8fc]"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={lead.name} size="sm" />
                            <div className="min-w-0">
                              <Link
                                to="/occupancy/lead/$leadId"
                                params={{ leadId: lead.id }}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs font-bold hover:text-[#0943a0]"
                              >
                                {lead.name}
                              </Link>
                              <p className="mt-1 max-w-[220px] truncate text-[10px] text-[#8b8f95]">
                                {lead.preferred_localities?.join(', ') || 'Anywhere'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-xs font-semibold">{inr(lead.budget_max)}</td>
                        <td className="px-3 py-3.5 text-xs text-[#646971]">
                          {shortDate(lead.move_in_date)}
                        </td>
                        <td className="px-3 py-3.5 text-xs text-[#646971]">
                          {lead.source ? SOURCE_LABEL[lead.source] : '–'}
                        </td>
                        <td className="px-3 py-3.5 text-xs text-[#646971]">
                          {lead.owner_name ?? 'Unassigned'}
                        </td>
                        <td className="px-3 py-3.5 text-xs capitalize text-[#646971]">
                          {relativeDays(lead.last_contacted_at)}
                        </td>
                        <td className="px-3 py-3.5">
                          <StageChip stage={lead.stage} />
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {atRisk ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#d53a35]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#d53a35]" />
                              At risk
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile list */}
              <div className="divide-y divide-[#f0ece8] md:hidden">
                {rows.map(({ lead, atRisk }) => (
                  <Link
                    key={lead.id}
                    to="/occupancy/lead/$leadId"
                    params={{ leadId: lead.id }}
                    className="flex items-center gap-3 p-4"
                  >
                    <Avatar name={lead.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-bold">{lead.name}</p>
                        <StageChip stage={lead.stage} />
                        {atRisk ? (
                          <span className="text-[10px] font-bold text-[#d53a35]">At risk</span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-[11px] text-[#8b8f95]">
                        {lead.preferred_localities?.[0] ?? 'Anywhere'} · {inr(lead.budget_max)} ·
                        Move {shortDate(lead.move_in_date)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#c9c2bc]" />
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#ecdca0] bg-[#fdf8e6] px-4 py-3 text-xs">
          <span className="flex items-center gap-2 font-semibold text-[#5c4a12]">
            <TrendingUp className="h-4 w-4 text-[#0943a0]" />
            Conversion rate, booked + moved in
          </span>
          <span className="font-display text-lg font-bold text-[#171b20]">
            {conversion.toFixed(1)}%{' '}
            <span className="font-sans text-[11px] font-medium text-[#8b8f95]">
              of {total} leads
            </span>
          </span>
        </div>
      </div>
    </AppShell>
  )
}
