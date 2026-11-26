import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import type { Explore } from "@fr/shared";
import { fonts, type Palette } from "../../theme/tokens";

type Props = { palette: Palette; topics: Explore["topics"]; onPick: (name: string) => void };

// The people, places and organisations in the most cards today. Tapping one searches for it.
export function TopicChips({ palette, topics, onPick }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {topics.map((topic) => (
        <Pressable
          key={topic.name}
          onPress={() => onPick(topic.name)}
          accessibilityRole="button"
          accessibilityLabel={`${topic.name}, in ${topic.count} stories today`}
          style={({ pressed }) => [styles.chip, { backgroundColor: palette.card, borderColor: palette.hairline }, pressed && { opacity: 0.5 }]}
        >
          <Text style={[styles.name, { color: palette.ink }]} numberOfLines={1}>
            {topic.name}
          </Text>
          <Text style={[styles.count, { color: palette.muted }]}>{topic.count}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 16 },
  chip: { height: 36, borderRadius: 18, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, maxWidth: 240 },
  name: { fontFamily: fonts.medium, fontSize: 14, flexShrink: 1 },
  count: { fontFamily: fonts.medium, fontSize: 12 },
});
