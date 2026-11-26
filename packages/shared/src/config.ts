export const TICK_CRON = "*/5 * * * *";
export const TICK_LOCK_ID = 7_315_001;
export const TICK_EXPIRE_SECONDS = 60 * 60;

export const ROBOTS_AGENT = "FirstReportBot";
export const USER_AGENT = `${ROBOTS_AGENT}/0.1`;
export const FETCH_TIMEOUT_MS = 15_000;
export const PAGE_FETCH_GAP_MS = 3_000;
export const ROBOTS_CACHE_MS = 24 * 60 * 60 * 1000;

export const THIN_RSS_WORDS = 60;
export const LEDE_MAX_PARAGRAPHS = 2;
export const LEDE_MAX_WORDS = 120;
export const LEDE_MIN_PARAGRAPH_WORDS = 12;

export const MAX_TITLE_CHARS = 300;
export const MAX_LEDE_CHARS = 1_500;
export const MAX_BODY_CHARS = 20_000;
export const MAX_PAGE_BYTES = 2_000_000;

export const FILTERED_URL_PATTERNS = ["/live/", "live-updates", "/opinion/", "/editorial/", "/blogs/"];
export const FILTERED_TITLE_PATTERNS = [/^top \d+\b/i, /morning brief/i, /horoscope/i, /^gold rate today/i, /^daily quiz/i];

export const TRACKING_PARAMS = ["fbclid", "gclid", "ref"];
export const TRACKING_PARAM_PREFIXES = ["utm_"];

export const EMBEDDING_DIMENSIONS = 768;

export const TIMEZONE = "Asia/Kolkata";

export const EMBED_MODEL = "gemini-embedding-2";
export const EMBED_TASK_PREFIX = "task: sentence similarity | query: ";
export const EMBED_BATCH_SIZE = 100;
export const TEXT_MODEL = "gemini-3.1-flash-lite";

export const MODEL_PRICES: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "gemini-embedding-2": { inputPerMillion: 0.2, outputPerMillion: 0 },
  "gemini-3.1-flash-lite": { inputPerMillion: 0.25, outputPerMillion: 1.5 },
};

// Dev runs on the Gemini free tier (GEMINI_FREE_TIER=true). Google shows the real limits only in AI Studio;
// these are guesses kept ~10% under ~500 requests/day.
export const FREE_TIER_DAILY_REQUESTS: Record<string, number> = {
  "gemini-3.1-flash-lite": 450,
};

export const GEMINI_MAX_RETRIES = 5;
export const GEMINI_BASE_DELAY_MS = 2_000;
export const GEMINI_MAX_DELAY_MS = 65_000;

export const NEAR_DUP_SAME_SOURCE = 0.97;
export const NEAR_DUP_WINDOW_HOURS = 72;

export const EVENT_JOIN = 0.94;
export const EVENT_BORDER_LOW = 0.86;
export const EVENT_WINDOW_HOURS = 72;
export const EVENT_CANDIDATES = 3;

export const LABEL_PAIR_COUNT = 200;
export const LABEL_MIN_SCORE = 0.8;
export const LABEL_BAND_WIDTH = 0.05;
export const LABEL_TARGET_PRECISION = 0.95;
export const LABEL_TARGET_RECALL = 0.95;

export const MAX_NEW_ARTICLES_PER_DAY = 250;
export const EVENT_ASK_MAX_WAIT_HOURS = 2;

export const CARD_MODEL = TEXT_MODEL;
export const CARD_MAX_ARTICLES = 5;
export const CARD_MAX_WORDS = 60;
export const HEADLINE_MAX_WORDS = 12;
export const CARD_LEDE_MAX_CHARS = 1_000;
export const CARDS_PER_TICK = 40;
// An Event gets its card once it has waited this long for sibling articles, or at once when it already has
// articles from CARD_FAST_SOURCES outlets (breaking news). Ready Events are carded most-covered, then newest, first.
export const CARD_SETTLE_MINUTES = 10;
export const CARD_FAST_SOURCES = 2;
export const CARD_MAX_AGE_HOURS = 24;

// Starting values for gemini-embedding-2 Event centroids; tune with pnpm label:pairs --events.
export const STORY_JOIN = 0.9;
export const STORY_BORDER_LOW = 0.85;
export const STORY_WINDOW_DAYS = 30;
export const STORY_RECENT_EVENTS = 3;
export const STORY_CANDIDATES = 3;
export const STORY_LABEL_PAIR_COUNT = 100;
export const STORY_LABEL_MIN_SCORE = 0.8;
export const SUMMARY_TARGET_WORDS = 120;
export const SUMMARY_MAX_WORDS = 150;

