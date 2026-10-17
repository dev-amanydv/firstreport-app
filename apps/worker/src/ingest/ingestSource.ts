import { eq, sources, type Db, type FeedState } from "@fr/db";
import { MAX_BODY_CHARS, THIN_RSS_WORDS } from "@fr/shared";
import { contentHash, htmlToParagraphs, makeLede, wordCount } from "./extract.js";
import { fetchFeed, type FeedItem } from "./fetchFeed.js";
import { fetchPage } from "./fetchPage.js";
import { isFiltered } from "./filters.js";
import { normalizeUrl } from "./normalizeUrl.js";
import { findExisting, insertArticle, updateArticle, type ArticleContent } from "./saveArticle.js";

type Source = typeof sources.$inferSelect;

export type SourceCounts = {
  feeds: number;
  notModified: number;
  feedErrors: number;
  items: number;
  filtered: number;
  unchanged: number;
  edited: number;
  inserted: number;
  duplicates: number;
  pageFetches: number;
  pageErrors: number;
  itemErrors: number;
};

function emptyCounts(): SourceCounts {
  return {
    feeds: 0,
    notModified: 0,
    feedErrors: 0,
    items: 0,
    filtered: 0,
    unchanged: 0,
    edited: 0,
    inserted: 0,
    duplicates: 0,
    pageFetches: 0,
    pageErrors: 0,
    itemErrors: 0,
  };
}

async function buildContent(item: FeedItem, rssParagraphs: string[], thin: boolean, counts: SourceCounts) {
  let paragraphs = rssParagraphs;
  let bodyText: string | null = null;
  let imageUrl = item.imageUrl;

  if (thin) {
    counts.pageFetches++;
    try {
      const page = await fetchPage(item.link);
      if (page && page.paragraphs.length > 0) {
        paragraphs = page.paragraphs;
        bodyText = paragraphs.join("\n\n").slice(0, MAX_BODY_CHARS);
      }
      imageUrl ??= page?.imageUrl ?? null;
    } catch {
      counts.pageErrors++;
    }
  }

  const content: ArticleContent = {
    title: item.title,
    lede: makeLede(paragraphs),
    bodyText,
    contentHash: contentHash(item.title, bodyText ?? paragraphs.join("\n\n")),
    imageUrl,
  };
  return content;
}

async function processItem(db: Db, source: Source, item: FeedItem, counts: SourceCounts, dryRun: boolean) {
  if (isFiltered(item.link, item.title)) {
    counts.filtered++;
    return;
  }

  const canonicalUrl = normalizeUrl(item.link);
  const rssParagraphs = htmlToParagraphs(item.html);
  const rssText = rssParagraphs.join("\n\n");
  const thin = wordCount(rssText) < THIN_RSS_WORDS;
  const existing = await findExisting(db, source.id, canonicalUrl, item.guid);

  const sameTitle = existing?.title === item.title;
  const sameText = thin || existing?.contentHash === contentHash(item.title, rssText);
  if (existing && sameTitle && sameText) {
    counts.unchanged++;
    return;
  }

  if (dryRun) {
    if (thin) counts.pageFetches++;
    if (existing) counts.edited++;
    else counts.inserted++;
    return;
  }

  const content = await buildContent(item, rssParagraphs, thin, counts);

  if (existing) {
    if (await updateArticle(db, existing, content)) counts.edited++;
    else counts.duplicates++;
    return;
  }

  const article = { ...content, sourceId: source.id, url: item.link, canonicalUrl, guid: item.guid, publishedAt: item.publishedAt };
  if (await insertArticle(db, article)) counts.inserted++;
  else counts.duplicates++;
}

export async function ingestSource(db: Db, source: Source, dryRun: boolean) {
  const counts = emptyCounts();
  const feedState: FeedState = { ...source.feedState };

  for (const feedUrl of source.rssUrls) {
    counts.feeds++;
    try {
      const result = await fetchFeed(feedUrl, feedState[feedUrl]);
      if (result.notModified) {
        counts.notModified++;
        continue;
      }

      const errorsBefore = counts.itemErrors;
      for (const item of result.items) {
        counts.items++;
        try {
          await processItem(db, source, item, counts, dryRun);
        } catch (error) {
          counts.itemErrors++;
          console.error(`[${source.name}] item failed: ${item.link}`, error);
        }
      }

      if (counts.itemErrors === errorsBefore) feedState[feedUrl] = result.cache;
    } catch (error) {
      counts.feedErrors++;
      console.error(`[${source.name}] feed failed: ${feedUrl}`, error instanceof Error ? error.message : error);
    }
  }

  if (!dryRun) {
    const now = new Date();
    await db
      .update(sources)
      .set({ feedState, lastFetchedAt: now, ...(counts.inserted > 0 ? { lastNewItemAt: now } : {}) })
      .where(eq(sources.id, source.id));
  }

  return counts;
}
