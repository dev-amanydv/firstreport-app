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

export function CloseIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
      <Line x1="6" x2="18" y1="6" y2="18" />
      <Line x1="18" x2="6" y1="6" y2="18" />
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

// Google's four-colour "G", as Google's sign-in branding guidelines require (never recoloured).
export function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

export function CheckIcon({ color, size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)} strokeWidth={2.25}>
      <Polyline points="5 12.5 10 17.5 19 7" />
    </Svg>
  );
}

// Account page rows: same 24-grid line style.
export function BookmarkIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
      <Path d="M6 3.5h12v17l-6-4.25-6 4.25z" />
    </Svg>
  );
}

export function BellIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
      <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <Path d="M10 21h4" />
    </Svg>
  );
}

export function ContrastIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 3a9 9 0 0 1 0 18z" fill={color} />
    </Svg>
  );
}

export function InfoIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
      <Circle cx="12" cy="12" r="9" />
      <Line x1="12" x2="12" y1="11" y2="16.5" />
      <Line x1="12" x2="12.01" y1="7.5" y2="7.5" />
    </Svg>
  );
}

export function ShieldIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
      <Path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z" />
    </Svg>
  );
}

export function DocumentIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
      <Path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" />
      <Polyline points="14 3 14 8 19 8" />
      <Line x1="8.5" x2="15.5" y1="13" y2="13" />
      <Line x1="8.5" x2="13" y1="16.5" y2="16.5" />
    </Svg>
  );
}

export function SignOutIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
      <Path d="M9 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H9" />
      <Polyline points="16 17 21 12 16 7" />
      <Line x1="21" x2="9" y1="12" y2="12" />
    </Svg>
  );
}

export function ChevronIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
      <Polyline points="9 6 15 12 9 18" />
    </Svg>
  );
}

export function BackIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color)}>
      <Polyline points="15 6 9 12 15 18" />
    </Svg>
  );
}
