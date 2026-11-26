import { useEffect, type ComponentProps } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Tabs } from "expo-router";
import { EXPLORE_HINT } from "../lib/tour";
import { hideExploreHint, useExploreHint } from "../tour";
import { metrics, type Palette } from "../theme/tokens";
import { TourBubble } from "./TourOverlay";
import { CompassIcon, HomeIcon, PersonIcon } from "./icons";

// The Explore pointer after the onboarding tour stays this long, or until a tab is pressed.
const EXPLORE_HINT_MS = 6000;
const HINT_WIDTH = 220;
const HINT_INSET = 12;

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

// Icon-only, as on the artboard; each tab still has a spoken label.
export function BottomNav({ state, emitter, navigateToTab, descriptors, palette }: TabBarProps & { palette: Palette }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const exploreHint = useExploreHint();
  useEffect(() => {
    if (!exploreHint) return;
    const timer = setTimeout(hideExploreHint, EXPLORE_HINT_MS);
    return () => clearTimeout(timer);
  }, [exploreHint]);

  return (
    <View style={[styles.nav, { paddingBottom: insets.bottom, height: metrics.navHeight + insets.bottom, backgroundColor: palette.canvas }]}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const colour = focused ? palette.ink : palette.navInactive;
        const onPress = () => {
          hideExploreHint();
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={descriptors[route.key]?.options.title ?? route.name}
            style={styles.item}
          >
            {route.name === "index" ? (
              <HomeIcon color={colour} filled={focused} cutout={palette.canvas} />
            ) : route.name === "explore" ? (
              <>
                <CompassIcon color={colour} />
                {exploreHint ? (
                  // Drawn above the bar; it only points, so touches pass through it.
                  <View pointerEvents="none" style={[styles.hint, { width: Math.min(HINT_WIDTH, width - HINT_INSET * 2) }]}>
                    <TourBubble palette={palette} text={EXPLORE_HINT} />
                  </View>
                ) : null}
              </>
            ) : (
              <PersonIcon color={colour} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: "row" },
  item: { flex: 1, alignItems: "center", justifyContent: "center" },
  hint: { position: "absolute", bottom: metrics.navHeight - 2, left: HINT_INSET },
});
