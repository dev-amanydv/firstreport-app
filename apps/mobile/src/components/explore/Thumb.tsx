import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { CATEGORY_SHORT_LABELS, type Category } from "@fr/shared";
import { fonts, type Palette } from "../../theme/tokens";

type Props = { palette: Palette; uri: string | null; category: Category; width: number; height: number; radius?: number };

// A small hotlinked image; the category's initial on a quiet fill when there is none or it fails.
export function Thumb({ palette, uri, category, width, height, radius = 10 }: Props) {
  const [failed, setFailed] = useState(false);
  const label = category === "other" ? "F" : CATEGORY_SHORT_LABELS[category].charAt(0);
  return (
    <View style={[styles.frame, { width, height, borderRadius: radius, backgroundColor: palette.imageFallback }]}>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
          accessible={false}
        />
      ) : (
        <Text style={[styles.initial, { color: palette.placeholderInk, fontSize: Math.round(height * 0.5) }]} accessible={false}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  initial: { fontFamily: fonts.headline },
});
