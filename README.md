# Sliv Staff Attendance & Wage App

An internal web app for a small multi-location retail business. Staff log
daily shift/sales data through a simple form; the owner manages employees,
stores, and records through a password-protected admin panel.

## Stack

- **Framework:** Next.js (App Router)
- **Database:** PostgreSQL
- **ORM:** Prisma (v7, requires an explicit driver adapter — `@prisma/adapter-pg`)
- **Hosting:** Railway (app service + Postgres service, in one project)

## Project structure

```
prisma/
  schema.prisma       — database schema (source of truth for table structure)
  seed.ts             — idempotent seed script for test/demo data
src/
  app/
    page.tsx           — staff-facing form (server component)
    StaffForm.tsx       — two-step client form: edit → confirm → success
    actions.ts          — server action: re-validates and recomputes
                           everything server-side on submit
    admin/               — admin panel routes (auth-gated)
    admin/export/        — CSV export route handler
  lib/
    prisma.ts            — shared Prisma client singleton
    calculations.ts       — pure wage/commission math, shared by form + tests
    date-utils.ts          — UTC-safe date/time helpers (see note below)
    auth.ts                — admin session/auth logic
    records.ts              — shared filter logic for records table + CSV export
    nager.ts                 — fetches NSW public holidays from the Nager.Date API
    holiday-sync.ts           — sync algorithm: auto vs. manual holiday entries
```

## Data model

Four tables: `employees`, `stores`, `submissions`, `public_holidays`.

- `employees` and `stores` use a soft-delete pattern (`active` boolean, no
  delete path in code) so historical submissions always resolve to the
  correct name, even after someone leaves or a store closes.
- `public_holidays` supports both auto-synced (`source: "auto"`) and
  manually-entered (`source: "manual"`) rows. Manual entries always take
  priority over auto-sync. Unlike employees/stores, holidays *can* be
  hard-deleted — safe because submissions snapshot their own `day_type` and
  `public_holiday` status at submission time, rather than looking it up live.
- Money fields use Prisma's `Decimal` type, not floats, to avoid rounding
  drift across many calculations.

## Wage calculation logic

```
total_sales = eftpos_amount + cash_amount
commission = MAX(0, total_sales - store.commission_threshold) * store.commission_rate

rate_multiplier (highest applicable, not stacked):
  public_holiday -> 1.5
  Sunday          -> 1.5
  Saturday        -> 1.25
  weekday         -> 1.0

wage_from_hours = base_hourly_wage * rate_multiplier * hours_worked
total_wage = wage_from_hours + commission + extra_commission + transport_fee
```

All of this is recomputed **server-side on submit**, independent of
anything shown in the live client-side preview — the server never trusts
client-sent totals.

## Important implementation details

- **Timezones:** `date` is a date-only column, `clock_in`/`clock_out` are
  time-only, both timezone-naive. Always read/format these using UTC-safe
  methods (`getUTCHours`, `toISOString`, `Intl.DateTimeFormat` with an
  explicit `timeZone`) — never local-timezone methods like `.getHours()`,
  which will silently return wrong values depending on the host server's
  timezone.
- **Public holiday sync:** calls `date.nager.at`, filtered to holidays that
  are global or apply to subdivision `AU-NSW`. Uses the API's `localName`
  field, not `name` (the international label), since the NSW/Australian
  convention differs — e.g. Boxing Day, not "St. Stephen's Day."
- **Admin auth:** single shared password (`ADMIN_PASSWORD` env var), checked
  with a timing-safe comparison, backed by an HMAC-signed session cookie
  (httpOnly, 12-hour expiry) — no sessions table. Rotating `ADMIN_PASSWORD`
  instantly invalidates all existing sessions. Login attempts are
  rate-limited (10 per 15 min per IP, in-memory — resets on redeploy).
- Every admin mutation/query re-checks the session server-side inside the
  action/route itself, not just at the page level.

## Local development setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — use Railway's **public** Postgres URL for local dev
     (Settings → Networking → enable the TCP proxy on the Postgres service
     if it's not already on; get the resolved value via
     `railway variables --service Postgres --kv`)
   - `ADMIN_PASSWORD` — any value for local testing
3. `npx prisma generate`
4. `npm run dev` — runs at `http://localhost:3000`

## Migrations

- **Local development:** `npx prisma migrate dev` — creates and applies a
  new migration against whatever `DATABASE_URL` is currently set to.
- **Production (Railway):** migrations run automatically via
  `prisma migrate deploy`, configured as Railway's release command on the
  app service. This runs inside Railway's private network using the
  internal `postgres.railway.internal` address — no public database access
  needed for deploys.
- The very first migration was applied manually via raw SQL while working
  around an early connectivity issue, then reconciled with
  `prisma migrate resolve --applied`. All migrations since are managed
  normally through Prisma.

## Deployment

Connected to Railway via GitHub — every push to `main` triggers an
automatic build and deploy. See the separate handover document for
environment variable setup and ownership details.

## Testing approach

No automated CI test suite yet (documented gap — see handover doc). Testing
so far has been scenario-based: running real server logic against
deliberately chosen edge cases (day-type boundaries, commission threshold
edges, overnight shifts, expired/tampered auth cookies, stale vs. manual
holiday entries) using a disposable local Postgres instance, plus manual
browser verification of at least one real calculation per feature before
considering it done.