export const TICK_CRON = "*/15 * * * *";
export const TICK_LOCK_ID = 7_315_001;

export const USER_AGENT = "FirstReportBot/0.1 (+https://firstreport.app/bot)";
export const FETCH_TIMEOUT_MS = 15_000;
export const PAGE_FETCH_GAP_MS = 3_000;

export const THIN_RSS_WORDS = 60;
export const LEDE_MAX_PARAGRAPHS = 2;
export const LEDE_MAX_WORDS = 120;

export const MAX_TITLE_CHARS = 300;
export const MAX_LEDE_CHARS = 1_500;
export const MAX_BODY_CHARS = 20_000;
export const MAX_PAGE_BYTES = 2_000_000;

export const FILTERED_URL_PATTERNS = ["/live/", "live-updates", "/opinion/", "/editorial/", "/blogs/"];
export const FILTERED_TITLE_PATTERNS = [/^top \d+\b/i, /morning brief/i, /horoscope/i];

export const TRACKING_PARAMS = ["fbclid", "gclid", "ref"];
export const TRACKING_PARAM_PREFIXES = ["utm_"];

export const EMBEDDING_DIMENSIONS = 768;
