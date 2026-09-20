import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { ArrowLeft, BedDouble, Phone, Sparkles, Users } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBedAvailability, useLeads } from '@/lib/occupancy/queries'
import { bestLeadsForBed } from '@/lib/occupancy/matching'
import { inr, shortDate } from '@/lib/occupancy/format'
import { STAGE_LABELS } from '@/lib/occupancy/types'
import { ReasonList, ScoreBar, ScorePill } from '@/components/occupancy/match-bits'

export const Route = createFileRoute('/occupancy/bed/$bedId')({
  head: () => ({
    meta: [
      { title: 'Bed — Occupancy Engine' },
      {
        name: 'description',
        content: 'Who is waiting that would take this bed, ranked with reasons.',
      },
    ],
  }),
  component: BedPage,
})

function BedPage() {
  const { bedId } = Route.useParams()
  const { data: beds, isLoading: bedsLoading } = useBedAvailability()
  const { data: leads, isLoading: leadsLoading } = useLeads()

  const bed = useMemo(() => (beds ?? []).find((b) => b.bed_id === bedId), [beds, bedId])

  // DIRECTION 2 of the match engine: start from the bed, find the people.
  const matches = useMemo(
    () => (bed && leads ? bestLeadsForBed(bed, leads, 6) : []),
    [bed, leads],
  )

  const loading = bedsLoading || leadsLoading

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
        <Link
          to="/occupancy"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Occupancy Engine
        </Link>

        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : !bed ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            That bed no longer exists.
          </Card>
        ) : (
          <>
            {/* ---- The bed ------------------------------------------- */}
            <Card className="mb-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <BedDouble className="h-4 w-4 text-accent" />
                    <h1 className="text-xl font-display font-bold">
                      {bed.property_name}
                    </h1>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Room {bed.room_number}
                    {bed.bed_label} · {bed.sharing_type} sharing · {bed.gender} ·{' '}
                    {bed.locality}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant={bed.status === 'vacant' ? 'destructive' : 'secondary'}>
                      {bed.status === 'vacant' ? 'Empty now' : 'Occupied'}
                    </Badge>
                    <Badge variant="outline">{inr(bed.monthly_rent)}/mo</Badge>
                    {bed.available_from ? (
                      <Badge variant="outline">
                        Available {shortDate(bed.available_from)}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="text-right">
                  {bed.status === 'vacant' ? (
                    <>
                      <div className="text-2xl font-bold tabular-nums text-red-500">
                        −{inr(Number(bed.revenue_lost))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        lost over {bed.days_vacant} days empty
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {inr(bed.monthly_rent / 30)} more every day
                      </div>
                    </>
                  ) : bed.expected_move_out_date ? (
                    <>
                      <div className="text-sm font-medium">{bed.current_tenant}</div>
                      <div className="text-xs text-muted-foreground">
                        leaving {shortDate(bed.expected_move_out_date)}
                      </div>
                      <Badge variant="secondary" className="mt-2">
                        Future inventory
                      </Badge>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-medium">{bed.current_tenant}</div>
                      <div className="text-xs text-muted-foreground">no notice given</div>
                    </>
                  )}
                </div>
              </div>
            </Card>

            {/* ---- THE DEMO MOMENT: bed -> leads ---------------------- */}
            <Card>
              <div className="border-b px-5 py-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <h2 className="text-sm font-semibold">Who would take this bed</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Every CRM can tell you which beds suit a lead. This tells you which
                  leads suit a bed — ranked, with the reason for every point. Nobody had
                  to remember any of it.
                </p>
              </div>

              {matches.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  <Users className="mx-auto mb-2 h-5 w-5 opacity-50" />
                  {bed.available_from === null
                    ? 'This bed is occupied with no notice given, so there is nothing to sell yet.'
                    : 'No leads in the market currently fit this bed.'}
                </div>
              ) : (
                <div className="divide-y">
                  {matches.map(({ lead, score, reasons }) => (
                    <div key={lead.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            to="/occupancy/lead/$leadId"
                            params={{ leadId: lead.id }}
                            className="text-sm font-medium hover:underline"
                          >
                            {lead.name}
                          </Link>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {STAGE_LABELS[lead.stage]} · budget {inr(lead.budget_max)} ·
                            wants {lead.preferred_localities?.join(', ') || 'anywhere'} ·
                            moving {shortDate(lead.move_in_date)}
                          </div>
                        </div>
                        <ScorePill score={score} />
                      </div>

                      <div className="mt-3">
                        <ScoreBar score={score} />
                      </div>

                      <ReasonList reasons={reasons} />

                      {lead.phone ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3"
                          asChild
                        >
                          <a href={`tel:${lead.phone}`}>
                            <Phone className="mr-1.5 h-3 w-3" />
                            {lead.phone}
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </AppShell>
  )
}
