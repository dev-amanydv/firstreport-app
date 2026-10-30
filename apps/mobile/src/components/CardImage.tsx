import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { CATEGORY_SHORT_LABELS, type Category } from "@fr/shared";
import { fonts, type Palette } from "../theme/tokens";

type Props = {
  palette: Palette;
  uri: string | null;
  credit: string | null;
  category: Category;
  height: number;
  recyclingKey: string;
  active: boolean;
};

// Hotlinked source image with an outlet credit; a quiet category "section front" when there is none.
export function CardImage({ palette, uri, credit, category, height, recyclingKey, active }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = uri !== null && !failed;

  return (
    <View style={[styles.frame, { height, backgroundColor: palette.imageFallback }]}>
      {showImage ? (
        <>
          <Image
            source={{ uri }}
            recyclingKey={recyclingKey}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            priority={active ? "high" : "normal"}
            onError={() => setFailed(true)}
            accessibilityIgnoresInvertColors
            accessible={false}
          />
          {credit ? (
            <View style={[styles.credit, { backgroundColor: palette.creditChip }]}>
              <Text style={[styles.creditText, { color: palette.creditText }]}>Photo: {credit}</Text>
            </View>
          ) : null}
        </>
      ) : (
        <Text style={[styles.placeholder, { color: palette.placeholderInk }]} accessible={false}>
          {category === "other" ? "FirstReport" : CATEGORY_SHORT_LABELS[category]}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flexShrink: 0, overflow: "hidden", justifyContent: "flex-end" },
  credit: { position: "absolute", left: 12, bottom: 12, borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6 },
  creditText: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, includeFontPadding: false },
  placeholder: { fontFamily: fonts.headline, fontSize: 52, lineHeight: 56, letterSpacing: -1, paddingHorizontal: 16, paddingBottom: 10 },
});
