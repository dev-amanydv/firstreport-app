import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useSummary, useTimeline } from "../../src/api/client";
import { BackIcon } from "../../src/components/icons";
import { TimelineSkeleton } from "../../src/components/HistorySheet";
import { SheetMessage } from "../../src/components/Sheet";
import { Bone, Shimmer } from "../../src/components/Skeleton";
import { storyTitle } from "../../src/lib/explore";
import { storyDate } from "../../src/lib/time";
import { fonts, metrics, type Palette } from "../../src/theme/tokens";
import { usePalette } from "../../src/theme/useTheme";

const DOT = 9;

// A storyline opened from Explore: the latest "story so far", then every update in order.
export default function StoryScreen() {
  const { id, label, count } = useLocalSearchParams<{ id: string; label?: string; count?: string }>();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const timeline = useTimeline(id, true);
  const items = timeline.data?.items ?? [];
  const latest = items.at(-1);
  const summary = useSummary(id, latest?.id ?? "", latest !== undefined);
  const updates = timeline.data ? items.length : Number(count) || null;

  let body;
  if (timeline.isPending)
    body = (
      <Shimmer palette={palette} label="Loading the story">
        <View style={[styles.panel, { backgroundColor: palette.card }]}>
          <Bone height={10} width={180} />
          {[100, 96, 100, 90, 100, 58].map((w, i) => (
            <Bone key={i} height={15} width={`${w}%`} style={{ marginTop: i === 0 ? 16 : 11 }} />
          ))}
        </View>
        <View style={[styles.panel, styles.timelinePanel, { backgroundColor: palette.card }]}>
          <TimelineSkeleton palette={palette} rows={3} />
        </View>
      </Shimmer>
    );
  else if (timeline.isError)
    body = <SheetMessage palette={palette} text="Couldn't load this story." action={{ label: "Try again", onPress: () => void timeline.refetch() }} />;
  else if (!items.length) body = <SheetMessage palette={palette} text="This story is no longer available." />;
  else
    body = (
      <>
        {summary.isPending ? (
          <Shimmer palette={palette} label="Loading the story so far">
            <View style={[styles.panel, { backgroundColor: palette.card }]}>
              <Bone height={10} width={180} />
              {[100, 96, 100, 62].map((w, i) => (
                <Bone key={i} height={15} width={`${w}%`} style={{ marginTop: i === 0 ? 16 : 11 }} />
              ))}
            </View>
          </Shimmer>
        ) : summary.data ? (
          <View style={[styles.panel, { backgroundColor: palette.card }]}>
            <Text style={[styles.label, { color: palette.muted }]}>STORY SO FAR · AS OF {storyDate(latest!.firstSeenAt).toUpperCase()}</Text>
            <Text style={[styles.summary, { color: palette.ink }]}>{summary.data.summary}</Text>
          </View>
        ) : null}
        <Text style={[styles.label, styles.timelineLabel, { color: palette.muted }]} accessibilityRole="header">
          TIMELINE
        </Text>
        <View style={[styles.panel, { backgroundColor: palette.card }]}>
          {items.map((item, i) => (
            <TimelineRow key={item.id} palette={palette} item={item} last={i === items.length - 1} />
          ))}
        </View>
      </>
    );

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: palette.canvas }]}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.5 }]}
      >
        <BackIcon color={palette.ink} />
      </Pressable>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={[styles.title, { color: palette.ink }]} accessibilityRole="header">
          {label ? storyTitle(label) : "Story"}
        </Text>
        {updates ? <Text style={[styles.meta, { color: palette.muted }]}>{updates} updates</Text> : null}
        {body}
      </ScrollView>
    </View>
  );
}

type Item = { id: string; headline: string; firstSeenAt: string };

// The same rail as the History sheet; the newest update is marked.
function TimelineRow({ palette, item, last }: { palette: Palette; item: Item; last: boolean }) {
  return (
    <Pressable
      onPress={() => router.push(`/event/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${storyDate(item.firstSeenAt)}. ${item.headline}${last ? ". Latest" : ""}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.5 }]}
    >
      <View style={styles.rail}>
        <View
          style={[
            styles.dot,
            last ? { backgroundColor: palette.neutral } : { borderColor: palette.muted, borderWidth: 1.5, backgroundColor: palette.card },
          ]}
        />
        {last ? null : <View style={[styles.line, { backgroundColor: palette.hairline }]} />}
      </View>
      <View style={[styles.text, !last && styles.gap]}>
        <Text style={[styles.date, { color: last ? palette.neutral : palette.muted }]}>
          {storyDate(item.firstSeenAt)}
          {last ? " · Latest" : ""}
        </Text>
        <Text style={[styles.headline, { color: palette.ink, fontFamily: last ? fonts.semibold : fonts.medium }]}>{item.headline}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  content: { paddingHorizontal: metrics.cardInset * 2 },
  title: { fontFamily: fonts.headline, fontSize: 30, lineHeight: 34, letterSpacing: -0.45, marginTop: 4, paddingHorizontal: 4 },
  meta: { fontFamily: fonts.medium, fontSize: 13, marginTop: 6, marginBottom: 16, paddingHorizontal: 4 },
  panel: { borderRadius: metrics.cardRadius, padding: 18 },
  label: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.2 },
  timelineLabel: { marginTop: 24, marginBottom: 10, paddingHorizontal: 16 },
  // Where the real timeline panel sits, below its label.
  timelinePanel: { marginTop: 24 + 16 + 10 },
  summary: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, marginTop: 8 },
  row: { flexDirection: "row", gap: 12 },
  rail: { width: DOT, alignItems: "center" },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, marginTop: 4 },
  line: { flex: 1, width: 1.5, marginTop: 4 },
  text: { flex: 1 },
  gap: { paddingBottom: 18 },
  date: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, includeFontPadding: false },
  headline: { fontSize: 15, lineHeight: 21, marginTop: 3 },
});
