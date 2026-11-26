import { Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { CardPayload } from "@fr/shared";
import { toggleSaved, useIsSaved } from "../saved";
import { showToast } from "../toast";
import { tourEmit, useTourTarget } from "../tour";
import type { Palette } from "../theme/tokens";
import { BookmarkIcon } from "./icons";

const ICON = 26;
// A 44 pt target around the icon, without making the byline row taller.
const SLOP = (44 - ICON) / 2;

// The card's bookmark, at the right end of the byline: always visible, no need to open the action bar first.
export function SaveButton({ palette, card }: { palette: Palette; card: CardPayload }) {
  const saved = useIsSaved(card.id);
  const scale = useSharedValue(1);
  const target = useTourTarget("save");
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPress = () => {
    const nowSaved = toggleSaved(card);
    tourEmit("saveToggled", card.id);
    if (nowSaved) {
      scale.value = withSequence(withTiming(1.25, { duration: 90 }), withSpring(1, { damping: 9, stiffness: 260 }));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast({ message: "Saved to your stories", icon: "saved", action: { label: "View", onPress: () => router.push("/saved") } });
    } else {
      void Haptics.selectionAsync();
      showToast({ message: "Removed from saved", icon: "removed", action: { label: "Undo", onPress: () => void toggleSaved(card) } });
    }
  };

  return (
    <Pressable
      ref={target}
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
