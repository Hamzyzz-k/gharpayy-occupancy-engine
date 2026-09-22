-- ============================================================================
-- Seed data — a realistic Monday morning for a Bangalore PG operator
-- ============================================================================
-- Everything is relative to current_date, so the demo never goes stale.
--
-- Deliberately seeded to make the story visible:
--   * some beds empty for a LONG time  -> Revenue at Risk hurts
--   * some tenants on notice period    -> Vacancy Radar has content
--   * some leads gone cold with a soon -> Rescue List has real emergencies
--     move-in date
-- ============================================================================

truncate table public.activities, public.tasks, public.tenancies,
               public.beds, public.rooms, public.leads, public.properties
               restart identity cascade;

-- ---------------------------------------------------------------------------
-- Properties
-- ---------------------------------------------------------------------------

insert into public.properties (name, locality, address) values
  ('Gharpayy Koramangala 5th Block', 'Koramangala',   '#42, 5th Block, Koramangala'),
  ('Gharpayy HSR Sector 2',          'HSR Layout',    '#18, 14th Main, Sector 2, HSR'),
  ('Gharpayy HSR Sector 7',          'HSR Layout',    '#91, 27th Main, Sector 7, HSR'),
  ('Gharpayy BTM 2nd Stage',         'BTM Layout',    '#7, 16th Main, BTM 2nd Stage'),
  ('Gharpayy Marathahalli Bridge',   'Marathahalli',  '#203, Outer Ring Road, Marathahalli'),
  ('Gharpayy Indiranagar 12th Main', 'Indiranagar',   '#66, 12th Main, Indiranagar'),
  ('Gharpayy Electronic City P1',    'Electronic City','#12, Phase 1, Electronic City'),
  ('Gharpayy Whitefield ITPL',       'Whitefield',    '#88, ITPL Main Road, Whitefield');

-- ---------------------------------------------------------------------------
-- Rooms + beds
--
-- Rent scales with locality (Indiranagar/Koramangala expensive, EC cheap) and
-- inversely with sharing (single costs more than triple).
-- ---------------------------------------------------------------------------

do $$
declare
  p            record;
  room_idx     int;
  n_rooms      int;
  v_sharing    text;
  v_gender     text;
  v_floor      int;
  v_room_id    uuid;
  bed_count    int;
  b            int;
  base_rent    numeric;
  v_rent       numeric;
  locality_mul numeric;
begin
  for p in select * from public.properties loop

    locality_mul := case p.locality
      when 'Indiranagar'     then 1.30
      when 'Koramangala'     then 1.25
      when 'HSR Layout'      then 1.15
      when 'Whitefield'      then 1.00
      when 'BTM Layout'      then 0.95
      when 'Marathahalli'    then 0.92
      when 'Electronic City' then 0.85
      else 1.00
    end;

    n_rooms := 5 + floor(random() * 3)::int;   -- 5-7 rooms per property

    for room_idx in 1..n_rooms loop
      v_floor   := 1 + ((room_idx - 1) / 3);
      v_sharing := (array['single','double','triple','triple','double'])[1 + floor(random() * 5)::int];
      -- most properties are male-dominant, which matches the real market
      v_gender  := case when random() < 0.62 then 'male' else 'female' end;

      base_rent := case v_sharing
        when 'single' then 16000
        when 'double' then 11500
        when 'triple' then 8800
        else 7500
      end;
      v_rent := round((base_rent * locality_mul) / 100.0) * 100;

      insert into public.rooms (property_id, room_number, floor, sharing_type, gender)
      values (p.id, (v_floor * 100 + room_idx)::text, v_floor, v_sharing, v_gender)
      returning id into v_room_id;

      bed_count := case v_sharing
        when 'single' then 1 when 'double' then 2 when 'triple' then 3 else 4
      end;

      for b in 1..bed_count loop
        insert into public.beds (room_id, bed_label, monthly_rent, status)
        values (v_room_id, chr(64 + b), v_rent, 'occupied');
      end loop;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Occupancy: fill most beds, empty some, put some on notice
-- ---------------------------------------------------------------------------

