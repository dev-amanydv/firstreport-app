export const APP_LINK = "https://firstreport.in";

// The shared picture is laid out at this width in dp and captured at the device's pixel ratio
// (360 dp ≈ 1080 px on most phones).
export const SHARE_CARD = { width: 360, linkLabel: "Read more at firstreport.in" };

// Plain-text fallback for when the card cannot be captured as an image.
export function shareText(headline: string, paneText: string) {
  return `${headline}\n\n${paneText}\n\nRead on FirstReport: ${APP_LINK}`;
}
