# Gharpayy Occupancy Engine

An assignment submission for Gharpayy, built on top of
[`Gharpayytechy/a3x-gg`](https://github.com/Gharpayytechy/a3x-gg).

**Live:** https://gharpayy-occupancy-engine.vercel.app

---

## What the brief asked for

> *Host & understand our Lead Management CRM MVP. Activate 3 Modules of your
> choice & 2 new ideas. Ensure it's live, usable, and scalable with some
> backend.*

## What I found first

I spent the first hour reading the repo rather than writing code:

| | |
|---|---|
| Routes | 96 |
| TS/TSX files | 780 |
| Supabase migrations | 1 (creating a single `call_records` table) |
| `drizzle/schema.ts` | *"auto-generated and intentionally left blank"* |
| Files touching Supabase | 46 of 780 |

It's a well-built UI shell with almost no backend underneath it: most screens
render mock or randomised data. Their own README says *"remove Property Command
Center random data."*

That's what I took **"with some backend"** to mean, and it set the strategy:
**don't activate 96 half-working routes; make five of them real, end to end.**

Two other things worth flagging:

- **The original repo commits `.env`**, with live Supabase credentials, to a
  public repository. I didn't use them: this project runs against its own
  Supabase project, and `.env` is gitignored here with a `.env.example` in its
  place. The old keys should still be rotated, since removing the file doesn't
  remove it from git history.
- **The build runs out of memory on a default Node heap.** Rollup needs
  `NODE_OPTIONS=--max-old-space-size=8192` to bundle 780 files, otherwise it
  dies with `FATAL ERROR: JavaScript heap out of memory`.

---

## The idea

> **Gharpayy doesn't sell leads. It sells bed-nights, and a bed-night is the
> most perishable inventory there is.**

An empty bed last night can never be sold again. It's an airline seat after
takeoff. Airlines and hotels built an entire discipline around that fact forty
years ago; PG operators still run on lead lists.

So this isn't a lead CRM. It's an **occupancy engine**, and its home screen
isn't "how many leads this month". It's **how many rupees are leaking right
now, which beds, and who can fill each one.**

---

## What's built

### 3 modules activated

| Module | Route | What's real about it |
|---|---|---|
| **Lead Pipeline** | `/occupancy/pipeline` | 150 leads from Postgres, live funnel counts, search and stage filters. Stage changes persist and write an audit row. |
| **Bed Inventory** | `/occupancy/inventory` | Property → room → bed, sorted worst-occupancy-first, with live availability and rent missed per property. |
| **Follow-ups** | `/occupancy/rescue` | Real tasks you can complete, plus a ranked Rescue List of who to call today. |

### 2 new ideas

**1. The Match Engine, and it runs in both directions**

A scoring function (0 to 100) over budget, locality, availability and sharing
type. Gender, and rent more than 10% over budget, are hard filters rather than
scores. Plain arithmetic, not AI, deliberately: every point has to be
explainable to a customer on a phone call.

- `/occupancy/lead/:id` → the best beds for this lead *(what every CRM does)*
- `/occupancy/bed/:id` → **the best leads for this bed** *(what almost none do)*

The reverse direction is the useful one and nobody builds it, because if you
model the product as a *lead* CRM the lead is always the starting point.

**2. Vacancy Radar + Revenue at Risk**

`/occupancy` and `/occupancy/radar`.

Revenue at Risk (on screen, "Money lost to empty beds") is
`(monthly_rent / 30) × days_vacant`, summed across every empty bed and computed
in Postgres rather than the browser.

The Radar is the part I care about more: **a bed becomes sellable inventory the
moment a tenant gives notice, not the day it empties.** So it shows a 60-day
forward view of beds about to open up, each already pre-matched to waiting
leads. As an illustration: if around 40 beds turn over a month, cutting the
empty gap from 20 days to 2 at about ₹300 a bed-night recovers roughly
₹2.2L a month. The real figure depends on actual turnover and rents.

### The Rescue List scoring

Leads are lost to silence rather than refusals, but silence alone is a poor
signal: two quiet days mean nothing for someone moving in three months and
everything for someone moving in five days. Each active lead scores out of 100
as **urgency (up to 55) + silence (up to 35, capped at two weeks) + pipeline
stage (up to 10)**. Leads silent for three weeks with no move-in inside that
window are grouped as *gone cold* rather than critical.

The first version multiplied those factors. On the seeded data that marked 62
of 123 active leads critical, 46 of them tied at 100, because ten days of
silence alone reached the threshold whatever the move-in date. Adding the parts
keeps urgency in charge: 20 critical, 38 warm, 56 fine, 9 gone cold.

---

## Design

- **Gharpayy's brand, not the repo's theme.** The existing app is themed
  orange; gharpayy.com uses blue `#0943a0` and yellow `#f4c024`. The app is
  re-themed to match, with yellow for call-to-action buttons as on the site.
  Red, green and amber are reserved for meaning: loss, good, warning.
- **Light and dark mode**, switched from the header and remembered between
  visits. Colours on the new screens are tokens with a value for each mode.
- **Every number is real.** Nothing on screen is decorative data; where a
  figure would need history the database doesn't hold, it isn't shown.
- **Checked at eight widths**, 320px to 1920px, with a script that measures
  every text box on every screen and flags overlaps or sideways scrolling.
  All seven screens pass at all eight widths.
- **Demo data is labelled** on every screen: the properties and leads are
  generated, the backend is live.

---

## The backend

Seven tables, indexed on the columns the availability view and screens query by:

```
properties ──< rooms ──< beds ──< tenancies
leads ──< activities
leads ──< tasks
```

`supabase/migrations/0001_occupancy_engine.sql`: schema, indexes (including a
GIN index on the preferred-localities array), RLS on all seven tables, and a
`bed_availability` view that computes `available_from`, `days_vacant` and
`revenue_lost` in SQL.

`supabase/migrations/0002_seed_demo_data.sql`: 8 properties, roughly 100 to 130
beds (the layout is randomised), 150 leads, tenancies, activity history and tasks. All dated relative to
`current_date`, so the demo never goes stale.

**The key modelling decision:** the unit of inventory is a **bed**, not a
property or a room. You cannot answer "what's actually available on the 5th?"
from property-level data.

**On scale:** the expensive facts (which beds are free, from when, for how long,
and what they have cost) are computed in Postgres over indexed columns, so they
don't grow with how much the browser has loaded. Match scoring currently runs in
the browser over those rows, which is fine at this size. At a few thousand beds
it would move into the database, for example as a view refreshed when a bed or
lead changes.

---

## Running it

```bash
npm install
cp .env.example .env    # then fill in your own Supabase URL + anon key
npm run dev
```

Then run both files in `supabase/migrations/` in the Supabase SQL editor, in
order.

Building needs a larger heap:

```bash
NODE_OPTIONS=--max-old-space-size=8192 npm run build
```

---

## What I'd build next

**WhatsApp ingestion.** Every lead in this market actually arrives on WhatsApp,
and that context currently lives in a salesperson's personal phone. Parse those
threads into `activities` automatically and the CRM stops depending on people
remembering to log things, which they never do.

After that: real auth with RLS scoped to staff roles (the policies are the only
thing that needs to change, since RLS is already on), and code-splitting the route
tree so the build no longer needs a raised memory limit.

---

## Honest notes

- Built fast, with modern tooling. The work that mattered wasn't typing speed:
  it was deciding what *not* to build, and modelling beds as the unit of
  inventory.
- The other ~91 routes are untouched and still on mock data. That was
  deliberate, not unfinished.
- Auth is not wired up: RLS policies are currently open for the demo. That's
  the first thing I'd close.

_Original project README preserved as `README-original.md`._