do $$
declare
  -- Split by gender so a tenant's name matches the room they're in.
  male_names   text[] := array[
    'Rahul','Arun','Karthik','Vikram','Rohit','Aditya','Nikhil','Sanjay',
    'Varun','Manish','Siddharth','Harsh','Akash','Gaurav','Abhishek'];
  female_names text[] := array[
    'Priya','Neha','Sneha','Ananya','Divya','Shreya','Meera','Pooja',
    'Kavya','Ritu','Aishwarya','Tanvi','Swati','Nandini','Isha'];
  last_names  text[] := array[
    'Sharma','Reddy','Nair','Iyer','Gupta','Patel','Kumar','Rao','Singh','Menon',
    'Desai','Joshi','Bhat','Pillai','Verma','Agarwal','Shetty','Mishra'];
  bd            record;
  roll          numeric;
  v_move_in     date;
  v_notice      date;
  v_moveout     date;
  v_vacant_days int;
  v_name        text;
begin
  for bd in
    select b.id, b.monthly_rent, r.gender
    from public.beds b join public.rooms r on r.id = b.room_id
  loop
    roll   := random();
    v_name := case when bd.gender = 'female'
                then female_names[1 + floor(random() * array_length(female_names,1))::int]
                else male_names[1 + floor(random() * array_length(male_names,1))::int]
              end
              || ' ' ||
              last_names[1 + floor(random() * array_length(last_names,1))::int];

    if roll < 0.13 then
      -- ~13% vacant. Spread the vacancy age so Revenue at Risk has a long tail.
      v_vacant_days := 2 + floor(random() * 46)::int;   -- 2-47 days empty
      update public.beds
         set status = 'vacant',
             vacant_since = current_date - v_vacant_days
       where id = bd.id;

    elsif roll < 0.24 then
      -- ~11% on notice period -> these power the Vacancy Radar
      v_move_in := current_date - (120 + floor(random() * 300))::int;
      v_notice  := current_date - floor(random() * 22)::int;
      v_moveout := v_notice + 30;
      update public.beds set status = 'occupied' where id = bd.id;
      insert into public.tenancies
        (bed_id, tenant_name, tenant_phone, move_in_date, notice_given_date,
         expected_move_out_date, monthly_rent, status)
      values
        (bd.id, v_name, '+9198' || lpad(floor(random()*10000000)::text, 7, '0'),
         v_move_in, v_notice, v_moveout, bd.monthly_rent, 'notice_period');

    else
      -- settled tenants
      v_move_in := current_date - (30 + floor(random() * 500))::int;
      update public.beds set status = 'occupied' where id = bd.id;
      insert into public.tenancies
        (bed_id, tenant_name, tenant_phone, move_in_date, monthly_rent, status)
      values
        (bd.id, v_name, '+9198' || lpad(floor(random()*10000000)::text, 7, '0'),
         v_move_in, bd.monthly_rent, 'active');
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------

do $$
declare
  -- Split by gender so a lead's name matches the gender the matcher filters on.
  male_names   text[] := array[
    'Aman','Rajat','Deepak','Kunal','Naveen','Yash','Sameer','Tarun','Imran',
    'Sahil','Ravi','Ajay','Vivek','Arjun','Rohan','Farhan','Dhruv','Aakash'];
  female_names text[] := array[
    'Sanya','Preeti','Anjali','Shruti','Ritika','Megha','Pallavi','Bhavya','Lakshmi',
    'Trisha','Sonal','Nisha','Garima','Pooja','Kriti','Simran','Payal','Juhi'];
  last_names  text[] := array[
    'Sharma','Reddy','Nair','Iyer','Gupta','Patel','Kumar','Rao','Singh','Menon',
    'Desai','Joshi','Bhat','Pillai','Verma','Agarwal','Shetty','Mishra','Khan','Das'];
  localities  text[] := array[
    'Koramangala','HSR Layout','BTM Layout','Marathahalli','Indiranagar',
    'Electronic City','Whitefield'];
  owners      text[] := array['Divyanshu','Sneha K','Rahul M','Aarti P'];
  sources     text[] := array['housing','nobroker','instagram','walkin','referral','website'];
  stages      text[] := array[
    'new','new','new','contacted','contacted','contacted','visit_scheduled',
    'visit_scheduled','visited','visited','negotiation','booked','moved_in','lost'];

  i           int;
  v_lead_id   uuid;
  v_stage     text;
  v_gender    text;
  v_budget    numeric;
  v_prefs     text[];
  v_created   timestamptz;
  v_contacted timestamptz;
  n_acts      int;
  a           int;
