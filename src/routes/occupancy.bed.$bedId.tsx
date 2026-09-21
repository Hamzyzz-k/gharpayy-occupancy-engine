import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import {
  CalendarDays,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
  TrendingDown,
  Users,
} from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import {
  PAGE,
  Avatar,
  BackLink,
  Dot,
  EmptyNote,
  ErrorNote,
  PageHeader,
  Shimmer,
  StageChip,
} from '@/components/occupancy/ui'
import { ReasonGrid, ScoreRing } from '@/components/occupancy/match-bits'
import { useBedAvailability, useLeads } from '@/lib/occupancy/queries'
import { bestLeadsForBed } from '@/lib/occupancy/matching'
import type { BedAvailability, Lead } from '@/lib/occupancy/types'
import { daysUntil, inr, shortDate, shortProperty, waNumber } from '@/lib/occupancy/format'

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

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** A short, friendly WhatsApp opener offering this specific bed. */
function whatsappLink(lead: Lead, bed: BedAvailability): string | null {
  if (!lead.phone) return null
  const first = lead.name.split(' ')[0]
  const when =
    bed.status === 'vacant' ? 'available right away' : `available from ${shortDate(bed.available_from)}`
  const text =
    `Hi ${first}, this is Gharpayy. A ${bed.sharing_type} bed at ${bed.property_name} ` +
    `in ${bed.locality} fits what you're looking for: ${inr(bed.monthly_rent)} a month, ${when}. ` +
    `Would you like to come and see it?`
  return `https://wa.me/${waNumber(lead.phone)}?text=${encodeURIComponent(text)}`
}

