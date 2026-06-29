# Suppliance

**AI-powered supply chain risk intelligence for small and mid-size importers.**

Built for the **H0 Hackathon**.

**Live:** [suppliance.vercel.app](https://suppliance.vercel.app)

---

## Overview

Small and mid-size importers rarely have an in-house trade-compliance team. When a tariff changes, a port shuts down, or a key supplier's region becomes unstable, the people who feel it first are operators who don't have the bandwidth to track HS code rulings or scan regional news for early warning signs.

Suppliance is an agentic monitoring system that watches global trade news (RSS feeds, GDELT) for events relevant to a customer's actual supply chain, then runs a multi-agent reasoning pipeline that:

- Identifies whether a disruption affects the customer's sourcing footprint
- Calculates the financial exposure across open purchase orders
- Surfaces pre-vetted alternative suppliers in unaffected regions
- Checks import/compliance implications (sanctions, certificates of origin, customs documentation)
- Runs every recommendation through an adversarial review pass before it reaches a human

The result is surfaced on a live dashboard with an interactive globe, per-customer alerting, and a supplier directory — not a wall of raw agent logs.

## Core Features

### Multi-agent risk pipeline

A CrewAI pipeline of 5 agents, backed by Google Gemini, run as two sequential CrewAI crews:

1. **Tariff Risk Monitor** *(Crew 1)* — scans collected news/RSS articles and classifies whether a real disruption event exists, against the customer's HS codes and sourcing countries.
2. **Financial Impact Calculator** *(Crew 2, step 1)* — calculates the dollar exposure across the customer's open purchase orders.
3. **Alternative Supplier Finder** *(Crew 2, step 2)* — searches the supplier directory for pre-vetted alternates in regions unaffected by the event.
4. **Import Compliance Specialist** *(Crew 2, step 3)* — checks customs documentation, certificate-of-origin, and sanctions-list implications for those alternates.
5. **Risk Challenger** *(Crew 2, step 4 — adversarial review)* — critiques the output of agents 2–4 for hallucinations, weak evidence, or overlooked edge cases before anything reaches the user.

Agents 2–5 run sequentially (each one's task explicitly consumes the previous agent's output, CrewAI's default process), each reasoning over a different RSS pass (trade/tariff news, regional-stability news, regulatory feeds respectively) plus the customer's own data. Crew 1 and Crew 2 are split into two separate CrewAI runs (rather than one 5-task crew) so the orchestrator can validate and correct Crew 1's output — e.g. discarding HS codes the customer doesn't actually import — before constructing Crew 2's prompts.

Two additional pipelines (compliance-check and trade-document analysis) run on the same orchestrator for document- and regulation-specific queries.

### Live dashboard

- An interactive 3D globe (`react-globe.gl` + three.js) plotting the customer's suppliers, HQ/import destination, and active disruption events, with a switcher for the most recent events.
- Real-time pipeline run status and parsed (not raw-log) agent output.
- KPI cards for trade exposure, proposed alternates, critical events, and countries monitored.

### Supplier directory & settings

- A searchable directory of suppliers by country/region/category, backed by a seeded global supplier dataset.
- Per-customer settings for sourcing countries, critical regions, risk tolerance, and import destination (the country/port where shipments actually arrive — this anchors the dashboard globe).

### Auth & billing

- Authentication via [Clerk](https://clerk.com).
- Subscription billing via [Stripe](https://stripe.com), with plan management in-app.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript/JSX, Vite, Tailwind CSS v4, react-globe.gl, three.js, framer-motion |
| UI scaffolding | [Vercel v0](https://v0.dev) — used to generate and iterate on early UI components |
| Backend | Python, FastAPI, SQLAlchemy, Pydantic |
| AI orchestration | CrewAI (multi-agent), Google Gemini |
| Database | Amazon Aurora PostgreSQL, pgvector (forward infrastructure for semantic search), IAM auth |
| News ingestion | Google RSS Feeds, Trade News Sources, GDELT |
| Auth | Clerk |
| Billing | Stripe |
| Deployment | AWS (Aurora), Vercel (frontend), Render (backend) |
| Infrastructure | Docker, Docker Compose (`docker-compose.yml` at repo root) |
| CI | GitHub Actions (backend pytest, frontend build) |

## Database — Amazon Aurora PostgreSQL

The production database is **Amazon Aurora PostgreSQL**, authenticated via **AWS IAM** rather than a long-lived password. The data model has 15 tables; the five core domain tables are `global_suppliers`, `business_profiles`, `disruption_events`, `tariff_alerts`, and `historical_impacts`. Aurora was chosen over a NoSQL option (e.g. DynamoDB) because supply chain risk is fundamentally relational — which supplier is exposed to which disruption, mapped to a customer's sourcing footprint — not flat key-value lookups. This is implemented in [`backend/database.py`](backend/database.py), which supports three connection modes selected by environment variables:

1. **SQLite** — zero-setup local dev (`DATABASE_URL=sqlite:///./coastguard.db`).
2. **Aurora with a static password** — a plain `postgresql+psycopg2://` connection string.
3. **Aurora with IAM authentication** (`AURORA_USE_IAM_AUTH=true`) — the mode used in production.

In IAM mode, the app never stores a database password at all. Instead, on every new physical connection SQLAlchemy calls a custom `creator()` function that:

1. Calls `boto3`'s `rds.generate_db_auth_token()` to mint a fresh, SigV4-signed authentication token scoped to that exact host/port/username — these tokens are only valid for **15 minutes**.
2. Opens the `psycopg2` connection using that token as the password, over `sslmode=require`.

The connection pool's `pool_recycle` is set to **840 seconds (14 minutes)** — deliberately just under the token's 15-minute lifetime — so SQLAlchemy always discards and replaces a pooled connection before its IAM token can expire, instead of handing the application a connection that's about to start failing auth mid-request. `pool_pre_ping=True` additionally verifies a connection is alive before reuse.

This means the only thing the deployed app needs is an IAM identity (instance role, task role, or access key) with `rds-db:connect` permission for the target Aurora cluster/user — no secret ever needs to be rotated, stored in a secrets manager, or leaked in a config file.

The same engine factory also auto-registers the **pgvector** extension on every new connection (`CREATE EXTENSION IF NOT EXISTS vector`), so the schema is ready for embedding-based retrieval if/when that's added, without a separate migration step.

## Project Structure

```
backend/
  api/v2/          REST routers — auth, suppliers, alerts, monitor, disruptions,
                    geo, news, global suppliers, payments, settings
  core/             Pipeline orchestration, agent definitions, RSS/article cache,
                    auth (Clerk JWT verification), scheduler
  collectors/       Concurrent RSS feed collectors (tariff/trade, regional-stability, compliance)
  services/         GDELT client, news feed, coordinates, impact calculations
  demo/             Scripted demo/autoplay data for presentations
  scripts/          DB migration, seeding, and maintenance scripts
  tests/            pytest suite

frontend/
  src/pages/        Routed pages (Dashboard, Suppliers, Past Events, Settings,
                     Subscription, Onboarding, Landing, Admin, Demo)
  src/components/    Shared UI (globe, header, settings sections, common widgets)
  src/services/      API client
  src/lib/           Appearance/theming helpers
```

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+ and [pnpm](https://pnpm.io/installation)

### Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env           # fill in real values, or leave mock mode on
python start_server.py
```

The API runs at `http://localhost:8000` (health check at `/api/health`).

By default the app runs in **mock mode** (`USE_MOCK_LLM=true`, `USE_MOCK_DATA=true` in `.env.example`) so it works with zero external API keys. To run the real 5-agent pipeline, set up Gemini (below) and flip `USE_MOCK_LLM=false`; set `USE_REAL_TOOLS=true` to pull live GDELT headlines.

### Setting up Gemini (the LLM provider)

The agent pipeline calls Google Gemini by default (`LLM_PROVIDER=gemini` in `.env.example`) — this is the easiest provider to get running locally, no AWS account or cloud setup required:

1. Get a free API key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Put it in `GEMINI_API_KEY` in `backend/.env`.
3. Set `USE_MOCK_LLM=false`.

`GEMINI_MODEL` defaults to `gemini/gemini-flash-latest`, a Google-maintained alias that always points at the current flash-tier model (fast/cheap). Use `gemini/gemini-pro-latest` for higher quality.

AWS Bedrock (Claude) is also supported as an alternative provider — set `LLM_PROVIDER=bedrock`, plus `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` with `bedrock:InvokeModel` permission and a one-time Bedrock model-access request in the AWS Console. See the comments in `backend/.env.example` for the full Bedrock setup steps.

### Frontend

```bash
cd frontend
pnpm install
cp .env.example .env   # set VITE_CLERK_PUBLISHABLE_KEY — the app won't boot without it
pnpm dev
```

The app runs at `http://localhost:5173`.

### Docker

A `docker-compose.yml` is provided at the repo root for running both services together:

```bash
docker compose up --build
```

## Testing

```bash
# Backend
cd backend
python -m pytest tests/ -v

# Frontend
cd frontend
pnpm build
```

Both run automatically in CI on every push/PR (see `.github/workflows/ci.yml`).

## Environment Variables

### Backend (`backend/.env`, copied from `backend/.env.example`)

- **Database** — SQLite by default; Aurora PostgreSQL via a connection string or IAM auth (`AURORA_USE_IAM_AUTH=true` + `AURORA_*` vars).
- **LLM (Gemini, default)** — `LLM_PROVIDER=gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL`. See [Setting up Gemini](#setting-up-gemini-the-llm-provider).
- **LLM (AWS Bedrock, alternative)** — `LLM_PROVIDER=bedrock`, `BEDROCK_MODEL_ID`, `BEDROCK_REGION`, plus `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (shared with Aurora IAM auth above).
- **Mock/real mode toggles** — `USE_MOCK_LLM`, `USE_MOCK_DATA`, `USE_REAL_TOOLS`.
- **Scheduler** — `ENABLE_SCHEDULER`, `SCHEDULER_INTERVAL_HOURS` for periodic background runs (disabled by default; trigger runs manually for demos).
- **Auth** — `CLERK_ISSUER_URL`, `CLERK_SECRET_KEY` (required for any request that needs an authenticated user).
- **Billing** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (required for the subscription flow).

See `backend/.env.example` for the full, commented list.

### Frontend (`frontend/.env`, copied from `frontend/.env.example`)

- `VITE_CLERK_PUBLISHABLE_KEY` — required; the app fails to render without it.
- `VITE_STRIPE_PUBLISHABLE_KEY` — required for the Subscription page.
- `VITE_API_URL` — optional, defaults to `http://127.0.0.1:8000`.
