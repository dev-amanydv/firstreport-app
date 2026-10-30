const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// "just now", "42 min ago", "3 h ago", "yesterday", then "12 Oct".
export function relativeTime(iso: string, now = Date.now()) {
  const elapsed = Math.max(0, now - Date.parse(iso));
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  if (elapsed < 2 * DAY) return "yesterday";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const IST_OFFSET = 330 * MINUTE;

// "29 Oct, 4:30 pm" in IST, with the year only when it is not this year. Built by hand so
// Hermes and Node agree on the output.
export function storyDate(iso: string, now = Date.now()) {
  const date = new Date(Date.parse(iso) + IST_OFFSET);
  const year = date.getUTCFullYear();
  const hours = date.getUTCHours();
  const day = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  const time = `${hours % 12 || 12}:${String(date.getUTCMinutes()).padStart(2, "0")} ${hours < 12 ? "am" : "pm"}`;
  return `${year === new Date(now + IST_OFFSET).getUTCFullYear() ? day : `${day} ${year}`}, ${time}`;
}
