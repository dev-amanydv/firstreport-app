ALTER TYPE "public"."llm_purpose" ADD VALUE 'triage';--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "triaged_at" timestamp with time zone;--> statement-breakpoint
-- Articles from before triage count as triaged, so edited ones are still re-embedded.
UPDATE "articles" SET "triaged_at" = "fetched_at";
