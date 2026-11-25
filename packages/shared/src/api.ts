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
  // Name of the outlet the image comes from, for the photo credit.
  imageCredit: z.string().nullable(),
  neutral: z.string(),
  // Only sent while perspectives are enabled on the server (PERSPECTIVES_ENABLED).
  contested: z.boolean().optional(),
  left: z.string().nullable().optional(),
  right: z.string().nullable().optional(),
  sources: z.array(z.object({ name: z.string(), url: z.string() })),
  story: z.object({ id: z.uuid(), eventCount: z.number().int() }).nullable(),
});
export type CardPayload = z.infer<typeof cardPayloadSchema>;

export const feedSchema = z.object({
  items: z.array(cardPayloadSchema),
  nextCursor: z.string().nullable(),
  // Published Events in this category from the last FEED_PROGRESS_WINDOW_HOURS, for the app's progress bar.
  windowTotal: z.number().int(),
});
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

// showAiLabel and perspectives are only sent while perspectives are enabled on the server.
export const appConfigSchema = z.object({
  showAiLabel: z.boolean().optional(),
  perspectives: z.boolean().optional(),
  minAppVersion: z.string(),
});
export type AppConfig = z.infer<typeof appConfigSchema>;

// Optional Google sign-in. These routes are never cached.
export const googleSignInRequestSchema = z.object({ idToken: z.string().min(1).max(4096) });

export const userSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string().nullable(),
  pictureUrl: z.string().nullable(),
});
export type User = z.infer<typeof userSchema>;

export const signInResponseSchema = z.object({ token: z.string(), user: userSchema });
export type SignInResponse = z.infer<typeof signInResponseSchema>;
