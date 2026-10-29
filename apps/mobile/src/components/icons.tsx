import Svg, { Circle, Line, Path, Polygon, Polyline } from "react-native-svg";

// Paths copied from the design artboard (24 × 24 grid, stroke 1.75).
type IconProps = { color: string; size?: number };

const stroke = (color: string) => ({
  fill: "none",
  stroke: color,
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function ClockIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
      <Circle cx="12" cy="12" r="9" />
      <Polyline points="12 7 12 12 15.5 14" />
    </Svg>
  );
}

export function CompressIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
      <Polyline points="4 14 10 14 10 20" />
      <Polyline points="20 10 14 10 14 4" />
      <Line x1="14" x2="21" y1="10" y2="3" />
      <Line x1="3" x2="10" y1="21" y2="14" />
    </Svg>
  );
}

export function ExternalIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
      <Path d="M15 3h6v6" />
      <Path d="M10 14 21 3" />
      <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </Svg>
  );
}

export function ShareIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
      <Circle cx="18" cy="5" r="3" />
      <Circle cx="6" cy="12" r="3" />
      <Circle cx="18" cy="19" r="3" />
      <Line x1="8.6" x2="15.4" y1="13.5" y2="17.5" />
      <Line x1="15.4" x2="8.6" y1="6.5" y2="10.5" />
    </Svg>
  );
}

export function CompassIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
      <Circle cx="12" cy="12" r="9.5" />
      <Polygon points="15.8 8.2 13.9 13.9 8.2 15.8 10.1 10.1 15.8 8.2" />
    </Svg>
  );
}

// Filled when active; the door is cut out in the canvas colour, as on the artboard.
export function HomeIcon({ color, size = 24, filled, cutout }: IconProps & { filled: boolean; cutout: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)} fill={filled ? color : "none"}>
      <Path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" stroke={filled ? cutout : color} />
    </Svg>
  );
}

export function PersonIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}
