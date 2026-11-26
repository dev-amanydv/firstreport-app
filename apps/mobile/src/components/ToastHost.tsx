import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { hideToast, useToast, type Toast } from "../toast";
import { fonts, metrics, type Palette } from "../theme/tokens";
import { usePalette } from "../theme/useTheme";
import { BookmarkIcon } from "./icons";

const SHOW_MS = 2600;
const HEIGHT = 52;
const RADIUS = HEIGHT / 2;
// Springy and a little wobbly, like a drop settling.
const DROP = { damping: 14, stiffness: 220, mass: 0.9 };
const OUT = { duration: 180, easing: Easing.in(Easing.quad) };

// Floats above the bottom nav. Rendered once, in the root layout.
export function ToastHost() {
  const toast = useToast();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  // Keeps the last toast on screen while it animates out.
  const [shown, setShown] = useState<Toast | null>(null);
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (toast) {
      setShown(toast);
      progress.value = 0;
      progress.value = withSpring(1, DROP);
      AccessibilityInfo.announceForAccessibility(toast.message);
      const timer = setTimeout(() => hideToast(toast.id), SHOW_MS);
      return () => clearTimeout(timer);
    }
    progress.value = withTiming(0, OUT, (done) => {
      if (done) scheduleOnRN(setShown, null);
    });
  }, [toast, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: Math.min(1, p * 1.6),
      transform: [
        { translateY: (1 - p) * 28 },
        // Wider and flatter as it lands, then it settles back: the "liquid" part.
        { scaleX: 0.86 + 0.14 * p + (p > 1 ? (p - 1) * 0.5 : 0) },
        { scaleY: 0.9 + 0.1 * p - (p > 1 ? (p - 1) * 0.4 : 0) },
      ],
    };
  });

  if (!shown) return null;

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + metrics.navHeight + 16 }]}>
      <Animated.View
        style={[styles.toast, styles.shadow, style]}
        accessibilityLiveRegion="polite"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {width ? <Glass palette={palette} width={width} /> : null}
        <View style={styles.content}>
          {shown.icon ? (
            <View style={[styles.badge, { backgroundColor: shown.icon === "saved" ? palette.neutral : palette.glassIconBg }]}>
              <BookmarkIcon
                color={shown.icon === "saved" ? palette.onNeutral : palette.ink}
                size={15}
                filled={shown.icon === "saved"}
              />
            </View>
          ) : null}
          <Text style={[styles.message, { color: palette.ink }]} numberOfLines={1}>
            {shown.message}
          </Text>
          {shown.action ? (
            <Pressable
              onPress={() => {
                shown.action!.onPress();
                hideToast(shown.id);
              }}
              hitSlop={10}
              accessibilityRole="button"
              style={({ pressed }) => [styles.action, { backgroundColor: palette.glassIconBg }, pressed && { opacity: 0.6 }]}
            >
              <Text style={[styles.actionText, { color: palette.ink }]}>{shown.action.label}</Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

// Frosted glass without a native blur: a milky fill, a bright sheen across the top, a light rim and a darker
// outer edge, so it reads as a raised drop of glass over the card.
function Glass({ palette, width }: { palette: Palette; width: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={HEIGHT}>
      <Defs>
        <LinearGradient id="toastSheen" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={palette.glassSheen} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={palette.glassSheen * 0.35} />
        </LinearGradient>
        <LinearGradient id="toastRim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={palette.glassRim} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={palette.glassRim * 0.25} />
        </LinearGradient>
      </Defs>
      <Rect x="0.5" y="0.5" width={width - 1} height={HEIGHT - 1} rx={RADIUS - 0.5} fill={palette.glassFill} stroke={palette.glassEdge} strokeWidth={1} />
      <Rect x="0" y="0" width={width} height={HEIGHT} rx={RADIUS} fill="url(#toastSheen)" />
      <Rect x="1.5" y="1.5" width={width - 3} height={HEIGHT - 3} rx={RADIUS - 1.5} fill="none" stroke="url(#toastRim)" strokeWidth={1} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: { height: HEIGHT, borderRadius: RADIUS, minWidth: 200, maxWidth: 380 },
  // Android draws elevation through a see-through fill, so the shadow is iOS only; the dark edge does the job there.
  shadow: Platform.select({
    ios: { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
    default: {},
  }),
  content: { flex: 1, flexDirection: "row", alignItems: "center", paddingLeft: 10, paddingRight: 8, gap: 10 },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  message: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, includeFontPadding: false, marginRight: 6 },
  action: { height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: "center", marginLeft: "auto" },
  actionText: { fontFamily: fonts.semibold, fontSize: 13, includeFontPadding: false },
});
