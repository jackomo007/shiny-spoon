# Stakk AI — Journal, Strategies, Portfolio, Charts & AI Analysis

## Overview

This repository contains a web application (Next.js + TypeScript) focused on **trade management**, **trade journaling (Journal)**, **strategies and rules**, **spot portfolio tracking**, plus **chart tracking** with stored analyses and **AI-powered trade pre-analysis**.

The app is designed to:
- Organize trades into **journals** per account
- Record trades with a **complete trade model** (spot and futures)
- Associate trades with **strategies** and mark **matched rules**
- Use **tags** per trade
- Provide a separate **Portfolio** view (spot holdings/transactions)
- Track charts (TradingView symbol + timeframe), generate analyses, and store results
- Track AI usage for auditing and cost control

---

## Main modules implemented

### 1) Authentication (NextAuth — Credentials)
- Email/password login
- Session includes `user.id` and `accountId`
- Server pages and API routes validate session and redirect to `/login` when required

Related:
- `next-auth` with Credentials provider
- Extended typing in `next-auth.d.ts` (Session/JWT)

---

### 2) Accounts (Account scope)
The app runs primarily under an `account` entity, which belongs to a `user`.  
A user can have accounts of different types (crypto/stock/forex), with a unique constraint per `(user_id, type)`.

`account` is the core data scope for:
- journals
- journal entries
- strategies
- tags
- trackers (charts)
- price structures
- exit strategies
- trade pre-analyses
- portfolio trades

---

### 3) Journals + active selection
**Journals** are collections used to group trades.  
There is a concept of an **active journal** (used as the main context in the UI).

Front-end behavior:
- List journals with an “Active” badge
- Create a journal by name
- Make a journal active
- Delete journals (with confirmation modal)

API used by the UI:
- `GET /api/journals` → returns `{ items, activeJournalId }`
- `POST /api/journals` → create journal
- `DELETE /api/journals/:id` → delete journal
- `POST /api/journal/active` → set active journal

Database:
- `journal` includes `account_id`, `name`, `created_at`
- Unique: `(account_id, name)`

---

### 4) Journal (Trades) — full trade record
The Journal is the main area for recording trades.

Supports:
- Spot and Futures
- Trade status: in-progress, win, loss, break-even
- Side: buy/sell and long/short
- Prices: entry, exit, stop, take profit
- Costs: buy fee, sell fee, plus aggregated `trading_fee`
- Timeframe per trade (e.g., 1H, 1D)
- Notes: entry and review
- Strategy-rule match data
- Tags

Trade storage is centered around `journal_entry`.

Key tables:
- `journal_entry` stores most trade data
- Relations:
  - `spot_trade` (when the trade is spot)
  - `futures_trade` (when futures; leverage/margin/liquidation)
  - `journal_entry_tag` (tags per trade)

Enums:
- `journal_entry_side`: `buy | sell | long | short`
- `journal_entry_status`: `in-progress | win | loss | break-even` (mapped)

---

### 5) Strategies + Rules (global rule catalog)
Strategies are per account and include:
- Name
- Notes
- A set of rules (via association)

Data model:
- `strategy` belongs to `account`
- `rule` is a global rule catalog (`title` is unique)
- `strategy_rule` joins strategy ↔ rule

Front-end behavior:
- Strategy list with computed metrics (win rate, pnl, tradesUsed, etc.)
- Modal to create/edit a strategy:
  - Name + Notes
  - Embedded rule CRUD (title/description)
- Search, sorting, and date range filtering

Expected API used by UI:
- `GET /api/strategies?start&end` → `{ items, summary }`
- `GET /api/strategies` → list base for dropdowns
- `GET /api/strategies/:id` → detail + rules
- `POST /api/strategies` → create
- `PUT /api/strategies/:id` → update
- `DELETE /api/strategies/:id` → delete

---

### 6) Tags
Tags are per account and can be assigned to journal entries.

Model:
- `tag` belongs to `account`
- `journal_entry_tag` links `journal_entry` and `tag`

Typical API:
- `GET /api/tags`
- `POST /api/tags`

---

### 7) Portfolio (Spot holdings / transactions)
Portfolio is a separate view focused on **spot holdings**, including:
- Summary cards (balance, invested, profit, 24h)
- Allocation card
- Assets table
- Transactions table
- “Add Transaction” modal

Database:
- `portfolio_trade` (per account):
  - datetime, asset, kind, qty, price_usd, fee_usd, cash_delta, note

API used by UI:
- `GET /api/portfolio` → returns `{ summary, assets, transactions }`

---

