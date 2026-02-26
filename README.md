# Stakk AI

Stakk AI is a Next.js trading workspace focused on account-scoped workflows: trade journaling, strategy/rule management, spot portfolio tracking, chart tracker automation, AI-assisted trade analysis, and admin operations (users, prompts, AI cost monitoring).

## Recent changes (2026-02-26)

- Journal frontend was componentized: large `/journal` UI sections were extracted into `components/journal/ui/*` (toolbar, summary cards, trades card, and modal components).
- Build/lint cleanup was completed:
  - Next.js config updated to use `serverExternalPackages` (instead of deprecated `experimental.serverComponentsExternalPackages`).
  - Existing ESLint warnings in app/components/lib files were resolved.
- Unused files were removed after dependency-graph verification and build validation:
  - Removed orphaned UI/components, unused service/repository files, and stale utility scripts/files.
  - Updated `tsconfig.json` includes to remove stale references.

## Feature map (UI routes)

- `/dashboard`: home metrics and summary widgets.
- `/journal`: create and manage trade entries.
- `/journals`: create/select/delete journals.
- `/strategies`: strategy CRUD and rule composition.
- `/portfolio`: spot portfolio summary, asset views, transactions.
- `/exit-strategy`: staged exit strategies and executions.
- `/trade-analyzer`: AI pre-trade analysis flow.
- `/chart-tracker`: tracker subscriptions and analysis history.
- `/add-coin`: coin price-structure management.
- `/profile`: display name + avatar management.
- `/admin/*`: admin console for prompts, users, and costs.

## Tech stack

- Frontend: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4.
- API layer: Next.js Route Handlers (`app/api/**/route.ts`).
- Auth/session: NextAuth credentials provider + JWT sessions.
- Validation: Zod.
- Database: MySQL + Prisma ORM.
- AI/automation: OpenAI SDK, `p-limit` worker concurrency.
- Storage/integrations: AWS S3, CoinGecko, Binance, CoinMarketCap.

## Canonical repository structure

```text
app/
  (app)/                 # authenticated app pages
  (auth)/                # login/register pages
  api/                   # canonical backend route handlers
components/              # UI and feature components
services/                # domain services (tracker, exit strategy, portfolio holdings, price structure)
lib/                     # auth, prisma, prompts, AI helpers, market clients, utilities
data/repositories/       # persistence-level portfolio repository helpers
prisma/
  schema.prisma
  migrations/
```

## Authentication and authorization model

- Login uses NextAuth credentials (`email` + `password`).
- Session/JWT are enriched with:
  - `session.user.id`
  - `session.user.isAdmin`
  - `session.accountId`
- Most domain data is account-scoped via `account_id`.

### Middleware behavior

`middleware.ts` currently enforces:

- Protected page routes: `/dashboard`, `/strategies`, `/journal`, `/chart-tracker`, `/profile`, `/portfolio`, `/admin`.
- Protected API routes: `/api/admin/*`, `/api/journal/*`, `/api/strategies/*`, `/api/tracker/*`, `/api/portfolio/*`.
- Admin gate for `/admin/*` and `/api/admin/*`.
- `POST /api/tracker/run` requires `x-cron-key` matching `CRON_SECRET` (or `NEXT_PUBLIC_DEV_CRON_SECRET` in non-production).
- In-memory rate limiting for selected POST routes (`/api/journal`, `/api/strategies`, `/api/billing` pattern list).

