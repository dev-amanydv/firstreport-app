export const APP_LINK = "https://firstreport.in";

export function shareText(headline: string, paneText: string) {
  return `${headline}\n\n${paneText}\n\nRead on FirstReport: ${APP_LINK}`;
}
