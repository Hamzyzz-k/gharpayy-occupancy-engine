import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { ArrowDownRight, Check, CircleAlert, Flame, Phone } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import {
  CARD,
  PAGE,
  Avatar,
  Dot,
  EmptyNote,
  ErrorNote,
  PageHeader,
  Shimmer,
  StageChip,
} from '@/components/occupancy/ui'
import { useCompleteTask, useLeads, useOpenTasks } from '@/lib/occupancy/queries'
import { buildRescueList } from '@/lib/occupancy/rescue'
import { dueLabel, inr } from '@/lib/occupancy/format'

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

const BAND = {
  critical: { chip: 'bg-[#fff0ee] text-[#d53a35]', text: 'text-[#d53a35]', label: 'Critical' },
  warm: { chip: 'bg-[#fff7e7] text-[#c98218]', text: 'text-[#c98218]', label: 'Warm' },
  ok: { chip: 'bg-[#edf8f1] text-[#24805b]', text: 'text-[#8b8f95]', label: 'OK' },
  cold: { chip: 'bg-[#f2f0ed] text-[#646971]', text: 'text-[#a5a9ae]', label: 'Gone cold' },
} as const

const SHOWN = 20

function RescuePage() {
  const { data: leads, isLoading, error } = useLeads()
  const { data: tasks, isLoading: tasksLoading } = useOpenTasks()
  const completeTask = useCompleteTask()

  const all = useMemo(() => buildRescueList(leads ?? [], 1000), [leads])
  const rescue = all.filter((r) => r.band !== 'cold')
  const cold = all.filter((r) => r.band === 'cold')
  const critical = rescue.filter((r) => r.band === 'critical')
  const atRisk = rescue.filter((r) => r.band === 'critical' || r.band === 'warm')

  const leadById = useMemo(() => new Map((leads ?? []).map((l) => [l.id, l])), [leads])

  return (
    <AppShell>
      <div className={PAGE}>
        <PageHeader
          eyebrow="Rescue list"
          title="Start with the leads most likely to disappear."
          subtitle="Leads aren't lost to a no. They're lost to silence. This ranks silence against how soon each person needs a bed, so you just work down it."
        />

        {error ? <ErrorNote error={error} /> : null}

        <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          {/* ---- Critical hero -------------------------------------------- */}
          <div className="relative overflow-hidden rounded-3xl bg-[#f4c024] p-6 shadow-[0_16px_32px_rgba(244,192,36,0.32)] sm:p-7">
            <div className="absolute -bottom-20 -right-12 h-48 w-48 rounded-full border-[28px] border-white/15" />
            <div className="relative">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-[#4a3a05]">
                <Flame className="h-4 w-4" />
                Critical attention
              </div>
              {isLoading ? (
                <div className="mt-8 h-[70px] w-24 animate-pulse rounded-xl bg-white/25" />
              ) : (
                <p className="mt-8 font-display text-[70px] font-bold leading-none tracking-[-0.08em] text-[#171b20]">
                  {critical.length}
                </p>
              )}
              <p className="mt-2 max-w-xs text-sm font-semibold leading-6 text-[#4a3a05]">
                critical lead{critical.length === 1 ? '' : 's'} need a call today. They need a bed
                soon and the conversation has stalled.
              </p>
              <div className="mt-7 flex items-center gap-2 text-xs font-bold text-[#171b20]">
                Work from top to bottom
                <ArrowDownRight className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* ---- Task queue ------------------------------------------------- */}
          <div className="rounded-3xl border border-[#e4e0dd] bg-white p-5 shadow-[0_8px_24px_rgba(42,30,21,0.035)] sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8b8f95]">
                  Open follow-ups
                </p>
                <h2 className="mt-1 font-display text-xl font-bold tracking-[-0.035em]">
                  Your task queue
                </h2>
              </div>
              <span className="rounded-full bg-[#fff0ee] px-2 py-1 text-[10px] font-bold text-[#d53a35]">
                {tasks?.length ?? 0} open
              </span>
            </div>
            <div className="mt-4 max-h-[272px] divide-y divide-[#f0ece8] overflow-y-auto pr-1">
              {tasksLoading
                ? Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} className="my-3 h-10" />)
                : (tasks ?? []).map((t) => {
                    const lead = leadById.get(t.lead_id)
                    const overdue = new Date(t.due_at).getTime() < Date.now()
                    return (
                      <div key={t.id} className="flex items-center gap-3 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            completeTask.mutate(t.id, {
                              onSuccess: () => toast.success('Done'),
                              onError: (e) => toast.error((e as Error).message),
                            })
                          }
                          disabled={completeTask.isPending}
                          aria-label={`Mark "${t.title}" done`}
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-[#d8d1ca] text-transparent transition hover:border-[#48b878] hover:text-[#48b878] disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold">
                            {t.title}{' '}
                            {lead ? (
                              <Link
                                to="/occupancy/lead/$leadId"
                                params={{ leadId: lead.id }}
                                className="font-medium text-[#777c83] hover:text-[#0943a0]"
                              >
                                with {lead.name}
                              </Link>
                            ) : null}
                          </p>
                          <p
                            className={`mt-1 text-[10px] ${
                              overdue ? 'font-bold text-[#d53a35]' : 'text-[#8b8f95]'
                            }`}
                          >
                            {dueLabel(t.due_at)}
                            {overdue ? ' · overdue' : ''}
                          </p>
                        </div>
                        {lead?.phone ? (
                          <a
                            href={`tel:${lead.phone}`}
                            aria-label={`Call ${lead.name}`}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-[#eee9e5] text-[#777c83] transition hover:text-[#0943a0]"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </div>
                    )
                  })}
              {!tasksLoading && (tasks ?? []).length === 0 ? (
                <p className="py-6 text-center text-xs text-[#8b8f95]">No open follow-ups.</p>
              ) : null}
            </div>
          </div>
        </section>

        {/* ---- Ranked leads ---------------------------------------------- */}
        <section className="mt-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-[-0.04em]">Ranked leads</h2>
              <p className="mt-1 text-xs text-[#8b8f95]">
                Urgency leads: how soon they need a bed. Silence and pipeline stage add to it.
              </p>
            </div>
            <span className="hidden text-xs text-[#8b8f95] sm:block">
              {critical.length} critical, {atRisk.length - critical.length} warm. Showing top{' '}
              {Math.min(SHOWN, rescue.length)}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} className="h-28" />)
              : rescue.slice(0, SHOWN).map(({ lead, risk, band, reasons }, i) => {
                  const b = BAND[band]
                  return (
                    <div key={lead.id} className={`${CARD} p-4 sm:p-5`}>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="w-5 text-xs font-bold tabular-nums text-[#b2b0ad]">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <Avatar name={lead.name} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                to="/occupancy/lead/$leadId"
                                params={{ leadId: lead.id }}
                                className="text-sm font-bold hover:text-[#0943a0]"
                              >
                                {lead.name}
                              </Link>
                              <span className={`rounded-md px-1.5 py-1 text-[10px] font-bold ${b.chip}`}>
                                {b.label}
                              </span>
                              <StageChip stage={lead.stage} />
                            </div>
                            <p className="mt-1 truncate text-[11px] text-[#8b8f95]">
                              {lead.preferred_localities?.join(', ') || 'Anywhere'}
                              <Dot />
                              {inr(lead.budget_max)} budget
                              <Dot />
                              Owner {lead.owner_name ?? 'unassigned'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`font-display text-2xl font-bold ${b.text}`}>{risk}</p>
                            <p className="text-[10px] uppercase tracking-[0.1em] text-[#8b8f95]">
                              risk
                            </p>
                          </div>
                          {lead.phone ? (
                            <a
                              href={`tel:${lead.phone}`}
                              aria-label={`Call ${lead.name}`}
                              className="inline-flex items-center gap-2 rounded-xl bg-[#171b20] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-[#2b3037]"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Call</span>
                            </a>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-[#f0ece8] pt-3">
                        {reasons.map((reason) => (
                          <span
                            key={reason}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#fcf9f7] px-2.5 py-1.5 text-[11px] font-medium text-[#646971]"
                          >
                            <CircleAlert className="h-3 w-3 text-[#e5a135]" />
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
            {!isLoading && rescue.length === 0 ? (
              <EmptyNote>Nothing to rescue. Everyone has been contacted recently.</EmptyNote>
            ) : null}
          </div>
        </section>

        {!isLoading && cold.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-display text-xl font-bold tracking-[-0.035em]">
              Gone cold{' '}
              <span className="ml-1 rounded-full bg-[#f2f0ed] px-2 py-0.5 align-middle text-[10px] font-bold text-[#646971]">
                {cold.length}
              </span>
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-[#8b8f95]">
              Silent for three weeks or more, with no move-in inside that window. They have
              probably found somewhere else. Worth one last message, not a place in today&apos;s
              call queue.
            </p>
            <div className={`${CARD} mt-4 divide-y divide-[#f0ece8]`}>
              {cold.map(({ lead, reasons }) => (
                <Link
                  key={lead.id}
                  to="/occupancy/lead/$leadId"
                  params={{ leadId: lead.id }}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-[#f6f8fc] sm:px-5"
                >
                  <Avatar name={lead.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">{lead.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-[#8b8f95]">{reasons.join(' · ')}</p>
                  </div>
                  <StageChip stage={lead.stage} />
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  )
}
