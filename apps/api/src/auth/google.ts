import { OAuth2Client } from "google-auth-library";

export type GoogleProfile = { sub: string; email: string; name: string | null; pictureUrl: string | null };
// Resolves to the profile for a valid ID token, or null for any token Google would not accept.
export type GoogleVerifier = (idToken: string) => Promise<GoogleProfile | null>;

// The app's web client ID is the audience of the ID tokens the phone gets from Google.
export function googleVerifier(webClientId: string): GoogleVerifier {
  const client = new OAuth2Client();
  return async (idToken) => {
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: webClientId });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || payload.email_verified === false) return null;
      return { sub: payload.sub, email: payload.email, name: payload.name ?? null, pictureUrl: payload.picture ?? null };
    } catch {
      return null;
    }
  };
}

// An unset or placeholder client ID means sign-in is not configured yet.
export function configuredClientId(value: string | undefined) {
  return value && !/^replace/i.test(value) ? value : null;
}
