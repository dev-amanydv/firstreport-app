import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type HostInstance, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Defs, Mask, Rect } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import type { TourStep } from "../lib/tour";
import type { TourTargets } from "../tour";
import { fonts, type Palette } from "../theme/tokens";
import { ChevronIcon } from "./icons";

type Props = {
  palette: Palette;
  step: TourStep;
  text: string;
  targets: TourTargets;
  // Called when the step's control is not on screen, so the tour skips it rather than hang.
  onMissing: () => void;
  onFinish: () => void;
};

type Box = { x: number; y: number; width: number; height: number };

// Room around the highlighted control, and its corner radius.
const PAD = 6;
const HOLE_RADIUS = 14;
// The action bar slides in over 180 ms; the controls are measured once it has settled.
const MEASURE_DELAY_MS = 220;
const SIDE = 16;
const GAP = 12;
// The last step ends with a swipe up this far, or a flick.
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 600;

// Dims everything but the control the current step is about. The scrim is drawn with a cut-out, and four
// near-transparent Views around the hole take every touch outside it, so only the real control can be
// used. (A View with a background stops gesture-handler from reaching the views beneath it.)
export function TourOverlay({ palette, step, text, targets, onMissing, onFinish }: Props) {
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
            <TourBubble palette={palette} text={text} style={styles.swipeBubble}>
              <Pressable onPress={onFinish} accessibilityRole="button" hitSlop={10} style={({ pressed }) => pressed && { opacity: 0.6 }}>
                <Text style={[styles.action, { color: palette.card }]}>Start reading</Text>
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

  // The bubble goes below a control in the top half, above one in the bottom half, its arrow at the control.
  const below = hole.y + hole.height / 2 < size.height / 2;
  const bubbleWidth = size.width - SIDE * 2;
  const arrowX = Math.min(Math.max(hole.x + hole.width / 2 - SIDE - ARROW / 2, 18), bubbleWidth - 18 - ARROW);
  const bubblePosition = below ? { top: hole.y + hole.height + GAP } : { bottom: size.height - hole.y + GAP };

  return (
    <View ref={root} style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="box-none">
      <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Mask id="tourHole" x={0} y={0} width={size.width} height={size.height} maskUnits="userSpaceOnUse">
            <Rect width={size.width} height={size.height} fill="#fff" />
            <Rect x={hole.x} y={hole.y} width={hole.width} height={hole.height} rx={HOLE_RADIUS} fill="#000" />
          </Mask>
        </Defs>
        <Rect width={size.width} height={size.height} fill={palette.scrim} mask="url(#tourHole)" />
      </Svg>
      <Blocker style={{ left: 0, right: 0, top: 0, height: Math.max(hole.y, 0) }} />
      <Blocker style={{ left: 0, right: 0, top: hole.y + hole.height, bottom: 0 }} />
      <Blocker style={{ left: 0, width: Math.max(hole.x, 0), top: hole.y, height: hole.height }} />
      <Blocker style={{ left: hole.x + hole.width, right: 0, top: hole.y, height: hole.height }} />
      <TourBubble
        key={step}
        palette={palette}
        text={text}
        arrow={{ side: below ? "top" : "bottom", x: arrowX }}
        style={[styles.bubble, bubblePosition]}
      />
    </View>
  );
}

function Blocker({ style }: { style: StyleProp<ViewStyle> }) {
  return <View style={[styles.blocker, style]} onStartShouldSetResponder={() => true} />;
}

const ARROW = 12;

type BubbleProps = {
  palette: Palette;
  text: string;
  arrow?: { side: "top" | "bottom"; x: number };
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

// The tour's tooltip: dark on light, light on dark, so it stands out from the dimmed card. Also used for
// the Explore pointer in the bottom bar.
export function TourBubble({ palette, text, arrow, style, children }: BubbleProps) {
  return (
    <Animated.View entering={FadeIn.duration(220)} style={[styles.bubbleBox, { backgroundColor: palette.ink }, style]} accessibilityLiveRegion="polite">
      {arrow ? (
        <View
          style={[
            styles.arrow,
            { backgroundColor: palette.ink, left: arrow.x },
            arrow.side === "top" ? { top: -ARROW / 2 } : { bottom: -ARROW / 2 },
          ]}
        />
      ) : null}
      <Text style={[styles.text, { color: palette.card }]}>{text}</Text>
      {children}
    </Animated.View>
  );
}

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
      <ChevronIcon color="#FFFFFF" size={40} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  blocker: { position: "absolute", backgroundColor: "rgba(0,0,0,0.01)" },
  bubble: { position: "absolute", left: SIDE, right: SIDE },
  bubbleBox: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  arrow: { position: "absolute", width: ARROW, height: ARROW, transform: [{ rotate: "45deg" }] },
  text: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  action: { fontFamily: fonts.semibold, fontSize: 15, textDecorationLine: "underline" },
  swipe: { alignItems: "center", justifyContent: "flex-end", paddingBottom: 48, gap: 16 },
  swipeBubble: { marginHorizontal: SIDE, alignSelf: "stretch" },
});
