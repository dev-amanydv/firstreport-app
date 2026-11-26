import { Pressable, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { CardPayload } from "@fr/shared";
import { toggleSaved, useIsSaved } from "../saved";
import type { Palette } from "../theme/tokens";
import { BookmarkIcon } from "./icons";

const ICON = 20;
// A 44 pt target around the 20 pt icon, without making the byline row taller.
const SLOP = (44 - ICON) / 2;

// The card's bookmark, at the end of the byline: always visible, no need to open the action bar first.
export function SaveButton({ palette, card }: { palette: Palette; card: CardPayload }) {
  const saved = useIsSaved(card.id);
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPress = () => {
    const nowSaved = toggleSaved(card);
    if (nowSaved) {
      scale.value = withSequence(withTiming(1.25, { duration: 90 }), withSpring(1, { damping: 9, stiffness: 260 }));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      void Haptics.selectionAsync();
    }
  };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={SLOP}
      accessibilityRole="button"
      accessibilityLabel={saved ? "Remove from saved stories" : "Save story"}
      accessibilityState={{ selected: saved }}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
    >
      <Animated.View style={style}>
        <BookmarkIcon color={palette.ink} size={ICON} filled={saved} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: ICON, height: ICON, alignItems: "center", justifyContent: "center" },
});
