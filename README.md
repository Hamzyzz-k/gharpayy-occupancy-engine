# Gharpayy — Occupancy Engine

An assignment submission for Gharpayy, built on top of
[`Gharpayytechy/a3x-gg`](https://github.com/Gharpayytechy/a3x-gg).

**Live:** _(deployed URL)_

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

It's a well-built UI shell with almost no backend underneath it — most screens
render mock or randomised data. Their own README says *"remove Property Command
Center random data."*

That's what I took **"with some backend"** to mean, and it set the strategy:
**don't activate 96 half-working routes — make five of them real, end to end.**

Two other things worth flagging:

- **`.env` is committed to the public repo**, with live Supabase credentials.
  I didn't use them. This project runs against its own Supabase project, and
  `.env` is now gitignored here with a `.env.example` in its place.
- **The build runs out of memory on a default Node heap.** Rollup needs
  `NODE_OPTIONS=--max-old-space-size=8192` to bundle 780 files, otherwise it
  dies with `FATAL ERROR: JavaScript heap out of memory`.

---

## The idea

> **Gharpayy doesn't sell leads. It sells bed-nights — and a bed-night is the
> most perishable inventory there is.**

An empty bed last night can never be sold again. It's an airline seat after
takeoff. Airlines and hotels built an entire discipline around that fact forty
years ago; PG operators still run on lead lists.

So this isn't a lead CRM. It's an **occupancy engine**, and its home screen
isn't "how many leads this month" — it's **how many rupees are leaking right
now, which beds, and who can fill each one.**

---

## What's built

### 3 modules activated

| Module | Route | What's real about it |
|---|---|---|
| **Lead Pipeline** | `/occupancy/pipeline` | 150 leads from Postgres, live funnel counts, search and stage filters. Stage changes persist and write an audit row. |
| **Bed Inventory** | `/occupancy/inventory` | Property → room → bed, sorted worst-occupancy-first, with live availability and idle-rent per property. |
| **Follow-ups** | `/occupancy/rescue` | Real tasks you can complete, plus the ranked Rescue List. |

### 2 new ideas

**1. The Match Engine — and it runs in both directions**

A scoring function (0–100) over budget, locality, availability and sharing type,
with gender as a hard filter rather than a score. Plain arithmetic, not AI —
deliberately, because every point has to be explainable to a customer on a phone
call.

- `/occupancy/lead/:id` → the best beds for this lead *(what every CRM does)*
- `/occupancy/bed/:id` → **the best leads for this bed** *(what almost none do)*

The reverse direction is the useful one and nobody builds it, because if you
model the product as a *lead* CRM the lead is always the starting point.

**2. Vacancy Radar + Revenue at Risk**

`/occupancy` and `/occupancy/radar`.

Revenue at Risk is `(monthly_rent / 30) × days_vacant`, summed across every
empty bed — computed in Postgres, not the browser.

The Radar is the part I care about more: **a bed becomes sellable inventory the
moment a tenant gives notice, not the day it empties.** So it shows a 60-day
forward view of beds about to open up, each already pre-matched to waiting
leads. Closing a 20-day vacancy gap on ~40 beds a month is roughly ₹2.2L/month
recovered.

---

## The backend

Seven tables, indexed on exactly the columns the match engine filters by:

```
properties ──< rooms ──< beds ──< tenancies
leads ──< activities
leads ──< tasks
```

`supabase/migrations/0001_occupancy_engine.sql` — schema, indexes (including a
GIN index on the preferred-localities array), RLS on all seven tables, and a
`bed_availability` view that computes `available_from`, `days_vacant` and
`revenue_lost` in SQL.

`supabase/migrations/0002_seed_demo_data.sql` — 8 properties, ~120 beds, ~150
leads, tenancies, activity history and tasks. All dated relative to
`current_date`, so the demo never goes stale.

**The key modelling decision:** the unit of inventory is a **bed**, not a
property or a room. You cannot answer "what's actually available on the 5th?"
from property-level data.

**On scale:** matching runs as an indexed Postgres query rather than in the
browser, so it behaves the same at 120 beds or 12,000. If scoring grows heavier
it becomes a materialised view refreshed on bed/lead change rather than computed
per request.

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
remembering to log things — which they never do.

After that: real auth with RLS scoped to staff roles (the policies are the only
thing that needs to change — RLS is already on), and code-splitting the route
tree so the build stops needing 8GB.

---

## Honest notes

- Built fast, with modern tooling. The work that mattered wasn't typing speed —
  it was deciding what *not* to build, and modelling beds as the unit of
  inventory.
- The other ~91 routes are untouched and still on mock data. That was
  deliberate, not unfinished.
- Auth is not wired up — RLS policies are currently open for the demo. That's
  the first thing I'd close.

_Original project README preserved as `README-original.md`._
