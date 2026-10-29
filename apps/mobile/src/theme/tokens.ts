// Light values are copied from the design artboard (packages/designs/A2-Revealed-Light.dc.html).
// Dark values are derived: the artboard is light only.

export const light = {
  canvas: "#E6E6E6",
  card: "#FFFFFF",
  ink: "#0A0A0A",
  muted: "#5C5C5C",
  navInactive: "#666666",
  hairline: "#E6E6E6",
  imageFallback: "#CFD3D6",
  creditChip: "rgba(0,0,0,0.62)",
  creditText: "#FFFFFF",
  placeholderInk: "rgba(0,0,0,0.09)",
  neutral: "#1B7A4B",
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
  imageFallback: "#2B2F33",
  creditChip: "rgba(0,0,0,0.62)",
  creditText: "#FFFFFF",
  placeholderInk: "rgba(255,255,255,0.07)",
  neutral: "#3FA674",
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
};
