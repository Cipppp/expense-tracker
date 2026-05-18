# Expense Tracker

A personal expense tracker for a Romanian micro-enterprise. Replaces the Google
Sheets + Apps Script setup with a typed, deployable web app.

- **Stack**: Next.js 15 (App Router) · TypeScript · Tailwind · shadcn/ui ·
  Prisma · SQLite (dev) / Postgres (prod) · Recharts · iron-session
- **Domain logic**: Romanian micro-enterprise tax math (BS+BAS, CAM, impozit
  micro, dividende), RON↔USD conversion, Revolut CSV import with twin-safe
  dedup, keyword-based category tagging.
- **Auth**: single-user password gate via iron-session cookies.

## Quick start

```bash
npm install
npm run db:push     # create / migrate schema
npm run db:seed     # default tax config + default category rules
npm run dev         # http://localhost:3000

# Default password (set in .env): cefani
```

Then drop one or more Revolut CSVs onto the **Import** page.

## Project layout

```
src/
  app/
    (authed)/             ← protected pages (Dashboard, Expenses, Income, Import, Settings)
    api/                  ← route handlers: import, income, settings, auth
    login/                ← unauthenticated login page
  components/
    ui/                   ← shadcn/ui primitives
    dashboard/            ← summary cards, monthly chart, top merchants, tax breakdown
    expenses/             ← month filter
    income/               ← income form (hourly / lump-sum)
    settings/             ← tax & FX form
    import/               ← drag-and-drop dropzone
    app-shell.tsx         ← sidebar + mobile nav
  lib/
    db.ts                 ← Prisma client (singleton)
    csv.ts                ← Revolut CSV parser
    import.ts             ← three-pass dedup + categorize + write
    categorizer.ts        ← keyword → category rules
    tax.ts                ← BS+BAS / CAM / micro / dividende math
    format.ts             ← money + date formatters (RON in bani, USD in cents)
    queries.ts            ← server-only data access (RSC)
    session.ts            ← iron-session config
  middleware.ts           ← redirect unauthed requests to /login
prisma/
  schema.prisma           ← Expense, Income, Job, Settings, ImportBatch, CategoryRule
  seed.ts                 ← initial settings + category rules
```

## Money representation

All money is stored as **integers in minor units** — RON bani (1/100 RON), USD
cents — to avoid floating-point drift. Conversion happens at display time via
`fmtRon` / `fmtUsd` in `src/lib/format.ts`.

## Dedup (Revolut imports)

Three passes in `src/lib/import.ts`:

1. **Within-CSV exact duplicates** — keyed on `sortKey|desc|amount`. Skipped.
2. **Twin transactions** (e.g. two Wolt orders one minute apart) — preserved by
   their distinct `sortKey`.
3. **Cross-import duplicates** — count-based: for each
   `day|description|amount`, only insert when batch count exceeds existing DB
   count. The same statement re-uploaded results in 0 inserts.

## Deploying to Vercel

The dev setup uses SQLite at `prisma/dev.db`. Vercel's filesystem is ephemeral
so production needs a real Postgres. Free options: **Neon**, **Supabase**,
**Vercel Postgres**.

### 1. Provision Postgres

Create a free Neon project → copy the `DATABASE_URL` (it looks like
`postgresql://user:pass@host/db?sslmode=require`).

### 2. Switch Prisma provider

```diff
// prisma/schema.prisma
 datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
 }
```

### 3. Push schema + seed

```bash
DATABASE_URL="postgresql://…" npx prisma db push
DATABASE_URL="postgresql://…" npm run db:seed
```

### 4. Push to GitHub

```bash
git add .
git commit -m "init expense tracker app"
git push
```

### 5. Import to Vercel

- New Project → Import the GitHub repo
- Framework preset: **Next.js** (auto-detected)
- Env vars:
  - `DATABASE_URL` — your Neon/Supabase Postgres URL
  - `SESSION_SECRET` — a 32+ character random string
    (`openssl rand -hex 32`)
  - `ACCESS_PASSWORD` — your chosen access password
- Deploy.

That's it. The first build runs `prisma generate` then `next build`.

### Security notes for production

- `ACCESS_PASSWORD` is a single-user gate. Use a long, random value.
- `SESSION_SECRET` signs the auth cookie — rotate it to force re-login.
- Cookies are `secure` + `httpOnly` + `sameSite=lax` in production.
- All API routes pass through `middleware.ts`, which redirects unauthed
  requests to `/login`.
- For stronger auth (magic link, OAuth), swap iron-session for NextAuth.js.

## Differences vs the Apps Script setup

| Old (Sheets + Apps Script)                 | New (Next.js + DB)                              |
|--------------------------------------------|-------------------------------------------------|
| Auto-import every 1 min from Drive folder  | Drag-and-drop in browser (or POST to `/api/import` from a CRON) |
| Monthly tabs (Apr 2026, May 2026, …)        | One `expenses` table, filtered by month in UI   |
| `forceReimportAprMay` to wipe + reload     | Re-import is idempotent — same CSV → 0 inserts  |
| Conditional formatting for >50 RON/day     | Per-row red highlight when daily total > threshold (configurable) |
| TOP 5 via QUERY formula                    | SQL `GROUP BY merchant` in `getTopMerchants`   |
| Tax math in Dashboard L9:U20 formulas      | `src/lib/tax.ts` (pure TS, unit-testable)      |
| Romanian comments in Code.gs               | English comments + Romanian labels in UI       |

## Importing the Google Drive auto-pipeline (optional)

If you want to keep auto-import from your existing Drive folder, change the
Apps Script trigger to POST the CSV body to `https://your-app.vercel.app/api/import`:

```javascript
// in Code.gs
function postToVercel(filename, text) {
  const blob = Utilities.newBlob(text, "text/csv", filename);
  UrlFetchApp.fetch("https://your-app.vercel.app/api/import", {
    method: "post",
    payload: { file: blob },
    headers: { "Cookie": `et_session=${PROPS.getProperty("ET_SESSION")}` },
  });
}
```

(You'd need to either disable middleware for `/api/import` with an API key, or
log in once from Apps Script and cache the cookie.)
