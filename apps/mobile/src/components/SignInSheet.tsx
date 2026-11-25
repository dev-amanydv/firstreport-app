import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { GestureDetector, GestureHandlerRootView, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { CATEGORY_SHORT_LABELS, type Category } from "@fr/shared";
import { COPY, LEGAL } from "../auth/copy";
import { firstName, useSignIn } from "../auth/useSignIn";
import { dark as darkPalette, fonts, type Palette } from "../theme/tokens";
import { GoogleButton } from "./GoogleButton";
import { CheckIcon } from "./icons";

export type HeroCard = { id: string; imageUrl: string | null; category: Category };

type Props = {
  palette: Palette;
  visible: boolean;
  // The cards the reader has just been reading, newest last; up to three are fanned in the hero.
  cards: HeroCard[];
  onClose: () => void;
};

const OPEN = { damping: 22, stiffness: 210, mass: 0.9 };
const CLOSE = { duration: 220, easing: Easing.in(Easing.quad) };
const FAN = { damping: 14, stiffness: 160, mass: 0.8 };
const FADE = { duration: 220, easing: Easing.out(Easing.cubic) };
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 800;
// After a successful sign-in the welcome stays up this long, then the sheet closes itself.
const WELCOME_MS = 1600;
const RADIUS = 28;

// Where each hero card ends up when fanned: left, back to front.
const FAN_POSES = [
  { x: -62, y: 12, rotate: -9 },
  { x: 62, y: 12, rotate: 9 },
  { x: 0, y: 0, rotate: 0 },
];
const STAGGER_MS = 60;
const FAN_DELAY_MS = 140;

// The sign-in invitation: a bottom sheet with the reader's own last cards fanned above one Google button.
// It slides up on a soft spring, closes on "Not now", the scrim, the back button or a drag down.
export function SignInSheet({ palette, visible, cards, onClose }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const isDark = palette === darkPalette;
  const [mounted, setMounted] = useState(visible);
  const shown = useSharedValue(0);
  const drag = useSharedValue(0);
  const welcome = useSharedValue(0);
  const signIn = useSignIn();
  const busy = signIn.state.status === "busy";
  const done = signIn.state.status === "done";

  useEffect(() => {
    if (visible) {
      setMounted(true);
      signIn.reset();
      drag.value = 0;
      welcome.value = 0;
      shown.value = reduceMotion ? withTiming(1, FADE) : withSpring(1, OPEN);
    } else {
      shown.value = withTiming(0, CLOSE, (finished) => {
        if (finished) scheduleOnRN(setMounted, false);
      });
    }
    // signIn.reset is a fresh function each render; only a change of `visible` matters here.
  }, [visible, reduceMotion]);

  // Signed in: show the welcome, then close. The ref keeps a re-render from restarting the timer.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!done) return;
    welcome.value = withTiming(1, FADE);
    const timer = setTimeout(() => closeRef.current(), WELCOME_MS);
    return () => clearTimeout(timer);
  }, [done, welcome]);

  const dismiss = () => {
    if (!busy && !done) onClose();
  };

  const pan = usePanGesture({
    activeOffsetY: [-8, 8],
    onUpdate: (event) => {
      drag.value = Math.max(0, event.translationY);
    },
    onDeactivate: (event) => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) scheduleOnRN(dismiss);
      else drag.value = withSpring(0, OPEN);
    },
  });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const panelStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: shown.value, transform: [{ translateY: drag.value }] }
      : { transform: [{ translateY: (1 - shown.value) * height * 0.6 + drag.value }] },
  );
  const formStyle = useAnimatedStyle(() => ({ opacity: 1 - welcome.value }));
  const welcomeStyle = useAnimatedStyle(() => ({
    opacity: welcome.value,
    transform: [{ scale: 0.92 + welcome.value * 0.08 }],
  }));

  if (!mounted) return null;
  const hero = cards.slice(-3);
  const error = signIn.state.status === "error" ? signIn.state.message : null;
  const user = signIn.state.status === "done" ? signIn.state.user : null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={dismiss}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityRole="button" accessibilityLabel={COPY.notNow} />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessibilityViewIsModal
            accessibilityLabel="Sign in"
            style={[styles.panel, { paddingBottom: insets.bottom + 18, backgroundColor: palette.card }, panelStyle]}
          >
            <View style={[styles.handle, { backgroundColor: palette.muted }]} />

            <View style={styles.hero} accessible={false} importantForAccessibility="no-hide-descendants">
              <Glow color={palette.neutral} />
              {hero.map((card, i) => (
                <FannedCard
                  key={card.id}
                  card={card}
                  pose={FAN_POSES[i + (3 - hero.length)]!}
                  open={visible}
                  delay={i * STAGGER_MS}
                  instant={reduceMotion}
                  palette={palette}
                />
              ))}
            </View>

            <View>
              <Animated.View style={formStyle} pointerEvents={done ? "none" : "auto"}>
                <Text style={[styles.eyebrow, { color: palette.neutral }]}>{COPY.eyebrow.toUpperCase()}</Text>
                <Text style={[styles.headline, { color: palette.ink }]} accessibilityRole="header">
                  {COPY.headline}
                </Text>
                <Text style={[styles.body, { color: palette.muted }]}>{COPY.body}</Text>

                <View style={styles.actions}>
                  <GoogleButton dark={isDark} busy={busy} onPress={() => void signIn.start()} />
                  <Text
                    style={[styles.error, { color: palette.left, opacity: error ? 1 : 0 }]}
                    accessibilityLiveRegion="polite"
                    accessibilityElementsHidden={!error}
                  >
                    {error ?? " "}
                  </Text>
                  <Pressable
                    onPress={dismiss}
                    disabled={busy}
                    accessibilityRole="button"
                    hitSlop={8}
                    style={({ pressed }) => [styles.notNow, { opacity: busy ? 0 : pressed ? 0.5 : 1 }]}
                  >
                    <Text style={[styles.notNowText, { color: palette.ink }]}>{COPY.notNow}</Text>
                  </Pressable>
                </View>

                <FinePrint palette={palette} />
              </Animated.View>

              {done ? (
                <Animated.View style={[StyleSheet.absoluteFill, styles.welcome, welcomeStyle]} accessibilityLiveRegion="assertive">
                  <View style={[styles.check, { backgroundColor: palette.neutral }]}>
                    <CheckIcon color="#FFFFFF" />
                  </View>
                  <Text style={[styles.headline, styles.center, { color: palette.ink }]}>{COPY.welcome(user ? firstName(user) : null)}</Text>
                  <Text style={[styles.body, styles.center, { color: palette.muted }]}>{COPY.welcomeBody}</Text>
                </Animated.View>
              ) : null}
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

