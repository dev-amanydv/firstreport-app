import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { COPY } from "../auth/copy";
import { GoogleMark } from "./icons";

type Props = { dark: boolean; busy: boolean; onPress: () => void };

// Google's branding colours for the neutral light and dark buttons.
const THEMES = {
  light: { fill: "#FFFFFF", border: "#747775", text: "#1F1F1F" },
  dark: { fill: "#131314", border: "#8E918F", text: "#E3E3E3" },
};
const PRESS = { damping: 18, stiffness: 420 };

// "Continue with Google", drawn to Google's sign-in button guidelines: the full-colour G on a neutral pill.
export function GoogleButton({ dark, busy, onPress }: Props) {
  const theme = THEMES[dark ? "dark" : "light"];
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      onPressIn={() => (scale.value = withSpring(0.98, PRESS))}
      onPressOut={() => (scale.value = withSpring(1, PRESS))}
      accessibilityRole="button"
      accessibilityLabel={COPY.button}
      accessibilityState={{ busy, disabled: busy }}
    >
      <Animated.View style={[styles.button, { backgroundColor: theme.fill, borderColor: theme.border }, style]}>
        <View style={styles.mark}>{busy ? <ActivityIndicator size="small" color={theme.text} /> : <GoogleMark size={20} />}</View>
        <Text style={[styles.label, { color: theme.text }]}>{COPY.button}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: 27,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 20,
  },
  mark: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  // Google asks for Roboto Medium, which is Android's system sans.
  label: Platform.select({
    android: { fontFamily: "sans-serif-medium", fontSize: 16, letterSpacing: 0.1 },
    default: { fontSize: 16, fontWeight: "500", letterSpacing: 0.1 },
  }),
});