## Environment variables

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Yes | Prisma datasource | MySQL connection string. |
| `NEXTAUTH_URL` | Yes (prod), recommended local | NextAuth / `next.config.ts` | Canonical app URL for auth callbacks/session handling. |
| `NEXTAUTH_SECRET` | Yes (prod) | NextAuth runtime | JWT/session encryption secret. |
| `OPENAI_API_KEY` | Yes for AI features | `lib/ai-analyzer.ts` | OpenAI calls for chart/trade/price-structure analysis. |
| `CHART_ANALYZER_MODEL` | Optional | `lib/ai-analyzer.ts` | Override chart analysis model (default `gpt-4o-mini`). |
| `TRADE_ANALYZER_MODEL` | Optional | `lib/ai-analyzer.ts` | Override trade analyzer model (default `gpt-4o-mini`). |
| `PRICE_STRUCTURE_MODEL` | Optional | `lib/ai-analyzer.ts` | Override price-structure model (default `gpt-4o-mini`). |
| `CRON_SECRET` | Yes for scheduled tracker jobs | `middleware.ts`, `app/api/tracker/run/route.ts` | Secret expected in `x-cron-key`. |
| `NEXT_PUBLIC_DEV_CRON_SECRET` | Optional (dev only) | `middleware.ts`, `app/api/tracker/run/route.ts` | Alternate cron key for local/non-prod testing. |
| `CMC_API_KEY` | Optional but recommended | `app/api/assets/coins`, `app/api/journal/[id]` | CoinMarketCap lookup/symbol validation. |
| `COINGECKO_PRO` | Optional | `lib/markets/coingecko.ts` | Toggle CoinGecko Pro base URL/behavior (`"true"`/`"false"`). |
| `COINGECKO_API_KEY` | Optional (required when Pro mode is enabled) | `lib/markets/coingecko.ts` | CoinGecko API authentication. |
| `BINANCE_API_URL` | Optional | `lib/klines.ts` | Binance API base URL (default `https://api.binance.com`). |
| `AWS_REGION` | Yes for S3 features | `lib/s3.ts` | S3 region. |
| `S3_BUCKET` | Yes for S3 features | `lib/s3.ts` | S3 bucket name for uploads. |
| `AWS_ACCESS_KEY_ID` | Yes for S3 features | `lib/s3.ts` | AWS credential for uploads/signing. |
| `AWS_SECRET_ACCESS_KEY` | Yes for S3 features | `lib/s3.ts` | AWS credential secret. |
| `NODE_ENV` | Runtime-provided | multiple files | Controls prod/dev branches and safeguards. |

### Example `.env`

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/stakk_ai"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-long-random-secret"

OPENAI_API_KEY=""
CHART_ANALYZER_MODEL="gpt-4o-mini"
TRADE_ANALYZER_MODEL="gpt-4o-mini"
PRICE_STRUCTURE_MODEL="gpt-4o-mini"

CRON_SECRET="replace-me"
NEXT_PUBLIC_DEV_CRON_SECRET="dev-secret"

CMC_API_KEY=""
COINGECKO_PRO="false"
COINGECKO_API_KEY=""
BINANCE_API_URL="https://api.binance.com"

AWS_REGION="us-east-1"
S3_BUCKET=""
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
```

## Local setup and runbook

### Prerequisites

- Node.js + npm
- MySQL instance
- `.env` configured

### Install + run

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

App runs at `http://localhost:3000`.

### Production build

```bash
npm run build
npm run start
```

### Linting

```bash
npm run lint
```

`npm run lint` runs ESLint with `--fix` and can modify files.

## Database overview (Prisma)

- Auth and identity: `user`, `password_reset_token`, `account`.
- Journaling: `journal`, `journal_entry`, `spot_trade`, `futures_trade`, `tag`, `journal_entry_tag`.
- Strategy system: `strategy`, `rule`, `strategy_rule`.
- Portfolio and holdings: `portfolio_trade` (+ derived portfolio views in services/routes).
- Chart tracking: `chart_tracker`, `chart_subscription`, `chart_analysis`.
- AI analysis and billing: `trade_pre_analysis`, `ai_usage`, `app_prompt`.
- Exit strategy: `exit_strategy`, `exit_strategy_execution`.
- Price structure and assets: `coin_price_structure`, `verified_asset`.
- Market snapshots: `fear_greed_index`, `global_crypto_market_snapshot`, `funding_rate`, `crypto_open_interest`.

## API reference (canonical `app/api`)

Auth labels:

- `public`: no session required.
- `session`: authenticated session required.
- `admin`: admin session required.
- `cron key`: requires `x-cron-key` secret.

### Auth and profile

| Endpoint | Methods | Auth | Main inputs | Main outputs / behavior |
|---|---|---|---|---|
| `/api/auth/[...nextauth]` | `GET`, `POST` | public | NextAuth callback/query payloads | NextAuth session/auth handlers. |
| `/api/auth/register` | `POST` | public | `{ email, username, password, types? }` | Creates user + accounts (always includes `crypto`), sets active account cookie, returns `{ ok, userId }`. |
| `/api/profile/display-name` | `POST` | session | `{ displayName }` | Updates user display name, returns `{ ok, displayName }`. |
| `/api/profile/avatar/upload-url` | `GET` | session | query: `contentType` | Returns signed upload URL + public URL `{ url, publicUrl }`. |
| `/api/profile/avatar/confirm` | `POST` | session | `{ avatarUrl }` | Persists avatar URL, returns `{ ok, avatarUrl }`. |

### Accounts

