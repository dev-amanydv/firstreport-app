import { useEffect, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { GestureDetector, GestureHandlerRootView, usePanGesture } from "react-native-gesture-handler";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { useOverlay } from "../overlays";
import { fonts, metrics, type Palette } from "../theme/tokens";

type Props = { palette: Palette; visible: boolean; title: string; onClose: () => void; children: ReactNode };

const OPEN = { duration: 240, easing: Easing.out(Easing.cubic) };
const CLOSE = { duration: 200, easing: Easing.in(Easing.quad) };
// Dragging the header down this far, or flicking it, closes the sheet.
const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 800;
const MAX_HEIGHT_SHARE = 0.75;

// A bottom sheet over everything: slides up, closes on the scrim, the back button or a drag down.
// It stays mounted until the closing slide ends, so the content does not vanish mid-animation.
export function Sheet({ palette, visible, title, onClose, children }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const shown = useSharedValue(0);
  const drag = useSharedValue(0);
  useOverlay(mounted);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.value = 0;
      shown.value = withTiming(1, OPEN);
    } else {
      shown.value = withTiming(0, CLOSE, (finished) => {
        if (finished) scheduleOnRN(setMounted, false);
      });
    }
  }, [visible, shown, drag]);

  // Only the header drags, so the content below can scroll.
  const pan = usePanGesture({
    activeOffsetY: [-8, 8],
    onUpdate: (event) => {
      drag.value = Math.max(0, event.translationY);
    },
    onDeactivate: (event) => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) scheduleOnRN(onClose);
      else drag.value = withTiming(0, OPEN);
    },
  });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - shown.value) * height + drag.value }] }));

  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.panel,
            { maxHeight: height * MAX_HEIGHT_SHARE, paddingBottom: insets.bottom + 16, backgroundColor: palette.card },
            panelStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={styles.header} collapsable={false}>
              <View style={[styles.handle, { backgroundColor: palette.muted }]} />
              <Text style={[styles.title, { color: palette.ink }]} accessibilityRole="header">
                {title}
              </Text>
            </View>
          </GestureDetector>
          <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// Loading, empty and error states inside a sheet.
export function SheetMessage({ palette, text, action }: { palette: Palette; text: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.message}>
      <Text style={[styles.messageText, { color: palette.muted }]}>{text}</Text>
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <Text style={[styles.messageAction, { color: palette.ink }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: metrics.sheetRadius,
    borderTopRightRadius: metrics.sheetRadius,
  },
  header: { paddingTop: 8, paddingBottom: 12, paddingHorizontal: 20 },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, opacity: 0.35, marginBottom: 14 },
  title: { fontFamily: fonts.headline, fontSize: 22, lineHeight: 26, letterSpacing: -0.33, includeFontPadding: false },
  content: { paddingHorizontal: 20 },
  message: { paddingVertical: 24, gap: 12 },
  messageText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  messageAction: { fontFamily: fonts.semibold, fontSize: 15, textDecorationLine: "underline" },
});
