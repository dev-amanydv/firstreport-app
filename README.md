# FirstReport

A mobile-first Indian news aggregator in the style of Inshorts. RSS articles from Indian outlets are grouped into **Events** (one card each), and Events are chained into **Stories**. Gemini writes each card: a factual summary of up to 60 words. Left and right perspectives for contested stories are built but paused behind `PERSPECTIVES_ENABLED` (see "Perspectives (paused)" below).

The full product and engineering brief is in [`CLAUDE.md`](CLAUDE.md).

## Status

| Milestone                                        | State                                                                                |
| :----------------------------------------------- | :----------------------------------------------------------------------------------- |
| M1 Repo + ingest                                 | ✅                                                                                   |
| M2 Embeddings + Events                           | ✅ thresholds tuned from labelled pairs                                              |
| M3 Cards                                         | ✅ prompt v2 (perspectives); v3 facts-only while they are paused                       |
| M4 Stories, summaries, nightly job, budget brake | ✅ (R2 backup and alert webhook moved to M7)                                         |
| M5 API + admin                                   | ✅ built; gate pending (7 days unattended under $1.50/day)                           |
| M6 Mobile app                                    | in progress: home screen, History, Story so far, optional Google sign-in (M6b), Account page and Appearance built |
| M7 Hardening, M8 Closed beta                     | not started                                                                          |

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
  app/(tabs)/          Explore (search, trending topics, developing stories, most covered) · Home · Account
  app/story/[id].tsx   a storyline opened from Explore: latest story-so-far + timeline
  src/components/      card, perspective swipe, action bar, category strip, feed pager, bottom bar; explore/ for the Explore tab
  src/lib/             pure helpers (relative time, image height, progress, share text), unit-tested
  src/theme/tokens.ts  colours, fonts and sizes taken from the design artboard
packages/designs     the design artboard (reference mockup, not code)
packages/db          Drizzle schema, migrations, client, sources seed, Event/Story ops shared by worker and admin
packages/shared      config.ts (every threshold, window, limit and model ID) and api.ts (zod schemas of the public API)
docker/              Postgres init (creates the fr_test database)
data/                labels, card reports (git-ignored)
```

## Run it locally

This walks through the whole stack on one Mac: Postgres in Docker, then the worker, the API and the mobile app running from source. All commands run from the repo root unless a step says otherwise. Once everything is set up you will have four terminals open:

| Terminal | Command                                           | Purpose                                                                   |
| :------- | :------------------------------------------------ | :------------------------------------------------------------------------ |
| 1        | `docker compose up -d` (runs in the background) | Postgres 16 + pgvector on `localhost:5432`                              |
| 2        | `pnpm worker:start`                             | Pipeline: a tick every 15 min, nightly job at 02:30 IST, admin regen jobs |
| 3        | `pnpm api:start`                                | Public `/v1` API and `/admin` on `localhost:3000`                   |
| 4        | `pnpm mobile`                                   | Expo / Metro bundler for the app                                          |

### 1. Install the prerequisites

| Tool           | Version                                            | Check                      | Notes                                                                                                                                                                                 |
| :------------- | :------------------------------------------------- | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js        | ≥ 24                                              | `node -v`                | `nvm install 24` or `brew install node@24`                                                                                                                                        |
| pnpm           | 12 (pinned to `pnpm@12.8.1` in `package.json`) | `pnpm -v`                | `corepack enable`. Corepack then uses the pinned version automatically                                                                                                              |
| Docker         | Docker Desktop (or OrbStack / Colima)              | `docker compose version` | Must be running before step 3                                                                                                                                                         |
| Gemini API key | free tier is fine                                  |                            | Create one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Without it the worker only ingests (no Events beyond step 6, no cards), so the app has nothing to show |

For the mobile app you also need one of these:

- **Android (main target):** Android Studio with an Android SDK and platform tools, and JDK 17 (Android Studio's bundled JDK works). Put the SDK on your path, in `~/.zshrc`:

  ```sh
  export ANDROID_HOME="$HOME/Library/Android/sdk"
  export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  ```

  Then either create an emulator (Android Studio → Device Manager) or connect a phone with Developer options and USB / wireless debugging on. `adb devices` should list it.
- **iOS simulator (optional):** Xcode with a simulator runtime installed, and CocoaPods (`brew install cocoapods`).

Expo Go is not enough: the app uses native modules (gesture handler, Reanimated, pager-view, Google sign-in), so it runs as a development build that you compile once (step 7).

### 2. Clone, install and configure

```sh
git clone <repo-url> fr-app && cd fr-app
pnpm install                  # installs every workspace (apps/*, packages/*)
cp .env.example .env
```

Edit the root `.env`. Every app (worker, API, db scripts) loads it with `--env-file-if-exists`:

| Variable                                        | Local value                                               | Why                                                                     |
| :---------------------------------------------- | :-------------------------------------------------------- | :---------------------------------------------------------------------- |
| `DATABASE_URL`                                | `postgres://fr:fr@localhost:5432/fr` (already set)      | Dev database created by compose                                         |
| `TEST_DATABASE_URL`                           | `postgres://fr:fr@localhost:5432/fr_test` (already set) | Used only by `pnpm test`, which truncates it                          |
| `GEMINI_API_KEY`                              | your key                                                  | Embeddings, cards, Stories, summaries                                   |
| `GEMINI_FREE_TIER`                            | `true`                                                  | Keeps you under the free-tier daily caps (see "Gemini free tier" below) |
| `PERSPECTIVES_ENABLED`                        | `false`                                                 | Left/right perspectives; paused (see "Perspectives (paused)" below)    |
| `ADMIN_USER`, `ADMIN_PASSWORD`              | anything, e.g. `admin` / `admin`                      | The admin at `/admin` is turned off while either is empty             |
| `GOOGLE_WEB_CLIENT_ID`                        | `REPLACE_ME` until you have one                         | Google sign-in; the API answers 503 to sign-in while it is a placeholder |
| `R2_*`, `ALERT_WEBHOOK_URL`, `SENTRY_DSN` | leave empty                                               | Not used until M7                                                       |
| `EXPO_PUBLIC_API_BASE_URL`                    | leave empty here                                          | The app reads its own `apps/mobile/.env` instead (step 7)             |

