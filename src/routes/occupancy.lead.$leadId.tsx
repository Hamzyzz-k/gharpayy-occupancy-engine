import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowRightLeft,
  BedDouble,
  Check,
  ChevronRight,
  MapPin,
  MessageCircle,
  NotebookPen,
  Phone,
} from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import {
  CARD,
  PAGE,
  Avatar,
  BackLink,
  Dot,
  EmptyNote,
  ErrorNote,
  PageHeader,
  Shimmer,
} from '@/components/occupancy/ui'
import { ScoreRing, scoreText } from '@/components/occupancy/match-bits'
import {
  useBedAvailability,
  useLead,
  useLeadActivities,
  useLogActivity,
  useUpdateLeadStage,
} from '@/lib/occupancy/queries'
import { bestBedsForLead } from '@/lib/occupancy/matching'
import { rescueScore } from '@/lib/occupancy/rescue'
import { inr, relativeDays, shortDate, shortProperty } from '@/lib/occupancy/format'
import { LEAD_STAGES, STAGE_LABELS } from '@/lib/occupancy/types'
import type { Activity, LeadStage } from '@/lib/occupancy/types'

export const Route = createFileRoute('/occupancy/lead/$leadId')({
  head: () => ({
    meta: [
      { title: 'Lead — Gharpayy' },
      { name: 'description', content: 'Lead detail, matched beds, and full activity history.' },
    ],
  }),
  component: LeadPage,
})

const RISK = {
  critical: {
    chip: 'bg-[var(--oc-red-soft)] text-[var(--oc-red)]',
    ring: '#e12527',
    text: 'text-[var(--oc-red)]',
    label: 'Critical risk',
    line: 'At real risk of going quiet. Reach out today.',
  },
  warm: {
    chip: 'bg-[var(--oc-amber-soft)] text-[var(--oc-amber)]',
    ring: '#e5a135',
    text: 'text-[var(--oc-amber)]',
    label: 'Warm risk',
    line: 'Worth a nudge soon. Keep the conversation moving.',
  },
  ok: {
    chip: 'bg-[var(--oc-green-soft)] text-[var(--oc-green)]',
    ring: '#48b878',
    text: 'text-[var(--oc-green)]',
    label: 'Low risk',
    line: 'In good shape. Keep the next step clear.',
  },
  cold: {
    chip: 'bg-[var(--oc-chip)] text-[var(--oc-text-2)]',
    ring: '#b9b3ad',
    text: 'text-[var(--oc-text-2)]',
    label: 'Gone cold',
    line: 'No contact in weeks and no near move-in. Probably found somewhere else. Worth one last message.',
  },
} as const

const ACTIVITY_ICON: Record<Activity['type'], { icon: typeof Phone; cls: string }> = {
  call: { icon: Phone, cls: 'bg-[var(--oc-brand-soft)] text-[var(--oc-brand)]' },
  whatsapp: { icon: MessageCircle, cls: 'bg-[var(--oc-green-soft)] text-[var(--oc-green)]' },
  email: { icon: NotebookPen, cls: 'bg-[var(--oc-chip)] text-[var(--oc-text-2)]' },
  visit: { icon: MapPin, cls: 'bg-[var(--oc-purple-soft)] text-[var(--oc-purple)]' },
  note: { icon: NotebookPen, cls: 'bg-[var(--oc-chip)] text-[var(--oc-text-2)]' },
  stage_change: { icon: ArrowRightLeft, cls: 'bg-[var(--oc-brand-soft)] text-[var(--oc-brand)]' },
}

function activityText(a: Activity): string {
  if (a.type === 'stage_change' && a.outcome && a.outcome in STAGE_LABELS) {
    return `Lead moved to ${STAGE_LABELS[a.outcome as LeadStage]}`
  }
  if (a.notes) return a.notes
  const kind = a.type === 'whatsapp' ? 'WhatsApp' : a.type.charAt(0).toUpperCase() + a.type.slice(1)
  return a.outcome ? `${kind}, ${a.outcome.replace(/_/g, ' ')}` : kind
}

