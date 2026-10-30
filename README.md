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
| M5 API + admin | ✅ built; gate pending (7 days unattended under $1.50/day) |
| M6 Mobile app | in progress: the home screen, History and Story so far are built; Account comes next |
| M7 Hardening, M8 Closed beta | not started |

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
  src/pipeline/regenCard.ts  admin regenerate / flip to contested (pg-boss `regen` jobs from the API)
  test/                Vitest unit + fixture replay tests (Gemini is mocked)
apps/api             Fastify: public /v1 API + server-rendered admin
  src/public/          feed, event, timeline, summary, categories, config
  src/admin/           basic auth + same-origin check, pages, actions (each writes admin_actions)
  test/                Fastify inject tests against fr_test
apps/mobile          Expo (SDK 58) + expo-router app; the UI follows packages/designs
  app/(tabs)/          Explore · Home · Account (only Home is built)
  src/components/      card, perspective swipe, action bar, category strip, feed pager, bottom bar
  src/lib/             pure helpers (relative time, image height, progress, share text), unit-tested
  src/theme/tokens.ts  colours, fonts and sizes taken from the design artboard
packages/designs     the design artboard (reference mockup, not code)
packages/db          Drizzle schema, migrations, client, sources seed, Event/Story ops shared by worker and admin
packages/shared      config.ts (every threshold, window, limit and model ID) and api.ts (zod schemas of the public API)
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
| `pnpm api:start` | API on port 3000: `/v1/*` and the admin at `/admin` (needs `ADMIN_USER`/`ADMIN_PASSWORD`) |
| `pnpm mobile` | Expo dev server for the app (see "Mobile app" below) |
| `pnpm worker:nightly` | Run the nightly job now (waits for a running tick) |
| `pnpm label:pairs` | Label article pairs (same event?) → `data/labels.csv` |
| `pnpm label:pairs --events` | Label Event pairs (same storyline?) → `data/story-labels.csv` |
| `pnpm label:report [--events]` | Precision/recall per threshold, with suggested `EVENT_*` / `STORY_*` values |
| `pnpm cards:report [--n 30] [--from <report.md>]` | Generate cards for recent Events without saving them → `data/cards-<date>-v<prompt>.md` |
| `pnpm events:reset` | Dev only: clear Events, Stories and summaries so articles are reassigned |
| `pnpm test` | Vitest for every package, one package at a time (they share the `fr_test` database) |
| `pnpm typecheck` | `tsc` across all packages |
| `pnpm db:generate` | Generate a migration after editing `packages/db/src/schema.ts` |
| `pnpm db:studio` | Browse and edit the dev database in Drizzle Studio (https://local.drizzle.studio) |

Without `GEMINI_API_KEY`, a tick only ingests and skips every Gemini step.

## API and admin

Public, read-only, `Cache-Control: public, s-maxage=60`:

| Endpoint | Returns |
| :-- | :-- |
| `GET /v1/feed?category=&cursor=&limit=20` | Published cards, newest first with a small multi-source boost; `nextCursor` for the next page; `windowTotal` (the category's cards from the last 24 h, for the app's progress bar) |
| `GET /v1/events/:id` | One card. A merged Event answers 301 to the Event it was merged into |
| `GET /v1/stories/:id/timeline` | The Story's published Events, oldest first |
| `GET /v1/stories/:id/summary?asOf=:eventId` | The story-so-far as of that Event, or 404 |
| `GET /v1/categories`, `GET /v1/config` | Category labels; `{ showAiLabel, minAppVersion }` |

The admin at `/admin` uses HTTP basic auth (`ADMIN_USER`/`ADMIN_PASSWORD`; it is off when they are unset). It has Events (hide, unhide, regenerate, flip contested, merge, move to Story), Stories (rename, merge), Sources (toggle) and a 30-day cost page. Regenerate and "make contested" queue a pg-boss `regen` job that the worker runs between ticks, so the API never calls Gemini. Forms are only accepted from the admin's own origin.

## Mobile app

The app reads only the public `/v1` API and holds no secrets. Expo reads its `.env` from `apps/mobile/`, not the repo root:

```sh
echo "EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000" > apps/mobile/.env   # Android emulator → host; use your LAN IP for a phone
pnpm api:start
pnpm mobile                   # then open the installed app on the phone
```

**Phone over Wi‑Fi adb.** Pair once (Developer options → Wireless debugging → Pair device with pairing code, then `adb pair <ip:port>`). After that adb reconnects by itself, so skip `adb connect`. Each session, route the phone's localhost to the Mac:

```sh
adb devices                          # one line per phone; if it is listed twice, add -s <serial> below
adb reverse tcp:3077 tcp:3077        # API (the README uses PORT=3077 when 3000 is taken)
adb reverse tcp:8081 tcp:8081        # Metro
```

The reverse rules are lost whenever the connection drops; "Couldn't load the news." on the phone usually means they need re-running. Judge smoothness on a release build (`pnpm exec expo run:android --variant release --device`): a debug build runs JavaScript unoptimised.

Gesture handler, Reanimated and pager-view are native modules, so the app needs a development build (`npx expo run:android` from `apps/mobile`) if Expo Go does not have matching versions.

The UI follows the artboard in [`packages/designs`](packages/designs). Light colours, type sizes and spacing are copied from it into `src/theme/tokens.ts`; dark values are derived. The headline font is a static cut of Newsreader at optical size 26 (`assets/fonts`), because the Google Fonts package only ships optical size 16.

## Deploy (VPS)

The `Dockerfile` builds one image for every app; `docker-compose.yml` picks the command. The app services sit behind the `app` profile, so a plain `docker compose up -d` in dev still starts only Postgres.

```sh
cp .env.example .env          # GEMINI_API_KEY, GEMINI_FREE_TIER=false, ADMIN_USER/ADMIN_PASSWORD
docker compose --profile app up -d --build   # postgres → migrate (one-off) → worker + api (:3000)
docker compose --profile app run --rm migrate pnpm db:seed --all-feeds
docker compose logs -f worker api
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

All tunables are in [`packages/shared/src/config.ts`](packages/shared/src/config.ts). Environment variables are listed in [`.env.example`](.env.example). `R2_*`, `ALERT_WEBHOOK_URL` and `SENTRY_DSN` are not used yet. They arrive with M7. `EXPO_PUBLIC_API_BASE_URL` belongs in `apps/mobile/.env`.