export const MATERIAL_WINDOW_HOURS = 24;
export const MAX_REGENS = 3;

// Paid-price USD per day. Soft skips the material-change step; hard also pauses card writing.
export const DAILY_BUDGET_SOFT = 1.5;
export const DAILY_BUDGET_HARD = 3.0;
// On the free tier, the material-change step also stops once a model has used this share of its daily cap.
export const FREE_TIER_SOFT_SHARE = 0.8;

export const NIGHTLY_CRON = "30 2 * * *"; // 02:30 in TIMEZONE
export const NIGHTLY_EXPIRE_SECONDS = 60 * 60;
export const MERGE_WINDOW_HOURS = 48;
export const BODY_RETENTION_DAYS = 14;
export const STORY_DORMANT_DAYS = 30;
export const SOURCE_SILENT_HOURS = 24;

// Admin "regenerate" and "flip to contested" are pg-boss jobs the worker runs, so the API never calls Gemini.
export const REGEN_QUEUE = "regen";
export const REGEN_EXPIRE_SECONDS = 15 * 60;

export const API_PORT = 3000;
export const PUBLIC_CACHE_SECONDS = 60;
export const FEED_PAGE_DEFAULT = 20;
export const FEED_PAGE_MAX = 50;
// Feed sort key = first_seen_at + least(article_count, FEED_BOOST_MAX_ARTICLES) * FEED_BOOST_MINUTES.
export const FEED_BOOST_MINUTES = 10;
export const FEED_BOOST_MAX_ARTICLES = 5;
export const CARD_MAX_SOURCES = 5;
// The app's progress bar counts the category's cards from this window.
export const FEED_PROGRESS_WINDOW_HOURS = 24;
export const SHOW_AI_LABEL = false;
// Explore tab: storylines still developing, the Events most outlets covered, and today's topics.
export const EXPLORE_DEVELOPING_MIN_EVENTS = 3;
export const EXPLORE_DEVELOPING_WINDOW_HOURS = 72;
export const EXPLORE_DEVELOPING_LIMIT = 10;
export const EXPLORE_WINDOW_HOURS = 24;
export const EXPLORE_MOST_COVERED_MIN_SOURCES = 2;
export const EXPLORE_MOST_COVERED_LIMIT = 10;
export const EXPLORE_TOPICS_MIN_EVENTS = 2;
export const EXPLORE_TOPICS_LIMIT = 10;
// Onboarding tour: the newest card of a recent Story with enough Events to show History and Story so far.
export const TOUR_MIN_EVENTS = 3;
export const TOUR_WINDOW_HOURS = 72;
// Search: Postgres full-text over published cards from this window (no index needed at this size).
export const SEARCH_WINDOW_DAYS = 30;
export const SEARCH_QUERY_MIN = 2;
export const SEARCH_QUERY_MAX = 100;
export const SEARCH_LIMIT_DEFAULT = 20;
export const SEARCH_LIMIT_MAX = 50;

// Left/right perspectives (and the "contested" call that gates them) are paused. Off unless
// PERSPECTIVES_ENABLED=true: the card prompt then asks Gemini for facts only, and the API and admin
// show nothing about perspectives. Read at call time so tests can flip it.
export function perspectivesEnabled() {
  return process.env.PERSPECTIVES_ENABLED === "true";
}
export const MIN_APP_VERSION = "1.0.0";

// Privacy policy and terms, served by the API at /privacy and /terms (apps/api/src/legal).
export const CONTACT_EMAIL = "info@firstreport.news";
export const LEGAL_UPDATED = "26 November 2026";
export const LEGAL_CACHE_SECONDS = 3600;
export const CATEGORY_LABELS = {
  national: "National & Politics",
  business: "Business & Economy",
  technology: "Technology",
  sports: "Sports",
  entertainment: "Entertainment",
  world: "World",
} as const;
// For the app's category strip and card meta line.
export const CATEGORY_SHORT_LABELS = {
  national: "National",
  business: "Business",
  technology: "Technology",
  sports: "Sports",
  entertainment: "Entertainment",
  world: "World",
} as const;

export const ADMIN_PAGE_SIZE = 50;
export const COST_PAGE_DAYS = 30;

// Sign-in box for readers who are not signed in: after these many cards seen (counted once each,
// across app opens), then on every AUTH_PROMPT_EVERY-th card after the last of them.
export const AUTH_PROMPT_AT = [3, 5, 7];
export const AUTH_PROMPT_EVERY = 7;
// Bytes of randomness in a session token.
export const SESSION_TOKEN_BYTES = 32;

// Saved stories: kept on the phone for everyone, and on the account once signed in. At most this many;
// saving past it drops the oldest.
export const SAVED_MAX = 500;
