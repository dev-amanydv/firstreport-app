import { sql } from "drizzle-orm";
import { createDb } from "./client.js";
import { databaseUrl } from "./env.js";
import { sources } from "./schema.js";

type SeedSource = { name: string; domain: string; rssUrls: string[]; extraRssUrls?: string[]; active: boolean };

const activeSources: SeedSource[] = [
  {
    name: "Indian Express",
    domain: "indianexpress.com",
    rssUrls: ["https://indianexpress.com/section/india/feed/"],
    extraRssUrls: ["https://indianexpress.com/feed/"],
  },
  {
    name: "The Hindu",
    domain: "thehindu.com",
    rssUrls: [],
    extraRssUrls: [
      "https://www.thehindu.com/news/national/feeder/default.rss",
      "https://www.thehindu.com/business/feeder/default.rss",
      "https://www.thehindu.com/news/international/feeder/default.rss",
      "https://www.thehindu.com/sport/feeder/default.rss",
      "https://www.thehindu.com/sci-tech/technology/feeder/default.rss",
      "https://www.thehindu.com/entertainment/feeder/default.rss",
    ],
  },
  { name: "NDTV", domain: "ndtv.com", rssUrls: ["https://feeds.feedburner.com/ndtvnews-top-stories"] },
  { name: "NDTV Profit", domain: "ndtvprofit.com", rssUrls: ["https://feeds.feedburner.com/ndtvprofit-latest"] },
  {
    name: "Hindustan Times",
    domain: "hindustantimes.com",
    rssUrls: [
      "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml",
      "https://www.hindustantimes.com/feeds/rss/business/rssfeed.xml",
    ],
  },
  {
    name: "Times of India",
    domain: "timesofindia.indiatimes.com",
    rssUrls: [
      "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
      "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms",
    ],
  },
  {
    name: "Mint",
    domain: "livemint.com",
    rssUrls: ["https://www.livemint.com/rss/news", "https://www.livemint.com/rss/technology"],
  },
  {
    name: "Economic Times",
    domain: "economictimes.indiatimes.com",
    rssUrls: ["https://economictimes.indiatimes.com/rssfeedstopstories.cms"],
  },
  {
    name: "India Today",
    domain: "indiatoday.in",
    rssUrls: ["https://www.indiatoday.in/rss/1206578", "https://www.indiatoday.in/rss/1206514"],
  },
  {
    name: "Hindu BusinessLine",
    domain: "thehindubusinessline.com",
    rssUrls: [],
    extraRssUrls: ["https://www.thehindubusinessline.com/feeder/default.rss"],
  },
  { name: "Gadgets 360", domain: "gadgets360.com", rssUrls: ["https://feeds.feedburner.com/gadgets360-latest"] },
  { name: "The Quint", domain: "thequint.com", rssUrls: ["https://www.thequint.com/stories.rss"] },
].map((s) => ({ ...s, active: true }));

const todoSources: SeedSource[] = [
  { name: "Business Standard", domain: "business-standard.com" },
  { name: "News18", domain: "news18.com" },
  { name: "Firstpost", domain: "firstpost.com" },
  { name: "Moneycontrol", domain: "moneycontrol.com" },
  { name: "The Telegraph", domain: "telegraphindia.com" },
  { name: "The Tribune", domain: "tribuneindia.com" },
  { name: "ThePrint", domain: "theprint.in" },
  { name: "Scroll", domain: "scroll.in" },
  { name: "The Wire", domain: "thewire.in" },
  { name: "Deccan Herald", domain: "deccanherald.com" },
  { name: "New Indian Express", domain: "newindianexpress.com" },
  { name: "WION", domain: "wionews.com" },
  { name: "Financial Express", domain: "financialexpress.com" },
].map((s) => ({ ...s, rssUrls: ["TODO"], active: false }));

const allFeeds = process.argv.includes("--all-feeds");
const { db, close } = createDb(databaseUrl());

for (const { extraRssUrls = [], ...source } of [...activeSources, ...todoSources]) {
  const rssUrls = allFeeds ? [...source.rssUrls, ...extraRssUrls] : source.rssUrls;
  await db
    .insert(sources)
    .values({ ...source, rssUrls })
    .onConflictDoUpdate({
      target: sources.name,
      set: { domain: sql`excluded.domain`, rssUrls: sql`excluded.rss_urls` },
    });
}

await close();
console.log(`seeded ${activeSources.length} active and ${todoSources.length} todo sources${allFeeds ? " with all feeds" : ""}`);