// A soft light behind the cards, in the Neutral accent.
function Glow({ color }: { color: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="58%" rx="46%" ry="62%">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#glow)" />
    </Svg>
  );
}

type FannedCardProps = {
  card: HeroCard;
  pose: { x: number; y: number; rotate: number };
  open: boolean;
  delay: number;
  instant: boolean;
  palette: Palette;
};

// One of the reader's recent cards: starts stacked in the middle and swings out to its pose,
// a beat after the one before it.
function FannedCard({ card, pose, open, delay, instant, palette }: FannedCardProps) {
  const [failed, setFailed] = useState(false);
  const t = useSharedValue(instant ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    if (instant) {
      t.value = 1;
      return;
    }
    t.value = 0;
    t.value = withDelay(FAN_DELAY_MS + delay, withSpring(1, FAN));
  }, [open, instant, delay, t]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: pose.x * t.value },
      { translateY: pose.y * t.value },
      { rotate: `${pose.rotate * t.value}deg` },
      { scale: 0.9 + 0.1 * Math.min(t.value, 1) },
    ],
  }));

  const showImage = card.imageUrl !== null && !failed;
  return (
    <Animated.View style={[styles.cardShadow, style]}>
      <View style={[styles.cardFrame, { backgroundColor: palette.imageFallback, borderColor: palette.card }]}>
        {showImage ? (
          <Image
            source={{ uri: card.imageUrl! }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
            onError={() => setFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={[styles.cardPlaceholder, { color: palette.placeholderInk }]} numberOfLines={1}>
            {card.category === "other" ? "FR" : CATEGORY_SHORT_LABELS[card.category]}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

function FinePrint({ palette }: { palette: Palette }) {
  const link = (label: string, url: string) =>
    url ? (
      <Text style={styles.link} onPress={() => void WebBrowser.openBrowserAsync(url)} accessibilityRole="link">
        {label}
      </Text>
    ) : (
      label
    );
  return (
    <Text style={[styles.finePrint, { color: palette.muted }]}>
      By continuing you agree to the {link("Terms", LEGAL.termsUrl)} and {link("Privacy Policy", LEGAL.privacyUrl)}.
    </Text>
  );
}

const CARD_W = 92;
const CARD_H = 122;

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    paddingHorizontal: 24,
    boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
  },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, opacity: 0.3, marginTop: 8 },
  hero: { height: 176, alignItems: "center", justifyContent: "center", marginHorizontal: -24, marginTop: 4 },
  cardShadow: {
    position: "absolute",
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
  },
  cardFrame: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 3,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  cardPlaceholder: { fontFamily: fonts.headline, fontSize: 18, paddingHorizontal: 6 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.4, marginTop: 6 },
  headline: { fontFamily: fonts.headline, fontSize: 28, lineHeight: 32, letterSpacing: -0.42, marginTop: 8 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, marginTop: 8 },
  actions: { marginTop: 22 },
  error: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, textAlign: "center", marginTop: 10 },
  notNow: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 2 },
  notNowText: { fontFamily: fonts.semibold, fontSize: 15 },
  finePrint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 6 },
  link: { textDecorationLine: "underline" },
  welcome: { alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  check: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  center: { textAlign: "center" },
});
