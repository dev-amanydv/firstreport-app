import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import PagerView from "react-native-pager-view";
import { Image } from "expo-image";
import { useIsFocused } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { CATEGORY_SHORT_LABELS } from "@fr/shared";
import { useAppConfig, useFeed } from "../api/client";
import { useSession } from "../auth/session";
import { markCardSeen } from "../authPrompt";
import { imageHeight, isRendered, progress, RENDER_AHEAD } from "../lib/layout";
import { useAnyOverlayOpen } from "../overlays";
import { fonts, metrics, type Palette } from "../theme/tokens";
import { Card } from "./Card";
import { Bone, Shimmer } from "./Skeleton";
import type { FeedCategory } from "./CategoryStrip";
import { SignInPopup } from "./SignInPopup";

const PREFETCH_FROM_END = 5;
// Coming back after this long starts again from the newest card.
const STALE_AFTER_MS = 10 * 60_000;
// The sign-in box waits until the reader has rested on a card this long, so it never cuts into a swipe.
const PROMPT_SETTLE_MS = 450;

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

  const items = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);
  const windowTotal = feed.data?.pages[0]?.windowTotal ?? 0;
  const currentId = items[index]?.id;

  // Signed-out readers are invited to sign in after their 3rd, 5th and 7th card, then every 7th.
  const session = useSession();
  const signedOut = session.status === "signedOut";
  const focused = useIsFocused();
  const overlayOpen = useAnyOverlayOpen();
  const [promptDue, setPromptDue] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    if (!signedOut || !currentId) return;
    let live = true;
    void markCardSeen(currentId).then((due) => {
      if (due && live) setPromptDue(true);
    });
    return () => {
      live = false;
    };
  }, [signedOut, currentId]);

  // Opens once the reader pauses: not mid-swipe, not over another sheet, not while another screen is on top.
  useEffect(() => {
    if (!promptDue || !signedOut || !focused || overlayOpen) return;
    const timer = setTimeout(() => {
      setPromptDue(false);
      setPromptOpen(true);
    }, PROMPT_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [promptDue, signedOut, focused, overlayOpen, currentId]);

  const heroCards = useMemo(
    () => items.slice(Math.max(0, index - 2), index + 1).map(({ id, imageUrl, category }) => ({ id, imageUrl, category })),
    [items, index],
  );

  // The next cards' photos are downloaded before they are swiped in.
  useEffect(() => {
    const upcoming = items.slice(index + 1, index + 1 + RENDER_AHEAD).flatMap((card) => (card.imageUrl ? [card.imageUrl] : []));
    if (upcoming.length) void Image.prefetch(upcoming, "memory-disk");
  }, [index, items]);

  // Nothing here may hold up the pager while it settles: the re-render is a transition,
  // and the next page is requested after the frame.
  const onPageSelected = (position: number) => {
    startTransition(() => setIndex(position));
    if (position >= items.length - PREFETCH_FROM_END && feed.hasNextPage && !feed.isFetchingNextPage) {
      requestAnimationFrame(() => void feed.fetchNextPage());
    }
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
        onPageSelected={(event) => onPageSelected(event.nativeEvent.position)}
      >
        {/* Every item keeps its page; only the ones next to the current card are mounted. */}
        {items.map((card, i) => (
          <View key={card.id} style={styles.page}>
            {isRendered(i, index) ? (
              <Card
                card={card}
                palette={palette}
                width={size.width - metrics.cardInset * 2}
                height={size.height}
                progress={{ value: progress(i, windowTotal), label: `Story ${i + 1} of ${Math.max(windowTotal, i + 1)}` }}
                active={i === index}
                showAiLabel={config.data?.showAiLabel ?? false}
              />
            ) : null}
          </View>
        ))}
      </PagerView>
    );

  return (
    <View style={styles.feed} onLayout={onLayout}>
      {content}
      <SignInPopup palette={palette} visible={promptOpen} cards={heroCards} onClose={() => setPromptOpen(false)} />
    </View>
  );
}

function Frame({ palette, children }: { palette: Palette; children: React.ReactNode }) {
  return <View style={[styles.frame, { backgroundColor: palette.card }]}>{children}</View>;
}

// Shimmering blocks in the exact layout of a real card (image, progress line, headline, age and outlet
// logos, then the text), so nothing jumps when it arrives.
export function Skeleton({ palette, height }: { palette: Palette; height: number }) {
  return (
    <Frame palette={palette}>
      <Shimmer palette={palette} label="Loading the news">
        <Bone height={imageHeight(height)} radius={0} />
        <View style={[styles.track, { backgroundColor: palette.hairline }]} />
        <View style={styles.skeletonBody}>
          <Bone height={22} style={{ marginTop: 4 }} />
          <Bone height={22} width="68%" style={{ marginTop: 8 }} />
          <View style={styles.skeletonByline}>
            <Bone height={12} width={64} />
            <View style={styles.skeletonLogos}>
              {[0, 1, 2].map((i) => (
                <Bone key={i} height={19} width={19} radius={10} style={{ marginLeft: i ? -5 : 0, borderWidth: 1.5, borderColor: palette.card }} />
              ))}
            </View>
          </View>
          {[100, 96, 100, 88, 100, 62].map((w, i) => (
            <Bone key={i} height={15} width={`${w}%`} style={{ marginTop: i === 0 ? 22 : 11 }} />
          ))}
        </View>
      </Shimmer>
    </Frame>
  );
}

type MessageProps = { palette: Palette; title: string; action?: { label: string; onPress: () => void } };

export function Message({ palette, title, action }: MessageProps) {
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
  skeletonByline: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skeletonLogos: { flexDirection: "row" },
  track: { height: 2 },
  message: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 14 },
  messageTitle: { fontFamily: fonts.headline, fontSize: 26, lineHeight: 30, letterSpacing: -0.39 },
  messageAction: { fontFamily: fonts.semibold, fontSize: 15, textDecorationLine: "underline" },
});
