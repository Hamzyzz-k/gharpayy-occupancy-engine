import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLeads, useSellBeds } from '@/lib/occupancy/queries'
import { bestLeadsForBed } from '@/lib/occupancy/matching'
import { inr } from '@/lib/occupancy/format'
import type { BedAvailability } from '@/lib/occupancy/types'

export interface SellTarget {
  beds: BedAvailability[]
  /** "Room 101" or "Room 101A", for the title and toast. */
  label: string
}

const todayISO = () => new Date().toISOString().slice(0, 10)

const FIELD =
  'h-10 w-full rounded-xl border border-[var(--oc-border)] bg-[var(--oc-sunken)] px-3 text-sm text-[var(--oc-text)] outline-none transition placeholder:text-[var(--oc-text-3)] focus:border-[var(--oc-brand)] focus:ring-2 focus:ring-[var(--oc-brand)]/10'

export function SellDialog({ target, onClose }: { target: SellTarget | null; onClose: () => void }) {
  const { data: leads } = useLeads()
  const sell = useSellBeds()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [moveIn, setMoveIn] = useState(todayISO())
  const [leadId, setLeadId] = useState<string | undefined>()

  useEffect(() => {
    if (target) {
      setName('')
      setPhone('')
      setMoveIn(todayISO())
      setLeadId(undefined)
    }
  }, [target])

  // Suggest the people the match engine already ranked for this bed.
  const suggestions = useMemo(
    () => (target && leads ? bestLeadsForBed(target.beds[0]!, leads, 3) : []),
    [target, leads],
  )

  const rent = target?.beds.reduce((s, b) => s + Number(b.monthly_rent), 0) ?? 0
  const bedCount = target?.beds.length ?? 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!target || !name.trim()) return
    sell.mutate(
      {
        beds: target.beds.map((b) => ({ bed_id: b.bed_id, monthly_rent: Number(b.monthly_rent) })),
        tenantName: name.trim(),
        tenantPhone: phone.trim() || undefined,
        moveInDate: moveIn,
        leadId,
      },
      {
        onSuccess: () => {
          toast.success(`${target.label} marked as sold to ${name.trim()}`)
          onClose()
        },
        onError: (err) => toast.error((err as Error).message),
      },
    )
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Mark {target?.label} as sold</DialogTitle>
            <DialogDescription>
              {bedCount === 1 ? '1 bed' : `${bedCount} beds`}, {inr(rent)} a month. It comes off the
              empty list for everyone straight away.
            </DialogDescription>
          </DialogHeader>

          {suggestions.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.11em] text-[var(--oc-text-3)]">
                Booked by one of these leads?
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map(({ lead, score }) => {
                  const active = leadId === lead.id
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setLeadId(active ? undefined : lead.id)
                        setName(active ? '' : lead.name)
                        setPhone(active ? '' : (lead.phone ?? ''))
                      }}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                        active
                          ? 'border-[var(--oc-brand)] bg-[var(--oc-brand-soft)] text-[var(--oc-brand)]'
                          : 'border-[var(--oc-border)] text-[var(--oc-text-2)] hover:border-[var(--oc-brand)]'
                      }`}
                    >
                      {lead.name} <span className="font-medium opacity-70">{score}</span>
                    </button>
                  )
                })}
              </div>
              {leadId ? (
                <p className="mt-2 text-[11px] text-[var(--oc-text-3)]">
                  This lead will move to Booked in the pipeline.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[var(--oc-text-2)]">Tenant name</span>
              <input
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setLeadId(undefined)
                }}
                placeholder="Who booked it?"
                className={FIELD}
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--oc-text-2)]">Phone (optional)</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="+91"
                  className={FIELD}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--oc-text-2)]">Move-in date</span>
                <input
                  type="date"
                  required
                  value={moveIn}
                  onChange={(e) => setMoveIn(e.target.value)}
                  className={FIELD}
                />
              </label>
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2 sm:gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-[var(--oc-border)] px-4 text-xs font-bold text-[var(--oc-text-2)] transition hover:bg-[var(--oc-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sell.isPending || !name.trim()}
              className="h-10 rounded-xl bg-[#f4c024] px-4 text-xs font-bold text-[#171b20] transition hover:brightness-105 disabled:opacity-50"
            >
              {sell.isPending ? 'Saving' : 'Mark as sold'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
