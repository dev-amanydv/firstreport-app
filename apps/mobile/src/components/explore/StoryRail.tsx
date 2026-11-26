import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Explore } from "@fr/shared";
import { storyTitle } from "../../lib/explore";
import { relativeTime } from "../../lib/time";
import { fonts, metrics, type Palette } from "../../theme/tokens";
import { Thumb } from "./Thumb";

type Story = Explore["developing"][number];
type Props = { palette: Palette; stories: Story[]; onOpen: (story: Story) => void };

const CARD_WIDTH = 260;

// Storylines still moving: the newest update's image and headline, and how many updates so far.
export function StoryRail({ palette, stories, onOpen }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD_WIDTH + 12}
      decelerationRate="fast"
      contentContainerStyle={styles.row}
    >
      {stories.map((story) => {
        const title = storyTitle(story.label);
        const meta = `${story.eventCount} updates · ${relativeTime(story.lastEventAt)}`;
        return (
          <Pressable
            key={story.storyId}
            onPress={() => onOpen(story)}
            accessibilityRole="button"
            accessibilityLabel={`${title}. ${meta}. Latest: ${story.latestEvent.headline}`}
            style={({ pressed }) => [styles.card, { backgroundColor: palette.card }, pressed && { opacity: 0.7 }]}
          >
            <Thumb palette={palette} uri={story.latestEvent.imageUrl} category="other" width={CARD_WIDTH} height={130} radius={0} />
            <View style={styles.body}>
              <Text style={[styles.title, { color: palette.neutral }]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[styles.headline, { color: palette.ink }]} numberOfLines={3}>
                {story.latestEvent.headline}
              </Text>
              <Text style={[styles.meta, { color: palette.muted }]}>{meta}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 12, paddingHorizontal: 16 },
  card: { width: CARD_WIDTH, borderRadius: metrics.cardRadius - 4, overflow: "hidden" },
  body: { padding: 14, gap: 6, flex: 1 },
  title: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.3 },
  headline: { fontFamily: fonts.headline, fontSize: 19, lineHeight: 23, letterSpacing: -0.2, minHeight: 69 },
  meta: { fontFamily: fonts.medium, fontSize: 12 },
});
