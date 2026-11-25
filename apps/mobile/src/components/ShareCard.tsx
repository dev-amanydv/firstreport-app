import { useEffect, useRef, useState } from "react";
import { Image as RNImage, Share, StyleSheet, Text, View, type HostInstance } from "react-native";
import { Image } from "expo-image";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { CATEGORY_SHORT_LABELS, type CardPayload } from "@fr/shared";
import { SHARE_CARD, shareText } from "../lib/share";
import { logoStackLabel } from "../lib/sources";
import { storyDate } from "../lib/time";
import { fonts, light } from "../theme/tokens";
import type { Pane } from "./Perspective";

type Props = {
  card: CardPayload;
  pane: Pane;
  text: string;
  onDone: () => void;
};

const LABELS: Record<Pane, string> = { left: "Left-leaning view", neutral: "Neutral", right: "Right-leaning view" };
const LOGO = require("../../assets/images/splash-logo.png");
const LOGO_RATIO = 1529 / 350;
// Never hold the share sheet hostage to a slow image: capture whatever has loaded by then.
const IMAGE_WAIT_MS = 3000;

// The card as a picture, Inshorts-style: rendered off-screen at a fixed width, captured, then
// handed to the system share sheet. Always light, so it reads the same in any chat app.
// Falls back to sharing plain text if the capture fails.
export function ShareCard({ card, pane, text, onDone }: Props) {
  const ref = useRef<HostInstance>(null);
  const [imageFailed, setImageFailed] = useState(false);
  // The hero image and the logo; capture once both have settled (loaded or failed).
  const [pending, setPending] = useState(card.imageUrl ? 2 : 1);
  const settle = () => setPending((count) => count - 1);
  const palette = light;

  useEffect(() => {
    const timer = setTimeout(() => setPending(0), IMAGE_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  const started = useRef(false);
  useEffect(() => {
    if (pending > 0 || started.current) return;
    started.current = true;
    void (async () => {
      try {
        const uri = await captureRef(ref, { format: "png", result: "tmpfile" });
        await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: card.headline });
      } catch {
        await Share.share({ message: shareText(card.headline, text) }).catch(() => undefined);
      } finally {
        onDone();
      }
    })();
  }, [pending, card.headline, text, onDone]);

  const showImage = card.imageUrl !== null && !imageFailed;
  const showBadge = card.contested === true;
  const accent = palette[pane];

  return (
    <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: palette.card }]}>
        <View style={[styles.image, { backgroundColor: palette.imageFallback }]}>
          {showImage ? (
            <>
              <Image
                source={{ uri: card.imageUrl! }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
                onLoad={settle}
                onError={() => {
                  setImageFailed(true);
                  settle();
                }}
              />
              {card.imageCredit ? (
                <View style={[styles.credit, { backgroundColor: palette.creditChip }]}>
                  <Text style={[styles.creditText, { color: palette.creditText }]}>Photo: {card.imageCredit}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={[styles.placeholder, { color: palette.placeholderInk }]}>
              {card.category === "other" ? "FirstReport" : CATEGORY_SHORT_LABELS[card.category]}
            </Text>
          )}
        </View>

        <View style={styles.content}>
          {showBadge ? (
            <View style={styles.badge}>
              <View style={[styles.dot, { backgroundColor: accent }]} />
              <Text style={[styles.badgeText, { color: accent }]}>{LABELS[pane]}</Text>
            </View>
          ) : null}
          <Text style={[styles.headline, { color: palette.ink }]} textBreakStrategy="highQuality">
            {card.headline}
          </Text>
          <Text style={[styles.meta, { color: palette.muted }]}>
            {storyDate(card.firstSeenAt)}
            {card.sources.length ? ` · ${logoStackLabel(card.sources)}` : ""}
          </Text>
          <Text style={[styles.body, { color: palette.ink }]} textBreakStrategy="highQuality">
            {text}
          </Text>
        </View>

        <View style={[styles.footer, { borderTopColor: palette.hairline }]}>
          <RNImage source={LOGO} style={styles.logo} resizeMode="contain" onLoadEnd={settle} />
          <Text style={[styles.link, { color: palette.muted }]}>{SHARE_CARD.linkLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const W = SHARE_CARD.width;
const PAD = 22;

const styles = StyleSheet.create({
  // Laid out and drawn, but outside the screen.
  offscreen: { position: "absolute", left: -10_000, top: 0, width: W },
  card: { width: W },
  image: { width: W, height: Math.round((W * 9) / 16), overflow: "hidden", justifyContent: "flex-end" },
  credit: { position: "absolute", left: 12, bottom: 12, borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6 },
  creditText: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 14, includeFontPadding: false },
  placeholder: { fontFamily: fonts.headline, fontSize: 48, lineHeight: 52, letterSpacing: -1, paddingHorizontal: PAD, paddingBottom: 10 },
  content: { paddingHorizontal: PAD, paddingTop: 18, paddingBottom: 22 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: "uppercase", includeFontPadding: false },
  headline: { fontFamily: fonts.headline, fontSize: 24, lineHeight: 29, letterSpacing: -0.3, includeFontPadding: false },
  meta: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 15, marginTop: 8, includeFontPadding: false },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, marginTop: 14, includeFontPadding: false },
  footer: {
    borderTopWidth: 1,
    marginHorizontal: PAD,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: { height: 20, width: 20 * LOGO_RATIO },
  link: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, includeFontPadding: false },
});
