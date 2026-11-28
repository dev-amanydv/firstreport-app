import { useId } from "react";
import { Platform, StyleSheet, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { Palette } from "../theme/tokens";

type Props = { palette: Palette; width: number; height: number; radius: number };

// Frosted glass without a native blur: a milky fill, a bright sheen across the top, a light rim and a darker
// outer edge, so it reads as a raised drop of glass. Fills its parent; the parent sets the size.
export function Glass({ palette, width, height, radius }: Props) {
  // Each drop needs its own gradient ids, or two on screen at once would share one.
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const r = Math.min(radius, height / 2, width / 2);
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
      <Defs>
        <LinearGradient id={`sheen${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={palette.glassSheen} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={palette.glassSheen * 0.35} />
        </LinearGradient>
        <LinearGradient id={`rim${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={palette.glassRim} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={palette.glassRim * 0.25} />
        </LinearGradient>
      </Defs>
      <Rect x="0.5" y="0.5" width={width - 1} height={height - 1} rx={r - 0.5} fill={palette.glassFill} stroke={palette.glassEdge} strokeWidth={1} />
      <Rect x="0" y="0" width={width} height={height} rx={r} fill={`url(#sheen${id})`} />
      <Rect x="1.5" y="1.5" width={width - 3} height={height - 3} rx={r - 1.5} fill="none" stroke={`url(#rim${id})`} strokeWidth={1} />
    </Svg>
  );
}

// The soft shadow under a glass drop. Android draws elevation through a see-through fill, so it is iOS only;
// the dark edge does the job there.
export const glassShadow: ViewStyle =
  Platform.OS === "ios" ? { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } } : {};
