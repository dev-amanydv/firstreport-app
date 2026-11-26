// Light values are copied from the design artboard (packages/designs/A2-Revealed-Light.dc.html).
// Dark values are derived: the artboard is light only.

export const light = {
  canvas: "#E6E6E6",
  card: "#FFFFFF",
  ink: "#0A0A0A",
  muted: "#5C5C5C",
  navInactive: "#666666",
  hairline: "#E6E6E6",
  // The card's action pill and the thin pipes between its icons.
  actionPill: "#F0F0EF",
  actionDivider: "rgba(0,0,0,0.14)",
  // The frosted toast: milky fill, top sheen and rim strengths (0–1), outer edge, and the chip behind its icon/button.
  glassFill: "rgba(250,250,250,0.84)",
  // Thicker glass for tour tooltips, which sit over text and must stay easy to read.
  glassFillStrong: "rgba(250,250,250,0.95)",
  glassSheen: 0.9,
  glassRim: 0.95,
  glassEdge: "rgba(0,0,0,0.10)",
  glassIconBg: "rgba(0,0,0,0.06)",
  imageFallback: "#CFD3D6",
  creditChip: "rgba(0,0,0,0.62)",
  creditText: "#FFFFFF",
  placeholderInk: "rgba(0,0,0,0.09)",
  scrim: "rgba(0,0,0,0.4)",
  // Loading placeholders: a quiet block with a soft light sweeping across it.
  skeleton: "#ECECEA",
  skeletonOnCanvas: "#D9D9D7",
  skeletonShine: "rgba(255,255,255,0.85)",
  // Outlet logos sit on white in both themes, so dark-on-transparent favicons stay visible.
  logoBg: "#FFFFFF",
  logoEdge: "rgba(0,0,0,0.12)",
  neutral: "#1B7A4B",
  // Text and marks drawn on a Neutral-green fill.
  onNeutral: "#FFFFFF",
  left: "#B3362B",
  right: "#6B3FA0",
};

export type Palette = typeof light;

export const dark: Palette = {
  canvas: "#0B0B0B",
  card: "#171717",
  ink: "#F2F2F2",
  muted: "#A3A3A3",
  navInactive: "#8A8A8A",
  hairline: "#2A2A2A",
  actionPill: "#262626",
  actionDivider: "rgba(255,255,255,0.16)",
  glassFill: "rgba(44,44,46,0.82)",
  glassFillStrong: "rgba(44,44,46,0.95)",
  glassSheen: 0.16,
  glassRim: 0.28,
  glassEdge: "rgba(0,0,0,0.55)",
  glassIconBg: "rgba(255,255,255,0.10)",
  imageFallback: "#2B2F33",
  creditChip: "rgba(0,0,0,0.62)",
  creditText: "#FFFFFF",
  placeholderInk: "rgba(255,255,255,0.07)",
  scrim: "rgba(0,0,0,0.6)",
  skeleton: "#242424",
  skeletonOnCanvas: "#1C1C1C",
  skeletonShine: "rgba(255,255,255,0.07)",
  logoBg: "#FFFFFF",
  logoEdge: "rgba(255,255,255,0.16)",
  neutral: "#3FA674",
  onNeutral: "#0B0B0B",
  left: "#E0675B",
  right: "#A585D6",
};

export const fonts = {
  headline: "NewsreaderHeadline",
  regular: "PublicSans_400Regular",
  medium: "PublicSans_500Medium",
  semibold: "PublicSans_600SemiBold",
};

// Sizes from the artboard, in dp (the artboard is 390 × 844 CSS px).
export const metrics = {
  cardInset: 8,
  cardRadius: 20,
  stripHeight: 48,
  navHeight: 60,
  navGap: 4,
  actionBarHeight: 72,
  tabsHeight: 40,
  sheetRadius: 20,
};

// A tap only counts if the finger barely moves; otherwise a quick swipe would toggle the action bar.
// Pass the fields one by one: the worklets Babel plugin rejects a spread in gesture-hook configs.
export const TAP_SLOP = { maxDistance: 10, maxDuration: 250 };
