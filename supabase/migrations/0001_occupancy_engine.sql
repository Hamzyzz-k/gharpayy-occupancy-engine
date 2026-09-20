-- ============================================================================
-- Gharpayy Occupancy Engine — core schema
-- ============================================================================
-- The unit of inventory is a BED, not a property and not a room.
-- Everything else hangs off that decision.
--
-- properties ──< rooms ──< beds ──< tenancies
-- leads ──< activities
-- leads ──< tasks
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Inventory side: what we sell
-- ---------------------------------------------------------------------------

create table if not exists public.properties (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  locality    text        not null,           -- 'Koramangala', 'HSR Layout', ...
  address     text,
  city        text        not null default 'Bengaluru',
  created_at  timestamptz not null default now()
);

create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  room_number  text not null,
  floor        int,
  sharing_type text not null check (sharing_type in ('single','double','triple','quad')),
  gender       text not null check (gender in ('male','female','unisex')),
  created_at   timestamptz not null default now(),
  unique (property_id, room_number)
);

create table if not exists public.beds (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  bed_label    text not null,                 -- 'A', 'B', 'C'
  monthly_rent numeric(10,2) not null check (monthly_rent > 0),
  status       text not null default 'vacant'
               check (status in ('vacant','occupied','blocked')),
  -- the day this bed became empty. Drives Revenue at Risk.
  vacant_since date,
  created_at   timestamptz not null default now(),
  unique (room_id, bed_label)
);

-- A tenancy links a bed to a person over a period of time.
-- The moment notice_given_date is set, that bed becomes FUTURE INVENTORY —
-- which is the whole basis of the Vacancy Radar.
create table if not exists public.tenancies (
  id                     uuid primary key default gen_random_uuid(),
  bed_id                 uuid not null references public.beds(id) on delete cascade,
  tenant_name            text not null,
  tenant_phone           text,
  move_in_date           date not null,
  notice_given_date      date,
  expected_move_out_date date,
  actual_move_out_date   date,
  monthly_rent           numeric(10,2) not null,
  status                 text not null default 'active'
                         check (status in ('active','notice_period','ended')),
  created_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Demand side: who might buy
-- ---------------------------------------------------------------------------

create table if not exists public.leads (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  phone                text,
  email                text,
  gender               text check (gender in ('male','female')),
  budget_max           numeric(10,2),
  preferred_localities text[] default '{}',
  preferred_sharing    text check (preferred_sharing in ('single','double','triple','quad','any')),
  move_in_date         date,
  source               text check (source in ('housing','nobroker','instagram','walkin','referral','website','other')),
  stage                text not null default 'new'
                       check (stage in ('new','contacted','visit_scheduled','visited','negotiation','booked','moved_in','lost')),
  owner_name           text,                  -- assigned salesperson
  last_contacted_at    timestamptz,
  lost_reason          text,
  notes                text,
  created_at           timestamptz not null default now()
);

create table if not exists public.activities (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id) on delete cascade,
  type       text not null check (type in ('call','whatsapp','email','visit','note','stage_change')),
  outcome    text,                             -- 'connected', 'no_answer', ...
  notes      text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.leads(id) on delete cascade,
  title        text not null,
  due_at       timestamptz not null,
  status       text not null default 'open' check (status in ('open','done','snoozed')),
  assigned_to  text,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes — on exactly the columns the Match Engine filters by
-- ---------------------------------------------------------------------------

create index if not exists idx_rooms_property      on public.rooms(property_id);
create index if not exists idx_rooms_gender        on public.rooms(gender);
create index if not exists idx_beds_room           on public.beds(room_id);
create index if not exists idx_beds_status         on public.beds(status);
create index if not exists idx_beds_rent           on public.beds(monthly_rent);
create index if not exists idx_tenancies_bed       on public.tenancies(bed_id);
create index if not exists idx_tenancies_status    on public.tenancies(status);
create index if not exists idx_tenancies_moveout   on public.tenancies(expected_move_out_date);
create index if not exists idx_leads_stage         on public.leads(stage);
create index if not exists idx_leads_movein        on public.leads(move_in_date);
create index if not exists idx_leads_contacted     on public.leads(last_contacted_at);
create index if not exists idx_leads_localities    on public.leads using gin(preferred_localities);
create index if not exists idx_activities_lead     on public.activities(lead_id, created_at desc);
create index if not exists idx_tasks_lead          on public.tasks(lead_id);
create index if not exists idx_tasks_due           on public.tasks(due_at) where status = 'open';

-- ---------------------------------------------------------------------------
-- bed_availability — one flat view joining the inventory chain.
--
-- available_from answers "when can somebody actually move into this bed?"
--   vacant now            -> today
--   notice given          -> their expected move-out date   <-- future inventory
--   occupied, no notice   -> null (not sellable)
-- ---------------------------------------------------------------------------

create or replace view public.bed_availability as
select
  b.id                as bed_id,
  b.bed_label,
  b.monthly_rent,
  b.status,
  b.vacant_since,
  r.id                as room_id,
  r.room_number,
  r.sharing_type,
  r.gender,
  p.id                as property_id,
  p.name              as property_name,
  p.locality,
  t.tenant_name       as current_tenant,
  t.expected_move_out_date,
  case
    when b.status = 'vacant'        then current_date
    when t.status = 'notice_period' then t.expected_move_out_date
    else null
  end                 as available_from,
  case
    when b.status = 'vacant' and b.vacant_since is not null
      then (current_date - b.vacant_since)
    else 0
  end                 as days_vacant,
  -- Revenue at Risk: daily rent x days empty
  case
    when b.status = 'vacant' and b.vacant_since is not null
      then round((b.monthly_rent / 30.0) * (current_date - b.vacant_since), 2)
    else 0
  end                 as revenue_lost
from public.beds b
join public.rooms r      on r.id = b.room_id
join public.properties p on p.id = r.property_id
left join public.tenancies t
       on t.bed_id = b.id
      and t.status in ('active','notice_period');

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- This is a demo with no auth, so anon gets full access. Real deployment would
-- scope these to an authenticated staff role — that's the honest next step, and
-- enabling RLS now means the policies are the only thing that has to change.
-- ---------------------------------------------------------------------------

alter table public.properties enable row level security;
alter table public.rooms      enable row level security;
alter table public.beds       enable row level security;
alter table public.tenancies  enable row level security;
alter table public.leads      enable row level security;
alter table public.activities enable row level security;
alter table public.tasks      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['properties','rooms','beds','tenancies','leads','activities','tasks']
  loop
    execute format(
      'drop policy if exists demo_all on public.%I; '
      'create policy demo_all on public.%I for all using (true) with check (true);',
      t, t
    );
  end loop;
end $$;