begin
  for i in 1..150 loop
    v_stage  := stages[1 + floor(random() * array_length(stages,1))::int];
    v_gender := case when random() < 0.6 then 'male' else 'female' end;
    v_budget := (round((7000 + random() * 11000) / 500.0) * 500)::numeric;

    -- 1-2 preferred localities
    v_prefs := array[ localities[1 + floor(random() * array_length(localities,1))::int] ];
    if random() < 0.45 then
      v_prefs := v_prefs || localities[1 + floor(random() * array_length(localities,1))::int];
    end if;

    v_created := now() - (random() * 45 || ' days')::interval;

    -- Deliberate: ~18% of leads have gone quiet for a week or more.
    -- Cross that with a soon move-in date and the Rescue List lights up red.
    if random() < 0.18 then
      v_contacted := v_created;                                    -- never followed up
    elsif v_stage = 'new' then
      v_contacted := null;
    else
      v_contacted := now() - (random() * 9 || ' days')::interval;
    end if;

    insert into public.leads
      (name, phone, email, gender, budget_max, preferred_localities, preferred_sharing,
       move_in_date, source, stage, owner_name, last_contacted_at, created_at, lost_reason)
    values (
      case when v_gender = 'female'
        then female_names[1 + floor(random() * array_length(female_names,1))::int]
        else male_names[1 + floor(random() * array_length(male_names,1))::int]
      end || ' ' ||
      last_names[1 + floor(random() * array_length(last_names,1))::int],
      '+9197' || lpad(floor(random()*10000000)::text, 7, '0'),
      null,
      v_gender,
      v_budget,
      v_prefs,
      (array['single','double','triple','any','any'])[1 + floor(random()*5)::int],
      current_date + (floor(random() * 55) - 5)::int,    -- some already overdue
      sources[1 + floor(random() * array_length(sources,1))::int],
      v_stage,
      owners[1 + floor(random() * array_length(owners,1))::int],
      v_contacted,
      v_created,
      case when v_stage = 'lost'
        then (array['went with competitor','budget mismatch','postponed move',
                    'no response','location too far'])[1 + floor(random()*5)::int]
        else null end
    )
    returning id into v_lead_id;

    -- Activity history so lead timelines aren't blank
    n_acts := case v_stage
      when 'new' then 0
      when 'contacted' then 1 + floor(random()*2)::int
      when 'lost' then 2 + floor(random()*3)::int
      else 2 + floor(random()*4)::int
    end;

    for a in 1..n_acts loop
      insert into public.activities (lead_id, type, outcome, notes, created_by, created_at)
      values (
        v_lead_id,
        (array['call','whatsapp','call','visit','note'])[1 + floor(random()*5)::int],
        (array['connected','no_answer','interested','callback_requested','not_reachable'])[1 + floor(random()*5)::int],
        (array['Shared options over WhatsApp',
               'Asked for photos of the room',
               'Will confirm after salary credit',
               'Wants to visit this weekend',
               'Budget slightly below our rate',
               'Comparing with another PG nearby'])[1 + floor(random()*6)::int],
        owners[1 + floor(random() * array_length(owners,1))::int],
        -- Somewhere between the lead arriving and now, never in the future.
        v_created + random() * (now() - v_created)
      );
    end loop;

    -- Open follow-up tasks, some already overdue
    if v_stage in ('contacted','visit_scheduled','visited','negotiation') and random() < 0.65 then
      insert into public.tasks (lead_id, title, due_at, status, assigned_to)
      values (
        v_lead_id,
        (array['Call back','Send room options','Confirm visit slot',
               'Share rent breakup','Follow up on token'])[1 + floor(random()*5)::int],
        now() + ((random() * 10 - 4) || ' days')::interval,
        'open',
        owners[1 + floor(random() * array_length(owners,1))::int]
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Sanity check — run this after seeding, the numbers should look like a real PG
-- ---------------------------------------------------------------------------
-- select
--   (select count(*) from properties)                                as properties,
--   (select count(*) from beds)                                      as beds,
--   (select count(*) from beds where status = 'vacant')               as vacant_beds,
--   (select count(*) from tenancies where status = 'notice_period')   as on_notice,
--   (select count(*) from leads)                                      as leads,
--   (select round(sum(revenue_lost)) from bed_availability)           as revenue_at_risk,
--   (select round(100.0 * count(*) filter (where status='occupied') / count(*), 1)
--      from beds)                                                     as occupancy_pct;
