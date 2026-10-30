// The artboard's card is 708 tall with a 236 image. Shorter phones lose photo, never text.
export const IMAGE_MAX = 236;
export const IMAGE_MIN = 148;
const TEXT_BLOCK = 472;

export function imageHeight(cardHeight: number) {
  return Math.round(Math.min(IMAGE_MAX, Math.max(IMAGE_MIN, cardHeight - TEXT_BLOCK)));
}

// Only the cards next to the current one are mounted; the rest are empty pages.
export const RENDER_BEHIND = 2;
export const RENDER_AHEAD = 2;

export function isRendered(page: number, current: number) {
  return page >= current - RENDER_BEHIND && page <= current + RENDER_AHEAD;
}

// Position n of the window's N cards, as a 0–1 bar. Past the window the bar stays full.
export function progress(index: number, windowTotal: number) {
  if (windowTotal <= 0) return 1;
  return Math.min(1, (index + 1) / windowTotal);
}
