import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "../theme/tokens";
import { usePalette } from "../theme/useTheme";

// A titled, empty screen for routes that come in later steps.
export function Placeholder({ title }: { title: string }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, backgroundColor: palette.canvas }]}>
      <Text style={[styles.title, { color: palette.ink }]} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20 },
  title: { fontFamily: fonts.headline, fontSize: 26, lineHeight: 30, letterSpacing: -0.39 },
});
