# FirstReport

A mobile-first Indian news aggregator in the style of Inshorts. RSS articles from Indian outlets are grouped into **Events** (one card each), and Events are chained into **Stories**. Gemini writes each card: a neutral summary of up to 60 words, plus left and right perspectives when the story is contested.

The full product and engineering brief is in [`CLAUDE.md`](CLAUDE.md).

## Status

| Milestone | State |
| :-- | :-- |
| M1 Repo + ingest | ✅ |
| M2 Embeddings + Events | ✅ thresholds tuned from labelled pairs |
| M3 Cards | ✅ prompt v2 |
| M4 Stories, summaries, nightly job, budget brake | ✅ (R2 backup and alert webhook moved to M7) |
| M5 API + admin | next |
| M6 Mobile app, M7 Hardening, M8 Closed beta | not started |

Only the worker exists so far. `apps/api` and `apps/mobile` have not been created yet.

## Repo layout

```
apps/worker          ingestion + AI pipeline, run by pg-boss
  src/tick.ts          one 15-minute tick (steps 1–12)
  src/nightly.ts       02:30 IST job: twin merge, body purge, dormant Stories, alerts
  src/start.ts         long-running worker: schedules tick + nightly with pg-boss
  src/ingest/          feed fetch (conditional GET), page extraction, URL normalisation, filters
  src/pipeline/        embed, near-duplicate, assign Events, cards, Stories, summaries, material change, budget
  src/prompts/         Gemini prompts and JSON schemas (card.ts is versioned)
  src/gemini/          the single Gemini wrapper: retries, llm_calls logging, cost, free-tier caps
  src/labels/          pair sampling and precision/recall for threshold tuning
  src/cli/             command-line entry points (see below)
  test/                Vitest unit + fixture replay tests (Gemini is mocked)
packages/db          Drizzle schema, migrations, client, sources seed
packages/shared      config.ts: every threshold, window, limit and model ID
docker/              Postgres init (creates the fr_test database)
data/                labels, card reports (git-ignored)
```

## Setup

You need Node ≥ 24, pnpm 12 and Docker.

```sh
pnpm install
cp .env.example .env          # set GEMINI_API_KEY; DATABASE_URL already points at the compose DB
docker compose up -d          # Postgres 16 + pgvector, with databases fr and fr_test
pnpm db:migrate
pnpm db:seed                  # 12 active outlets + inactive TODO candidates
```

`pnpm db:seed --all-feeds` also adds the extra section feeds that are left out by default to stay in the Gemini free tier.

## Running

| Command | What it does |
| :-- | :-- |
| `pnpm worker:tick --dry-run` | Fetch and parse feeds, write nothing, skip the Gemini steps |
| `pnpm worker:tick` | Run one full tick now |
| `pnpm worker:start` | Long-running worker: tick every 15 min, nightly at 02:30 IST |
| `pnpm worker:nightly` | Run the nightly job now (waits for a running tick) |
| `pnpm label:pairs` | Label article pairs (same event?) → `data/labels.csv` |
| `pnpm label:pairs --events` | Label Event pairs (same storyline?) → `data/story-labels.csv` |
| `pnpm label:report [--events]` | Precision/recall per threshold, with suggested `EVENT_*` / `STORY_*` values |
| `pnpm cards:report [--n 30] [--from <report.md>]` | Generate cards for recent Events without saving them → `data/cards-<date>-v<prompt>.md` |
| `pnpm events:reset` | Dev only: clear Events, Stories and summaries so articles are reassigned |
| `pnpm test` | Vitest (needs the compose Postgres for the `fr_test` database) |
| `pnpm typecheck` | `tsc` across all packages |
| `pnpm db:generate` | Generate a migration after editing `packages/db/src/schema.ts` |
| `pnpm db:studio` | Browse and edit the dev database in Drizzle Studio (https://local.drizzle.studio) |

Without `GEMINI_API_KEY`, a tick only ingests and skips every Gemini step.

## Deploy (VPS)

The `Dockerfile` builds one image for every app; `docker-compose.yml` picks the command. The app services sit behind the `app` profile, so a plain `docker compose up -d` in dev still starts only Postgres.

```sh
cp .env.example .env          # GEMINI_API_KEY, GEMINI_FREE_TIER=false, ADMIN_USER/ADMIN_PASSWORD
docker compose --profile app up -d --build   # postgres → migrate (one-off) → worker
docker compose --profile app run --rm migrate pnpm db:seed --all-feeds
docker compose logs -f worker
```

Postgres listens on `127.0.0.1:5432` only. Compose overrides `DATABASE_URL` to point at the `postgres` service.

## How a tick works

1. **Ingest:** conditional GET on every active feed, filtering, URL normalisation, Readability extraction when the RSS text is under 60 words, and a content hash. Unique constraints drop repeats.
2. **Embed:** `title + lede` with `gemini-embedding-2` (768 dimensions, normalised), then fold same-source near-duplicates (≥ 0.97) into the older article.
3. **Assign:** one article at a time, against Event centroids from the last 72 h. ≥ 0.94 joins, 0.86–0.94 asks Gemini, anything lower starts a new Event.
4. **Cards:** Events that waited one tick get a card from `gemini-3.1-flash-lite`, which is validated in code. Valid cards are published; one failed retry marks the Event `failed`.
5. **Stories → summaries → material-change rewrites:** at most 3 rewrites per Event, only within 24 h.

The budget brake skips rewrites above $1.50/day and pauses card writing above $3.00/day. Every Gemini call is logged to `llm_calls` with its cost at paid prices.

## Gemini free tier (dev)

`GEMINI_FREE_TIER` is on unless set to `false`. In that mode:

- Flash-Lite calls stop at 450 a day (`FREE_TIER_DAILY_REQUESTS`).
- Material-change rewrites stop at 80% of that cap.
- Ingestion is capped at 250 new articles a day (`MAX_NEW_ARTICLES_PER_DAY`).

Set `GEMINI_FREE_TIER=false` in production.

## Configuration

All tunables are in [`packages/shared/src/config.ts`](packages/shared/src/config.ts). Environment variables are listed in [`.env.example`](.env.example). `ADMIN_*`, `R2_*`, `ALERT_WEBHOOK_URL`, `SENTRY_DSN` and `EXPO_PUBLIC_API_BASE_URL` are not used yet. They arrive with M5–M7.