`.env` is git-ignored. Never commit it.

### 3. Start Postgres

```sh
docker compose up -d postgres # starts only the postgres service if running worker & api on the host
docker compose ps             # wait until postgres shows "healthy"
docker compose exec postgres psql -U fr -c '\l'   # should list both fr and fr_test
```

The container is `pgvector/pgvector:pg16`, bound to `127.0.0.1:5432`, with user, password and database all `fr`. Data lives in the `pgdata` Docker volume, so it survives restarts. `docker/init-test-db.sql` creates `fr_test`, but only the first time the volume is created. If `fr_test` is missing, create it by hand:

```sh
docker compose exec postgres psql -U fr -c 'CREATE DATABASE fr_test'
```

If the port is taken (`address already in use`), another Postgres is running on 5432. Stop it (`brew services stop postgresql@16`, for example) or change the left side of the port mapping in `docker-compose.yml` and both URLs in `.env`.

### 4. Create the schema and seed the sources

```sh
pnpm db:migrate               # applies packages/db/migrations (pgvector extension, tables, enums); prints "migrations applied"
pnpm db:seed                  # upserts 12 active outlets with real feeds + 13 inactive TODO candidates
```

Both are safe to re-run. `pnpm db:seed --all-feeds` adds the extra section feeds that are left out by default to stay within the Gemini free tier. pg-boss creates its own `pgboss` schema the first time the worker or API starts.

