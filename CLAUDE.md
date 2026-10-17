# FirstReport — Project Brief for Claude Code

You are the engineering partner on **FirstReport**, a mobile-first Indian news aggregator in the style of Inshorts. It is built by **one developer, solo**, in **Node.js/TypeScript**, on a **hard budget of about \$20–40/month**. Read this whole file before writing any code. The decisions in it are settled. If you think one is wrong, say so and wait for an answer; do not quietly change it.

---

## 1\. What the product does

FirstReport shows news as full-screen cards:

- **Swipe up/down:** next or previous news card. Newest first, filterable by category.  
- **Swipe left/right on a card:** switch perspective.  
  - Center (default) \= **Neutral** fact-based summary (green badge)  
  - Swipe right \= **Left-wing** perspective (red badge)  
  - Swipe left \= **Right-wing** perspective (purple badge)  
  - If the story is **not contested** (accident, weather, sports result, obituary, science), only the Neutral card exists. Show a **"Facts only"** badge and disable horizontal swipe.  
- **Every text is at most 60 words.**  
- **Action bar on each card:**  
  - **History** (clock): the timeline of earlier events in the same storyline. Tapping one opens that card.  
  - **Summary** (compress): a "story so far" overview, as of the date of the card being read.  
  - **Source / Share:** open the original article, or share the card text.  
  - Hide History and Summary when the storyline has only one event.  
- Category side menu (National & Politics, Business & Economy, Technology, Sports, Entertainment, World), dark mode.

**Deferred to v1.1. Do NOT build these now:** polls, hands-free text-to-speech with auto-swipe, PDF export. Leave room for them in the design, but write no code for them.

---

## 2\. Settled decisions (do not change without asking)

| Area | Decision |
| :---- | :---- |
| Ingestion | **RSS first.** Fetch the article HTML page only when the RSS text is thin (\< \~60 words). No per-site HTML scrapers. |
| Scale | 15–25 English-language Indian sources, \~1–2k articles/day, giving \~150–300 Events/day |
| Freshness | Worker runs every **15 minutes**; new stories appear within \~30 min |
| AI provider | **Google Gemini only** (embeddings \+ text generation). No other paid AI. |
| Perspectives | **Fully AI-generated** by Gemini from the Event's merged facts. Fact-locked: no facts, numbers or quotes beyond the sources. |
| AI label | **Not shown at launch**, behind config flag `SHOW_AI_LABEL` (default `false`) |
| Uncontested news | Neutral only, swipe disabled, "Facts only" badge |
| Storylines | Automatic: embeddings \+ a Gemini yes/no for borderline cases. No human curation. |
| Card updates | Rewrite a published card only on a **material change** (new facts), **max 3 rewrites** per Event |
| Summary | Updated **incrementally** whenever a Story gets a new Event; **one stored version per Event** |
| Feed order | Newest first \+ category filter, small boost for multi-source Events |
| Images | Hotlink the source's `og:image` / RSS media URL with outlet credit; category placeholder as fallback. Never re-host images. |
| Users | No login. Anonymous device ID (only needed later for polls). |
| Language | English only |
| RAG | **None.** No LangChain, no vector DB service, no retrieval framework. Embeddings live in Postgres (pgvector) and are used only for grouping. Story history is a plain SQL query. |
| Infra | One small VPS (2 vCPU / 4 GB) running Docker Compose: Postgres \+ worker \+ API. Cloudflare in front of the API. **No Redis, no Kubernetes, no queues besides pg-boss.** |
| Timeline | Play Store (Android) closed beta in \~8–10 weeks |
| Admin | One minimal password-protected web admin served by the API |

---

## 3\. Tech stack

- **Monorepo:** pnpm workspaces, TypeScript strict mode everywhere.  
    
  apps/worker     \# the ingestion \+ AI pipeline (pg-boss jobs)  
    
  apps/api        \# Fastify REST API \+ server-rendered admin pages  
    
  apps/mobile     \# Expo (React Native) app  
    
  packages/db     \# drizzle schema, migrations, typed queries  
    
  packages/shared \# zod schemas, types, config constants shared by all apps  
    
