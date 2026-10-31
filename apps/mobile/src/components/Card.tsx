import { memo, useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GestureDetector, useTapGesture } from "react-native-gesture-handler";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import type { CardPayload } from "@fr/shared";
import { markHintShown, shouldHint } from "../hints";
import { imageHeight } from "../lib/layout";
import { relativeTime } from "../lib/time";
import { fonts, metrics, TAP_SLOP, type Palette } from "../theme/tokens";
import { ActionBar } from "./ActionBar";
import { CardImage } from "./CardImage";
import { HistorySheet } from "./HistorySheet";
import { Perspective, type Pane } from "./Perspective";
import { ShareCard } from "./ShareCard";
import { SourceLogos } from "./SourceLogos";
import { SummarySheet } from "./SummarySheet";

type Props = {
  card: CardPayload;
  palette: Palette;
  width: number;
  height: number;
  // 0–1 position in the feed and its spoken form ("Story 4 of 12"); null outside the feed.
  progress: { value: number; label: string } | null;
  active: boolean;
  showAiLabel: boolean;
};

const CONTENT_PADDING = 16;

// Memoised: on a page swipe only the two cards whose `active` flips re-render.
export const Card = memo(function Card({ card, palette, width, height, progress, active, showAiLabel }: Props) {
  const [actionsVisible, setActionsVisible] = useState(false);
  const [pane, setPane] = useState<Pane>("neutral");
  const [hint, setHint] = useState(false);
  const [sheet, setSheet] = useState<"history" | "summary" | null>(null);
  // The pane being shared while its picture is captured; null when not sharing.
  const [sharing, setSharing] = useState<Pane | null>(null);

  // The action bar and its sheets belong to the card being read; they close as soon as you move on.
  useEffect(() => {
    if (active) return;
    setActionsVisible(false);
    setSheet(null);
  }, [active]);

  useEffect(() => {
    if (active && card.contested && !hint && shouldHint()) {
      markHintShown();
      setHint(true);
    }
  }, [active, card.contested, hint]);

  const toggleActions = () => setActionsVisible((visible) => !visible);
  const tap = useTapGesture({ maxDistance: TAP_SLOP.maxDistance, maxDuration: TAP_SLOP.maxDuration, runOnJS: true, onActivate: toggleActions });

  const texts = { neutral: card.neutral, left: card.left ?? card.neutral, right: card.right ?? card.neutral };
  const source = card.sources[0];
  const closeSheet = () => setSheet(null);
  const doneSharing = useCallback(() => setSharing(null), []);

  return (
    <View style={[styles.card, { height, backgroundColor: palette.card }]}>
      <GestureDetector gesture={tap}>
        <View collapsable={false}>
          <CardImage
            palette={palette}
            uri={card.imageUrl}
            credit={card.imageCredit}
            category={card.category}
            height={imageHeight(height)}
            recyclingKey={card.id}
            active={active}
          />
          <View
            style={[styles.track, { backgroundColor: palette.hairline }]}
            accessibilityRole={progress ? "progressbar" : undefined}
            accessibilityLabel={progress?.label}
          >
            {progress ? <View style={[styles.fill, { width: `${progress.value * 100}%`, backgroundColor: palette.ink }]} /> : null}
          </View>
          <View style={styles.header}>
            <Text
              style={[styles.headline, { color: palette.ink }]}
              numberOfLines={3}
              accessibilityRole="header"
              textBreakStrategy="highQuality"
              lineBreakStrategyIOS="standard"
            >
              {card.headline}
            </Text>
            <View style={styles.byline}>
              <Text style={[styles.date, { color: palette.muted }]}>{relativeTime(card.firstSeenAt)}</Text>
              <SourceLogos palette={palette} sources={card.sources} />
            </View>
          </View>
        </View>
      </GestureDetector>

      <View style={styles.body}>
        <Perspective
          palette={palette}
          width={width - CONTENT_PADDING * 2}
          contested={card.contested}
          texts={texts}
          showAiLabel={showAiLabel}
          hint={hint}
          onPaneChange={setPane}
          onTap={toggleActions}
        />
      </View>

      <ActionBar
        palette={palette}
        visible={actionsVisible}
        eventCount={card.story?.eventCount ?? 1}
        onHistory={() => setSheet("history")}
        onSummary={() => setSheet("summary")}
        onSource={source ? () => void WebBrowser.openBrowserAsync(source.url) : null}
        onShare={() => setSharing((current) => current ?? pane)}
      />

      {sharing ? <ShareCard card={card} pane={sharing} text={texts[sharing]} onDone={doneSharing} /> : null}

      {card.story && card.story.eventCount > 1 ? (
        <>
          <HistorySheet
            palette={palette}
            visible={sheet === "history"}
            storyId={card.story.id}
            currentId={card.id}
            onClose={closeSheet}
            onOpen={(id) => {
              closeSheet();
              router.push({ pathname: "/event/[id]", params: { id } });
            }}
          />
          <SummarySheet
            palette={palette}
            visible={sheet === "summary"}
            storyId={card.story.id}
            eventId={card.id}
            eventAt={card.firstSeenAt}
            onClose={closeSheet}
          />
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: metrics.cardRadius, overflow: "hidden" },
  track: { height: 2 },
  fill: { height: 2 },
  header: { paddingTop: 14, paddingHorizontal: CONTENT_PADDING },
  headline: {
    fontFamily: fonts.headline,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.39,
    includeFontPadding: false,
  },
  byline: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  date: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, includeFontPadding: false },
  body: { flex: 1, paddingHorizontal: CONTENT_PADDING },
});
