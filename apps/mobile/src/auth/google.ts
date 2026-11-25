import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";

// The OAuth *web* client ID: Google issues the ID token for it, and the API checks it against the same ID.
// Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in apps/mobile/.env; REPLACE_ME (or unset) means sign-in is off.
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
export const googleConfigured = WEB_CLIENT_ID !== "" && !/^replace/i.test(WEB_CLIENT_ID);

export class SignInError extends Error {
  constructor(readonly kind: "not-configured" | "no-play-services" | "failed") {
    super(kind);
  }
}

let configured = false;

// The only place the app talks to the Google sign-in SDK, so the library can be swapped later.
export async function signInWithGoogle(): Promise<{ idToken: string } | "cancelled"> {
  if (!googleConfigured) throw new SignInError("not-configured");
  if (!configured) {
    GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
    configured = true;
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return "cancelled";
    if (!response.data.idToken) throw new SignInError("failed");
    return { idToken: response.data.idToken };
  } catch (error) {
    if (error instanceof SignInError) throw error;
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS) return "cancelled";
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new SignInError("no-play-services");
    }
    throw new SignInError("failed");
  }
}

// Forgets the chosen Google account, so the next sign-in offers the account picker again.
export async function forgetGoogleAccount(revoke: boolean) {
  if (!configured) return;
  await (revoke ? GoogleSignin.revokeAccess() : GoogleSignin.signOut()).catch(() => {});
}