- **Database:** PostgreSQL 16 \+ `pgvector`. ORM: **drizzle**. Migrations are checked in.  
- **Jobs:** `pg-boss` (Postgres-backed queue and cron). The 15-minute tick must never overlap itself: use a singleton job or a Postgres advisory lock.  
- **RSS:** `rss-parser`, with conditional GET (send `If-None-Match` / `If-Modified-Since`, honour 304).  
- **Article text:** `@mozilla/readability` \+ `jsdom`, only when the RSS text is thin.  
- **Gemini:** the official `@google/genai` SDK. Use structured JSON output (`responseSchema`). Keep all model IDs in config; **check the current model names in Google's docs** before hard-coding. Starting values: embeddings `gemini-embedding-001` (outputDimensionality 768, taskType `SEMANTIC_SIMILARITY`); text `gemini-2.5-flash-lite`, with `gemini-2.5-flash` as an optional card model. If a 2.5 Flash model with "thinking" is used, set the thinking budget to 0\.  
- **API:** Fastify \+ zod validation. Responses are cacheable (`Cache-Control: public, s-maxage=60`) so Cloudflare can absorb traffic.  
- **Mobile:** Expo, expo-router, TanStack Query, `react-native-pager-view` (vertical feed), `react-native-gesture-handler` \+ `react-native-reanimated` (horizontal perspective swipe), `expo-image` (cached hotlinked images with fallback).  
- **Testing:** Vitest. Saved RSS/HTML fixtures, so the pipeline can be replayed offline without network or Gemini cost (mock the Gemini client).  
- **Errors:** Sentry free tier (API \+ app), added in the hardening milestone.

---

## 4\. Core concepts (read carefully — this is where people get confused)

- **Article:** one URL from one outlet. Raw input. \~1,500/day.  
- **Event:** one real-world happening. A group of Articles from many outlets about the same thing. **One Event \= one card in the app.** \~250/day.  
- **Story:** a chain of Events over days or weeks (collapse → arrest → compensation). Powers History and Summary. A one-off news item is simply a Story with one Event.  
- **Embedding:** 768 numbers per Article, computed **once** by Gemini from `title + lede` and stored. Normalise to unit length before storing, because reduced-dimension Gemini embeddings are not pre-normalised.  
- **Cosine similarity:** plain math between two stored embeddings, done in Postgres with pgvector (`<=>` is cosine distance; similarity \= `1 - distance`). It never calls Gemini.  
- **Event centroid:** the normalised mean of its member Articles' embeddings, recomputed whenever an Article joins.

**What is compared with what (never "with all the data"):**

| Comparison | New item | Compared against | Window |
| :---- | :---- | :---- | :---- |
| Near-duplicate (same site re-post) | Article | Articles from the **same source** | 72 h |
| Event assignment | Article | **Event centroids** (status ≠ merged/hidden) | Events with `last_article_at` in the last 72 h |
| Story linking | Event | Centroids of the **last 3 Events** of each **active** Story | Stories with `last_event_at` in the last 30 days |

**Articles must be assigned to Events one at a time, in order, even within one batch**, so that article \#2 can match the Event article \#1 just created. Never run assignment in parallel.

---

## 5\. Data model (drizzle schema in `packages/db`)

All ids are `uuid` or prefixed text ids (your choice; be consistent). `sources` — filled by the developer (seed script / admin); lightly updated by the worker

| Field | Type | Notes |
| :---- | :---- | :---- |
| id | pk |  |
| name | text | "Indian Express" |
| domain | text |  |
| rss\_urls | text\[\] | one or more section feeds |
| active | bool | default true |
| lean | text null | unused in v1, kept for future grounded perspectives |
| etag, last\_modified | text null | per feed URL; store as jsonb keyed by URL if needed |
| last\_fetched\_at | timestamptz | updated every tick |
| last\_new\_item\_at | timestamptz | updated when new items arrive; alert if \> 24 h old |

### `articles` — created in steps 1–3, completed in steps 4–6

