import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type HostInstance, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Mask, Rect, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import type { TourStep } from "../lib/tour";
import type { TourTargets } from "../tour";
import { fonts, type Palette } from "../theme/tokens";
import { Glass, glassShadow } from "./Glass";
import { ChevronIcon } from "./icons";

type Props = {
  palette: Palette;
  step: TourStep;
  text: string;
  // Position among the tour's steps, for the dots in the bubble.
  progress: { index: number; total: number };
  targets: TourTargets;
  // Called when the step's control is not on screen, so the tour skips it rather than hang.
  onMissing: () => void;
  onFinish: () => void;
};

type Box = { x: number; y: number; width: number; height: number };

// Room around the highlighted control, and its corner radius.
const PAD = 6;
const HOLE_RADIUS = 16;
// The action bar slides in over 180 ms; the controls are measured once it has settled.
const MEASURE_DELAY_MS = 220;
const SIDE = 16;
const GAP = 14;
// The last step ends with a swipe up this far, or a flick.
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 600;
const BUBBLE_RADIUS = 24;
// Springy and a little wobbly, like the toast: a drop of glass settling.
const DROP = { damping: 14, stiffness: 220, mass: 0.9 };
const WHITE = "#FFFFFF";

// Dims everything but the control the current step is about, and rings it with a glass rim. The scrim is
// drawn with a cut-out, and four near-transparent Views around the hole take every touch outside it, so
// only the real control can be used. (A View with a background stops gesture-handler reaching beneath it.)
export function TourOverlay({ palette, step, text, progress, targets, onMissing, onFinish }: Props) {
  const root = useRef<HostInstance>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [hole, setHole] = useState<Box | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((old) => (old?.width === width && old.height === height ? old : { width, height }));
  };

  useEffect(() => {
    setHole(null);
    if (step === "swipe" || !size) return;
    const timer = setTimeout(() => {
      const target = targets[step].current;
      if (!target || !root.current) return onMissing();
      root.current.measureInWindow((rootX, rootY) => {
        target.measureInWindow((x, y, width, height) => {
          if (!width || !height) return onMissing();
          setHole({ x: x - rootX - PAD, y: y - rootY - PAD, width: width + PAD * 2, height: height + PAD * 2 });
        });
      });
    }, MEASURE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [step, size, targets, onMissing]);

  const swipe = usePanGesture({
    activeOffsetY: [-8, 8],
    onDeactivate: (event) => {
      if (event.translationY < -SWIPE_DISTANCE || event.velocityY < -SWIPE_VELOCITY) scheduleOnRN(onFinish);
    },
  });

  if (!size) return <View ref={root} style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="box-none" />;

  if (step === "swipe") {
    return (
      <View ref={root} style={StyleSheet.absoluteFill} onLayout={onLayout}>
        <GestureDetector gesture={swipe}>
          <View style={[StyleSheet.absoluteFill, styles.swipe, { backgroundColor: palette.scrim }]} collapsable={false}>
            <SwipeArrow />
            <TourBubble palette={palette} text={text} progress={progress} style={styles.swipeBubble}>
              <Pressable
                onPress={onFinish}
                accessibilityRole="button"
                hitSlop={10}
                style={({ pressed }) => [styles.chip, { backgroundColor: palette.neutral }, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.chipText, { color: palette.onNeutral }]}>Start reading</Text>
              </Pressable>
            </TourBubble>
          </View>
        </GestureDetector>
      </View>
    );
  }

  // Until the control is measured, the whole area is dimmed and blocked.
  if (!hole) {
    return (
      <View ref={root} style={StyleSheet.absoluteFill} onLayout={onLayout}>
        <Blocker style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }]} />
      </View>
    );
  }

  // The bubble goes below a control in the top half, above one in the bottom half.
  const below = hole.y + hole.height / 2 < size.height / 2;
  const bubblePosition = below ? { top: hole.y + hole.height + GAP } : { bottom: size.height - hole.y + GAP };

  return (
    <View ref={root} style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="box-none">
      <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Mask id="tourHole" x={0} y={0} width={size.width} height={size.height} maskUnits="userSpaceOnUse">
            <Rect width={size.width} height={size.height} fill={WHITE} />
            <Rect x={hole.x} y={hole.y} width={hole.width} height={hole.height} rx={HOLE_RADIUS} fill="#000" />
          </Mask>
          <LinearGradient id="tourRim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={WHITE} stopOpacity={0.95} />
            <Stop offset="1" stopColor={WHITE} stopOpacity={0.3} />
          </LinearGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill={palette.scrim} mask="url(#tourHole)" />
        {/* A glass lens around the control: a soft halo, then a bright rim lit from above. */}
        <Rect
          x={hole.x - 3}
          y={hole.y - 3}
          width={hole.width + 6}
          height={hole.height + 6}
          rx={HOLE_RADIUS + 3}
          fill="none"
          stroke={WHITE}
          strokeOpacity={0.14}
          strokeWidth={6}
        />
        <Rect x={hole.x} y={hole.y} width={hole.width} height={hole.height} rx={HOLE_RADIUS} fill="none" stroke="url(#tourRim)" strokeWidth={1.5} />
      </Svg>
      <Blocker style={{ left: 0, right: 0, top: 0, height: Math.max(hole.y, 0) }} />
      <Blocker style={{ left: 0, right: 0, top: hole.y + hole.height, bottom: 0 }} />
      <Blocker style={{ left: 0, width: Math.max(hole.x, 0), top: hole.y, height: hole.height }} />
      <Blocker style={{ left: hole.x + hole.width, right: 0, top: hole.y, height: hole.height }} />
      <TourBubble key={step} palette={palette} text={text} progress={progress} style={[styles.bubble, bubblePosition]} />
    </View>
  );
}

