import { useEffect, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { CategoryStrip, type FeedCategory } from "../../src/components/CategoryStrip";
import { Feed } from "../../src/components/Feed";
import { takeTourDue } from "../../src/tour";
import { metrics } from "../../src/theme/tokens";
import { usePalette } from "../../src/theme/useTheme";

export default function Home() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<FeedCategory | null>(null);

  // A new reader gets the onboarding tour once, over the feed.
  useEffect(() => {
    void takeTourDue().then((due) => {
      if (due) router.push("/tour");
    });
  }, []);

  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: metrics.navGap, backgroundColor: palette.canvas }}>
      <CategoryStrip palette={palette} value={category} onChange={setCategory} />
      <Feed palette={palette} category={category} />
    </View>
  );
}