| Field | Type | Set / changed |
| :---- | :---- | :---- |
| id | pk | step 1 |
| source\_id | fk | step 1 |
| url | text | original URL |
| canonical\_url | text | step 2 (normalised) |
| guid | text null | from feed |
| title | text | step 1; updated if the site edits it |
| lede | text | first \~2 paragraphs (step 1 or 3\) |
| body\_text | text null | step 3, only when fetched; **purged after 14 days** |
| content\_hash | text | sha256 of normalised title \+ body/lede |
| image\_url | text null | og:image or RSS media |
| published\_at, fetched\_at, updated\_at | timestamptz |  |
| embedding | vector(768) null | step 4 |
| event\_id | fk null | step 6; changed by nightly merge |
| status | enum | `new` → `assigned`; or `skipped` (filtered) |

Unique constraints: `(source_id, canonical_url)`, `(source_id, guid)` where guid not null, `(source_id, content_hash)`. Exact repeats are rejected by these constraints (use `ON CONFLICT DO NOTHING`), **never stored twice**. **Same-site re-post / edited article:** do NOT insert a new row. Update the existing row in place (title, lede, hash, embedding, updated\_at), and mark its Event `needs_recheck = true`.

### `events` — created in step 6, card filled in steps 8–9, updated on every join

| Field | Type | Set / changed |
| :---- | :---- | :---- |
| id | pk | step 6 |
| status | enum `collecting | published | hidden | failed | merged` | `collecting` at creation → `published` after a valid card |
| centroid | vector(768) | step 6; recomputed on every join |
| article\_count | int | every join |
| first\_seen\_at | timestamptz | step 6; **feed sort key**, never changes |
| last\_article\_at | timestamptz | every join (keeps it inside the 72 h window) |
| headline | text null | step 8 |
| neutral | text null | step 8 (≤ 60 words) |
| contested | bool null | step 8; admin can flip |
| contested\_reason | text null | step 8 |
| left\_text, right\_text | text null | step 8; must be null if not contested |
| category | enum | step 8 |
| entities | text\[\] | step 8 (people, places, orgs) |
| story\_label | text null | step 8 (hashtag-style, e.g. `KesarganjBridgeCollapse`) |
| image\_url | text null | from the first member article with an image |
| story\_id | fk null | step 10 |
| regen\_count | int default 0 | \+1 per step-12 rewrite, max 3 |
| needs\_recheck | bool default false | set when an article joins or is edited after publishing |
| gen\_version | int | prompt version used, so prompt fixes can be re-run |
| merged\_into\_id | fk null | set by the nightly merge on the losing twin |
| card\_generated\_at | timestamptz null |  |

### `stories` — created in step 10, updated when Events join

| Field | Type | Notes |
| :---- | :---- | :---- |
| id | pk |  |
| label | text | copied from the first Event's `story_label` |
| event\_count | int | the app hides History/Summary when this is 1 |
| first\_event\_at, last\_event\_at | timestamptz |  |
| status | enum `active | dormant` | dormant after 30 days with no new Event (nightly) |

### `story_summaries` — append-only, created in step 11

`id, story_id, as_of_event_id, summary (~120 words), created_at`. One row each time an Event joins a Story that already had ≥ 1 Event. Never updated.

### `llm_calls` — append-only, one row per Gemini call

`id, purpose (embed | same_event | card | validate_retry | story_link | summary | material_change), model, input_tokens, output_tokens, cost_usd, latency_ms, ok, error, created_at`. Compute `cost_usd` from a price table in config.

### `admin_actions` — append-only

`id, action (hide | unhide | regen | flip_contested | merge_events | move_event | merge_stories | toggle_source), target_id, note, created_at`.

**Indexes:** `events(status, first_seen_at desc)`, `events(category, first_seen_at desc)`, `events(story_id, first_seen_at)`, `events(last_article_at)`, `articles(source_id, published_at)`, `articles(event_id)`. No vector index needed at this scale (≤ \~5k rows per window). Revisit only if a query takes \> 50 ms.

---

## 6\. The worker pipeline (`apps/worker`)

One **tick** every 15 minutes (cron `*/15 * * * *` via pg-boss, non-overlapping). Each step logs counts. Every Gemini call goes through one wrapper that retries with exponential backoff on 429/5xx, writes an `llm_calls` row, and enforces the daily budget.

