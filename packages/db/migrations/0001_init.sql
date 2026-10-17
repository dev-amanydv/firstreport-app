CREATE TYPE "public"."admin_action_type" AS ENUM('hide', 'unhide', 'regen', 'flip_contested', 'merge_events', 'move_event', 'merge_stories', 'toggle_source');--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('new', 'assigned', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('national', 'business', 'technology', 'sports', 'entertainment', 'world', 'other');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('collecting', 'published', 'hidden', 'failed', 'merged');--> statement-breakpoint
CREATE TYPE "public"."llm_purpose" AS ENUM('embed', 'same_event', 'card', 'validate_retry', 'story_link', 'summary', 'material_change');--> statement-breakpoint
CREATE TYPE "public"."story_status" AS ENUM('active', 'dormant');--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" "admin_action_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"guid" text,
	"title" text NOT NULL,
	"lede" text NOT NULL,
	"body_text" text,
	"content_hash" text NOT NULL,
	"image_url" text,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"embedding" vector(768),
	"event_id" uuid,
	"status" "article_status" DEFAULT 'new' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "event_status" DEFAULT 'collecting' NOT NULL,
	"centroid" vector(768) NOT NULL,
	"article_count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_article_at" timestamp with time zone NOT NULL,
	"headline" text,
	"neutral" text,
	"contested" boolean,
	"contested_reason" text,
	"left_text" text,
	"right_text" text,
	"category" "category",
	"entities" text[] DEFAULT '{}' NOT NULL,
	"story_label" text,
	"image_url" text,
	"story_id" uuid,
	"regen_count" integer DEFAULT 0 NOT NULL,
	"needs_recheck" boolean DEFAULT false NOT NULL,
	"gen_version" integer,
	"merged_into_id" uuid,
	"card_generated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" "llm_purpose" NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
	"latency_ms" integer NOT NULL,
	"ok" boolean NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"rss_urls" text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"lean" text,
	"feed_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_new_item_at" timestamp with time zone,
	CONSTRAINT "sources_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"event_count" integer DEFAULT 1 NOT NULL,
	"first_event_at" timestamp with time zone NOT NULL,
	"last_event_at" timestamp with time zone NOT NULL,
	"status" "story_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"as_of_event_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_summaries_as_of_event_id_unique" UNIQUE("as_of_event_id")
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_merged_into_id_events_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_summaries" ADD CONSTRAINT "story_summaries_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_summaries" ADD CONSTRAINT "story_summaries_as_of_event_id_events_id_fk" FOREIGN KEY ("as_of_event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_source_canonical_url_key" ON "articles" USING btree ("source_id","canonical_url");--> statement-breakpoint
CREATE UNIQUE INDEX "articles_source_guid_key" ON "articles" USING btree ("source_id","guid") WHERE "articles"."guid" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_source_content_hash_key" ON "articles" USING btree ("source_id","content_hash");--> statement-breakpoint
CREATE INDEX "articles_source_published_idx" ON "articles" USING btree ("source_id","published_at");--> statement-breakpoint
CREATE INDEX "articles_event_idx" ON "articles" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "events_status_first_seen_idx" ON "events" USING btree ("status","first_seen_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_category_first_seen_idx" ON "events" USING btree ("category","first_seen_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_story_first_seen_idx" ON "events" USING btree ("story_id","first_seen_at");--> statement-breakpoint
CREATE INDEX "events_last_article_idx" ON "events" USING btree ("last_article_at");