Check the result in Drizzle Studio (`pnpm db:studio`, then open https://local.drizzle.studio) or with psql:

```sh
docker compose exec postgres psql -U fr -c 'select name, active from sources order by active desc, name'
```

### 5. Run the worker

First check that feeds can be fetched, without writing anything or calling Gemini:

```sh
pnpm worker:tick --dry-run    # logs per-step counts, then "dry run: nothing written, later steps skipped"
```

Then fill the database by hand with two real ticks:

```sh
pnpm worker:tick              # 1st: ingest → embed → assign articles to new Events (status collecting)
pnpm worker:tick              # 2nd: Events from the 1st tick get cards → published → Stories → summaries
```

Cards wait one tick on purpose (pipeline step 7), so the first tick never publishes anything. Each step logs a line like `cards: {...} in 4.2s`, and the tick ends with `tick finished in …s`. The first tick on an empty database takes a few minutes: it fetches every feed and, for thin RSS items, the article page (at most one request every 3 s per domain). Check what came out:

```sh
docker compose exec postgres psql -U fr -c 'select status, count(*) from events group by 1'
```

You want some `published` rows. Then leave the long-running worker going in its own terminal:

```sh
pnpm worker:start             # "worker started, tick schedule: */15 * * * *, nightly: 30 2 * * * Asia/Kolkata"
```

It ticks on every quarter hour, runs the nightly job at 02:30 IST, and runs admin regenerate jobs from the API. A manual `pnpm worker:tick` while it runs is safe: the advisory lock makes one of them log `tick already running, skipping`. Stop it with Ctrl-C.

On the free tier the day's quota can run out. Look for `DailyQuotaReached` in the log, or check the cost page in the admin. Ingestion stops after 250 new articles per IST day, so later ticks that day may add nothing. Events older than 24 h are never carded or served, so a database left alone for a few days shows an empty feed until the worker runs again.

### 6. Run the API

```sh
pnpm api:start           # Fastify on 0.0.0.0:3000 (logs JSON lines)
PORT=3077 pnpm api:start      # if something else already uses 3000
```

Check it from another terminal:

```sh
curl -s localhost:3000/v1/config                      # {"showAiLabel":false,"minAppVersion":"1.0.0"}
curl -s 'localhost:3000/v1/feed?limit=2' | head -c 600 # published cards; "items": [] means no published Events yet (go back to step 5)
curl -s localhost:3000/v1/categories
```

Open the admin at http://localhost:3000/admin and ign in with `ADMIN_USER` / `ADMIN_PASSWORD`. It lists Events, Stories and Sources and has a 30-day cost page. Regenerate and "make contested" only queue a job, so the worker from step 5 must be running for them to take effect.

### 7. Run the mobile app

**a. Point the app at the API.** The app reads `apps/mobile/.env`, not the root `.env`. `EXPO_PUBLIC_*` values are inlined into the bundle when Metro builds it. Pick the URL for where the app runs:

| App runs on                            | `EXPO_PUBLIC_API_BASE_URL` | Extra step                                                                                             |
| :------------------------------------- | :--------------------------- | :----------------------------------------------------------------------------------------------------- |
| iOS simulator                          | `http://localhost:3000`    | none: the simulator shares the Mac's network                                                           |
| Android emulator                       | `http://10.0.2.2:3000`     | none: `10.0.2.2` is the emulator's alias for the Mac                                                 |
| Android phone over USB or wireless adb | `http://localhost:3000`    | `adb reverse tcp:3000 tcp:3000` (and `tcp:8081` for Metro), see below                              |
| Any phone on the same Wi‑Fi, no adb   | `http://<Mac LAN IP>:3000` | find the IP with `ipconfig getifaddr en0`; allow incoming connections for Node in the macOS firewall |

```sh
echo "EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000" > apps/mobile/.env
```

Use the port the API actually listens on (3077 if you started it with `PORT=3077`). Without the variable the app falls back to `http://localhost:3000`.

**b. Build and install the development build (once, and again after native changes).** Start an emulator or connect the phone first, then:

```sh
pnpm --filter @fr/mobile android     # expo run:android: generates apps/mobile/android (git-ignored), builds with Gradle, installs, starts Metro
pnpm --filter @fr/mobile ios         # same for the iOS simulator (generates apps/mobile/ios, runs pod install)
```

The first Android build takes 5–15 minutes while Gradle downloads its dependencies; later builds are incremental. Rebuild after adding a native package, changing `app.json`, or changing icons or splash images (`pnpm exec expo prebuild -p android --clean` from `apps/mobile` regenerates the native project).

**c. Day to day, just start Metro** and open the already installed FirstReport app (or press `a` / `i` in the Metro terminal):

```sh
pnpm mobile                          # expo start
pnpm mobile --clear                  # after editing apps/mobile/.env, so the new URL is inlined
```

**Physical Android phone.** For USB, plug it in and accept the debugging prompt. For Wi‑Fi, pair once (Developer options → Wireless debugging → Pair device with pairing code, then `adb pair <ip:port>`); adb reconnects by itself after that. Each session, route the phone's `localhost` to the Mac:

```sh
adb devices                          # one line per device; if the phone shows twice, add -s <serial> to the commands below
adb reverse tcp:3000 tcp:3000        # API (use 3077 if the API runs on 3077)
adb reverse tcp:8081 tcp:8081        # Metro
```

The reverse rules disappear whenever the connection drops. "Couldn't load the news." on the phone usually means they need re-running.

A debug build runs JavaScript unoptimised, so judge scrolling smoothness on a release build: `pnpm exec expo run:android --variant release --device` from `apps/mobile`.

### 8. Run the tests and type checks

```sh
pnpm test                     # Vitest in every package, one at a time; DB tests use fr_test and truncate it; Gemini is mocked
pnpm typecheck                # tsc across all packages
```

Postgres must be up for `pnpm test`. The tests never touch the `fr` database or call the real Gemini API.

### Alternative: worker and API in Docker

To run the backend the way the VPS does, instead of steps 4–6:

```sh
docker compose up -d --build                           # postgres → migrate (one-off) → worker + api on :3000
docker compose run --rm migrate pnpm db:seed           # seed once
docker compose logs -f worker api
```

The containers read the same root `.env`, but compose points `DATABASE_URL` at the `postgres` service. Don't also run `pnpm worker:start` / `pnpm api:start` on the host at the same time (port 3000 clashes). The mobile app still runs from source as in step 7. Stop the services with `docker compose down`.

### Stopping and resetting

| Goal                                   | Command                                                                                    |
| :------------------------------------- | :----------------------------------------------------------------------------------------- |
| Stop worker, API, Metro                | Ctrl-C in their terminals                                                                  |
| Stop Postgres, keep data               | `docker compose down`                                                                    |
| Wipe the database completely           | `docker compose down -v`, then steps 3–5 again                                          |
| Keep articles, redo grouping and cards | `pnpm events:reset` (clears Events, Stories, summaries), then `pnpm worker:tick` twice |

### Troubleshooting

| Symptom                                                         | Cause and fix                                                                                                                                              |
| :-------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL is not set`                                     | No root `.env`. Run `cp .env.example .env`                                                                                                             |
| `ECONNREFUSED 127.0.0.1:5432`                                 | Postgres is not running. `docker compose up -d`, wait for healthy                                                                                        |
| `type "vector" does not exist`                                | Migrations not applied. `pnpm db:migrate`                                                                                                                |
| `GEMINI_API_KEY is not set: Gemini steps skipped`             | Add the key to the root `.env`                                                                                                                           |
| Ticks run but no Events get published                           | The first tick never publishes; run a second. Otherwise look for `DailyQuotaReached` or Gemini errors in the log, and for `failed` Events in the admin |
| Feed in the app is empty                                        | `curl localhost:3000/v1/feed` returns no items: published Events are older than 24 h. Run `pnpm worker:tick` twice                                     |
| "Couldn't load the news."                                       | Wrong `EXPO_PUBLIC_API_BASE_URL` for the device, missing `adb reverse`, or the API is down. Fix it, then `pnpm mobile --clear`                       |
| Changed `apps/mobile/.env` but the app still uses the old URL | The value is inlined at bundle time: restart Metro with `--clear`                                                                                        |
| `/admin` returns 404                                          | `ADMIN_USER` or `ADMIN_PASSWORD` is empty; set both and restart the API                                                                                |
| `EADDRINUSE :3000`                                            | Another process (or the Docker `api` service) is on 3000. Stop it or use `PORT=3077 pnpm api:start` and match the app's URL                            |
| `pnpm test` fails with `database "fr_test" does not exist`  | Create it (see step 3)                                                                                                                                     |
| Android build: `SDK location not found` / wrong Java          | Set `ANDROID_HOME` and `JAVA_HOME` (step 1) and open a new terminal                                                                                    |

## Running

| Command                                             | What it does                                                                                      |
| :-------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| `pnpm worker:tick --dry-run`                      | Fetch and parse feeds, write nothing, skip the Gemini steps                                       |
| `pnpm worker:tick`                                | Run one full tick now                                                                             |
| `pnpm worker:start`                               | Long-running worker: tick every 15 min, nightly at 02:30 IST                                      |
| `pnpm api:start`                                  | API on port 3000: `/v1/*` and the admin at `/admin` (needs `ADMIN_USER`/`ADMIN_PASSWORD`) |
| `pnpm mobile`                                     | Expo dev server for the app (see "Mobile app" below)                                              |
| `pnpm worker:nightly`                             | Run the nightly job now (waits for a running tick)                                                |
| `pnpm label:pairs`                                | Label article pairs (same event?) → `data/labels.csv`                                          |
| `pnpm label:pairs --events`                       | Label Event pairs (same storyline?) → `data/story-labels.csv`                                  |
| `pnpm label:report [--events]`                    | Precision/recall per threshold, with suggested `EVENT_*` / `STORY_*` values                   |
| `pnpm cards:report [--n 30] [--from <report.md>]` | Generate cards for recent Events without saving them → `data/cards-<date>-v<prompt>.md`        |
| `pnpm events:reset`                               | Dev only: clear Events, Stories and summaries so articles are reassigned                          |
| `pnpm test`                                       | Vitest for every package, one package at a time (they share the `fr_test` database)             |
| `pnpm typecheck`                                  | `tsc` across all packages                                                                       |
| `pnpm db:generate`                                | Generate a migration after editing `packages/db/src/schema.ts`                                  |
| `pnpm db:studio`                                  | Browse and edit the dev database in Drizzle Studio (https://local.drizzle.studio)                 |

Without `GEMINI_API_KEY`, a tick only ingests and skips every Gemini step.

## API and admin

Public, read-only, `Cache-Control: public, s-maxage=60`:

| Endpoint                                      | Returns                                                                                                                                                                                |
| :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/feed?category=&cursor=&limit=20`   | Published cards, newest first with a small multi-source boost; `nextCursor` for the next page; `windowTotal` (the category's cards from the last 24 h, for the app's progress bar) |
| `GET /v1/events/:id`                        | One card. A merged Event answers 301 to the Event it was merged into                                                                                                                   |
| `GET /v1/stories/:id/timeline`              | The Story's published Events, oldest first                                                                                                                                             |
| `GET /v1/stories/:id/summary?asOf=:eventId` | The story-so-far as of that Event, or 404                                                                                                                                              |
| `GET /v1/categories`, `GET /v1/config`    | Category labels; `{ showAiLabel, minAppVersion }`                                                                                                                                    |
| `GET /privacy`, `GET /terms`               | Privacy policy (with `#delete-account`) and terms of use, static HTML; contact `info@firstreport.news` |
| `GET /v1/explore`                           | Explore tab: `developing` (active Stories with 3+ Events updated in the last 72 h), `mostCovered` (today's Events by number of outlets, 2+), `topics` (entities in 2+ of today's Events) |
| `GET /v1/search?q=&limit=20`                | Full-text search (`events.search_doc`, GIN-indexed) over published cards from the last 30 days, best match first; 400 if `q` is under 2 characters |

Per user, `Cache-Control: private, no-store` (a separate Fastify plugin, so the public cache header never reaches them):

| Endpoint                     | Does                                                                                         |
| :--------------------------- | :------------------------------------------------------------------------------------------- |
| `POST /v1/auth/google`     | `{ idToken }` → `{ token, user }`; 401 for a token Google rejects, 503 while not configured |
| `GET /v1/me`               | The signed-in user (`Authorization: Bearer <token>`), or 401                                  |
| `POST /v1/auth/signout`    | Ends that session                                                                            |
| `DELETE /v1/account`       | Deletes the user and all its sessions                                                       |

The admin at `/admin` uses HTTP basic auth (`ADMIN_USER`/`ADMIN_PASSWORD`; it is off when they are unset). It has Events (hide, unhide, regenerate, flip contested, merge, move to Story), Stories (rename, merge), Sources (toggle) and a 30-day cost page. Regenerate and "make contested" queue a pg-boss `regen` job that the worker runs between ticks, so the API never calls Gemini. Forms are only accepted from the admin's own origin.

## Sign-in (optional)

Reading never needs an account. Signed-out readers see a centred sign-in popup after their 3rd, 5th and 7th card, then every 7th (`AUTH_PROMPT_AT`, `AUTH_PROMPT_EVERY` in `config.ts`). Each card counts once, across app opens, and the popup only opens once the reader rests on a card and no other sheet is open. The Account tab always offers Log in and Sign up (both run Google sign-in), and once signed in shows the profile, Sign out and Delete account.

Only Google is offered, through `@react-native-google-signin/google-signin` (wrapped in `apps/mobile/src/auth/google.ts`). The phone gets a Google ID token, `POST /v1/auth/google` checks it with `google-auth-library` and returns an opaque session token (only its sha256 is stored, in `sessions`). The app keeps the token in `expo-secure-store`.

To turn it on:

1. In the Google Cloud console, create OAuth clients: a **Web** client, and an **Android** client with package `in.firstreport.app` and the SHA-1 of your signing key (`cd apps/mobile/android && ./gradlew signingReport` for debug; Play's app-signing key for store builds). For iOS, an **iOS** client too.
2. Put the Web client ID in `GOOGLE_WEB_CLIENT_ID` (root `.env`) and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (`apps/mobile/.env`). For iOS, replace `REPLACE_ME` in the `iosUrlScheme` in `apps/mobile/app.json` with the iOS client's reversed ID.
3. Rebuild the development build (step 7b) and restart Metro with `--clear`.

The terms and privacy links in the popup's fine print (and the Privacy policy and Terms rows on the Account page, which read "Soon" until then) are plain text until `LEGAL` in `apps/mobile/src/auth/copy.ts` gets URLs (M7). The popup's and Account page's words are in `COPY` in the same file.

## Mobile app

The app reads the public `/v1` API, plus the sign-in routes above, and holds no secrets. How to point it at the API, build it and run it on an emulator or phone is in [Run it locally](#run-it-locally), step 7.

App icons and splash logos live in `apps/mobile/assets/images`. `scripts/build-icons.py` makes the icons from `assets/first-report-icon-light.png`: iOS light, dark and tinted, and the Android adaptive icon with a monochrome layer for themed icons. `scripts/build-splash-logo.py` makes the light and dark splash wordmarks from `assets/first-report-logo-light.png`. The command is in each script's header. Android 12+ shows the splash logo inside a 192dp circle, so it is 184dp wide there and 260dp on iOS. After changing them, regenerate the native project: `npx expo prebuild -p android --clean`.

The UI follows the artboard in [`packages/designs`](packages/designs). Light colours, type sizes and spacing are copied from it into `src/theme/tokens.ts`; dark values are derived. The headline font is a static cut of Newsreader at optical size 26 (`assets/fonts`), because the Google Fonts package only ships optical size 16.

## Deploy (VPS)

The `Dockerfile` builds one image for every app; `docker-compose.yml` picks the command. Running `docker compose up -d` starts Postgres, runs database migrations, and launches both worker and API services.

```sh
cp .env.example .env          # GEMINI_API_KEY, GEMINI_FREE_TIER=false, ADMIN_USER/ADMIN_PASSWORD
docker compose up -d --build   # postgres → migrate (one-off) → worker + api (:3000)
docker compose run --rm migrate pnpm db:seed --all-feeds
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

## Perspectives (paused)

Left/right perspectives are off unless `PERSPECTIVES_ENABLED=true`, read by the worker and the API. While it is off:

- The card prompt is the facts-only v3: Gemini's schema has no `contested`, `contested_reason`, `left` or `right`, so it writes none. New cards store those columns as null.
- The API leaves `contested`/`left`/`right` out of every card (even cards stored with them) and `showAiLabel`/`perspectives` out of `/v1/config`.
- The admin shows no perspective texts or flip button, and `flip-contested` answers 404. A queued flip job is dropped.
- The app needs no change: a card without `contested: true` is plain text with no tabs, labels or swipe.

Turning it on brings back prompt v2 and everything above, with no app release. Old cards keep their stored perspectives; cards written while it was off have none until they are regenerated.

## Configuration

All tunables are in [`packages/shared/src/config.ts`](packages/shared/src/config.ts). Environment variables are listed in [`.env.example`](.env.example). `R2_*`, `ALERT_WEBHOOK_URL` and `SENTRY_DSN` are not used yet. They arrive with M7. `EXPO_PUBLIC_API_BASE_URL` belongs in `apps/mobile/.env`.