1. **Fetch.** For each active source and feed URL, make a conditional GET. Parse items. Skip items matching filter patterns (URL contains `/live/`, `live-updates`, `/opinion/`, `/editorial/`, `/blogs/`; titles like "Top 10", "Morning brief", "Horoscope"; patterns live in config). Insert as `articles` with status `new`.  
2. **Dedupe by address.** Normalise the URL: lowercase host, drop `utm_*`/`fbclid`/`gclid`/`ref` params, `/amp` suffixes, `amp.`/`m.` subdomains, trailing slash, fragment. Unique constraints drop repeats.  
3. **Extract \+ hash.** If the RSS text is \< 60 words, fetch the page (polite: ≤ 1 request every 3 s per domain, real User-Agent, respect robots.txt) and run Readability. Set `lede` (first \~2 paragraphs, max \~120 words) and `content_hash`. A duplicate hash for the same source is dropped.  
4. **Embed.** Batch-embed `title + "\n" + lede` for new articles (up to 100 per request). Normalise and store.  
5. **Same-site near-duplicate.** If cosine ≥ `NEAR_DUP_SAME_SOURCE` (0.95) with an article from the **same source** in the last 72 h, treat it as an edit of that article: update the old row in place, delete the new one, flag the Event `needs_recheck`.  
6. **Assign to Events — sequentially, ordered by `published_at`.** For each article, get the top 3 candidate Events by centroid cosine (72 h window, status in `collecting`/`published`).  
   - best ≥ `EVENT_JOIN` (0.85): join it  
   - `EVENT_BORDER_LOW` (0.75) ≤ best \< 0.85: ask Gemini Flash-Lite "same real-world event? yes/no" with both titles \+ ledes. Yes → join; no → new Event  
   - best \< 0.75: create a new Event (`collecting`, centroid \= this embedding)  
   - On join: recompute the centroid, bump `article_count` and `last_article_at`; if the Event is already `published`, set `needs_recheck = true`.  
7. **Wait one tick.** Only Events with status `collecting` **created before this tick started** move on to step 8\. This lets sibling articles arrive, so cards are written from several sources.  
8. **Write the card.** One Gemini call per Event. Input: ledes of up to 5 member articles, preferring different sources, \~2–3k tokens. Output JSON:  
     
   {  
     
     "headline": "≤ 12 words",  
     
     "category": "national | business | technology | sports | entertainment | world | other",  
     
     "neutral": "≤ 60 words",  
     
     "contested": true,  
     
     "contested\_reason": "one line, or null",  
     
     "left": "≤ 60 words, or null",  
     
     "right": "≤ 60 words, or null",  
     
     "entities": \["..."\],  
     
     "story\_label": "PascalCaseHashtag"  
     
   }  
     
   Prompt rules (keep the prompt in `apps/worker/src/prompts/card.ts`, versioned with `gen_version`):  
     
   1. Neutral states only facts present in the supplied articles; no loaded adjectives.  
   2. Left/right argue **from** those facts. They never add new facts, numbers, quotes or events.  
   3. Define left and right by **values**, not parties. Left: welfare, civil liberties, minority rights, labour, state accountability. Right: national security, markets, fiscal discipline, tradition, cultural nationalism.  
   4. Never attribute words to a named real person ("Critics argue…", not "X said…").  
   5. `contested = true` only if there is a genuine public policy or values debate. Accidents, weather, sports results, obituaries, science and market moves are `false` unless the coverage itself is about blame, negligence or policy.  
   6. Indian English, plain words, present tense for current events.  
2. **Validate in code.** Each text ≤ 60 words, headline ≤ 12 words. If `contested = false`, left and right must be null. Every number in `neutral` must appear in at least one source lede. On failure: retry once with a corrective instruction; if it fails again, mark the Event `failed` (it will show in admin). On success: set status `published`, `card_generated_at`, `gen_version`.  
3. **Link to a Story** (newly published Events only). Candidates: `active` Stories with `last_event_at` in the last 30 days. Score \= max cosine between this Event's centroid and the centroids of that Story's **last 3 Events**. Shared entity \= case-insensitive overlap of `entities`.  
   - score ≥ `STORY_JOIN` (0.80) **and** ≥ 1 shared entity: join  
   - score ≥ `STORY_BORDER_LOW` (0.70), or ≥ 0.80 without a shared entity: Gemini yes/no "is this a new development of the same storyline?"  
   - otherwise: new Story (label from `story_label`, `event_count = 1`)  
   - On join: bump `event_count`, set `last_event_at`.  
