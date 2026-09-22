/**
 * Occupancy Engine domain types.
 *
 * These mirror supabase/migrations/0001_occupancy_engine.sql.
 * The generated `integrations/supabase/types.ts` doesn't know about these
 * tables (it was generated against an empty schema), so we type them here
 * and cast the client in `db.ts` rather than editing a generated file.
 */

export type Gender = 'male' | 'female'
export type RoomGender = Gender | 'unisex'
export type SharingType = 'single' | 'double' | 'triple' | 'quad'
export type SharingPreference = SharingType | 'any'

export type LeadStage =
  | 'new'
  | 'contacted'
  | 'visit_scheduled'
  | 'visited'
  | 'negotiation'
  | 'booked'
  | 'moved_in'
  | 'lost'

export type LeadSource =
  | 'housing'
  | 'nobroker'
  | 'instagram'
  | 'walkin'
  | 'referral'
  | 'website'
  | 'other'

/** Ordered pipeline, used for the stage picker and funnel counts. */
export const LEAD_STAGES: LeadStage[] = [
  'new',
  'contacted',
  'visit_scheduled',
  'visited',
  'negotiation',
  'booked',
  'moved_in',
  'lost',
]

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  visit_scheduled: 'Visit scheduled',
  visited: 'Visited',
  negotiation: 'Negotiation',
  booked: 'Booked',
  moved_in: 'Moved in',
  lost: 'Lost',
}

export interface Lead {
  id: string
  name: string
  phone: string | null
  email: string | null
  gender: Gender | null
  budget_max: number | null
  preferred_localities: string[]
  preferred_sharing: SharingPreference | null
  move_in_date: string | null
  source: LeadSource | null
  stage: LeadStage
  owner_name: string | null
  last_contacted_at: string | null
  lost_reason: string | null
  notes: string | null
  created_at: string
}

export interface Property {
  id: string
  name: string
  locality: string
  address: string | null
  city: string
  created_at: string
}

export interface Activity {
  id: string
  lead_id: string
  type: 'call' | 'whatsapp' | 'email' | 'visit' | 'note' | 'stage_change'
  outcome: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface Task {
  id: string
  lead_id: string
  title: string
  due_at: string
  status: 'open' | 'done' | 'snoozed'
  assigned_to: string | null
  completed_at: string | null
  created_at: string
}

/**
 * A row of the `bed_availability` view: the flattened inventory chain
 * (property -> room -> bed) plus the computed availability + loss fields.
 */
export interface BedAvailability {
  bed_id: string
  bed_label: string
  monthly_rent: number
  status: 'vacant' | 'occupied' | 'blocked'
  vacant_since: string | null
  room_id: string
  room_number: string
  sharing_type: SharingType
  gender: RoomGender
  property_id: string
  property_name: string
  locality: string
  current_tenant: string | null
  expected_move_out_date: string | null
  /** When somebody could actually move in. null = not sellable. */
  available_from: string | null
  days_vacant: number
  /** Rupees already lost on this bed: (rent/30) * days_vacant */
  revenue_lost: number
}

/** An activity row with its lead's name joined in, for cross-lead feeds. */
export interface ActivityWithLead extends Activity {
  leads: { name: string } | null
}

/** A tenancy with the bed, room and property it belongs to. */
export interface Booking {
  id: string
  tenant_name: string
  move_in_date: string
  monthly_rent: number
  status: 'active' | 'notice_period' | 'ended'
  created_at: string
  beds: {
    bed_label: string
    rooms: { room_number: string; properties: { name: string } | null } | null
  } | null
}
