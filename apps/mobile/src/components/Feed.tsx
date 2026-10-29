import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import PagerView from "react-native-pager-view";
import { useQueryClient } from "@tanstack/react-query";
import { CATEGORY_SHORT_LABELS } from "@fr/shared";
import { useAppConfig, useFeed } from "../api/client";
import { imageHeight } from "../lib/layout";
import { fonts, metrics, type Palette } from "../theme/tokens";
import { Card } from "./Card";
import type { FeedCategory } from "./CategoryStrip";

const PREFETCH_FROM_END = 5;
// Coming back after this long starts again from the newest card.
const STALE_AFTER_MS = 10 * 60_000;

type Props = { palette: Palette; category: FeedCategory | null };

export function Feed({ palette, category }: Props) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [index, setIndex] = useState(0);
  const [generation, setGeneration] = useState(0);
  const feed = useFeed(category);
  const config = useAppConfig();
  const queryClient = useQueryClient();

  useEffect(() => setIndex(0), [category]);

  // Rather than shuffle cards under the reader, a long absence resets the feed to the top.
  const backgroundedAt = useRef<number | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        backgroundedAt.current ??= Date.now();
        return;
      }
      const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
      backgroundedAt.current = null;
      if (away > STALE_AFTER_MS) {
        void queryClient.resetQueries({ queryKey: ["feed"] });
        setIndex(0);
        setGeneration((n) => n + 1);
      }
    });
    return () => subscription.remove();
  }, [queryClient]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((old) => (old?.width === width && old.height === height ? old : { width, height }));
  };

  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];
  const windowTotal = feed.data?.pages[0]?.windowTotal ?? 0;

  const onPageSelected = (position: number) => {
    setIndex(position);
    if (position >= items.length - PREFETCH_FROM_END && feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  };

  let content;
  if (!size) content = null;
  else if (feed.isPending) content = <Skeleton palette={palette} height={size.height} />;
  else if (feed.isError && !items.length)
    content = (
      <Message palette={palette} title="Couldn't load the news." action={{ label: "Try again", onPress: () => void feed.refetch() }} />
    );
  else if (!items.length)
    content = <Message palette={palette} title={category ? `Nothing new in ${CATEGORY_SHORT_LABELS[category]} yet.` : "Nothing new yet."} />;
  else
    content = (
      <PagerView
        key={`${category ?? "top"}-${generation}`}
        style={StyleSheet.absoluteFill}
        orientation="vertical"
        offscreenPageLimit={1}
        pageMargin={metrics.cardInset}
        overdrag
        onPageSelected={(event) => onPageSelected(event.nativeEvent.position)}
      >
        {items.map((card, i) => (
          <View key={card.id} style={styles.page}>
            <Card
              card={card}
              palette={palette}
              width={size.width - metrics.cardInset * 2}
              height={size.height}
              index={i}
              windowTotal={windowTotal}
              active={i === index}
              showAiLabel={config.data?.showAiLabel ?? false}
            />
          </View>
        ))}
      </PagerView>
    );

  return (
    <View style={styles.feed} onLayout={onLayout}>
      {content}
    </View>
  );
}

function Frame({ palette, children }: { palette: Palette; children: React.ReactNode }) {
  return <View style={[styles.frame, { backgroundColor: palette.card }]}>{children}</View>;
}

// Flat blocks in the exact layout of a real card, so nothing jumps when it arrives.
function Skeleton({ palette, height }: { palette: Palette; height: number }) {
  const block = { backgroundColor: palette.hairline };
  return (
    <Frame palette={palette}>
      <View style={[{ height: imageHeight(height) + 2 }, block]} />
      <View style={styles.skeletonBody} accessibilityLabel="Loading the news">
        <View style={[styles.bar, block, { width: 150, height: 11 }]} />
        <View style={[styles.bar, block, { marginTop: 13, height: 22 }]} />
        <View style={[styles.bar, block, { marginTop: 8, height: 22, width: "62%" }]} />
        <View style={[{ marginTop: 16, height: 40, borderBottomWidth: 1, borderBottomColor: palette.hairline }]} />
        {[100, 96, 100, 88, 100, 70].map((w, i) => (
          <View key={i} style={[styles.bar, block, { marginTop: i === 0 ? 16 : 12, height: 14, width: `${w}%` }]} />
        ))}
      </View>
    </Frame>
  );
}

type MessageProps = { palette: Palette; title: string; action?: { label: string; onPress: () => void } };

function Message({ palette, title, action }: MessageProps) {
  return (
    <Frame palette={palette}>
      <View style={styles.message}>
        <Text style={[styles.messageTitle, { color: palette.ink }]}>{title}</Text>
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={12} style={({ pressed }) => pressed && { opacity: 0.5 }}>
            <Text style={[styles.messageAction, { color: palette.ink, textDecorationColor: palette.muted }]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  feed: { flex: 1 },
  page: { paddingHorizontal: metrics.cardInset },
  frame: { flex: 1, marginHorizontal: metrics.cardInset, borderRadius: metrics.cardRadius, overflow: "hidden" },
  skeletonBody: { paddingTop: 14, paddingHorizontal: 16 },
  bar: { borderRadius: 2 },
  message: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 14 },
  messageTitle: { fontFamily: fonts.headline, fontSize: 26, lineHeight: 30, letterSpacing: -0.39 },
  messageAction: { fontFamily: fonts.semibold, fontSize: 15, textDecorationLine: "underline" },
});
