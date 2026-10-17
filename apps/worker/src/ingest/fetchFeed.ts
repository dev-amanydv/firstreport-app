import Parser from "rss-parser";
import { MAX_TITLE_CHARS } from "@fr/shared";
import { htmlToText } from "./extract.js";
import { httpGet, isHttpUrl } from "./http.js";

type MediaTag = { $?: { url?: string } };
type ExtraFields = { contentEncoded?: string; mediaContent?: MediaTag[]; mediaThumbnail?: MediaTag };
type RawItem = Parser.Item & ExtraFields;

export type FeedItem = {
  link: string;
  guid: string | null;
  title: string;
  html: string;
  publishedAt: Date;
  imageUrl: string | null;
};

export type FeedCache = { etag: string | null; lastModified: string | null };

export type FeedResult = { notModified: true } | { notModified: false; items: FeedItem[]; cache: FeedCache };

const parser = new Parser<object, ExtraFields>({
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

function pickImage(item: RawItem) {
  const candidates = [
    item.mediaContent?.[0]?.$?.url,
    item.mediaThumbnail?.$?.url,
    item.enclosure?.type?.startsWith("image") === false ? undefined : item.enclosure?.url,
  ];
  return candidates.find(isHttpUrl) ?? null;
}

function toPublishedAt(isoDate: string | undefined) {
  const now = new Date();
  const date = isoDate ? new Date(isoDate) : now;
  if (Number.isNaN(date.getTime()) || date > now) return now;
  return date;
}

function toFeedItem(item: RawItem): FeedItem | null {
  const link = item.link?.trim();
  const title = htmlToText(item.title ?? "").slice(0, MAX_TITLE_CHARS);
  if (!isHttpUrl(link) || !title) return null;

  return {
    link,
    guid: item.guid?.trim() || null,
    title,
    html: item.contentEncoded ?? item.content ?? item.summary ?? "",
    publishedAt: toPublishedAt(item.isoDate),
    imageUrl: pickImage(item),
  };
}

export async function fetchFeed(url: string, cache: FeedCache | undefined): Promise<FeedResult> {
  const headers: Record<string, string> = {};
  if (cache?.etag) headers["If-None-Match"] = cache.etag;
  if (cache?.lastModified) headers["If-Modified-Since"] = cache.lastModified;

  const response = await httpGet(url, headers);
  if (response.status === 304) return { notModified: true };
  if (!response.ok) throw new Error(`feed returned ${response.status}`);

  const feed = await parser.parseString(await response.text());
  return {
    notModified: false,
    items: feed.items.map(toFeedItem).filter((item) => item !== null),
    cache: { etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified") },
  };
}
