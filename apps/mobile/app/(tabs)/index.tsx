import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryStrip, type FeedCategory } from "../../src/components/CategoryStrip";
import { Feed } from "../../src/components/Feed";
import { metrics } from "../../src/theme/tokens";
import { usePalette } from "../../src/theme/useTheme";

export default function Home() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<FeedCategory | null>(null);

  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: metrics.navGap, backgroundColor: palette.canvas }}>
      <CategoryStrip palette={palette} value={category} onChange={setCategory} />
      <Feed palette={palette} category={category} />
    </View>
  );
}