function BedPage() {
  const { bedId } = Route.useParams()
  const { data: beds, isLoading: bedsLoading, error } = useBedAvailability()
  const { data: leads, isLoading: leadsLoading } = useLeads()

  const bed = useMemo(() => (beds ?? []).find((b) => b.bed_id === bedId), [beds, bedId])

  // Direction 2 of the match engine: start from the bed, find the people.
  const matches = useMemo(
    () => (bed && leads ? bestLeadsForBed(bed, leads, 6) : []),
    [bed, leads],
  )

  const loading = bedsLoading || leadsLoading

  if (loading) {
    return (
      <AppShell>
        <div className={PAGE}>
          <Shimmer className="mb-6 h-24" />
          <Shimmer className="h-64 rounded-3xl" />
        </div>
      </AppShell>
    )
  }

  if (!bed) {
    return (
      <AppShell>
        <div className={PAGE}>
          <BackLink to="/occupancy">Back to overview</BackLink>
          {error ? <ErrorNote error={error} /> : <EmptyNote>That bed no longer exists.</EmptyNote>}
        </div>
      </AppShell>
    )
  }

  const perDay = bed.monthly_rent / 30
  const leavingIn = daysUntil(bed.expected_move_out_date)
  const vacant = bed.status === 'vacant'
  const onNotice = !vacant && bed.expected_move_out_date !== null

  const subtitle = vacant
    ? `Turn this empty bed into a booked bed before another ${inr(perDay)} disappears.`
    : onNotice
      ? `Not empty yet. Line up the next tenant before ${bed.current_tenant} leaves on ${shortDate(bed.expected_move_out_date)}.`
      : 'Occupied, with no notice given. Nothing to sell yet.'

  return (
    <AppShell>
      <div className={PAGE}>
        <BackLink to="/occupancy">Back to overview</BackLink>

        <PageHeader
          eyebrow={`Bed detail · ${shortProperty(bed.property_name)}`}
          title={`Room ${bed.room_number}, bed ${bed.bed_label}`}
          subtitle={subtitle}
          actions={
            matches.length > 0 ? (
              <a
                href="#matches"
                className="inline-flex items-center gap-2 rounded-xl bg-[#f4c024] px-4 py-2.5 text-xs font-bold text-[#171b20] shadow-[0_7px_18px_rgba(9,67,160,0.22)] transition hover:brightness-105"
              >
                <Sparkles className="h-3.5 w-3.5" />
                See best matches
              </a>
            ) : undefined
          }
        />

        {/* ---- Hero ------------------------------------------------------- */}
        <section className="relative overflow-hidden rounded-3xl bg-[#0943a0] p-5 text-white shadow-[0_16px_34px_rgba(9,67,160,0.28)] sm:p-7">
          <div className="absolute -right-10 -top-16 h-60 w-60 rounded-full border-[36px] border-[#f4c024]/25" />
          <div className="relative grid gap-7 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] ${
                    vacant
                      ? 'bg-white/10 text-[#ffc2bd]'
                      : onNotice
                        ? 'bg-[#f4c024]/20 text-[#ffd35c]'
                        : 'bg-white/10 text-white/75'
                  }`}
                >
                  {vacant ? 'Empty now' : onNotice ? 'On notice' : 'Occupied'}
                </span>
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-white/75">
                  {cap(bed.sharing_type)} · {cap(bed.gender)}
                </span>
              </div>
              <p className="mt-5 flex items-center gap-2 text-sm text-white/75">
                <MapPin className="h-4 w-4 shrink-0 text-[#0943a0]" />
                {bed.property_name} · {bed.locality}
              </p>
              <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <HeroStat label="Monthly rent" value={inr(bed.monthly_rent)} />
                {vacant ? (
                  <HeroStat label="Empty for" value={`${bed.days_vacant} days`} danger />
                ) : (
                  <HeroStat
                    label={onNotice ? 'Leaves in' : 'Tenant'}
                    value={onNotice ? `${leavingIn} days` : (bed.current_tenant ?? 'Unknown')}
                  />
                )}
                <HeroStat
                  label="Available from"
                  value={vacant ? 'Now' : bed.available_from ? shortDate(bed.available_from) : 'Not yet'}
                />
                <HeroStat label="Bed type" value={cap(bed.sharing_type)} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 sm:p-6">
              {vacant ? (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.13em] text-white/65">
                        Money lost so far
                      </p>
                      <p className="mt-2 font-display text-[40px] font-bold leading-none tracking-[-0.05em] text-[#ffc2bd]">
                        {inr(Number(bed.revenue_lost))}
                      </p>
                    </div>
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-[#ffc2bd]">
                      <TrendingDown className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/65">Cost of one more empty day</span>
                      <span className="font-bold text-white">{inr(perDay)}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#e12527]"
                        style={{ width: `${Math.min(100, (bed.days_vacant / 45) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-white/65">
                      This bar keeps moving until the bed is filled.
                    </p>
                  </div>
                </>
              ) : onNotice ? (
                <>
                  <p className="text-xs font-bold uppercase tracking-[0.13em] text-white/65">
                    Sell before it empties
                  </p>
                  <p className="mt-2 font-display text-[40px] font-bold leading-none tracking-[-0.05em] text-[#ffd35c]">
                    {leavingIn} days
                  </p>
                  <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-white/65">
                    {bed.current_tenant} moves out on {shortDate(bed.expected_move_out_date)}. Book
                    someone now and this bed never loses a rupee.
                  </p>
                </>
              ) : (
                <p className="text-sm leading-6 text-white/65">
                  {bed.current_tenant} is settled here with no notice given, so there is nothing to
                  sell yet.
                </p>
              )}
            </div>
          </div>
        </section>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#ecdca0] bg-[#fdf8e6] p-4">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f4c024] text-[#171b20]">
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="text-xs leading-5 text-[#5c4a12]">
            <span className="font-bold">The reverse match.</span> Every CRM tells you which beds suit
            a lead. This tells you which leads suit a bed, so the moment a bed frees up you already
            know who to call.
          </p>
        </div>

        {/* ---- Matches --------------------------------------------------- */}
        <div
          id="matches"
          className="mt-7 flex scroll-mt-6 flex-col justify-between gap-3 sm:flex-row sm:items-end"
        >
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl font-bold tracking-[-0.04em]">
                Leads who could take it
              </h2>
              <span className="rounded-full bg-[#eaf0fa] px-2 py-0.5 text-[10px] font-bold text-[#0943a0]">
                {matches.length} matched
              </span>
            </div>
            <p className="mt-1 text-xs text-[#8b8f95]">
              Ranked by fit, with the reason behind every point. Gender and budget are hard filters.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#8b8f95]">
            <span className="h-2 w-2 rounded-full bg-[#48b878]" /> 75+ strong
            <span className="ml-2 h-2 w-2 rounded-full bg-[#e5a135]" /> 50 to 74 decent
          </div>
        </div>

        {matches.length === 0 ? (
          <div className="mt-4">
            <EmptyNote>
              <Users className="mx-auto mb-2 h-5 w-5 opacity-50" />
              {bed.available_from === null
                ? 'This bed is occupied with no notice given, so there is nothing to sell yet.'
                : 'No leads in the market currently fit this bed.'}
            </EmptyNote>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {matches.map(({ lead, score, reasons }, i) => {
              const wa = whatsappLink(lead, bed)
              return (
                <div
                  key={lead.id}
                  className={`rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(42,30,21,0.08)] sm:p-5 ${
                    i === 0
                      ? 'border-[#bccdea] shadow-[0_8px_24px_rgba(9,67,160,0.08)]'
                      : 'border-[#e4e0dd]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={lead.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/occupancy/lead/$leadId"
                          params={{ leadId: lead.id }}
                          className="text-sm font-bold hover:text-[#0943a0]"
                        >
                          {lead.name}
                        </Link>
                        <StageChip stage={lead.stage} />
                        {i === 0 ? (
                          <span className="text-[10px] font-bold text-[#0943a0]">Best fit</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] text-[#8b8f95]">
                        {inr(lead.budget_max)} budget
                        <Dot />
                        Wants {lead.preferred_localities?.join(', ') || 'anywhere'}
                      </p>
                    </div>
                    <ScoreRing score={score} />
                  </div>

                  <ReasonGrid reasons={reasons} />

                  <div className="mt-4 flex items-center justify-between border-t border-[#f0ece8] pt-3">
                    <span className="flex items-center gap-1.5 text-[11px] text-[#777c83]">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Move-in {shortDate(lead.move_in_date)}
                    </span>
                    {lead.phone ? (
                      <div className="flex gap-1.5">
                        <a
                          href={`tel:${lead.phone}`}
                          aria-label={`Call ${lead.name}`}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-[#e4e0dd] text-[#646971] transition hover:border-[#0943a0] hover:text-[#0943a0]"
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                        {wa ? (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`WhatsApp ${lead.name} about this bed`}
                            className="grid h-9 w-9 place-items-center rounded-lg bg-[#e9f8ef] text-[#24925d] transition hover:bg-[#d9f2e3]"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}

function HeroStat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.1em] text-white/60">{label}</p>
      <p
        className={`mt-1.5 truncate font-display text-xl font-bold ${danger ? 'text-[#ffc2bd]' : ''}`}
      >
        {value}
      </p>
    </div>
  )
}