### 8) Chart trackers + stored analyses
The system supports adding chart “trackers” based on:
- `tv_symbol` (TradingView symbol)
- `tf` (timeframe)
- active/inactive status
- last run timestamp

Model:
- `chart_tracker`
- `chart_subscription` joins `account` ↔ `chart_tracker`
- `chart_analysis` stores generated analysis text + image + metadata

API endpoints (examples shared):
- `GET /api/trackers` → list account trackers
- `POST /api/trackers` → add a coin, create trackers for multiple timeframes
- `DELETE /api/trackers/:id` → remove coin/tracker
- `GET /api/chart-analyses?trackerId=...` → recent analyses for a tracker

Automated execution (cron):
- POST endpoint that processes “due” trackers
- Protected by `x-cron-key` header
- Concurrency limited via `p-limit`

---

### 9) Trade Pre-Analysis (AI)
This module receives trade data, generates an AI analysis, and persists:
- analysis text
- model used
- prompt used
- input metadata
- AI usage record (tokens/cost)

Model:
- `trade_pre_analysis` (per account)
- optionally linked to `strategy`
- stores asset, values, stop/target, timeframe, analysis texts

Example endpoint:
- `POST /api/trade-analyzer`
  - validates payload with `zod` (TradeAnalyzerSchema)
  - builds prompt via `buildTradeAnalyzerPrompt`
  - runs analysis via `analyzeTradeText`
  - stores record in `trade_pre_analysis`
  - logs usage in `ai_usage`

---

### 10) Market / aggregated datasets
Tables designed for time-series snapshots:
- `fear_greed_index`
- `global_crypto_market_snapshot`
- `funding_rate`
- `crypto_open_interest`

These tables typically use `recorded_at` + `created_at` for historical tracking.

---

### 11) Exit Strategy + executions
The schema includes exit strategies per asset:
- `exit_strategy` (per account + coin)
- `exit_strategy_execution` (execution history per step)

Supports:
- type: `percentage`
- parameters: `sell_percent` and `gain_percent`
- executions store realized values and timestamps

---

### 12) Price Structure (levels per asset)
The schema supports saving structured levels per asset/exchange/timeframe:
- `coin_price_structure`
- stores JSON levels, last_price, and last_price_at

---

## Tech stack

### Frontend
- **Next.js** (App Router)
- **React**
- **TypeScript**
- **TailwindCSS**
- **react-hook-form**
- Internal UI components:
  - `Card`
  - `Modal`
  - `Table`

### Backend
- **Next.js Route Handlers** (`app/api/*`)
- **Prisma ORM**
- **MySQL**
- **zod** for request validation
- Internal libraries/services:
  - `services/tracker.service` (tracker orchestration and analysis)
  - `lib/ai-analyzer`, `lib/ai-usage`, `lib/prompts/*`
  - `lib/auth`, `lib/prisma`

### Runtime / operations
- Routes that require Node use `runtime = "nodejs"`
- Dynamic routes:
  - `revalidate = 0`
  - `dynamic = "force-dynamic"`

---

## Database (MySQL + Prisma)

### Datasource
- `provider = "mysql"`
- `url = env("DATABASE_URL")`

### Core entities (high level)
- `user` → authentication owner
- `account` → main scope
- `journal` → trade notebook
- `journal_entry` → trade record
- `spot_trade` / `futures_trade` → trade type extensions
- `strategy`, `rule`, `strategy_rule`
- `tag`, `journal_entry_tag`
- `portfolio_trade`
- `chart_tracker`, `chart_subscription`, `chart_analysis`
- `trade_pre_analysis`, `ai_usage`
- `coin_price_structure`
- `exit_strategy`, `exit_strategy_execution`
- market snapshot tables

---

## Session typing (NextAuth)

The project extends Session/JWT types:

### Session
- `session.user.id`
- `session.user.isAdmin`
- `session.accountId`

### JWT
- `uid`, `userId`, `accountId`, `isAdmin`
- `displayName`, `avatarUrl`

This data enables server pages and API routes to operate inside the correct account scope.

---

## Numeric input utilities (Decimal / money formatting)
Utilities exist to:
- sanitize input
- normalize decimals
- limit decimal places
- format for display (thousands separators)
- convert back to raw neutral format

Main functions:
- `sanitizeInput`
- `normalizeDecimalFlexible`
- `limitDecimals`
- `toDisplayUS`
- `toRawNeutral`
- `isValidNeutral`
- `toDisplay`

Goal:
- better UX while typing numeric values
- consistent normalization for validation/persistence

---

## Project structure (practical view)

