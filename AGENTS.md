# AGENTS.md

## Cursor Cloud specific instructions

CoastGuard is a two-process app: a **FastAPI backend** (`backend/`, port 8000) and a
**Vite + React frontend** (`frontend/`, port 5173). The frontend dev server proxies
`/api` → `http://127.0.0.1:8000`, so the backend must be running for the UI to load data.
Dependencies are installed by the startup update script (Python venv at `backend/.venv`,
pnpm `node_modules` in `frontend/`); do not reinstall them by hand unless they are missing.

### Running the services

- Backend: `cd backend && .venv/bin/python start_server.py` (serves on `0.0.0.0:8000`).
  Requires `backend/.env` — the update script copies it from `backend/.env.example` if
  missing. Defaults run **full mock mode** (`USE_MOCK_LLM=true`, `USE_MOCK_DATA=true`),
  so the entire 5-agent pipeline works end-to-end with **no external API keys**. Real
  LLM/Aurora/GDELT integrations are optional and gated behind env flags.
- Frontend: `cd frontend && pnpm dev` (serves on `:5173`). Start the backend first.
- Stop both: `./stop.sh` (note: it uses `pkill`/`lsof`; avoid `pkill -f` patterns in
  shared environments — prefer killing the specific PID).

### Database (SQLite)

- The DB (`backend/coastguard.db`) is embedded SQLite, auto-created on backend startup.
- For demo data (customer `id=1`, suppliers, a $40k order, sample alerts) run once:
  `cd backend && .venv/bin/python scripts/seed_data.py` (idempotent — it skips if already
  seeded). The hardcoded demo customer is `customer_id=1`.

### Hello-world smoke test

Trigger the 5-agent pipeline directly:
`curl -X POST http://localhost:8000/api/v2/monitor/run -H 'Content-Type: application/json' -d '{"customer_id":1,"hs_code":"6109.10","supplier_country":"Vietnam"}'`
In the UI, the equivalent is the **"Run Monitor"** button on the `/dashboard` (alerts) page.

### Non-obvious gotchas

- **Auth is removed** in Phase 1; `customer_id`/`business_id` is hardcoded to `1`.
  No login is required to use the app.
- **pnpm lockfile is out of sync** with the `vite` override in `frontend/package.json`,
  so use plain `pnpm install` (a `--frozen-lockfile` install will fail). `pnpm install`
  harmlessly rewrites `frontend/pnpm-lock.yaml` in the working tree.
- **No automated test suite and no ESLint config** exist in this repo. "Build" =
  `cd frontend && pnpm build`; backend has no build step.
- The filesystem is case-sensitive (Linux). Imports must match directory casing exactly,
  e.g. `components/Admin/...` (capital A), not `components/admin/...`.
- `crewai` and Google AI deps are heavy (~2 min install) but only used when
  `USE_MOCK_LLM=false`; the default mock mode never calls them.
