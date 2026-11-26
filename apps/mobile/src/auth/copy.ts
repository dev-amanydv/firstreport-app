// Words for the sign-in box, the Account screen and Saved stories. Saved stories exist (on the phone for
// everyone, on the account once signed in); personalised news is not built, so it is only promised early.
export const COPY = {
  headline: "Make FirstReport yours",
  body: "Sign in once to keep your saved stories on every phone, and be first to get news picked for you.",
  button: "Continue with Google",
  notNow: "Not now",
  welcome: (firstName: string | null) => (firstName ? `You're in, ${firstName}.` : "You're in."),
  welcomeBody: "Your saved stories now stay with your account.",
  account: {
    signedOutTitle: "Not signed in",
    signedOutBody: "Log in to keep saved stories on every phone and be first to get news picked for you.",
    logIn: "Log in",
    signUp: "Sign up",
    viaGoogle: "Continues with your Google account",
    soon: "Soon",
  },
  saved: {
    emptyTitle: "No saved stories yet",
    emptyBody: "Tap the bookmark on any card to keep it here.",
    phoneOnly: "Saved on this phone only. Log in to keep them on every phone.",
    holdToRemove: "press and hold to remove",
    removeTitle: "Remove from saved?",
    remove: "Remove",
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
