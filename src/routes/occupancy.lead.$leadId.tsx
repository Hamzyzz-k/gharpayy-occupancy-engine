import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  BedDouble,
  Clock,
  MessageSquare,
  Phone,
  Sparkles,
} from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useBedAvailability,
  useLead,
  useLeadActivities,
  useLogActivity,
  useUpdateLeadStage,
} from '@/lib/occupancy/queries'
import { bestBedsForLead } from '@/lib/occupancy/matching'
import { rescueScore } from '@/lib/occupancy/rescue'
import { inr, relativeDays, shortDate } from '@/lib/occupancy/format'
import { LEAD_STAGES, STAGE_LABELS } from '@/lib/occupancy/types'
import type { LeadStage } from '@/lib/occupancy/types'
import { ReasonList, ScoreBar, ScorePill } from '@/components/occupancy/match-bits'

export const Route = createFileRoute('/occupancy/lead/$leadId')({
  head: () => ({
    meta: [
      { title: 'Lead — Gharpayy' },
      { name: 'description', content: 'Lead detail, matched beds, and full activity history.' },
    ],
  }),
  component: LeadPage,
})

function LeadPage() {
  const { leadId } = Route.useParams()
  const { data: lead, isLoading } = useLead(leadId)
  const { data: activities } = useLeadActivities(leadId)
  const { data: beds } = useBedAvailability()

  const updateStage = useUpdateLeadStage()
  const logActivity = useLogActivity()
  const [note, setNote] = useState('')

  // DIRECTION 1 of the match engine: start from the lead, find the beds.
  const matches = useMemo(
    () => (lead && beds ? bestBedsForLead(lead, beds, 4) : []),
    [lead, beds],
  )

  const risk = useMemo(() => (lead ? rescueScore(lead) : null), [lead])

  if (isLoading) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          <Skeleton className="h-40 w-full" />
        </div>
      </AppShell>
    )
  }

  if (!lead) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Lead not found.
          </Card>
        </div>
      </AppShell>
    )
  }

  const handleStage = (stage: LeadStage) => {
    updateStage.mutate(
      { leadId: lead.id, stage },
      {
        onSuccess: () => toast.success(`Moved to ${STAGE_LABELS[stage]}`),
        onError: (e) => toast.error((e as Error).message),
      },
    )
  }

  const handleLog = (type: 'call' | 'whatsapp' | 'note') => {
    logActivity.mutate(
      { leadId: lead.id, type, notes: note || undefined },
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
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
        <Link
          to="/occupancy/pipeline"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Pipeline
        </Link>

        {/* ---- Header --------------------------------------------------- */}
        <Card className="mb-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-display font-bold">{lead.name}</h1>
              <div className="mt-1 text-sm text-muted-foreground">
                Budget {inr(lead.budget_max)} ·{' '}
                {lead.preferred_localities?.join(', ') || 'anywhere'} ·{' '}
                {lead.preferred_sharing ?? 'any'} sharing · {lead.gender ?? '—'}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Moving {shortDate(lead.move_in_date)} · from {lead.source} · owned by{' '}
                {lead.owner_name ?? 'nobody'}
              </div>
              {lead.phone ? (
                <Button size="sm" variant="outline" className="mt-3" asChild>
                  <a href={`tel:${lead.phone}`}>
                    <Phone className="mr-1.5 h-3 w-3" /> {lead.phone}
                  </a>
                </Button>
              ) : null}
            </div>

            {risk ? (
              <div className="text-right">
                <div
                  className={`text-2xl font-bold tabular-nums ${
                    risk.band === 'critical'
                      ? 'text-red-500'
                      : risk.band === 'warm'
                        ? 'text-amber-500'
                        : 'text-emerald-500'
                  }`}
                >
                  {risk.risk}
                </div>
                <div className="text-xs text-muted-foreground">risk of loss</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  contacted {relativeDays(lead.last_contacted_at)}
                </div>
              </div>
            ) : null}
          </div>

          {/* ---- Stage picker — this write is the "it's real" proof ----- */}
          <div className="mt-4 border-t pt-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pipeline stage
            </div>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_STAGES.map((s) => (
                <button
                  key={s}
                  disabled={updateStage.isPending}
                  onClick={() => handleStage(s)}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                    lead.stage === s
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* ---- Matched beds ------------------------------------------ */}
          <Card>
            <div className="border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold">Beds that fit {lead.name.split(' ')[0]}</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Scored on budget, locality, availability and sharing type. Gender is a
                hard filter, not a score.
              </p>
            </div>
            {matches.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                <BedDouble className="mx-auto mb-2 h-5 w-5 opacity-50" />
                Nothing available fits this lead right now.
              </div>
            ) : (
              <div className="divide-y">
                {matches.map(({ bed, score, reasons }) => (
                  <div key={bed.bed_id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to="/occupancy/bed/$bedId"
                          params={{ bedId: bed.bed_id }}
                          className="text-sm font-medium hover:underline"
                        >
                          {bed.property_name}
                        </Link>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Room {bed.room_number}
                          {bed.bed_label} · {bed.sharing_type} · {inr(bed.monthly_rent)}/mo
                        </div>
                      </div>
                      <ScorePill score={score} />
                    </div>
                    <div className="mt-3">
                      <ScoreBar score={score} />
                    </div>
                    <ReasonList reasons={reasons} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ---- Activity timeline ------------------------------------- */}
          <Card>
            <div className="border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold">Activity</h2>
              </div>
            </div>

            <div className="border-b px-5 py-4">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What happened on this call?"
                rows={2}
                className="text-sm"
              />
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={logActivity.isPending}
                  onClick={() => handleLog('call')}
                >
                  <Phone className="mr-1.5 h-3 w-3" /> Log call
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={logActivity.isPending}
                  onClick={() => handleLog('whatsapp')}
                >
                  <MessageSquare className="mr-1.5 h-3 w-3" /> Log WhatsApp
                </Button>
              </div>
            </div>

            <div className="max-h-[420px] divide-y overflow-y-auto">
              {(activities ?? []).map((a) => (
                <div key={a.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {a.type}
                    </Badge>
                    {a.outcome ? (
                      <span className="text-xs text-muted-foreground">{a.outcome}</span>
                    ) : null}
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {relativeDays(a.created_at)}
                    </span>
                  </div>
                  {a.notes ? <p className="mt-1 text-sm">{a.notes}</p> : null}
                  {a.created_by ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      by {a.created_by}
                    </p>
                  ) : null}
                </div>
              ))}
              {(activities ?? []).length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Nothing logged yet. That&apos;s usually how leads get lost.
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