function Blocker({ style }: { style: StyleProp<ViewStyle> }) {
  return <View style={[styles.blocker, style]} onStartShouldSetResponder={() => true} />;
}

type BubbleProps = {
  palette: Palette;
  text: string;
  progress?: { index: number; total: number };
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

// The tour's tooltip: a drop of frosted glass that lands with a little wobble, like the toast.
// Also used for the Explore pointer in the bottom bar.
export function TourBubble({ palette, text, progress, style, children }: BubbleProps) {
  const reduceMotion = useReducedMotion();
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const landed = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (!reduceMotion) landed.value = withSpring(1, DROP);
  }, [landed, reduceMotion]);

  const drop = useAnimatedStyle(() => {
    const p = landed.value;
    return {
      opacity: Math.min(1, p * 1.6),
      transform: [
        { translateY: (1 - p) * 16 },
        // Wider and flatter as it lands, then it settles back: the "liquid" part.
        { scaleX: 0.9 + 0.1 * p + (p > 1 ? (p - 1) * 0.5 : 0) },
        { scaleY: 0.92 + 0.08 * p - (p > 1 ? (p - 1) * 0.4 : 0) },
      ],
    };
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((old) => (old?.width === width && old.height === height ? old : { width, height }));
  };

  return (
    <Animated.View style={[styles.bubbleBox, glassShadow, drop, style]} onLayout={onLayout} accessibilityLiveRegion="polite">
      {box ? <Glass palette={palette} width={box.width} height={box.height} radius={BUBBLE_RADIUS} strong /> : null}
      <Text style={[styles.text, { color: palette.ink }]}>{text}</Text>
      {progress || children ? (
        <View style={styles.footer}>
          {progress ? <Dots palette={palette} {...progress} /> : <View />}
          {children}
        </View>
      ) : null}
    </Animated.View>
  );
}

// Where the reader is in the tour: the current step is a longer pill.
function Dots({ palette, index, total }: { palette: Palette; index: number; total: number }) {
  return (
    <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, i === index ? [styles.dotOn, { backgroundColor: palette.ink }] : { backgroundColor: palette.muted, opacity: 0.4 }]} />
      ))}
    </View>
  );
}

// A glass pill button, for the tour's Skip.
export function GlassPill({ palette, label, onPress, accessibilityLabel }: { palette: Palette; label: string; onPress: () => void; accessibilityLabel?: string }) {
  const [width, setWidth] = useState(0);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={8}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={({ pressed }) => [styles.pill, glassShadow, pressed && { opacity: 0.6 }]}
    >
      {width ? <Glass palette={palette} width={width} height={PILL_HEIGHT} radius={PILL_HEIGHT / 2} /> : null}
      <Text style={[styles.pillText, { color: palette.ink }]}>{label}</Text>
    </Pressable>
  );
}

const PILL_HEIGHT = 34;

function SwipeArrow() {
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    lift.value = withRepeat(withSequence(withTiming(-14, { duration: 520 }), withTiming(0, { duration: 520 })), -1);
  }, [lift, reduceMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }, { rotate: "-90deg" }] }));
  return (
    <Animated.View style={style} pointerEvents="none">
      <ChevronIcon color={WHITE} size={40} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  blocker: { position: "absolute", backgroundColor: "rgba(0,0,0,0.01)" },
  bubble: { position: "absolute", left: SIDE, right: SIDE },
  bubbleBox: { borderRadius: BUBBLE_RADIUS, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, gap: 12 },
  text: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 20 },
  dots: { flexDirection: "row", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 18 },
  chip: { height: 38, paddingHorizontal: 18, borderRadius: 19, justifyContent: "center" },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, includeFontPadding: false },
  pill: { height: PILL_HEIGHT, paddingHorizontal: 16, borderRadius: PILL_HEIGHT / 2, justifyContent: "center" },
  pillText: { fontFamily: fonts.semibold, fontSize: 14, includeFontPadding: false },
  swipe: { alignItems: "center", justifyContent: "flex-end", paddingBottom: 40, gap: 18 },
  swipeBubble: { marginHorizontal: SIDE, alignSelf: "stretch" },
});
