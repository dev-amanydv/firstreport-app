import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, type ScrollViewInstance } from "react-native";
import { CATEGORY_SHORT_LABELS } from "@fr/shared";
import { fonts, metrics, type Palette } from "../theme/tokens";

// The categories a reader can pick; null is "Top stories", every category together.
export type FeedCategory = keyof typeof CATEGORY_SHORT_LABELS;

const TABS: { id: FeedCategory | null; label: string }[] = [
  { id: null, label: "Top stories" },
  ...(Object.keys(CATEGORY_SHORT_LABELS) as FeedCategory[]).map((id) => ({ id, label: CATEGORY_SHORT_LABELS[id] })),
];

type Props = { palette: Palette; value: FeedCategory | null; onChange: (category: FeedCategory | null) => void };

export function CategoryStrip({ palette, value, onChange }: Props) {
  const scroll = useRef<ScrollViewInstance>(null);
  const offsets = useRef(new Map<FeedCategory | null, number>());

  // Keep the active tab in view, with a little of the previous one showing.
  useEffect(() => {
    const x = offsets.current.get(value);
    if (x !== undefined) scroll.current?.scrollTo({ x: Math.max(0, x - 48), animated: true });
  }, [value]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={styles.content}
      accessibilityRole="tablist"
      accessibilityLabel="Categories"
    >
      {TABS.map((tab) => {
        const selected = tab.id === value;
        return (
          <Pressable
            key={tab.label}
            onPress={() => onChange(tab.id)}
            onLayout={(event) => offsets.current.set(tab.id, event.nativeEvent.layout.x)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={styles.tab}
          >
            <Text style={[styles.label, selected ? { color: palette.ink, fontFamily: fonts.semibold } : { color: palette.navInactive }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { flexGrow: 0, height: metrics.stripHeight },
  content: { paddingLeft: 12, paddingRight: 12, gap: 4 },
  tab: { height: metrics.stripHeight, justifyContent: "center", paddingHorizontal: 8 },
  label: { fontFamily: fonts.regular, fontSize: 15, includeFontPadding: false },
});
