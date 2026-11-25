import { useState } from "react";
import * as Haptics from "expo-haptics";
import type { User } from "@fr/shared";
import { COPY } from "./copy";
import { SignInError } from "./google";
import { signIn } from "./session";

type State = { status: "idle" } | { status: "busy" } | { status: "error"; message: string } | { status: "done"; user: User };

// One sign-in attempt at a time, with the result as UI state. Cancelling in Google's picker is not an error.
export function useSignIn() {
  const [state, setState] = useState<State>({ status: "idle" });

  const start = async () => {
    if (state.status === "busy") return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState({ status: "busy" });
    try {
      const result = await signIn();
      if (result === "cancelled") return setState({ status: "idle" });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setState({ status: "done", user: result });
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const kind = error instanceof SignInError ? error.kind : "failed";
      setState({ status: "error", message: COPY.errors[kind] });
    }
  };

  return { state, start, reset: () => setState({ status: "idle" }) };
}

export const firstName = (user: User) => user.name?.trim().split(/\s+/)[0] ?? null;
