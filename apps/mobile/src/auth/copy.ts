// Words for the sign-in box and the Account screen. Saved stories and personalised news are not built
// yet, so the copy promises early access, never features that exist today.
export const COPY = {
  headline: "Make FirstReport yours",
  body: "Sign in once. Saved stories and news picked for you arrive first for signed-in readers.",
  button: "Continue with Google",
  notNow: "Not now",
  welcome: (firstName: string | null) => (firstName ? `You're in, ${firstName}.` : "You're in."),
  welcomeBody: "We'll let you know as soon as saved stories arrive.",
  account: {
    signedOutTitle: "Not signed in",
    signedOutBody: "Log in to be first to get saved stories and news picked for you.",
    logIn: "Log in",
    signUp: "Sign up",
    viaGoogle: "Continues with your Google account",
    soon: "Soon",
  },
  errors: {
    "not-configured": "Sign-in isn't set up yet.",
    "no-play-services": "Sign-in needs Google Play services on this phone.",
    failed: "Couldn't sign in. Please try again.",
  },
};

// Served by the API (apps/api/src/legal), so they live wherever EXPO_PUBLIC_API_BASE_URL points.
const SITE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
export const LEGAL = { termsUrl: `${SITE}/terms`, privacyUrl: `${SITE}/privacy` };
