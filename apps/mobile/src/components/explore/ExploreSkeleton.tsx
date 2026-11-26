import { Fragment } from "react";
import { StyleSheet, View } from "react-native";
import { metrics, type Palette } from "../../theme/tokens";
import { Bone, OnCard, Shimmer } from "../Skeleton";

// The Explore sections while /v1/explore loads: topic pills, two story cards, a ranked list.
// Sizes match TopicChips, StoryRail, EventRow and the Section header in app/(tabs)/explore.tsx.
export function ExploreSkeleton({ palette }: { palette: Palette }) {
  return (
    <Shimmer palette={palette} onCanvas label="Loading Explore">
      <SectionLabel width={112} />
      <View style={styles.chips}>
        {[96, 128, 74, 112, 88].map((w, i) => (
          <Bone key={i} height={36} width={w} radius={18} />
        ))}
      </View>

      <SectionLabel width={148} />
      <View style={styles.rail}>
        {[0, 1].map((i) => (
          <View key={i} style={[styles.storyCard, { backgroundColor: palette.card }]}>
            <OnCard>
              <Bone height={130} radius={0} />
              <View style={styles.storyBody}>
                <Bone height={10} width={110} />
                <Bone height={17} style={{ marginTop: 10 }} />
                <Bone height={17} width="84%" style={{ marginTop: 6 }} />
                <Bone height={17} width="46%" style={{ marginTop: 6 }} />
                <Bone height={10} width={92} style={{ marginTop: 12 }} />
              </View>
            </OnCard>
          </View>
        ))}
      </View>

      <SectionLabel width={136} />
      <View style={[styles.panel, styles.inset, { backgroundColor: palette.card }]}>
        <OnCard>
          <Rows palette={palette} count={4} ranked />
        </OnCard>
      </View>
    </Shimmer>
  );
}

// Search results loading: rows like EventRow in one card.
export function ResultsSkeleton({ palette }: { palette: Palette }) {
  return (
    <Shimmer palette={palette} label="Searching">
      <View style={[styles.panel, styles.results, { backgroundColor: palette.card }]}>
        <Rows palette={palette} count={5} />
      </View>
    </Shimmer>
  );
}

function SectionLabel({ width }: { width: number }) {
  return (
    <View style={styles.sectionHead}>
      <Bone height={10} width={width} radius={4} />
    </View>
  );
}

function Rows({ palette, count, ranked = false }: { palette: Palette; count: number; ranked?: boolean }) {
  return Array.from({ length: count }, (_, i) => (
    <Fragment key={i}>
      {i > 0 ? <View style={[styles.divider, { backgroundColor: palette.hairline }]} /> : null}
      <View style={styles.row}>
        {ranked ? <Bone height={18} width={14} radius={4} style={styles.rank} /> : null}
        <View style={styles.text}>
          <Bone height={14} />
          <Bone height={14} width={i % 2 ? "58%" : "78%"} style={{ marginTop: 7 }} />
          <Bone height={10} width={i % 2 ? 132 : 96} style={{ marginTop: 10 }} />
        </View>
        <Bone height={72} width={72} radius={10} />
      </View>
    </Fragment>
  ));
}

const STORY_WIDTH = 260;

const styles = StyleSheet.create({
  sectionHead: { marginTop: 24 + 3, marginBottom: 10 + 3, paddingHorizontal: 20 },
  chips: { flexDirection: "row", gap: 8, paddingHorizontal: 16, overflow: "hidden" },
  rail: { flexDirection: "row", gap: 12, paddingHorizontal: 16, overflow: "hidden" },
  storyCard: { width: STORY_WIDTH, borderRadius: metrics.cardRadius - 4, overflow: "hidden" },
  storyBody: { padding: 14 },
  inset: { marginHorizontal: metrics.cardInset * 2 },
  panel: { borderRadius: metrics.cardRadius, paddingHorizontal: 16 },
  results: { marginTop: 16, marginHorizontal: metrics.cardInset * 2 },
  divider: { height: StyleSheet.hairlineWidth * 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  rank: { marginHorizontal: 5 },
  text: { flex: 1 },
});
