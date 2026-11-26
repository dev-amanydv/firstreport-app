import { useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";
import { signInResponseSchema, userSchema, type User } from "@fr/shared";
import { apiRequest, HttpError } from "../api/client";
import { forgetGoogleAccount, signInWithGoogle } from "./google";

// The session token and the user it belongs to, kept in the OS keystore so the profile shows offline.
const KEY = "fr.session";
type Session = { token: string; user: User };
// undefined while the keystore is being read.
let current: Session | null | undefined;
// A function, so TypeScript does not keep a narrowed type across awaits.
const now = () => current;
const listeners = new Set<() => void>();

function set(next: Session | null) {
  current = next;
  listeners.forEach((listener) => listener());
  void (next ? SecureStore.setItemAsync(KEY, JSON.stringify(next)) : SecureStore.deleteItemAsync(KEY)).catch(() => {});
}

function parse(raw: string | null): Session | null {
  try {
    const value = JSON.parse(raw ?? "") as { token?: unknown; user?: unknown };
    const user = userSchema.safeParse(value.user);
    return typeof value.token === "string" && user.success ? { token: value.token, user: user.data } : null;
  } catch {
    return null;
  }
}

// Read once at start-up. A session the server no longer knows (signed out or deleted elsewhere) is dropped;
// being offline keeps it.
export async function loadSession() {
  if (current !== undefined) return;
  const session = parse(await SecureStore.getItemAsync(KEY).catch(() => null));
  set(session);
  if (!session) return;
  try {
    const user = await apiRequest("GET", "/v1/me", { token: session.token, schema: userSchema });
    if (now()?.token === session.token) set({ ...session, user });
  } catch (error) {
    if (error instanceof HttpError && error.status === 401 && now()?.token === session.token) set(null);
  }
}

export async function signIn(): Promise<User | "cancelled"> {
  const google = await signInWithGoogle();
  if (google === "cancelled") return "cancelled";
  const session = await apiRequest("POST", "/v1/auth/google", { body: { idToken: google.idToken }, schema: signInResponseSchema });
  set(session);
  return session.user;
}

// Signing out works offline: the local session goes at once, the server is told if it can be reached.
export async function signOut() {
  const token = now()?.token;
  set(null);
  await forgetGoogleAccount(false);
  if (token) await apiRequest("POST", "/v1/auth/signout", { token }).catch(() => {});
}

// Deleting must reach the server, so it throws when offline and the reader stays signed in.
export async function deleteAccount() {
  const token = now()?.token;
  if (!token) return;
  await apiRequest("DELETE", "/v1/account", { token });
  set(null);
  await forgetGoogleAccount(true);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// For stores that follow the session (saved stories): null when signed out, undefined while loading.
export const sessionToken = () => (current === undefined ? undefined : (current?.token ?? null));
export const subscribeSession = subscribe;

// "loading" until the keystore has been read; never prompt for sign-in before then.
export function useSession(): { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; user: User } {
  const session = useSyncExternalStore(subscribe, () => current);
  if (session === undefined) return { status: "loading" };
  return session ? { status: "signedIn", user: session.user } : { status: "signedOut" };
}
