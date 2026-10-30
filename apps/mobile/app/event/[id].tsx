import { useState } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useAppConfig, useEvent } from "../../src/api/client";
import { Card } from "../../src/components/Card";
import { Message, Skeleton } from "../../src/components/Feed";
import { CloseIcon } from "../../src/components/icons";
import { metrics } from "../../src/theme/tokens";
import { usePalette } from "../../src/theme/useTheme";

// One Event opened from History, as a card over the feed.
export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const event = useEvent(id);
  const config = useAppConfig();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((old) => (old?.width === width && old.height === height ? old : { width, height }));
  };

  let content;
  if (!size) content = null;
  else if (event.isPending) content = <Skeleton palette={palette} height={size.height} />;
  else if (event.isError)
    content = <Message palette={palette} title="Couldn't load this story." action={{ label: "Try again", onPress: () => void event.refetch() }} />;
  else if (!event.data) content = <Message palette={palette} title="This story is no longer available." />;
  else
    content = (
      <View style={styles.page}>
        <Card
          card={event.data}
          palette={palette}
          width={size.width - metrics.cardInset * 2}
          height={size.height}
          progress={null}
          active
          showAiLabel={config.data?.showAiLabel ?? false}
        />
      </View>
    );

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + metrics.navGap, backgroundColor: palette.canvas }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          style={({ pressed }) => pressed && { opacity: 0.5 }}
        >
          <CloseIcon color={palette.ink} />
        </Pressable>
      </View>
      <View style={styles.body} onLayout={onLayout}>
        {content}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { height: metrics.stripHeight, justifyContent: "center", paddingHorizontal: 16 },
  body: { flex: 1 },
  page: { paddingHorizontal: metrics.cardInset },
});
