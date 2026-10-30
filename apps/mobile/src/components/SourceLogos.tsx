import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { CardPayload } from "@fr/shared";
import { initials, logoStack, logoStackLabel, logoUrl } from "../lib/sources";
import { fonts, type Palette } from "../theme/tokens";

type Props = { palette: Palette; sources: CardPayload["sources"] };

const SIZE = 16;
const RING = 1.5;
const OVERLAP = 5;

// Tiny overlapping outlet logos beside the date, newest outlet on top, then "+2 more".
// Decorative for touch; read out as one label.
export function SourceLogos({ palette, sources }: Props) {
  if (!sources.length) return null;
  const { shown, extra } = logoStack(sources);

  return (
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={logoStackLabel(sources)}>
      {shown.map((source, i) => (
        <Ring key={source.name} palette={palette} index={i} count={shown.length}>
          <Logo palette={palette} name={source.name} url={source.url} />
        </Ring>
      ))}
      {extra > 0 ? <Text style={[styles.more, { color: palette.muted }]}>+{extra} more</Text> : null}
    </View>
  );
}

// A card-coloured ring cuts each circle out of the one beneath it.
function Ring({ palette, index, count, children }: { palette: Palette; index: number; count: number; children: ReactNode }) {
  return (
    <View style={[styles.ring, { backgroundColor: palette.card, zIndex: count - index, marginLeft: index ? -OVERLAP : 0 }]}>
      {children}
    </View>
  );
}

function Logo({ palette, name, url }: { palette: Palette; name: string; url: string }) {
  const [failed, setFailed] = useState(false);
  const uri = logoUrl(url);

  if (!uri || failed) {
    return (
      <View style={[styles.circle, styles.center, { backgroundColor: palette.imageFallback, borderColor: palette.logoEdge }]}>
        <Text style={[styles.initials, { color: palette.ink }]}>{initials(name)}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.circle, { backgroundColor: palette.logoBg, borderColor: palette.logoEdge }]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={120}
        cachePolicy="memory-disk"
        onError={() => setFailed(true)}
        accessible={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
  ring: { padding: RING, borderRadius: SIZE / 2 + RING },
  circle: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  center: { alignItems: "center", justifyContent: "center" },
  initials: { fontFamily: fonts.semibold, fontSize: 7, includeFontPadding: false },
  more: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16, marginLeft: 4, includeFontPadding: false },
});
