import { Fragment, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import type { User } from "@fr/shared";
import { COPY, LEGAL } from "../../src/auth/copy";
import { deleteAccount, signOut, useSession } from "../../src/auth/session";
import { useSignIn } from "../../src/auth/useSignIn";
import {
  BellIcon,
  BookmarkIcon,
  ChevronIcon,
  ContrastIcon,
  DocumentIcon,
  InfoIcon,
  PersonIcon,
  ShieldIcon,
  SignOutIcon,
} from "../../src/components/icons";
import { AppearancePicker } from "../../src/components/AppearancePicker";
import { Sheet } from "../../src/components/Sheet";
import type { AppearanceChoice } from "../../src/lib/appearance";
import { initials } from "../../src/lib/sources";
import { fonts, metrics, type Palette } from "../../src/theme/tokens";
import { setAppearance, useAppearance, usePalette } from "../../src/theme/useTheme";

const APPEARANCE_LABELS: Record<AppearanceChoice, string> = { system: "System", light: "Light", dark: "Dark" };
const VERSION = Constants.expoConfig?.version ?? "";

// Laid out like a signed-in account page for everyone: the header shows Log in / Sign up until there is
// a profile to show, and the Account section appears once signed in.
export default function Account() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const appearance = useAppearance();
  const [picker, setPicker] = useState(false);
  const signedIn = session.status === "signedIn";

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScrollView contentContainerStyle={[styles.screen, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.title, { color: palette.ink }]} accessibilityRole="header">
          Account
        </Text>

        {signedIn ? <Profile palette={palette} user={session.user} /> : <SignedOutHeader palette={palette} />}

        <Section palette={palette} label="Your reading">
          <Row palette={palette} icon={BookmarkIcon} label="Saved stories" soon />
          <Row palette={palette} icon={BellIcon} label="Followed stories" soon />
        </Section>

        <Section palette={palette} label="Preferences">
          <Row
            palette={palette}
            icon={ContrastIcon}
            label="Appearance"
            value={APPEARANCE_LABELS[appearance]}
            onPress={() => setPicker(true)}
          />
        </Section>

        <Section palette={palette} label="About">
          <Row palette={palette} icon={InfoIcon} label="How FirstReport works" onPress={() => router.push("/about")} />
          <LegalRow palette={palette} icon={ShieldIcon} label="Privacy policy" url={LEGAL.privacyUrl} />
          <LegalRow palette={palette} icon={DocumentIcon} label="Terms of use" url={LEGAL.termsUrl} />
          <Row palette={palette} label={`Version ${VERSION}`} muted />
        </Section>

        {signedIn ? <AccountActions palette={palette} /> : null}
      </ScrollView>

      {/* Choosing applies the theme and closes the sheet at once. */}
      <Sheet palette={palette} visible={picker} title="Appearance" centerTitle onClose={() => setPicker(false)}>
        <AppearancePicker
          palette={palette}
          value={appearance}
          onChange={(choice) => {
            setAppearance(choice);
            setPicker(false);
          }}
        />
      </Sheet>
    </View>
  );
}

function SignedOutHeader({ palette }: { palette: Palette }) {
  const signIn = useSignIn();
  // Google is the only provider, so both buttons run the same flow: a first visit creates the account.
  const [pressed, setPressed] = useState<"logIn" | "signUp" | null>(null);
  const busy = signIn.state.status === "busy";
  const error = signIn.state.status === "error" ? signIn.state.message : null;
  const start = (which: "logIn" | "signUp") => {
    setPressed(which);
    void signIn.start();
  };

  return (
    <View style={[styles.panel, styles.header, { backgroundColor: palette.card }]}>
      <View style={styles.headerTop}>
        <View style={[styles.avatar, styles.avatarEmpty, { backgroundColor: palette.hairline }]}>
          <PersonIcon color={palette.muted} size={28} />
        </View>
        <View style={styles.who}>
          <Text style={[styles.name, { color: palette.ink }]}>{COPY.account.signedOutTitle}</Text>
          <Text style={[styles.whoBody, { color: palette.muted }]}>{COPY.account.signedOutBody}</Text>
        </View>
      </View>
      <View style={styles.buttons}>
        <AuthButton
          palette={palette}
          label={COPY.account.logIn}
          filled={false}
          busy={busy && pressed === "logIn"}
          disabled={busy}
          onPress={() => start("logIn")}
        />
        <AuthButton
          palette={palette}
          label={COPY.account.signUp}
          filled
          busy={busy && pressed === "signUp"}
          disabled={busy}
          onPress={() => start("signUp")}
        />
      </View>
      {error ? (
        <Text style={[styles.error, { color: palette.left }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : (
        <Text style={[styles.caption, { color: palette.muted }]}>{COPY.account.viaGoogle}</Text>
      )}
    </View>
  );
}

type AuthButtonProps = { palette: Palette; label: string; filled: boolean; busy: boolean; disabled: boolean; onPress: () => void };

function AuthButton({ palette, label, filled, busy, disabled, onPress }: AuthButtonProps) {
  const text = filled ? palette.card : palette.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      style={({ pressed }) => [
        styles.authButton,
        filled ? { backgroundColor: palette.ink } : { borderColor: palette.ink, borderWidth: 1.5 },
        (pressed || (disabled && !busy)) && { opacity: 0.6 },
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={text} /> : <Text style={[styles.authLabel, { color: text }]}>{label}</Text>}
    </Pressable>
  );
}

function Profile({ palette, user }: { palette: Palette; user: User }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.panel, styles.header, styles.headerTop, { backgroundColor: palette.card }]}>
      {user.pictureUrl && !failed ? (
        <Image
          source={{ uri: user.pictureUrl }}
          style={[styles.avatar, { backgroundColor: palette.hairline }]}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarEmpty, { backgroundColor: palette.neutral }]}>
          <Text style={[styles.monogram, { color: palette.onNeutral }]}>{initials(user.name ?? user.email)}</Text>
        </View>
      )}
      <View style={styles.who}>
        {user.name ? (
          <Text style={[styles.name, { color: palette.ink }]} numberOfLines={1}>
            {user.name}
          </Text>
        ) : null}
        <Text style={[styles.whoBody, { color: palette.muted }]} numberOfLines={1}>
          {user.email}
        </Text>
      </View>
    </View>
  );
}

