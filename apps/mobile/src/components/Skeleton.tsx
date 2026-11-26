import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { Palette } from "../theme/tokens";

// Loading placeholders drawn in the exact shape of what is coming, so nothing jumps when it arrives.
// Every Bone inside one <Shimmer> shares a single clock, so the light sweeps across them together.

const SWEEP_MS = 1100;
const PAUSE_MS = 500;
const BAND = 140;

type ShimmerState = { progress: SharedValue<number> | null; palette: Palette; onCanvas: boolean };
const ShimmerContext = createContext<ShimmerState | null>(null);

type ShimmerProps = {
  palette: Palette;
  // Bones drawn straight on the screen background rather than on a card need a stronger tone.
  onCanvas?: boolean;
  label?: string;
  children: ReactNode;
};

export function Shimmer({ palette, onCanvas = false, label = "Loading", children }: ShimmerProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(withDelay(PAUSE_MS, withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) })), -1, false);
  }, [progress, reduceMotion]);

  return (
    <ShimmerContext.Provider value={{ progress: reduceMotion ? null : progress, palette, onCanvas }}>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
        {children}
      </View>
    </ShimmerContext.Provider>
  );
}

// A nested surface (a card inside an on-canvas Shimmer) switches the tone back.
export function OnCard({ children }: { children: ReactNode }) {
  const state = useContext(ShimmerContext);
  if (!state) return <>{children}</>;
  return <ShimmerContext.Provider value={{ ...state, onCanvas: false }}>{children}</ShimmerContext.Provider>;
}

type BoneProps = { width?: DimensionValue; height: number; radius?: number; style?: StyleProp<ViewStyle> };

export function Bone({ width = "100%", height, radius = 6, style }: BoneProps) {
  const state = useContext(ShimmerContext);
  const [boneWidth, setBoneWidth] = useState(0);
  if (!state) throw new Error("Bone must be inside <Shimmer>");
  const { palette, onCanvas, progress } = state;

  return (
    <View
      onLayout={(event) => setBoneWidth(event.nativeEvent.layout.width)}
      style={[{ width, height, borderRadius: radius, overflow: "hidden", backgroundColor: onCanvas ? palette.skeletonOnCanvas : palette.skeleton }, style]}
    >
      {progress && boneWidth ? <Shine progress={progress} width={boneWidth} color={palette.skeletonShine} /> : null}
    </View>
  );
}

// A soft band of light, travelling from just off the left edge to just off the right.
function Shine({ progress, width, color }: { progress: SharedValue<number>; width: number; color: string }) {
  const id = useId().replace(/:/g, "");
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(progress.value, [0, 1], [-BAND, width]) }] }));
  return (
    <Animated.View style={[styles.shine, style]} pointerEvents="none">
      <Svg width={BAND} height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="0.5" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={BAND} height="100%" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shine: { position: "absolute", top: 0, bottom: 0, left: 0, width: BAND },
});
