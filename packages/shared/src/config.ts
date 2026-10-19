export const TICK_CRON = "*/15 * * * *";
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
