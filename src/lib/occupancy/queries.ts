/**
 * Data access for the Occupancy Engine.
 *
 * Everything on the occupancy screens comes through here, and every one of these
 * hits Postgres. Nothing is mocked. That's the whole point of the exercise.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type {
  Activity,
  ActivityWithLead,
  Booking,
  BedAvailability,
  Lead,
  LeadStage,
  Property,
  Task,
} from './types'

/**
 * The generated `integrations/supabase/types.ts` was produced against an empty
 * schema, so it doesn't know our tables exist. Rather than hand-edit a file
 * marked "do not edit", we widen the client here and type the results
 * ourselves via the interfaces in ./types.
 */
const db = supabase as unknown as {
  from: (table: string) => any
}

export const qk = {
  leads: ['occupancy', 'leads'] as const,
  lead: (id: string) => ['occupancy', 'lead', id] as const,
  activities: (id: string) => ['occupancy', 'activities', id] as const,
  beds: ['occupancy', 'beds'] as const,
  properties: ['occupancy', 'properties'] as const,
  tasks: ['occupancy', 'tasks'] as const,
  recentActivity: ['occupancy', 'recent-activity'] as const,
  recentBookings: ['occupancy', 'recent-bookings'] as const,
}

function unwrap<T>({ data, error }: { data: T | null; error: any }): T {
  if (error) throw new Error(error.message ?? 'Query failed')
  return (data ?? []) as T
}

/**
 * Fail fast rather than retrying into a spinner.
 *
 * The common failure here isn't a flaky network, it's a `.env` pointing at the
 * wrong project, and retrying that three times with backoff just means the
 * user stares at a skeleton for half a minute instead of reading the error.
 * One retry, then surface it.
 */
const FAIL_FAST = {
  retry: 1,
  staleTime: 30_000,
} as const

