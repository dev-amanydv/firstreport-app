import { z } from "zod";

// Public API payloads, shared by apps/api and the mobile app.

export const categorySchema = z.enum(["national", "business", "technology", "sports", "entertainment", "world", "other"]);
export type Category = z.infer<typeof categorySchema>;

export const cardPayloadSchema = z.object({
  id: z.uuid(),
  headline: z.string(),
  category: categorySchema,
  firstSeenAt: z.iso.datetime({ offset: true }),
  imageUrl: z.string().nullable(),
  neutral: z.string(),
  contested: z.boolean(),
  left: z.string().nullable(),
  right: z.string().nullable(),
  sources: z.array(z.object({ name: z.string(), url: z.string() })),
  story: z.object({ id: z.uuid(), eventCount: z.number().int() }).nullable(),
});
export type CardPayload = z.infer<typeof cardPayloadSchema>;

export const feedSchema = z.object({ items: z.array(cardPayloadSchema), nextCursor: z.string().nullable() });
export type Feed = z.infer<typeof feedSchema>;

export const timelineSchema = z.object({
  items: z.array(z.object({ id: z.uuid(), headline: z.string(), firstSeenAt: z.iso.datetime({ offset: true }) })),
});
export type Timeline = z.infer<typeof timelineSchema>;

export const summarySchema = z.object({
  storyId: z.uuid(),
  asOfEventId: z.uuid(),
  summary: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Summary = z.infer<typeof summarySchema>;

export const categoriesSchema = z.object({ items: z.array(z.object({ id: categorySchema, label: z.string() })) });
export type Categories = z.infer<typeof categoriesSchema>;

export const appConfigSchema = z.object({ showAiLabel: z.boolean(), minAppVersion: z.string() });
export type AppConfig = z.infer<typeof appConfigSchema>;