function AccountActions({ palette }: { palette: Palette }) {
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
    <Section palette={palette} label="Account">
      <Row palette={palette} icon={SignOutIcon} label="Sign out" disabled={busy} onPress={() => void signOut()} />
      <Row palette={palette} label="Delete account" danger disabled={busy} onPress={confirmDelete} />
    </Section>
  );
}

function Section({ palette, label, children }: { palette: Palette; label: string; children: ReactNode }) {
  const rows = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: palette.muted }]} accessibilityRole="header">
        {label.toUpperCase()}
      </Text>
      <View style={[styles.panel, styles.group, { backgroundColor: palette.card }]}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? <View style={[styles.divider, { backgroundColor: palette.hairline }]} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

type RowProps = {
  palette: Palette;
  label: string;
  icon?: (props: { color: string; size?: number }) => ReactNode;
  value?: string;
  soon?: boolean;
  muted?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

function Row({ palette, label, icon: Icon, value, soon, muted, danger, disabled, onPress }: RowProps) {
  const ink = danger ? palette.left : muted || soon ? palette.muted : palette.ink;
  const content = (
    <>
      {Icon ? (
        <View style={styles.icon}>
          <Icon color={ink} size={22} />
        </View>
      ) : null}
      <Text style={[styles.rowLabel, { color: ink }, danger && styles.danger]} numberOfLines={1}>
        {label}
      </Text>
      {value ? <Text style={[styles.rowValue, { color: palette.muted }]}>{value}</Text> : null}
      {soon ? (
        <View style={[styles.soon, { backgroundColor: palette.hairline }]}>
          <Text style={[styles.soonText, { color: palette.muted }]}>{COPY.account.soon}</Text>
        </View>
      ) : null}
      {onPress && !danger ? <ChevronIcon color={palette.muted} /> : null}
    </>
  );
  if (!onPress)
    return (
      <View style={styles.row} accessible accessibilityLabel={soon ? `${label}, coming soon` : label}>
        {content}
      </View>
    );
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [styles.row, (pressed || disabled) && { opacity: 0.5 }]}
    >
      {content}
    </Pressable>
  );
}

// Opens the page once its URL is set (M7); until then it reads "Soon".
function LegalRow({ palette, icon, label, url }: { palette: Palette; icon: RowProps["icon"]; label: string; url: string }) {
  return url ? (
    <Row palette={palette} icon={icon} label={label} onPress={() => void WebBrowser.openBrowserAsync(url)} />
  ) : (
    <Row palette={palette} icon={icon} label={label} soon />
  );
}

const ICON_COLUMN = 38;

const styles = StyleSheet.create({
  screen: { paddingHorizontal: metrics.cardInset * 2, paddingBottom: 32 },
  title: { fontFamily: fonts.headline, fontSize: 30, lineHeight: 34, letterSpacing: -0.45, marginBottom: 16, paddingHorizontal: 4 },
  panel: { borderRadius: metrics.cardRadius },
  header: { padding: 20 },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarEmpty: { alignItems: "center", justifyContent: "center" },
  monogram: { fontFamily: fonts.semibold, fontSize: 22 },
  who: { flex: 1, gap: 3 },
  name: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24 },
  whoBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 18 },
  authButton: { flex: 1, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  authLabel: { fontFamily: fonts.semibold, fontSize: 15 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, textAlign: "center", marginTop: 10 },
  error: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, textAlign: "center", marginTop: 10 },
  section: { marginTop: 24 },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.2, marginBottom: 8, paddingHorizontal: 16 },
  group: { paddingHorizontal: 16 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginLeft: ICON_COLUMN },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { width: ICON_COLUMN - 8, alignItems: "flex-start" },
  rowLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 16 },
  rowValue: { fontFamily: fonts.regular, fontSize: 15 },
  danger: { fontFamily: fonts.semibold },
  soon: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  soonText: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.4 },
});
