import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { fonts, metrics, TAP_SLOP, type Palette } from "../theme/tokens";

// Pane order matches the tab order: swipe right for Left, swipe left for Right.
export const PANES = ["left", "neutral", "right"] as const;
export type Pane = (typeof PANES)[number];
const NEUTRAL = 1;
const LABELS: Record<Pane, string> = { left: "Left-leaning", neutral: "Neutral", right: "Right-leaning" };

const SETTLE = { duration: 260, easing: Easing.out(Easing.cubic) };
const FLICK_VELOCITY = 500;

type Props = {
  palette: Palette;
  width: number;
  contested: boolean;
  texts: Record<Pane, string>;
  showAiLabel: boolean;
  hint: boolean;
  onPaneChange: (pane: Pane) => void;
  onTap: () => void;
};

export function Perspective({ palette, width, contested, texts, showAiLabel, hint, onPaneChange, onTap }: Props) {
  // position: 0 = Left, 1 = Neutral, 2 = Right, fractional while dragging.
  const position = useSharedValue(NEUTRAL);
  const start = useSharedValue(NEUTRAL);
  const hintOpacity = useSharedValue(1);
  const [index, setIndex] = useState(NEUTRAL);
  const settled = useRef(NEUTRAL);

  const settle = (next: number) => {
    if (next === settled.current) return;
    settled.current = next;
    setIndex(next);
    onPaneChange(PANES[next]!);
    void Haptics.selectionAsync();
  };

  useEffect(() => {
    if (!hint) return;
    hintOpacity.value = withRepeat(withSequence(withTiming(0.55, { duration: 450 }), withTiming(1, { duration: 450 })), 2);
  }, [hint, hintOpacity]);

  const pan = usePanGesture({
    enabled: contested,
    // Clearly horizontal drags only: a vertical swipe fails this long before it could activate.
    activeOffsetX: [-20, 20],
    failOffsetY: [-8, 8],
    onActivate: () => {
      start.value = position.value;
    },
    onUpdate: (event) => {
      const raw = start.value - event.translationX / width;
      // Resist past the outer panes.
      position.value = raw < 0 ? raw / 4 : raw > 2 ? 2 + (raw - 2) / 4 : raw;
    },
    onDeactivate: (event) => {
      let target = Math.round(position.value);
      if (Math.abs(event.velocityX) > FLICK_VELOCITY) target = Math.round(start.value) - Math.sign(event.velocityX);
      target = Math.min(2, Math.max(0, target));
      position.value = withTiming(target, SETTLE);
      scheduleOnRN(settle, target);
    },
  });
  const tap = useTapGesture({ maxDistance: TAP_SLOP.maxDistance, maxDuration: TAP_SLOP.maxDuration, runOnJS: true, onActivate: onTap });
  const gesture = useCompetingGestures(pan, tap);

  const goTo = (next: number) => {
    position.value = withTiming(next, SETTLE);
    settle(next);
  };

  const panesStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -position.value * width }] }));

  return (
    <>
      {/* Uncontested news is just the facts: no tab row, no swipe. */}
      {contested ? (
        <Tabs palette={palette} width={width} position={position} index={index} hintOpacity={hintOpacity} onSelect={goTo} />
      ) : null}
      <GestureDetector gesture={gesture}>
        <View style={styles.viewport} collapsable={false}>
          <Animated.View style={[styles.panes, { width: width * 3 }, panesStyle]}>
            {PANES.map((pane) => (
              <View key={pane} style={{ width }} accessibilityElementsHidden={pane !== PANES[index]} importantForAccessibility={pane === PANES[index] ? "auto" : "no-hide-descendants"}>
                {showAiLabel && pane !== "neutral" ? <Text style={[styles.aiLabel, { color: palette.muted }]}>AI-generated viewpoint</Text> : null}
                <Body color={palette.ink}>{texts[pane]}</Body>
              </View>
            ))}
          </Animated.View>
        </View>
      </GestureDetector>
    </>
  );
}

function Body({ color, children }: { color: string; children: ReactNode }) {
  return (
    <Text style={[styles.body, { color }]} textBreakStrategy="highQuality" lineBreakStrategyIOS="standard">
      {children}
    </Text>
  );
}

type TabsProps = {
  palette: Palette;
  width: number;
  position: SharedValue<number>;
  index: number;
  hintOpacity: SharedValue<number>;
  onSelect: (index: number) => void;
};

function Tabs({ palette, width, position, index, hintOpacity, onSelect }: TabsProps) {
  const tabWidth = width / 3;
  const colours = [palette.left, palette.neutral, palette.right];

  // The underline follows the finger and takes on the colour of the pane it is nearest.
  const underline = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * tabWidth }],
    backgroundColor: interpolateColor(position.value, [0, 1, 2], colours),
  }));

  return (
    <View style={[styles.tabs, { boxShadow: `inset 0 -1px 0 ${palette.hairline}` }]} accessibilityRole="tablist" accessibilityLabel="Perspective">
      {PANES.map((pane, i) => (
        <Tab key={pane} i={i} label={LABELS[pane]} colour={colours[i]!} palette={palette} position={position} selected={i === index} hintOpacity={hintOpacity} onPress={() => onSelect(i)} />
      ))}
      <Animated.View pointerEvents="none" style={[styles.underline, { width: tabWidth }, underline]} />
    </View>
  );
}

type TabProps = {
  i: number;
  label: string;
  colour: string;
  palette: Palette;
  position: SharedValue<number>;
  selected: boolean;
  hintOpacity: SharedValue<number>;
  onPress: () => void;
};

function Tab({ i, label, colour, palette, position, selected, hintOpacity, onPress }: TabProps) {
  // 0 when this tab is fully inactive, 1 when fully active.
  const nearness = () => {
    "worklet";
    return Math.max(0, 1 - Math.abs(position.value - i));
  };
  const square = useAnimatedStyle(() => ({ width: 7 * nearness(), marginRight: 6 * nearness(), opacity: nearness() }));
  const text = useAnimatedStyle(() => ({
    color: interpolateColor(nearness(), [0, 1], [palette.muted, palette.ink]),
    opacity: interpolate(nearness(), [0, 1], [hintOpacity.value, 1]),
  }));

  return (
    <Pressable style={styles.tab} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={`${label} perspective`}>
      <Animated.View style={[styles.square, { backgroundColor: colour }, square]} />
      <Animated.Text style={[styles.tabLabel, { fontFamily: selected ? fonts.semibold : fonts.medium }, text]}>{label}</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: { marginTop: 12, height: metrics.tabsHeight, flexDirection: "row" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  square: { width: 7, height: 7 },
  tabLabel: { fontSize: 13, includeFontPadding: false },
  underline: { position: "absolute", left: 0, bottom: 0, height: 2 },
  viewport: { flex: 1, overflow: "hidden", marginTop: 10 },
  panes: { flexDirection: "row", alignItems: "flex-start" },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, includeFontPadding: false },
  aiLabel: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16, marginBottom: 4 },
});
