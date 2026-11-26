import { Fragment, useEffect, type ReactNode, type RefObject } from "react";
import { Pressable, StyleSheet, Text, View, type HostInstance } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTourTarget } from "../tour";
import { fonts, metrics, type Palette } from "../theme/tokens";
import { ClockIcon, ExternalIcon, ShareIcon, SummaryIcon } from "./icons";

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
const PILL_HEIGHT = 52;
const ACTION_WIDTH = 60;
const ICON_SIZE = 24;

type ActionSpec = { key: string; label: string; icon: ReactNode; badge?: number; target?: RefObject<HostInstance | null>; onPress: () => void };

export function ActionBar({ palette, visible, eventCount, onHistory, onSummary, onSource, onShare }: Props) {
  const shown = useSharedValue(0);
  const historyTarget = useTourTarget("history");
  const summaryTarget = useTourTarget("summary");
  useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, REVEAL);
  }, [visible, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * metrics.actionBarHeight }],
  }));

  // Icons only, so each one carries its meaning in its spoken label.
  const actions: ActionSpec[] = [];
  if (eventCount > 1) {
    actions.push({
      key: "history",
      label: `History, ${eventCount} updates`,
      icon: <ClockIcon color={palette.ink} size={ICON_SIZE} />,
      badge: eventCount,
      target: historyTarget,
      onPress: onHistory,
    });
    actions.push({ key: "summary", label: "Story so far", icon: <SummaryIcon color={palette.ink} size={ICON_SIZE} />, target: summaryTarget, onPress: onSummary });
  }
  if (onSource) {
    actions.push({ key: "source", label: "Open source article", icon: <ExternalIcon color={palette.ink} size={ICON_SIZE} />, onPress: onSource });
  }
  actions.push({ key: "share", label: "Share", icon: <ShareIcon color={palette.ink} size={ICON_SIZE} />, onPress: onShare });

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      accessibilityRole="toolbar"
      accessibilityLabel="Story actions"
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      style={[styles.bar, { backgroundColor: palette.card }, style]}
    >
      <View style={[styles.pill, { backgroundColor: palette.actionPill }]}>
        {actions.map((action, i) => (
          <Fragment key={action.key}>
            {i > 0 ? <View style={[styles.pipe, { backgroundColor: palette.actionDivider }]} /> : null}
            <Action palette={palette} {...action} />
          </Fragment>
        ))}
      </View>
    </Animated.View>
  );
}

function Action({ palette, label, icon, badge, target, onPress }: ActionSpec & { palette: Palette }) {
  return (
    <Pressable
      ref={target}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.5 }]}
    >
      <View>
        {icon}
        {badge ? (
          <View style={[styles.badge, { backgroundColor: palette.neutral, borderColor: palette.actionPill }]}>
            <Text style={[styles.badgeText, { color: palette.onNeutral }]}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        ) : null}
      </View>
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
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  action: { width: ACTION_WIDTH, height: PILL_HEIGHT, alignItems: "center", justifyContent: "center" },
  pipe: { width: StyleSheet.hairlineWidth * 2, height: 22, borderRadius: 1 },
  badge: {
    position: "absolute",
    top: -9,
    right: -12,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 13, includeFontPadding: false },
});