| Endpoint | Methods | Auth | Main inputs | Main outputs / behavior |
|---|---|---|---|---|
| `/api/accounts` | `GET` | session | - | Lists user accounts with active selection metadata. |
| `/api/accounts/select` | `POST` | session | `{ accountId }` | Select account by id for user context, `{ ok: true }` on success. |
| `/api/accounts/set-active` | `POST` | session | `{ accountId }` | Sets active account id, returns `{ ok: true }` or `404`. |
| `/api/accounts/switch` | `POST` | session | `{ accountId }` | Validates ownership and sets `active_account_id` cookie. |
| `/api/accounts/types` | `GET`, `POST`, `DELETE` | session | `POST/DELETE`: `{ type: "crypto"|"stock"|"forex" }` | List/create/delete typed accounts; deletion guards `crypto` and updates fallback active account. |

### Journals and journal entries

| Endpoint | Methods | Auth | Main inputs | Main outputs / behavior |
|---|---|---|---|---|
| `/api/journals` | `GET`, `POST` | session | `POST`: `{ name }` (JSON or form-data) | List journals + `activeJournalId`; create journal with uniqueness handling. |
| `/api/journals/[id]` | `DELETE` | session | route param `id` | Deletes journal and related records in transaction, returns `204` on success. |
| `/api/journal/active` | `POST` | session | `{ id }` or `{ journal_id }` | Validates account ownership and sets active journal. |
| `/api/journal` | `GET`, `POST` | session | `GET` query: `start`, `end`; `POST` trade payload (spot/futures fields, fees, tags, notes, timeframe, strategy) | List entries for date range and active journal; create journal entry (+ spot/futures + tags; optional portfolio mirror). |
| `/api/journal/[id]` | `PUT`, `DELETE` | session | route param `id`; `PUT` full trade update payload | Updates/deletes entry with account scoping, strategy validation, symbol validation, tag re-linking. |
| `/api/metrics/earnings` | `GET` | session | - | 12-month earnings buckets `{ month, earnings }`. |
| `/api/metrics/recent-trades` | `GET` | session | - | Latest 5 trades for account. |

### Strategies and tags

| Endpoint | Methods | Auth | Main inputs | Main outputs / behavior |
|---|---|---|---|---|
| `/api/strategies` | `GET`, `POST` | session | `GET` query: `start`, `end`; `POST`: `{ name, notes?, rules[] }` | Strategy list with metrics summary; create strategy and upsert rules. |
| `/api/strategies/[id]` | `GET`, `PUT`, `DELETE` | session | route param `id`; `PUT`: `{ name, notes?, rules[] }` | Get details, replace/update strategy, delete strategy. |
| `/api/tags` | `GET`, `POST` | session | `POST`: `{ name }` | List/create account tags (dedup behavior on unique conflict). |

### Portfolio

| Endpoint | Methods | Auth | Main inputs | Main outputs / behavior |
|---|---|---|---|---|
| `/api/portfolio` | `GET` | session | - | Portfolio summary, assets, transaction history; resolves prices and 24h metrics. |
| `/api/portfolio/[symbol]` | `GET` | session | route param `symbol` | Detailed symbol view: balance, metrics, key levels, transactions. |
| `/api/portfolio/add-asset` | `POST` | session | `{ symbol, amount, priceUsd, feeUsd?, strategyId?, executedAt }` | Creates initial position via repository layer. |
| `/api/portfolio/add-transaction` | `POST` | session | `{ asset, side, priceMode, priceUsd?, qty?, totalUsd?, feeUsd?, executedAt? }` | Creates spot transaction using market/custom pricing, updates verified asset metadata. |
| `/api/portfolio/transaction/[id]` | `PUT`, `DELETE` | session | route param `id`; `PUT` body `{ side, qty, priceUsd, feeUsd?, executedAt? }` | Updates/deletes spot transaction (journal entry scoped). |
| `/api/portfolio/assets/search` | `GET` | session | query: `q` | CoinGecko search for selectable assets. |
| `/api/portfolio/assets/top` | `GET` | session | - | Top market-cap coin shortcuts for UI. |
| `/api/portfolio/assets/price` | `GET` | session | query: `id` (CoinGecko id) | Returns current price payload from CoinGecko helper. |

### Tracker, analyses, price structure, exit strategy, AI trade analyzer