function LeadPage() {
  const { leadId } = Route.useParams()
  const { data: lead, isLoading, error } = useLead(leadId)
  const { data: activities } = useLeadActivities(leadId)
  const { data: beds } = useBedAvailability()

  const updateStage = useUpdateLeadStage()
  const logActivity = useLogActivity()
  const [note, setNote] = useState('')

  // Direction 1 of the match engine: start from the lead, find the beds.
  const matches = useMemo(
    () => (lead && beds ? bestBedsForLead(lead, beds, 4) : []),
    [lead, beds],
  )
  const risk = useMemo(() => (lead ? rescueScore(lead) : null), [lead])

  if (isLoading) {
    return (
      <AppShell>
        <div className={PAGE}>
          <Shimmer className="mb-6 h-24" />
          <Shimmer className="h-48" />
        </div>
      </AppShell>
    )
  }

  if (!lead || !risk) {
    return (
      <AppShell>
        <div className={PAGE}>
          <BackLink to="/occupancy/pipeline">Back to lead pipeline</BackLink>
          {error ? <ErrorNote error={error} /> : <EmptyNote>Lead not found.</EmptyNote>}
        </div>
      </AppShell>
    )
  }

  const r = RISK[risk.band]
  const firstName = lead.name.split(' ')[0]
  const currentIdx = LEAD_STAGES.indexOf(lead.stage)
  const isLost = lead.stage === 'lost'

  const handleStage = (stage: LeadStage) => {
    if (stage === lead.stage) return
    updateStage.mutate(
      { leadId: lead.id, stage },
      {
        onSuccess: () => toast.success(`Moved to ${STAGE_LABELS[stage]}`),
        onError: (e) => toast.error((e as Error).message),
      },
    )
  }

  const handleLog = (type: 'call' | 'whatsapp') => {
    logActivity.mutate(
      { leadId: lead.id, type, notes: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Logged')
          setNote('')
        },
        onError: (e) => toast.error((e as Error).message),
      },
    )
  }

  return (
    <AppShell>
      <div className={PAGE}>
        <BackLink to="/occupancy/pipeline">Back to lead pipeline</BackLink>

        <PageHeader
          eyebrow={`Lead detail · risk score ${risk.risk}`}
          title={lead.name}
          subtitle={r.line}
          actions={
            lead.phone ? (
              <a
                href={`tel:${lead.phone}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--oc-ink)] px-4 py-2.5 text-xs font-bold text-[var(--oc-ink-fg)] transition hover:bg-[var(--oc-ink-hover)]"
              >
                <Phone className="h-3.5 w-3.5" />
                Call lead
              </a>
            ) : undefined
          }
        />

        {/* ---- Profile ---------------------------------------------------- */}
        <section className={`${CARD} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={lead.name} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl font-bold tracking-[-0.04em]">{lead.name}</h2>
                <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${r.chip}`}>
                  {r.label}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[var(--oc-text-2)]">
                {lead.phone ? (
                  <>
                    <Phone className="h-3 w-3" />
                    {lead.phone}
                    <span className="text-[var(--oc-faint)]">•</span>
                  </>
                ) : null}
                <span className="capitalize">{lead.source ?? 'unknown'} lead</span>
                <span className="text-[var(--oc-faint)]">•</span>
                contacted {relativeDays(lead.last_contacted_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ScoreRing
                score={risk.risk}
                color={r.ring}
                label={`Risk of loss ${risk.risk} out of 100`}
              />
              <div className="hidden sm:block">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--oc-text-3)]">Risk of loss</p>
                <ul className="mt-1 space-y-0.5">
                  {risk.reasons.slice(0, 2).map((reason) => (
                    <li key={reason} className={`text-xs font-bold ${r.text}`}>
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--oc-divider)] pt-5 sm:grid-cols-4">
            <Fact label="Budget" value={`${inr(lead.budget_max)} / month`} />
            <Fact label="Wants" value={lead.preferred_localities?.join(', ') || 'Anywhere'} />
            <Fact
              label="Move-in"
              value={`${shortDate(lead.move_in_date)} · ${lead.preferred_sharing ?? 'any'} sharing`}
            />
            <Fact label="Owner" value={lead.owner_name ?? 'Unassigned'} />
          </div>
        </section>

        {/* ---- Pipeline stepper: this write is the "it's real" proof ------- */}
        <section className={`${CARD} mt-4 p-5 sm:p-6`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--oc-text-3)]">Pipeline</p>
              <p className="mt-1 text-sm text-[var(--oc-text-2)]">Click any stage to move this lead.</p>
            </div>
            <span className="shrink-0 rounded-lg bg-[var(--oc-brand-soft)] px-2 py-1 text-[10px] font-bold text-[var(--oc-brand)]">
              Current: {STAGE_LABELS[lead.stage]}
            </span>
          </div>
          <div className="mt-6 overflow-x-auto pb-1">
            <div className="flex min-w-[690px] items-center">
              {LEAD_STAGES.map((stage, i) => {
                const state =
                  stage === lead.stage
                    ? isLost
                      ? 'lost'
                      : 'current'
                    : !isLost && i < currentIdx
                      ? 'done'
                      : 'todo'
                const circle = {
                  done: 'border-[#48b878] bg-[var(--oc-green-soft)] text-[var(--oc-green)]',
                  current: 'border-[var(--oc-brand)] bg-[var(--oc-card)] text-[var(--oc-brand)]',
                  lost: 'border-[#e12527] bg-[var(--oc-red-soft)] text-[var(--oc-red)]',
                  todo: 'border-[var(--oc-border)] bg-[var(--oc-card)] text-[var(--oc-text-3)]',
                }[state]
                const labelCls = {
                  done: 'text-[var(--oc-green)]',
                  current: 'text-[var(--oc-brand)]',
                  lost: 'text-[var(--oc-red)]',
                  todo: 'text-[var(--oc-text-3)]',
                }[state]
                return (
                  <div
                    key={stage}
                    className={`flex items-center ${i < LEAD_STAGES.length - 1 ? 'flex-1' : ''}`}
                  >
                    <button
                      type="button"
                      disabled={updateStage.isPending}
                      onClick={() => handleStage(stage)}
                      aria-current={stage === lead.stage ? 'step' : undefined}
                      className={`group flex flex-col items-center gap-2 text-center text-[10px] font-bold transition disabled:opacity-60 ${labelCls}`}
                    >
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-full border-2 transition group-hover:border-[var(--oc-brand)] ${circle}`}
                      >
                        {state === 'done' ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </span>
                      <span className="whitespace-nowrap">{STAGE_LABELS[stage]}</span>
                    </button>
                    {i < LEAD_STAGES.length - 1 ? (
                      <div
                        className={`mx-2 mb-5 h-px flex-1 ${
                          !isLost && i < currentIdx ? 'bg-[#82d2a3]' : 'bg-[var(--oc-border)]'
                        }`}
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          {/* ---- Best beds ------------------------------------------------ */}
          <section className={`${CARD} p-5 sm:p-6`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold tracking-[-0.035em]">
                  Best beds for {firstName}
                </h2>
                <p className="mt-1 text-xs text-[var(--oc-text-3)]">
                  Ranked on budget, locality, move-in date and sharing type.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--oc-chip)] px-2 py-1 text-[10px] font-bold text-[var(--oc-text-2)]">
                {matches.length} match{matches.length === 1 ? '' : 'es'}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {matches.length === 0 ? (
                <EmptyNote>
                  <BedDouble className="mx-auto mb-2 h-5 w-5 opacity-50" />
                  Nothing available fits {firstName} right now.
                </EmptyNote>
              ) : (
                matches.map(({ bed, score, reasons }) => (
                  <Link
                    key={bed.bed_id}
                    to="/occupancy/bed/$bedId"
                    params={{ bedId: bed.bed_id }}
                    className="group flex items-center gap-3 rounded-xl border border-[var(--oc-divider)] p-3.5 transition hover:border-[var(--oc-brand-line)] hover:bg-[var(--oc-hover)]"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--oc-brand-soft)] text-[var(--oc-brand)]">
                      <BedDouble className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold group-hover:text-[var(--oc-brand)]">
                        {shortProperty(bed.property_name)} · Room {bed.room_number}
                        {bed.bed_label}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-[var(--oc-text-3)]">
                        <span className="capitalize">{bed.sharing_type}</span>
                        <Dot />
                        {inr(bed.monthly_rent)}
                        <Dot />
                        {bed.status === 'vacant'
                          ? 'available now'
                          : `available ${shortDate(bed.available_from)}`}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-[var(--oc-text-3)]">
                        {reasons.map((x) => x.detail).slice(0, 2).join(' · ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-display text-lg font-bold ${scoreText(score)}`}>{score}</p>
                      <p className="text-[10px] text-[var(--oc-text-3)]">
                        {bed.status === 'vacant'
                          ? `${inr(Number(bed.revenue_lost))} at risk`
                          : 'fit score'}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--oc-faint)]" />
                  </Link>
                ))
              )}
            </div>
          </section>

          {/* ---- Activity --------------------------------------------------- */}
          <section className={`${CARD} p-5 sm:p-6`}>
            <h2 className="font-display text-xl font-bold tracking-[-0.035em]">Log an activity</h2>
            <p className="mt-1 text-xs text-[var(--oc-text-3)]">Keep the lead context fresh.</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What happened on the call?"
              aria-label="Activity note"
              className="mt-5 min-h-[98px] w-full resize-none rounded-xl border border-[var(--oc-border)] bg-[var(--oc-sunken)] p-3 text-xs outline-none transition placeholder:text-[var(--oc-text-3)] focus:border-[var(--oc-brand)] focus:ring-2 focus:ring-[var(--oc-brand)]/10"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={logActivity.isPending}
                onClick={() => handleLog('call')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--oc-border)] px-3 py-2.5 text-xs font-bold text-[var(--oc-text)] transition hover:border-[var(--oc-brand)] hover:text-[var(--oc-brand)] disabled:opacity-60"
              >
                <Phone className="h-3.5 w-3.5" /> Log call
              </button>
              <button
                type="button"
                disabled={logActivity.isPending}
                onClick={() => handleLog('whatsapp')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--oc-green-soft)] px-3 py-2.5 text-xs font-bold text-[var(--oc-green)] transition hover:bg-[var(--oc-green-soft-2)] disabled:opacity-60"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Log WhatsApp
              </button>
            </div>

            <div className="mt-6 border-t border-[var(--oc-divider)] pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--oc-text-3)]">
                Recent activity
              </p>
              <div className="mt-4 max-h-[360px] space-y-4 overflow-y-auto pr-1">
                {(activities ?? []).map((a) => {
                  const { icon: Icon, cls } = ACTIVITY_ICON[a.type]
                  return (
                    <div key={a.id} className="flex gap-3">
                      <span
                        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${cls}`}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">{activityText(a)}</p>
                        <p className="mt-1 text-[10px] text-[var(--oc-text-3)]">
                          {a.created_by ?? 'Someone'} · {relativeDays(a.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
                {(activities ?? []).length === 0 ? (
                  <p className="text-xs text-[var(--oc-text-3)]">
                    Nothing logged yet. That&apos;s usually how leads get lost.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--oc-text-3)]">{label}</p>
      <p className="mt-1.5 truncate text-sm font-bold">{value}</p>
    </div>
  )
}