/** Abort a hung request so a bad host surfaces as an error instead of hanging. */
async function withTimeout<T>(p: PromiseLike<T>, ms = 8000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Request timed out after ${ms / 1000}s. Check VITE_SUPABASE_URL`)),
      ms,
    )
  })
  try {
    return await Promise.race([Promise.resolve(p), timeout])
  } finally {
    clearTimeout(timer!)
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function useLeads() {
  return useQuery({
    queryKey: qk.leads,
    ...FAIL_FAST,
    queryFn: async (): Promise<Lead[]> =>
      unwrap<Lead[]>(
        await withTimeout(db.from('leads').select('*').order('created_at', { ascending: false })),
      ),
  })
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: qk.lead(id ?? ''),
    enabled: Boolean(id),
    ...FAIL_FAST,
    queryFn: async (): Promise<Lead | null> => {
      const { data, error } = await withTimeout<{ data: unknown; error: { message: string } | null }>(
        db.from('leads').select('*').eq('id', id).maybeSingle(),
      )
      if (error) throw new Error(error.message)
      return data as Lead | null
    },
  })
}

export function useLeadActivities(id: string | undefined) {
  return useQuery({
    queryKey: qk.activities(id ?? ''),
    enabled: Boolean(id),
    ...FAIL_FAST,
    queryFn: async (): Promise<Activity[]> =>
      unwrap<Activity[]>(
        await withTimeout(db
          .from('activities')
          .select('*')
          .eq('lead_id', id)
          .order('created_at', { ascending: false })),
      ),
  })
}

/**
 * The flattened inventory view. `available_from`, `days_vacant` and
 * `revenue_lost` are all computed in Postgres, not in the browser, so this
 * behaves the same whether there are 120 beds or 12,000.
 */
export function useBedAvailability() {
  return useQuery({
    queryKey: qk.beds,
    ...FAIL_FAST,
    queryFn: async (): Promise<BedAvailability[]> =>
      unwrap<BedAvailability[]>(
        await withTimeout(db
          .from('bed_availability')
          .select('*')
          .order('revenue_lost', { ascending: false })),
      ),
  })
}

export function useProperties() {
  return useQuery({
    queryKey: qk.properties,
    ...FAIL_FAST,
    queryFn: async (): Promise<Property[]> =>
      unwrap<Property[]>(await withTimeout(db.from('properties').select('*').order('name'))),
  })
}

export function useOpenTasks() {
  return useQuery({
    queryKey: qk.tasks,
    ...FAIL_FAST,
    queryFn: async (): Promise<Task[]> =>
      unwrap<Task[]>(
        await withTimeout(db.from('tasks').select('*').eq('status', 'open').order('due_at')),
      ),
  })
}

// ---------------------------------------------------------------------------
// Writes: these are the proof it's a real backend
// ---------------------------------------------------------------------------

/**
 * Moving a lead through the pipeline. Also writes an activity row, so the
 * timeline records who moved it and when. A stage change with no audit trail
 * is how CRMs end up untrustworthy.
 */
export function useUpdateLeadStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ leadId, stage }: { leadId: string; stage: LeadStage }) => {
      const { error } = await db
        .from('leads')
        .update({ stage, last_contacted_at: new Date().toISOString() })
        .eq('id', leadId)
      if (error) throw new Error(error.message)

      await db.from('activities').insert({
        lead_id: leadId,
        type: 'stage_change',
        outcome: stage,
        notes: `Stage moved to ${stage}`,
        created_by: 'You',
      })
    },
    onSuccess: (_d, { leadId }) => {
      qc.invalidateQueries({ queryKey: qk.leads })
      qc.invalidateQueries({ queryKey: qk.lead(leadId) })
      qc.invalidateQueries({ queryKey: qk.activities(leadId) })
    },
  })
}

export function useLogActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      leadId: string
      type: Activity['type']
      outcome?: string
      notes?: string
    }) => {
      const { error } = await db.from('activities').insert({
        lead_id: input.leadId,
        type: input.type,
        outcome: input.outcome ?? null,
        notes: input.notes ?? null,
        created_by: 'You',
      })
      if (error) throw new Error(error.message)

      await db
        .from('leads')
        .update({ last_contacted_at: new Date().toISOString() })
        .eq('id', input.leadId)
    },
    onSuccess: (_d, { leadId }) => {
      qc.invalidateQueries({ queryKey: qk.activities(leadId) })
      qc.invalidateQueries({ queryKey: qk.lead(leadId) })
      qc.invalidateQueries({ queryKey: qk.leads })
    },
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (lead: Partial<Lead>) => {
      const { data, error } = await db.from('leads').insert(lead).select().single()
      if (error) throw new Error(error.message)
      return data as Lead
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.leads }),
  })
}

export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await db
        .from('tasks')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', taskId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tasks }),
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { leadId: string; title: string; dueAt: string }) => {
      const { error } = await db.from('tasks').insert({
        lead_id: input.leadId,
        title: input.title,
        due_at: input.dueAt,
        assigned_to: 'You',
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tasks }),
  })
}

/** Latest activity across every lead, for the admin feed. */
export function useRecentActivity(limit = 25) {
  return useQuery({
    queryKey: qk.recentActivity,
    ...FAIL_FAST,
    queryFn: async (): Promise<ActivityWithLead[]> =>
      unwrap(
        await withTimeout(
          db
            .from('activities')
            .select('*, leads(name)')
            .order('created_at', { ascending: false })
            .limit(limit),
        ),
      ),
  })
}

/** Most recent tenancies, i.e. beds that were sold, newest first. */
export function useRecentBookings(limit = 12) {
  return useQuery({
    queryKey: qk.recentBookings,
    ...FAIL_FAST,
    queryFn: async (): Promise<Booking[]> =>
      unwrap(
        await withTimeout(
          db
            .from('tenancies')
            .select(
              'id, tenant_name, move_in_date, monthly_rent, status, created_at, beds(bed_label, rooms(room_number, properties(name)))',
            )
            .order('created_at', { ascending: false })
            // Seeded tenancies share one created_at, so fall back to move-in date.
            .order('move_in_date', { ascending: false })
            .limit(limit),
        ),
      ),
  })
}

function invalidateInventory(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: qk.beds })
  qc.invalidateQueries({ queryKey: qk.leads })
  qc.invalidateQueries({ queryKey: qk.recentActivity })
  qc.invalidateQueries({ queryKey: qk.recentBookings })
}

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Mark one or more beds as sold: each gets an active tenancy and flips to
 * occupied. The update is guarded on status = 'vacant', so two people selling
 * the same bed at once can't both succeed. If a lead is given, they move to
 * Booked and the sale is logged on their timeline.
 */
export function useSellBeds() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      beds: { bed_id: string; monthly_rent: number }[]
      tenantName: string
      tenantPhone?: string
      moveInDate: string
      leadId?: string
      soldBy?: string
    }) => {
      for (const bed of input.beds) {
        const { data: claimed, error: claimError } = await db
          .from('beds')
          .update({ status: 'occupied', vacant_since: null })
          .eq('id', bed.bed_id)
          .eq('status', 'vacant')
          .select('id')
        if (claimError) throw new Error(claimError.message)
        if (!claimed?.length) throw new Error('That bed was already sold. Refresh and try again.')

        const { error } = await db.from('tenancies').insert({
          bed_id: bed.bed_id,
          tenant_name: input.tenantName,
          tenant_phone: input.tenantPhone || null,
          move_in_date: input.moveInDate,
          monthly_rent: bed.monthly_rent,
          status: 'active',
        })
        if (error) {
          // Put the bed back rather than leave it occupied with no tenant.
          await db.from('beds').update({ status: 'vacant', vacant_since: today() }).eq('id', bed.bed_id)
          throw new Error(error.message)
        }
      }

      if (input.leadId) {
        await db
          .from('leads')
          .update({ stage: 'booked', last_contacted_at: new Date().toISOString() })
          .eq('id', input.leadId)
        await db.from('activities').insert({
          lead_id: input.leadId,
          type: 'stage_change',
          outcome: 'booked',
          notes: `Booked ${input.beds.length === 1 ? 'a bed' : `${input.beds.length} beds`}, moving in ${input.moveInDate}`,
          created_by: input.soldBy ?? 'Owner',
        })
      }
    },
    onSuccess: () => invalidateInventory(qc),
  })
}

/** The tenant has left: end their tenancy and put the bed back on sale from today. */
export function useMarkBedVacant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (bedId: string) => {
      const { error: tErr } = await db
        .from('tenancies')
        .update({ status: 'ended', actual_move_out_date: today() })
        .eq('bed_id', bedId)
        .in('status', ['active', 'notice_period'])
      if (tErr) throw new Error(tErr.message)

      const { error } = await db
        .from('beds')
        .update({ status: 'vacant', vacant_since: today() })
        .eq('id', bedId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => invalidateInventory(qc),
  })
}

// ---------------------------------------------------------------------------
// Derived numbers
// ---------------------------------------------------------------------------

export interface OccupancyStats {
  totalBeds: number
  occupiedBeds: number
  vacantBeds: number
  occupancyPct: number
  revenueAtRisk: number
  /** Rupees of rent per month tied up in beds nobody is paying for. */
  monthlyRentIdle: number
  avgDaysVacant: number
  bedsOnNotice: number
}

export function computeStats(beds: BedAvailability[]): OccupancyStats {
  const total = beds.length
  const vacant = beds.filter((b) => b.status === 'vacant')
  const occupied = total - vacant.length
  const revenueAtRisk = beds.reduce((s, b) => s + Number(b.revenue_lost ?? 0), 0)
  const monthlyRentIdle = vacant.reduce((s, b) => s + Number(b.monthly_rent), 0)
  const avgDaysVacant = vacant.length
    ? vacant.reduce((s, b) => s + b.days_vacant, 0) / vacant.length
    : 0
  const bedsOnNotice = beds.filter(
    (b) => b.status === 'occupied' && b.expected_move_out_date !== null,
  ).length

  return {
    totalBeds: total,
    occupiedBeds: occupied,
    vacantBeds: vacant.length,
    occupancyPct: total ? (occupied / total) * 100 : 0,
    revenueAtRisk,
    monthlyRentIdle,
    avgDaysVacant,
    bedsOnNotice,
  }
}