> Exact structure may vary depending on the repository layout, but the observed pattern is:

- `app/`
  - `.../page.tsx` (pages)
  - `api/` (route handlers)
- `components/`
  - `ui/` (Card, Modal, Table)
  - `journal/`, `portfolio/`, `profile/`, etc.
- `lib/`
  - `auth` (NextAuth options)
  - `prisma` (Prisma instance)
  - `validators` (zod schemas)
  - `prompts` (prompt builders)
  - `ai-*` (AI integration and usage tracking)
- `services/`
  - `tracker.service` (trackers + analyses)
- `prisma/`
  - `schema.prisma`

---

## Environment variables

### Required
- `DATABASE_URL`  
  Example:
  ```env
  DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/trading_app"

### Auth
These variables are required for authentication and session handling via NextAuth.

- `NEXTAUTH_SECRET`  
  Secret used to sign and encrypt NextAuth sessions and JWTs.

- `NEXTAUTH_URL`  
  Base URL of the application (used by NextAuth for callbacks and redirects).

### Cron / Trackers
These variables are used to protect and control scheduled tracker executions.

- `CRON_SECRET`  
  Secret key expected in the `x-cron-key` header when triggering cron endpoints in production.

- `NEXT_PUBLIC_DEV_CRON_SECRET` *(development only)*  
  Alternative secret used to trigger cron endpoints in non-production environments.

---

### Additional
Depending on the AI provider and other integrations enabled in the repository, additional environment variables may exist and be required.

---

## Installation & Running

### 1) Install dependencies
```bash
npm install
```

### 2) Configure Environment Variables

Create a `.env` file in the repository root:

```bash
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/trading_app"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"
```

### 3) Prisma generate and migrate

```bash
npx prisma generate
npx prisma migrate dev
```

### 4) Run in Development Mode

Start the development server:

```bash
npm run dev
```

The application will be available at:

```bash
http://localhost:3000
```

### 5) Production Build

Build and run the application in production mode:

```bash
npm run build
npm start
```

---

## How the System Works (Flow Overview)

### Typical User Flow

### 1. User logs in.

### 2. The system determines the active accountId from the session.

### 3. The user manages:

- Journals

- Trades inside the active Journal

- Strategies and Rules

- Tags

- Spot Portfolio

### 4. The user can add chart trackers and view stored analyses.

### 5. The user can run AI-based trade pre-analysis and store the results.

## Core Principle

Most domain tables are scoped by `account_id`.

This ensures clean data separation between users and accounts.

### Primary API Endpoints

## Journals

- `GET /api/journals`

- `POST /api/journals`

- `DELETE /api/journals/:id`

- `POST /api/journal/active`

## Journal (Trades)

- `GET /api/journal?start=<iso>&end=<iso>`

- `POST /api/journal`

- `PUT /api/journal/:id`

- `DELETE /api/journal/:id`

## Strategies

- `GET /api/strategies?start=<iso>&end=<iso>`

- `GET /api/strategies`

- `GET /api/strategies/:id`

- `POST /api/strategies`

- `PUT /api/strategies/:id`

- `DELETE /api/strategies/:id`

## Tags

- `GET /api/tags`

- `POST /api/tags`

## Portfolio

- `GET /api/portfolio`

## Trackers / Analyses

- `GET /api/trackers`

- `POST /api/trackers`

- `DELETE /api/trackers/:id`

- `GET /api/chart-analyses?trackerId=<id>`

- `POST /api/cron/run-trackers`

## Trade Analyzer (AI)

- `POST /api/trade-analyzer`

### General Repository Notes

- The project evolves iteratively; some files or modules may exist even if they are not currently used in the main execution flow.

- The codebase prioritizes incremental delivery while maintaining consistent, account-scoped data integrity.

### Schema Quick Reference (Most Used Entities)

## user

- id (int), public_id (uuid), email, username, password_hash

- is_admin, avatar_url, display_name

- relation: accounts

## account

- id (uuid), user_id, type, name, created_at

- relation: journals, entries, strategies, tags, trackers, portfolio_trade, etc.

## journal / journal_entry

- journal: per-account notebook

- journal_entry: trade with spot/futures details + timeframe + fees + notes + tags

## strategy / rule / strategy_rule

- strategy: per account

- rule: global (unique title)

- strategy_rule: join table

## chart_tracker / chart_analysis / chart_subscription

- trackers by symbol/timeframe

- stored analyses

- subscriptions connect trackers to accounts

## trade_pre_analysis / ai_usage

- AI-generated trade pre-analysis

- usage logging: tokens/cost/metadata
