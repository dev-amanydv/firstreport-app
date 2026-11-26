import { createRef, useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAppConfig, useFeed, useTour } from "../src/api/client";
import { Card } from "../src/components/Card";
import { Skeleton } from "../src/components/Feed";
import { GlassPill, TourOverlay } from "../src/components/TourOverlay";
import { advance, stepCopy, tourSteps } from "../src/lib/tour";
import { useAnyOverlayOpen } from "../src/overlays";
import { markTourDone, showExploreHint, TourContext, useTourEvents, type TourTargets } from "../src/tour";
import { fonts, metrics } from "../src/theme/tokens";
import { usePalette } from "../src/theme/useTheme";

// The onboarding tour: one real card from a developing Story, with each feature pointed out in turn.
// The reader uses the real controls; the History and Story-so-far sheets are the real ones.
export default function TourScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const config = useAppConfig();
  const tour = useTour();
  // With no developing Story to show (or no answer), the short tour runs on the newest card of the feed.
  const fallback = !tour.data && (tour.isFetched || tour.isError);
  const feed = useFeed(null);
  const card = tour.data ?? (fallback ? feed.data?.pages[0]?.items[0] : undefined) ?? null;

  const eventCount = card?.story?.eventCount ?? 1;
  const steps = useMemo(() => tourSteps(eventCount), [eventCount]);
  const [index, setIndex] = useState(0);
  const step = steps[index]!;
  // Hidden while a sheet, the share flow or a dialog is open over the card.
  const covered = useAnyOverlayOpen();

  const targets = useMemo<TourTargets>(() => ({ card: createRef(), history: createRef(), summary: createRef(), save: createRef() }), []);

  useTourEvents((event, cardId) => {
    if (cardId === card?.id) setIndex((i) => advance(steps, i, event));
  });
  const skipStep = useCallback(() => setIndex((i) => Math.min(i + 1, steps.length - 1)), [steps.length]);

  // Once a card is on screen the tour counts as seen, however it ends (finished, skipped, back or the app
  // closed); it can be replayed from Account. Marked here rather than on unmount, which dev mode runs early.
  const shown = card !== null;
  useEffect(() => {
    if (shown) markTourDone();
  }, [shown]);

  // Offline with no cards cached: leave it due and try again on the next launch.
  const unavailable = fallback && !card && (feed.isError || (feed.isFetched && !feed.isFetching));
  useEffect(() => {
    if (unavailable) router.back();
  }, [unavailable]);

  const finish = useCallback(() => {
    showExploreHint();
    router.back();
  }, []);

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((old) => (old?.width === width && old.height === height ? old : { width, height }));
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + metrics.navGap, backgroundColor: palette.canvas }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.ink }]} accessibilityRole="header">
          Quick tour
        </Text>
        <GlassPill palette={palette} label="Skip" accessibilityLabel="Skip the tour" onPress={() => router.back()} />
      </View>
      <View style={styles.body} onLayout={onLayout}>
        {!size ? null : !card ? (
          <Skeleton palette={palette} height={size.height} />
        ) : (
          <TourContext.Provider value={targets}>
            <View style={styles.page}>
              <Card
                card={card}
                palette={palette}
                width={size.width - metrics.cardInset * 2}
                height={size.height}
                progress={null}
                active
                showAiLabel={config.data?.showAiLabel ?? false}
              />
            </View>
            {covered ? null : (
              <TourOverlay
                palette={palette}
                step={step}
                text={stepCopy(step, eventCount)}
                progress={{ index, total: steps.length }}
                targets={targets}
                onMissing={skipStep}
                onFinish={finish}
              />
            )}
          </TourContext.Provider>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { height: metrics.stripHeight, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  title: { fontFamily: fonts.headline, fontSize: 22, letterSpacing: -0.33 },
  body: { flex: 1 },
  page: { paddingHorizontal: metrics.cardInset },
});
