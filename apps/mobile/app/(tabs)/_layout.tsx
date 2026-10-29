import { Tabs } from "expo-router";
import { BottomNav } from "../../src/components/BottomNav";
import { usePalette } from "../../src/theme/useTheme";

// Home is the first screen, though it sits in the middle of the bar.
export const unstable_settings = { initialRouteName: "index" };

export default function TabsLayout() {
  const palette = usePalette();
  return (
    <Tabs
      tabBar={(props) => <BottomNav {...props} palette={palette} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: palette.canvas } }}
    >
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="account" options={{ title: "Account" }} />
    </Tabs>
  );
}
