import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Category } from "@fr/shared";
import { relativeTime } from "../../lib/time";
import { fonts, type Palette } from "../../theme/tokens";
import { Thumb } from "./Thumb";

type Props = {
  palette: Palette;
  event: { id: string; headline: string; imageUrl: string | null; firstSeenAt: string; category: Category };
  // "Covered by 9 outlets", shown before the age.
  note?: string;
  // The place in a ranked list.
  rank?: number;
  onOpen: (id: string) => void;
};

// One card as a list row: thumbnail, headline, age. Used by Most covered and by search results.
export function EventRow({ palette, event, note, rank, onOpen }: Props) {
  const meta = [note, relativeTime(event.firstSeenAt)].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={() => onOpen(event.id)}
      accessibilityRole="button"
      accessibilityLabel={`${rank ? `${rank}. ` : ""}${event.headline}. ${meta}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.5 }]}
    >
      {rank ? <Text style={[styles.rank, { color: palette.muted }]}>{rank}</Text> : null}
      <View style={styles.text}>
        <Text style={[styles.headline, { color: palette.ink }]} numberOfLines={3}>
          {event.headline}
        </Text>
        <Text style={[styles.meta, { color: palette.muted }]}>{meta}</Text>
      </View>
      <Thumb palette={palette} uri={event.imageUrl} category={event.category} width={72} height={72} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  rank: { fontFamily: fonts.headline, fontSize: 22, width: 24, textAlign: "center" },
  text: { flex: 1, gap: 4 },
  headline: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  meta: { fontFamily: fonts.medium, fontSize: 12 },
});
