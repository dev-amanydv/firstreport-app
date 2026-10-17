import { setTimeout as sleep } from "node:timers/promises";
import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import robotsModule from "robots-parser";
import { MAX_PAGE_BYTES, PAGE_FETCH_GAP_MS, ROBOTS_AGENT, ROBOTS_CACHE_MS } from "@fr/shared";
import { htmlToParagraphs } from "./extract.js";
import { httpGet, isHttpUrl } from "./http.js";

const robotsParser = robotsModule as unknown as typeof robotsModule.default;
type Robots = ReturnType<typeof robotsParser>;

const nextSlotByHost = new Map<string, number>();
const robotsByOrigin = new Map<string, { robots: Robots | null; fetchedAt: number }>();

async function waitForSlot(host: string) {
  const now = Date.now();
  const slot = Math.max(now, nextSlotByHost.get(host) ?? 0);
  nextSlotByHost.set(host, slot + PAGE_FETCH_GAP_MS);
  if (slot > now) await sleep(slot - now);
}

async function loadRobots(url: URL) {
  const robotsUrl = `${url.origin}/robots.txt`;
  await waitForSlot(url.host);
  try {
    const response = await httpGet(robotsUrl);
    return response.ok ? robotsParser(robotsUrl, await response.text()) : null;
  } catch {
    return null;
  }
}

async function isAllowed(url: URL) {
  const cached = robotsByOrigin.get(url.origin);
  let robots = cached?.robots ?? null;
  if (!cached || Date.now() - cached.fetchedAt > ROBOTS_CACHE_MS) {
    robots = await loadRobots(url);
    robotsByOrigin.set(url.origin, { robots, fetchedAt: Date.now() });
  }
  return robots?.isAllowed(url.href, ROBOTS_AGENT) !== false;
}

export async function fetchPage(link: string) {
  const url = new URL(link);
  if (!(await isAllowed(url))) return null;

  await waitForSlot(url.host);
  const response = await httpGet(url.href);
  if (!response.ok) return null;

  const html = (await response.text()).slice(0, MAX_PAGE_BYTES);
  const dom = new JSDOM(html, { url: url.href, virtualConsole: new VirtualConsole() });
  try {
    const document = dom.window.document;
    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null;
    const article = new Readability(document).parse();
    return {
      paragraphs: article?.content ? htmlToParagraphs(article.content) : [],
      imageUrl: isHttpUrl(ogImage) ? ogImage : null,
    };
  } finally {
    dom.window.close();
  }
}