2. **Update the summary** (only when the Story now has ≥ 2 Events). Input: the previous summary (or, if none, the first Event's neutral text with its date) \+ the new Event's neutral text \+ date. Output: \~120-word chronological "story so far". Insert a `story_summaries` row with `as_of_event_id` \= the new Event.  
3. **Material-change check.** For published Events with `needs_recheck = true`, `regen_count < 3` and `first_seen_at` within 24 h: a Flash-Lite call with the current neutral card \+ the new/edited ledes → `{ "material": bool, "new_facts": [] }`. If material: re-run steps 8–9 with the current member articles, `regen_count += 1`. Always clear `needs_recheck`.

**Nightly job (02:30 IST):**

- Merge twin Events: published/collecting Events from the last 48 h whose centroid cosine similarity is ≥ `EVENT_JOIN`. Keep the older one, move articles, recompute the centroid, set the loser to `merged` with `merged_into_id`, regenerate the survivor's card if needed.  
- Null out `articles.body_text` older than 14 days.  
- Mark Stories dormant after 30 days without an Event.  
- Run `pg_dump` and upload to Cloudflare R2 (S3-compatible).  
- Alert (log \+ optional email/Telegram webhook) for sources with `last_new_item_at` \> 24 h and for Events in `failed`.

**Budget brake:** if today's `sum(llm_calls.cost_usd)` \> `DAILY_BUDGET_SOFT` (\$1.50), skip step 12\. If it is \> `DAILY_BUDGET_HARD` (\$3.00), also pause step 8 and alert.

All thresholds, windows, limits and model IDs live in **`packages/shared/src/config.ts`**, never inline. They are starting values and will be tuned on real data.

---

## 7\. API (`apps/api`, Fastify)

Public, read-only, cacheable:

- `GET /v1/feed?category=&cursor=&limit=20`: published Events ordered by `first_seen_at` desc, with a small boost for multi-source Events (e.g. sort key \= `first_seen_at + least(article_count, 5) * 10 minutes`, configurable). Cursor-based pagination.  
- `GET /v1/events/:id`: one card.  
- `GET /v1/stories/:id/timeline`: the Story's published Events, oldest first (id, headline, first\_seen\_at).  
- `GET /v1/stories/:id/summary?asOf=:eventId`: the summary row for that Event; 404 if none.  
- `GET /v1/categories`  
- `GET /v1/config`: `{ showAiLabel, minAppVersion }`

Card payload:

{

  id, headline, category, firstSeenAt, imageUrl,

  neutral, contested, left, right,          // left/right null when not contested

  sources: { name: string; url: string }\[\], // max 5, newest first

  story: { id: string; eventCount: number } | null

}

Admin (server-rendered HTML, HTTP basic auth via `ADMIN_USER`/`ADMIN_PASSWORD`, never cached):

- Recent Events list with status/category filters. Event detail page: member articles, card texts, and buttons for hide/unhide, regenerate, flip contested, move to Story, merge into another Event.  
- Stories: merge two Stories, rename the label.  
- Sources: toggle active, see `last_new_item_at`.  
- Cost page: daily `llm_calls` totals by purpose for the last 30 days.  
- Every admin action writes `admin_actions`.

---

## 8\. Mobile app (`apps/mobile`, Expo)

- **Feed:** a vertical pager of full-screen cards. Image on top with outlet credit, then headline, then the perspective text pane. A progress bar at the bottom. Infinite scroll via cursor.  
- **Perspective pane:** a horizontal swipe between Left ← Neutral → Right, with badge colours as in §1 and pulsing swipe hints on the first few cards. If `contested = false`: Neutral only, "Facts only" badge, horizontal swipe disabled. If `/v1/config.showAiLabel` is true, show a small "AI-generated viewpoint" tag on the left/right panes.  
- **Action bar:** History (bottom sheet with the timeline; tapping an item opens that Event as a modal card), Summary (bottom sheet, fetched with `asOf` \= the current Event), Source (opens the top source URL), Share (native share with headline \+ current pane text \+ app link). History/Summary hidden when `story.eventCount <= 1`.  
- **Side menu:** categories, dark mode toggle, an "About perspectives" screen (static text explaining how cards are made).  
- **Images:** expo-image with a per-category placeholder on error.  
- The app makes **no AI calls** and holds **no secrets**.

---

## 9\. Environment variables

DATABASE\_URL=

GEMINI\_API\_KEY=

ADMIN\_USER=

ADMIN\_PASSWORD=

R2\_ACCOUNT\_ID= R2\_ACCESS\_KEY\_ID= R2\_SECRET\_ACCESS\_KEY= R2\_BUCKET=

ALERT\_WEBHOOK\_URL=          \# optional

SENTRY\_DSN=                 \# optional

EXPO\_PUBLIC\_API\_BASE\_URL=   \# mobile

Provide `.env.example`. Never commit secrets.

---

## 10\. Build order (milestones)

Work **one milestone at a time**. At the start of each, post a short plan (files, schema changes, tests) and wait for a go-ahead. At the end, give a summary and how to run it.

1. **M1 — Repo \+ ingest (week 1).** Monorepo scaffold, Docker Compose (Postgres 16 \+ pgvector), Drizzle schema for all tables, a seed script for sources (the developer supplies the final RSS URLs; put candidate outlet names in the seed with `TODO` URLs and **do not invent feed URLs**), steps 1–3 with conditional GET, URL normalisation and hashing. A CLI `pnpm worker:tick --dry-run`. Tests for URL normalisation and dedupe. *Done when:* a tick ingests real feeds and re-running it adds 0 duplicates.  
2. **M2 — Embeddings \+ Events (week 2).** The Gemini wrapper with `llm_calls` logging and backoff, steps 4–6, a labelling CLI (`pnpm label:pairs`) that shows 200 random article pairs from the 72 h window and records same/not-same to a CSV, and a script that reports precision/recall per threshold from that CSV. *Done when:* thresholds are chosen from labelled data.  
3. **M3 — Cards (week 3).** Steps 7–9, prompt v1, validators with unit tests, and a script that generates 30 Events with both Flash-Lite and Flash into a side-by-side Markdown report. *Gate:* the developer would publish ≥ 27 of 30 as they stand.  
4. **M4 — Stories \+ summaries \+ nightly (week 4).** Steps 10–12, the nightly job, the budget brake.  
5. **M5 — API \+ admin (week 5).** All endpoints, admin pages, cost page. *Gate:* the pipeline runs 7 days unattended at under \$1.50/day.  
6. **M6 — Mobile app (weeks 6–7).** Every screen in §8.  
7. **M7 — Hardening (week 8).** Sentry, alerts, R2 backups, source-silence alerts, privacy policy screen/link.  
8. **M8 — Closed beta (weeks 9–10).** Play Store internal testing build (EAS), fixes from testers.

---

## 11\. Rules for how you work

- Keep it simple. Prefer one plain function over an abstraction until a second use exists. This is a solo project and the developer must be able to read all of it.  
- **Do not add:** Redis, Kafka, Kubernetes, LangChain/LlamaIndex, a separate vector database, an ORM other than Drizzle, GraphQL, or microservices. Ask first if you believe one is needed.  
- Every Gemini call goes through the single wrapper (cost logging, retries, budget). No direct SDK calls elsewhere.  
- No magic numbers: thresholds, windows and model IDs come from `config.ts`.  
- Pipeline steps are idempotent and safe to re-run. A crashed tick must not leave half-written cards visible (only `published` Events are served).  
- Treat all fetched web content as untrusted data: never execute it, strip HTML before sending it to Gemini, and cap lengths.  
- Be polite to publishers: conditional GET, rate limits per domain, an identifying User-Agent, respect robots.txt. Show only our own 60-word text plus a link back.  
- Tests: unit tests for pure logic (normalisation, validators, threshold decisions, centroid math), and fixture-based replay tests for the pipeline with a mocked Gemini client. Do not call the real Gemini API in tests.  
- Write clear commit messages, one logical change per commit, and ask before pushing.  
- When anything in this brief is ambiguous, ask one short question rather than guessing on something hard to undo.

Start with **M1**: reply with your plan for it.