| Endpoint | Methods | Auth | Main inputs | Main outputs / behavior |
|---|---|---|---|---|
| `/api/tracker/coins` | `GET`, `POST` | session | `POST`: `{ tvSymbol, displaySymbol }` | List tracker subscriptions; add tracker for `h1`/`h4`; triggers async initial analyses. |
| `/api/tracker/coins/[id]` | `DELETE` | session | route param `id` | Removes subscription and deactivates tracker when no subscribers remain. |
| `/api/tracker/analyses` | `GET` | session | query: `trackerId` | Returns latest analyses for tracker (up to 10). |
| `/api/tracker/run` | `POST` | cron key | header `x-cron-key` | Executes due trackers with concurrency limit, returns queued/ok/fail report. |
| `/api/chart-trackers/[id]/refresh-sr` | `POST` | session | route param `id` | Manually run analysis refresh for one tracker. |
| `/api/add-coin/coins` | `GET`, `POST` | session | `POST`: `{ symbol, exchange? }` | List account price structures; upsert structure levels for asset. |
| `/api/add-coin/coins/[id]` | `GET` | session | route param `id` | Fetch detailed price structure by id. |
| `/api/exit-strategies` | `GET`, `POST` | session | `POST`: `{ coinSymbol, strategyType:"percentage", sellPercent, gainPercent }` | Lists strategy summaries; creates strategy (unique by account+coin+type). |
| `/api/exit-strategies/[id]` | `GET`, `DELETE` | session | route param `id` | Get strategy details/steps; delete strategy (`204` on success). |
| `/api/exit-strategies/[id]/executions` | `POST` | session | `{ stepGainPercent, targetPriceUsd, executedPriceUsd, quantitySold }` | Records execution and returns refreshed strategy details. |
| `/api/exit-strategies/simulate` | `POST` | session | `{ coinSymbol, sellPercent, gainPercent, maxSteps? }` | Computes projected staged exits without persistence. |
| `/api/trade-analyzer` | `POST` | session | validated trade analyzer payload (asset, strategy, prices, risk fields, etc.) | Generates/stores AI analysis and usage record, returns `{ id, analysis, createdAt }`. |

### Admin

| Endpoint | Methods | Auth | Main inputs | Main outputs / behavior |
|---|---|---|---|---|
| `/api/admin/users` | `GET` | admin | - | List users for admin console. |
| `/api/admin/users/[id]` | `PATCH`, `DELETE` | admin | `PATCH`: `{ is_admin }`; `DELETE`: `{ confirm }` | Toggle admin flag, or delete user + related account-scoped data. |
| `/api/admin/users/[id]/journals` | `GET` | admin | route param `id` | List recent journal entries for selected user. |
| `/api/admin/users/[id]/strategies` | `GET` | admin | route param `id` | List strategies and rules for selected user. |
| `/api/admin/prompts` | `GET`, `PUT` | admin | `PUT`: `{ items: [{ key, content }] }` | List/update app prompts in bulk. |
| `/api/admin/prompts/[id]` | `GET`, `PUT` | admin | route param `id`; `PUT` body `{ content, title?, description? }` | Read/update one prompt; updates can trigger tracker reruns for chart prompt key. |
| `/api/admin/costs` | `GET` | admin | query: `since`, `until`, `bucket` (`day|week|month`) | AI usage cost aggregation by time bucket and kind. |

### Market and public asset lookup

| Endpoint | Methods | Auth | Main inputs | Main outputs / behavior |
|---|---|---|---|---|
| `/api/assets/search` | `GET` | public | query: `q` | Search `verified_asset` by symbol/name. |
| `/api/assets/coins` | `GET` | public | query: `q` | Asset candidate resolver (DB + optional CoinMarketCap fallback). |

## Operations

### Scheduled tracker execution

- Route: `POST /api/tracker/run`
- Auth: `x-cron-key` header must match `CRON_SECRET` (or `NEXT_PUBLIC_DEV_CRON_SECRET` outside production).
- Scheduler behavior:
  - Finds due trackers using timeframe spacing (`h1`, `h4`, `d1`).
  - Runs analyses with `p-limit(2)` concurrency.
  - Returns `{ queued, ok, fail, results[] }` report.

Example:

```bash
curl -X POST http://localhost:3000/api/tracker/run \
  -H "x-cron-key: $CRON_SECRET"
```

## Known gaps and current inconsistencies

- `npm run seed` points to `prisma/seed.ts`, but that file is not present in this repository.
- Middleware includes `/api/billing` in its rate-limit/matcher patterns, but this repository currently has no `/api/billing/*` handlers.

## Contribution and safety notes

- Keep data access account-scoped (`account_id`) for domain entities.
- Validate request payloads with Zod in route handlers.
- Prefer Prisma migrations for schema changes (`npx prisma migrate dev`).
- Recheck middleware matchers and auth behavior when adding new API groups.
- `npm run lint` auto-fixes files; review diffs before commit.

## API/contract note

This README documents existing runtime behavior only. It does not introduce API, type, or interface changes.
