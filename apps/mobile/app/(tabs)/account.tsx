import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import type { User } from "@fr/shared";
import { COPY } from "../../src/auth/copy";
import { deleteAccount, signOut, useSession } from "../../src/auth/session";
import { useSignIn } from "../../src/auth/useSignIn";
import { GoogleButton } from "../../src/components/GoogleButton";
import { initials } from "../../src/lib/sources";
import { dark, fonts, metrics, type Palette } from "../../src/theme/tokens";
import { usePalette } from "../../src/theme/useTheme";

// The one place a reader can always sign in, see who they are signed in as, sign out or delete the account.
export default function Account() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const session = useSession();

  return (
    <ScrollView
      style={{ backgroundColor: palette.canvas }}
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + 12 }]}
    >
      <Text style={[styles.title, { color: palette.ink }]} accessibilityRole="header">
        Account
      </Text>
      {session.status === "signedIn" ? (
        <SignedIn palette={palette} user={session.user} />
      ) : session.status === "signedOut" ? (
        <SignedOut palette={palette} />
      ) : null}
    </ScrollView>
  );
}

function SignedOut({ palette }: { palette: Palette }) {
  const signIn = useSignIn();
  const error = signIn.state.status === "error" ? signIn.state.message : null;
  return (
    <View style={[styles.panel, { backgroundColor: palette.card }]}>
      <Text style={[styles.eyebrow, { color: palette.neutral }]}>{COPY.eyebrow.toUpperCase()}</Text>
      <Text style={[styles.headline, { color: palette.ink }]}>{COPY.headline}</Text>
      <Text style={[styles.body, { color: palette.muted }]}>{COPY.body}</Text>
      <View style={styles.button}>
        <GoogleButton dark={palette === dark} busy={signIn.state.status === "busy"} onPress={() => void signIn.start()} />
      </View>
      {error ? (
        <Text style={[styles.error, { color: palette.left }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function SignedIn({ palette, user }: { palette: Palette; user: User }) {
  const [busy, setBusy] = useState(false);

  const confirmDelete = () =>
    Alert.alert(
      "Delete your account?",
      "Your FirstReport account and sign-in are removed for good. You can keep reading without one.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await deleteAccount();
            } catch {
              Alert.alert("Couldn't delete your account", "Check your connection and try again.");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );

  return (
    <>
      <View style={[styles.panel, styles.profile, { backgroundColor: palette.card }]}>
        <Avatar palette={palette} user={user} />
        <View style={styles.who}>
          {user.name ? (
            <Text style={[styles.name, { color: palette.ink }]} numberOfLines={1}>
              {user.name}
            </Text>
          ) : null}
          <Text style={[styles.email, { color: palette.muted }]} numberOfLines={1}>
            {user.email}
          </Text>
        </View>
      </View>

      <View style={[styles.panel, styles.rows, { backgroundColor: palette.card }]}>
        <Row palette={palette} label="Sign out" disabled={busy} onPress={() => void signOut()} />
      </View>

      <Pressable
        onPress={confirmDelete}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => [styles.delete, (pressed || busy) && { opacity: 0.5 }]}
      >
        <Text style={[styles.deleteText, { color: palette.left }]}>Delete account</Text>
      </Pressable>
    </>
  );
}

function Avatar({ palette, user }: { palette: Palette; user: User }) {
  const [failed, setFailed] = useState(false);
  if (user.pictureUrl && !failed)
    return (
      <Image
        source={{ uri: user.pictureUrl }}
        style={[styles.avatar, { backgroundColor: palette.hairline }]}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    );
  return (
    <View style={[styles.avatar, styles.monogram, { backgroundColor: palette.neutral }]}>
      <Text style={[styles.monogramText, { color: palette.onNeutral }]}>{initials(user.name ?? user.email)}</Text>
    </View>
  );
}

function Row({ palette, label, disabled, onPress }: { palette: Palette; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, (pressed || disabled) && { opacity: 0.5 }]}
    >
      <Text style={[styles.rowText, { color: palette.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: metrics.cardInset * 2, paddingBottom: 32, gap: 12 },
  title: { fontFamily: fonts.headline, fontSize: 26, lineHeight: 30, letterSpacing: -0.39, marginBottom: 8, paddingHorizontal: 4 },
  panel: { borderRadius: metrics.cardRadius, padding: 20 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.4 },
  headline: { fontFamily: fonts.headline, fontSize: 24, lineHeight: 28, letterSpacing: -0.36, marginTop: 8 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, marginTop: 8 },
  button: { marginTop: 20 },
  error: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, textAlign: "center", marginTop: 10 },
  profile: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  monogram: { alignItems: "center", justifyContent: "center" },
  monogramText: { fontFamily: fonts.semibold, fontSize: 20 },
  who: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.semibold, fontSize: 17 },
  email: { fontFamily: fonts.regular, fontSize: 14 },
  rows: { paddingVertical: 4 },
  row: { minHeight: 48, justifyContent: "center" },
  rowText: { fontFamily: fonts.medium, fontSize: 16 },
  delete: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 8 },
  deleteText: { fontFamily: fonts.semibold, fontSize: 15 },
});
