import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Tabs } from "expo-router";
import { metrics, type Palette } from "../theme/tokens";
import { CompassIcon, HomeIcon, PersonIcon } from "./icons";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

// Icon-only, as on the artboard; each tab still has a spoken label.
export function BottomNav({ state, emitter, navigateToTab, descriptors, palette }: TabBarProps & { palette: Palette }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.nav, { paddingBottom: insets.bottom, height: metrics.navHeight + insets.bottom, backgroundColor: palette.canvas }]}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const colour = focused ? palette.ink : palette.navInactive;
        const onPress = () => {
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
              <CompassIcon color={colour} />
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
});
