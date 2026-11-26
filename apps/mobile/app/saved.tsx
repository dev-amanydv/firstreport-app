import { Fragment, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { COPY } from "../src/auth/copy";
import { useSession } from "../src/auth/session";
import { useSignIn } from "../src/auth/useSignIn";
import { EventRow } from "../src/components/explore/EventRow";
import { BackIcon, BookmarkIcon } from "../src/components/icons";
import { removeSaved, syncSaved, useSaved, useSavedLoaded } from "../src/saved";
import { fonts, metrics, type Palette } from "../src/theme/tokens";
import { usePalette } from "../src/theme/useTheme";

// Saved stories, newest save first. Opening one shows its card; press and hold to remove it.
export default function SavedScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const items = useSaved();
  const loaded = useSavedLoaded();
  const session = useSession();
  const signedIn = session.status === "signedIn";
  const [refreshing, setRefreshing] = useState(false);

  // Brings down saves made on another phone.
  useEffect(() => {
    void syncSaved();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await syncSaved();
    setRefreshing(false);
  };

  const confirmRemove = (id: string, headline: string) =>
    Alert.alert(COPY.saved.removeTitle, headline, [
      { text: "Cancel", style: "cancel" },
      { text: COPY.saved.remove, style: "destructive", onPress: () => removeSaved(id) },
    ]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: palette.canvas }]}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.5 }]}
      >
        <BackIcon color={palette.ink} />
      </Pressable>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={signedIn ? <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={palette.muted} /> : undefined}
      >
        <Text style={[styles.title, { color: palette.ink }]} accessibilityRole="header">
          Saved stories
        </Text>
        {items.length ? (
          <Text style={[styles.meta, { color: palette.muted }]}>
            {items.length === 1 ? "1 story" : `${items.length} stories`} · {COPY.saved.holdToRemove}
          </Text>
        ) : (
          <View style={styles.metaGap} />
        )}

        {session.status === "signedOut" ? <SignInNote palette={palette} /> : null}

        {!loaded ? null : items.length ? (
          <View style={[styles.panel, { backgroundColor: palette.card }]}>
            {items.map((item, i) => (
              <Fragment key={item.id}>
                {i > 0 ? <View style={[styles.divider, { backgroundColor: palette.hairline }]} /> : null}
                <EventRow
                  palette={palette}
                  event={item}
                  onOpen={(id) => router.push({ pathname: "/event/[id]", params: { id } })}
                  onLongPress={() => confirmRemove(item.id, item.headline)}
                />
              </Fragment>
            ))}
          </View>
        ) : (
          <View style={[styles.panel, styles.empty, { backgroundColor: palette.card }]}>
            <BookmarkIcon color={palette.muted} size={32} />
            <Text style={[styles.emptyTitle, { color: palette.ink }]}>{COPY.saved.emptyTitle}</Text>
            <Text style={[styles.emptyBody, { color: palette.muted }]}>{COPY.saved.emptyBody}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Signed out, saves live only on this phone; signing in keeps them on the account.
function SignInNote({ palette }: { palette: Palette }) {
  const signIn = useSignIn();
  const busy = signIn.state.status === "busy";
  const error = signIn.state.status === "error" ? signIn.state.message : null;
  return (
    <View style={[styles.panel, styles.note, { backgroundColor: palette.card }]}>
      <Text style={[styles.noteText, { color: palette.muted }]}>{error ?? COPY.saved.phoneOnly}</Text>
      <Pressable
        onPress={() => void signIn.start()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ busy }}
        hitSlop={12}
        style={({ pressed }) => pressed && { opacity: 0.5 }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={palette.ink} />
        ) : (
          <Text style={[styles.noteAction, { color: palette.ink }]}>{COPY.account.logIn}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  content: { paddingHorizontal: metrics.cardInset * 2 },
  title: { fontFamily: fonts.headline, fontSize: 30, lineHeight: 34, letterSpacing: -0.45, marginTop: 4, paddingHorizontal: 4 },
  meta: { fontFamily: fonts.medium, fontSize: 13, marginTop: 6, marginBottom: 16, paddingHorizontal: 4 },
  metaGap: { height: 16 },
  panel: { borderRadius: metrics.cardRadius, paddingHorizontal: 16 },
  divider: { height: StyleSheet.hairlineWidth * 2 },
  note: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, marginBottom: 12 },
  noteText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  noteAction: { fontFamily: fonts.semibold, fontSize: 15, textDecorationLine: "underline" },
  empty: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 28, gap: 8 },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 17, marginTop: 6 },
  emptyBody: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, textAlign: "center" },
});
