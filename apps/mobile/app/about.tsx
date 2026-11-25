import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { BackIcon } from "../src/components/icons";
import { fonts } from "../src/theme/tokens";
import { usePalette } from "../src/theme/useTheme";

// Static. Says nothing about left/right perspectives while they are paused.
const PARAGRAPHS = [
  {
    title: "One card, one event",
    text: "Each card is a single news event. FirstReport reads English-language Indian outlets every 15 minutes and groups their reports of the same event together.",
  },
  {
    title: "Written from the reports",
    text: "AI writes each card in 60 words or fewer, using only the facts in those reports. Numbers are copied exactly as the outlets give them, and nothing is added.",
  },
  {
    title: "Always a link back",
    text: "Every card names its outlets and links to the original articles, so you can read the full story at the source.",
  },
];

export default function About() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
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
          How FirstReport works
        </Text>
        {PARAGRAPHS.map((p) => (
          <View key={p.title} style={styles.block}>
            <Text style={[styles.heading, { color: palette.ink }]}>{p.title}</Text>
            <Text style={[styles.text, { color: palette.muted }]}>{p.text}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  content: { paddingHorizontal: 24 },
  title: { fontFamily: fonts.headline, fontSize: 30, lineHeight: 34, letterSpacing: -0.45, marginTop: 4, marginBottom: 8 },
  block: { marginTop: 20 },
  heading: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  text: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, marginTop: 4 },
});
