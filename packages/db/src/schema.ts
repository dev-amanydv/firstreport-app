import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { EMBEDDING_DIMENSIONS } from "@fr/shared";

export type FeedState = Record<string, { etag: string | null; lastModified: string | null }>;

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const tz = (name: string) => timestamp(name, { withTimezone: true });

export const articleStatus = pgEnum("article_status", ["new", "assigned", "skipped"]);
export const eventStatus = pgEnum("event_status", ["collecting", "published", "hidden", "failed", "merged"]);
export const storyStatus = pgEnum("story_status", ["active", "dormant"]);
export const category = pgEnum("category", [
  "national",
  "business",
  "technology",
  "sports",
  "entertainment",
  "world",
  "other",
]);
export const llmPurpose = pgEnum("llm_purpose", [
  "embed",
  "same_event",
  "card",
  "validate_retry",
  "story_link",
  "summary",
  "material_change",
]);
export const adminActionType = pgEnum("admin_action_type", [
  "hide",
  "unhide",
  "regen",
  "flip_contested",
  "merge_events",
  "move_event",
  "merge_stories",
  "rename_story",
  "toggle_source",
]);

export const sources = pgTable("sources", {
  id: id(),
  name: text("name").notNull().unique(),
  domain: text("domain").notNull(),
  rssUrls: text("rss_urls").array().notNull(),
  active: boolean("active").notNull().default(true),
  lean: text("lean"),
  feedState: jsonb("feed_state").$type<FeedState>().notNull().default({}),
  lastFetchedAt: tz("last_fetched_at"),
  lastNewItemAt: tz("last_new_item_at"),
});

export const stories = pgTable("stories", {
  id: id(),
  label: text("label").notNull(),
  eventCount: integer("event_count").notNull().default(1),
  firstEventAt: tz("first_event_at").notNull(),
  lastEventAt: tz("last_event_at").notNull(),
  status: storyStatus("status").notNull().default("active"),
});

export const events = pgTable(
  "events",
  {
    id: id(),
    status: eventStatus("status").notNull().default("collecting"),
    centroid: vector("centroid", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    articleCount: integer("article_count").notNull().default(1),
    firstSeenAt: tz("first_seen_at").notNull(),
    lastArticleAt: tz("last_article_at").notNull(),
    headline: text("headline"),
    neutral: text("neutral"),
    contested: boolean("contested"),
    contestedReason: text("contested_reason"),
    leftText: text("left_text"),
    rightText: text("right_text"),
    category: category("category"),
    entities: text("entities").array().notNull().default([]),
    storyLabel: text("story_label"),
    imageUrl: text("image_url"),
    storyId: uuid("story_id").references(() => stories.id),
    regenCount: integer("regen_count").notNull().default(0),
    needsRecheck: boolean("needs_recheck").notNull().default(false),
    genVersion: integer("gen_version"),
    mergedIntoId: uuid("merged_into_id").references((): AnyPgColumn => events.id),
    cardGeneratedAt: tz("card_generated_at"),
  },
  (t) => [
    index("events_status_first_seen_idx").on(t.status, t.firstSeenAt.desc()),
    index("events_category_first_seen_idx").on(t.category, t.firstSeenAt.desc()),
    index("events_story_first_seen_idx").on(t.storyId, t.firstSeenAt),
    index("events_last_article_idx").on(t.lastArticleAt),
  ],
);

export const articles = pgTable(
  "articles",
  {
    id: id(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    guid: text("guid"),
    title: text("title").notNull(),
    lede: text("lede").notNull(),
    bodyText: text("body_text"),
    contentHash: text("content_hash").notNull(),
    imageUrl: text("image_url"),
    publishedAt: tz("published_at").notNull(),
    fetchedAt: tz("fetched_at").notNull().defaultNow(),
    updatedAt: tz("updated_at").notNull().defaultNow(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    eventId: uuid("event_id").references(() => events.id),
    status: articleStatus("status").notNull().default("new"),
  },
  (t) => [
    uniqueIndex("articles_source_canonical_url_key").on(t.sourceId, t.canonicalUrl),
    uniqueIndex("articles_source_guid_key").on(t.sourceId, t.guid).where(sql`${t.guid} is not null`),
    uniqueIndex("articles_source_content_hash_key").on(t.sourceId, t.contentHash),
    index("articles_source_published_idx").on(t.sourceId, t.publishedAt),
    index("articles_event_idx").on(t.eventId),
  ],
);

export const storySummaries = pgTable("story_summaries", {
  id: id(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id),
  asOfEventId: uuid("as_of_event_id")
    .notNull()
    .unique()
    .references(() => events.id),
  summary: text("summary").notNull(),
  createdAt: createdAt(),
});

export const llmCalls = pgTable("llm_calls", {
  id: id(),
  purpose: llmPurpose("purpose").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 12, scale: 6, mode: "number" }).notNull().default(0),
  latencyMs: integer("latency_ms").notNull(),
  ok: boolean("ok").notNull(),
  error: text("error"),
  createdAt: createdAt(),
});

export const adminActions = pgTable("admin_actions", {
  id: id(),
  action: adminActionType("action").notNull(),
  targetId: uuid("target_id").notNull(),
  note: text("note"),
  createdAt: createdAt(),
});
