import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTimeline } from "../api/client";
import { storyDate } from "../lib/time";
import { fonts, type Palette } from "../theme/tokens";
import { Sheet, SheetMessage } from "./Sheet";
import { Bone, Shimmer } from "./Skeleton";

type Props = {
  palette: Palette;
  visible: boolean;
  storyId: string;
  // The Event being read; it is marked and not tappable.
  currentId: string;
  onClose: () => void;
  onOpen: (eventId: string) => void;
};

const DOT = 9;

// The Story's Events, oldest first, on a thin vertical line.
export function HistorySheet({ palette, visible, storyId, currentId, onClose, onOpen }: Props) {
  const timeline = useTimeline(storyId, visible);

  let content;
  if (timeline.isPending) content = <TimelineSkeleton palette={palette} />;
  else if (timeline.isError)
    content = (
      <SheetMessage palette={palette} text="Couldn't load the history." action={{ label: "Try again", onPress: () => void timeline.refetch() }} />
    );
  else
    content = timeline.data.items.map((item, i, items) => {
      const current = item.id === currentId;
      const last = i === items.length - 1;
      return (
        <Pressable
          key={item.id}
          disabled={current}
          onPress={() => onOpen(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`${storyDate(item.firstSeenAt)}. ${item.headline}${current ? ". Reading now" : ""}`}
          accessibilityState={{ selected: current }}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.5 }]}
        >
          <View style={styles.rail}>
            <View
              style={[
                styles.dot,
                current ? { backgroundColor: palette.neutral } : { borderColor: palette.muted, borderWidth: 1.5, backgroundColor: palette.card },
              ]}
            />
            {last ? null : <View style={[styles.line, { backgroundColor: palette.hairline }]} />}
          </View>
          <View style={[styles.text, !last && styles.gap]}>
            <Text style={[styles.date, { color: current ? palette.neutral : palette.muted }]}>
              {storyDate(item.firstSeenAt)}
              {current ? " · Reading now" : ""}
            </Text>
            <Text style={[styles.headline, { color: palette.ink, fontFamily: current ? fonts.semibold : fonts.medium }]}>{item.headline}</Text>
          </View>
        </Pressable>
      );
    });

  return (
    <Sheet palette={palette} visible={visible} title="Timeline" onClose={onClose}>
      {content}
    </Sheet>
  );
}

// Dots on the rail with a date and a headline beside each, like the real timeline.
export function TimelineSkeleton({ palette, rows = 4 }: { palette: Palette; rows?: number }) {
  return (
    <Shimmer palette={palette} label="Loading the timeline">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.rail}>
            <Bone height={DOT} width={DOT} radius={DOT / 2} style={{ marginTop: 4 }} />
            {i < rows - 1 ? <View style={[styles.line, { backgroundColor: palette.hairline }]} /> : null}
          </View>
          <View style={[styles.text, i < rows - 1 && styles.gap]}>
            <Bone height={10} width={96} style={{ marginTop: 3 }} />
            <Bone height={14} style={{ marginTop: 8 }} />
            <Bone height={14} width={i % 2 ? "48%" : "72%"} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}
    </Shimmer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  rail: { width: DOT, alignItems: "center" },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, marginTop: 4 },
  line: { flex: 1, width: 1.5, marginTop: 4 },
  text: { flex: 1 },
  gap: { paddingBottom: 18 },
  date: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, includeFontPadding: false },
  headline: { fontSize: 15, lineHeight: 21, marginTop: 3 },
});
