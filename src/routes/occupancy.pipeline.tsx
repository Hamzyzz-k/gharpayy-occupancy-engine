import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Filter, Search, Users } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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

/** Stages shown as the funnel across the top. 'lost' is excluded because it's not a step. */
const FUNNEL: LeadStage[] = LEAD_STAGES.filter((s) => s !== 'lost')

function PipelinePage() {
  const { data: leads, isLoading } = useLeads()
  const [stage, setStage] = useState<LeadStage | 'all'>('all')
  const [q, setQ] = useState('')

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of leads ?? []) m.set(l.stage, (m.get(l.stage) ?? 0) + 1)
    return m
  }, [leads])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (leads ?? []).filter((l) => {
      if (stage !== 'all' && l.stage !== stage) return false
      if (!needle) return true
      return (
        l.name.toLowerCase().includes(needle) ||
        (l.phone ?? '').includes(needle) ||
        (l.preferred_localities ?? []).some((p) => p.toLowerCase().includes(needle))
      )
    })
  }, [leads, stage, q])

  const conversion = useMemo(() => {
    const total = leads?.length ?? 0
    const won = (counts.get('booked') ?? 0) + (counts.get('moved_in') ?? 0)
    return total ? (won / total) * 100 : 0
  }, [leads, counts])

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
        <header className="mb-5">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-accent" />
            <h1 className="text-2xl font-display font-bold">Lead Pipeline</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {leads?.length ?? 0} leads · {conversion.toFixed(1)}% converted to booked or
            moved in. Live from Postgres, and stage changes persist.
          </p>
        </header>

        {/* ---- Funnel ------------------------------------------------- */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {FUNNEL.map((s) => {
            const n = counts.get(s) ?? 0
            const active = stage === s
            return (
              <button
                key={s}
                onClick={() => setStage(active ? 'all' : s)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  active ? 'border-accent bg-accent/10' : 'hover:bg-muted/50'
                }`}
              >
                <div className="text-lg font-semibold tabular-nums">{n}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {STAGE_LABELS[s]}
                </div>
              </button>
            )
          })}
        </div>

        {/* ---- Controls ----------------------------------------------- */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone or locality"
              className="pl-8"
            />
          </div>
          {stage !== 'all' ? (
            <button
              onClick={() => setStage('all')}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted"
            >
              <Filter className="h-3 w-3" />
              Clear {STAGE_LABELS[stage]}
            </button>
          ) : null}
        </div>

        {/* ---- List ---------------------------------------------------- */}
        <Card className="overflow-hidden">
          <div className="divide-y">
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="px-4 py-3">
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))
              : filtered.map((lead) => {
                  const r = rescueScore(lead)
                  return (
                    <Link
                      key={lead.id}
                      to="/occupancy/lead/$leadId"
                      params={{ leadId: lead.id }}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{lead.name}</span>
                          {r.band === 'critical' ? (
                            <Badge variant="destructive" className="text-[10px]">
                              at risk
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {inr(lead.budget_max)} ·{' '}
                          {lead.preferred_localities?.join(', ') || 'anywhere'} · moving{' '}
                          {shortDate(lead.move_in_date)} · {lead.source}
                        </div>
                      </div>
                      <div className="hidden shrink-0 text-right sm:block">
                        <div className="text-xs text-muted-foreground">
                          {lead.owner_name ?? 'unassigned'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          contacted {relativeDays(lead.last_contacted_at)}
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {STAGE_LABELS[lead.stage]}
                      </Badge>
                    </Link>
                  )
                })}
            {!isLoading && filtered.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                No leads match that filter.
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
