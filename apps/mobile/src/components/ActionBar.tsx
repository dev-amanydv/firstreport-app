import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { fonts, metrics, type Palette } from "../theme/tokens";
import { ClockIcon, CompressIcon, ExternalIcon, ShareIcon } from "./icons";

type Props = {
  palette: Palette;
  visible: boolean;
  // History and Story so far appear only when the Story has more than one Event.
  eventCount: number;
  onHistory: () => void;
  onSummary: () => void;
  onSource: (() => void) | null;
  onShare: () => void;
};

const REVEAL = { duration: 180, easing: Easing.out(Easing.quad) };

export function ActionBar({ palette, visible, eventCount, onHistory, onSummary, onSource, onShare }: Props) {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, REVEAL);
  }, [visible, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * metrics.actionBarHeight }],
  }));

  const hasStory = eventCount > 1;
  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      accessibilityRole="toolbar"
      accessibilityLabel="Story actions"
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      style={[styles.bar, { backgroundColor: palette.card, borderTopColor: palette.hairline }, style]}
    >
      {hasStory ? (
        <Action label="History" onPress={onHistory} palette={palette} icon={<ClockIcon color={palette.ink} />}>
          History <Text style={{ color: palette.muted }}>· {eventCount}</Text>
        </Action>
      ) : null}
      {hasStory ? (
        <Action label="Story so far" onPress={onSummary} palette={palette} icon={<CompressIcon color={palette.ink} />}>
          Story so far
        </Action>
      ) : null}
      {onSource ? (
        <Action label="Open source article" onPress={onSource} palette={palette} icon={<ExternalIcon color={palette.ink} />}>
          Source
        </Action>
      ) : null}
      <Action label="Share" onPress={onShare} palette={palette} icon={<ShareIcon color={palette.ink} />}>
        Share
      </Action>
    </Animated.View>
  );
}

type ActionProps = { label: string; icon: ReactNode; palette: Palette; onPress: () => void; children: ReactNode };

function Action({ label, icon, palette, onPress, children }: ActionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.5 }]}
    >
      <View>{icon}</View>
      <Text style={[styles.label, { color: palette.ink }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: metrics.actionBarHeight,
    borderTopWidth: 1,
    flexDirection: "row",
  },
  action: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  label: { fontFamily: fonts.medium, fontSize: 12, includeFontPadding: false },
});
