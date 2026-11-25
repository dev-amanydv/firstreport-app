import { StyleSheet, Pressable, Text, View, useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";
import type { AppearanceChoice } from "../lib/appearance";
import { fonts, type Palette } from "../theme/tokens";
import { CheckIcon } from "./icons";

type Props = { palette: Palette; value: AppearanceChoice; onChange: (choice: AppearanceChoice) => void };

const OPTIONS: { choice: AppearanceChoice; label: string }[] = [
  { choice: "light", label: "Light" },
  { choice: "dark", label: "Dark" },
  { choice: "system", label: "System" },
];

// Colours of the tiny screens: they always show light and dark, whatever the app is in now.
const SCREENS = {
  light: { bg: "#F3F4F6", fill: "#D5D7DC", edge: "rgba(0,0,0,0.06)" },
  dark: { bg: "#0B0B0B", fill: "#2E2E31", edge: "rgba(255,255,255,0.10)" },
};

const SHEET_PADDING = 20;
const GAP = 22;
const MAX_TILE = 92;
const ASPECT = 1.76;

// Three phone-shaped previews, each with its name and a radio under it. System shows half of each.
export function AppearancePicker({ palette, value, onChange }: Props) {
  const { width } = useWindowDimensions();
  const tile = Math.min(MAX_TILE, (width - SHEET_PADDING * 2 - GAP * 2 - 16) / 3);

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {OPTIONS.map(({ choice, label }) => {
        const selected = choice === value;
        return (
          <Pressable
            key={choice}
            onPress={() => {
              if (selected) return;
              void Haptics.selectionAsync();
              onChange(choice);
            }}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: selected }}
            style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
          >
            <View style={{ width: tile, height: tile * ASPECT }}>
              {choice === "system" ? (
                <>
                  <MiniScreen width={tile} colours={SCREENS.light} />
                  {/* The right half, cut from a full dark screen so its contents line up with the light one. */}
                  <View style={[styles.half, { width: tile / 2, borderTopRightRadius: tile * 0.15, borderBottomRightRadius: tile * 0.15 }]}>
                    <View style={{ marginLeft: -tile / 2 }}>
                      <MiniScreen width={tile} colours={SCREENS.dark} />
                    </View>
                  </View>
                </>
              ) : (
                <MiniScreen width={tile} colours={SCREENS[choice]} />
              )}
            </View>
            <Text style={[styles.label, { color: palette.ink }]}>{label}</Text>
            <View
              style={[
                styles.radio,
                selected ? { backgroundColor: palette.neutral, borderColor: palette.neutral } : { borderColor: palette.muted },
              ]}
            >
              {selected ? <CheckIcon color={palette.onNeutral} size={16} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// A sketch of a screen: an avatar dot, two text lines and two cards.
function MiniScreen({ width, colours }: { width: number; colours: (typeof SCREENS)["light"] }) {
  const pad = width * 0.15;
  const fill = { backgroundColor: colours.fill };
  return (
    <View
      style={{
        width,
        height: width * ASPECT,
        borderRadius: width * 0.15,
        padding: pad,
        backgroundColor: colours.bg,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: colours.edge,
      }}
    >
      <View style={[fill, { width: width * 0.22, height: width * 0.22, borderRadius: width * 0.11 }]} />
      <View style={[fill, styles.line, { width: width * 0.28, marginTop: width * 0.13 }]} />
      <View style={[fill, styles.line, { width: width * 0.68, marginTop: 5 }]} />
      <View style={[fill, { height: width * 0.27, borderRadius: width * 0.07, marginTop: width * 0.11 }]} />
      <View style={[fill, { height: width * 0.27, borderRadius: width * 0.07, marginTop: width * 0.08 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: GAP, paddingTop: 8, paddingBottom: 12 },
  option: { alignItems: "center" },
  half: { position: "absolute", top: 0, bottom: 0, right: 0, overflow: "hidden", alignItems: "flex-start" },
  line: { height: 5, borderRadius: 2.5 },
  label: { fontFamily: fonts.regular, fontSize: 17, marginTop: 14 },
  radio: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 12 },
});
