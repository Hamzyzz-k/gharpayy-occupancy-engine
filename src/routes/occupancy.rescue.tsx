import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Flame, ListChecks, Phone } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCompleteTask, useLeads, useOpenTasks } from '@/lib/occupancy/queries'
import { buildRescueList } from '@/lib/occupancy/rescue'
import { inr, relativeDays, shortDate } from '@/lib/occupancy/format'
import { STAGE_LABELS } from '@/lib/occupancy/types'

export const Route = createFileRoute('/occupancy/rescue')({
  head: () => ({
    meta: [
      { title: 'Rescue List — Gharpayy' },
      {
        name: 'description',
        content:
          'Who to call today, ranked by silence weighted against how soon they need a bed.',
      },
    ],
  }),
  component: RescuePage,
})

function RescuePage() {
  const { data: leads, isLoading } = useLeads()
  const { data: tasks } = useOpenTasks()
  const completeTask = useCompleteTask()

  const rescue = useMemo(() => buildRescueList(leads ?? [], 30), [leads])
  const critical = rescue.filter((r) => r.band === 'critical')

  const leadName = (id: string) => (leads ?? []).find((l) => l.id === id)?.name ?? 'Lead'

  const overdue = useMemo(
    () => (tasks ?? []).filter((t) => new Date(t.due_at).getTime() < Date.now()),
    [tasks],
  )

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
        <header className="mb-5">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-accent" />
            <h1 className="text-2xl font-display font-bold">Rescue List</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Leads aren&apos;t lost to &ldquo;no&rdquo; — they&apos;re lost to silence.
            But two days of silence means nothing for someone moving in three months and
            everything for someone moving in five days. This list decays by silence and
            multiplies by urgency, so the software decides the order and you just work
            down it.
          </p>
          {critical.length > 0 ? (
            <p className="mt-2 text-sm">
              <span className="font-semibold text-red-500">
                {critical.length} critical
              </span>
              <span className="text-muted-foreground"> — call these before lunch.</span>
            </p>
          ) : null}
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* ---- The ranked list ---------------------------------------- */}
          <Card className="lg:col-span-2">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Who to call today</h2>
            </div>
            <div className="divide-y">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="px-4 py-3">
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ))
                : rescue.map(({ lead, risk, band, reasons }) => (
                    <div key={lead.id} className="flex gap-3 px-4 py-3">
                      <div
                        className={`mt-0.5 w-10 shrink-0 text-center text-lg font-bold tabular-nums ${
                          band === 'critical'
                            ? 'text-red-500'
                            : band === 'warm'
                              ? 'text-amber-500'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {risk}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to="/occupancy/lead/$leadId"
                            params={{ leadId: lead.id }}
                            className="text-sm font-medium hover:underline"
                          >
                            {lead.name}
                          </Link>
                          <Badge variant="outline" className="text-[10px]">
                            {STAGE_LABELS[lead.stage]}
                          </Badge>
                          {band === 'critical' ? (
                            <Badge variant="destructive" className="text-[10px]">
                              critical
                            </Badge>
                          ) : null}
                        </div>
                        <ul className="mt-1 space-y-0.5">
                          {reasons.map((r, i) => (
                            <li key={i} className="text-xs text-muted-foreground">
                              · {r}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {inr(lead.budget_max)} ·{' '}
                          {lead.preferred_localities?.join(', ') || 'anywhere'} · owner{' '}
                          {lead.owner_name ?? 'nobody'}
                        </div>
                      </div>
                      {lead.phone ? (
                        <Button size="sm" variant="outline" className="shrink-0" asChild>
                          <a href={`tel:${lead.phone}`}>
                            <Phone className="h-3 w-3" />
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  ))}
              {!isLoading && rescue.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Nothing to rescue. Everyone has been contacted recently.
                </div>
              ) : null}
            </div>
          </Card>

          {/* ---- Open follow-ups ---------------------------------------- */}
          <Card className="h-fit">
            <div className="border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold">Open follow-ups</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                {overdue.length} overdue of {tasks?.length ?? 0}
              </p>
            </div>
            <div className="divide-y">
              {(tasks ?? []).slice(0, 15).map((t) => {
                const isOverdue = new Date(t.due_at).getTime() < Date.now()
                return (
                  <div key={t.id} className="flex items-start gap-2 px-4 py-3">
                    <button
                      onClick={() =>
                        completeTask.mutate(t.id, {
                          onSuccess: () => toast.success('Done'),
                          onError: (e) => toast.error((e as Error).message),
                        })
                      }
                      disabled={completeTask.isPending}
                      className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-emerald-500 disabled:opacity-50"
                      aria-label="Mark done"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">{t.title}</div>
                      <Link
                        to="/occupancy/lead/$leadId"
                        params={{ leadId: t.lead_id }}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        {leadName(t.lead_id)}
                      </Link>
                      <div
                        className={`text-[11px] ${
                          isOverdue ? 'text-red-500' : 'text-muted-foreground'
                        }`}
                      >
                        due {shortDate(t.due_at)}
                        {isOverdue ? ` · ${relativeDays(t.due_at)}` : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
              {(tasks ?? []).length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No open follow-ups.
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
