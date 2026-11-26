import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SEARCH_QUERY_MAX } from "@fr/shared";
import { CloseIcon, SearchIcon } from "../icons";
import { fonts, type Palette } from "../../theme/tokens";

type Props = {
  palette: Palette;
  value: string;
  active: boolean;
  onChange: (text: string) => void;
  onFocus: () => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function SearchBar({ palette, value, active, onChange, onFocus, onSubmit, onCancel }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.field, { backgroundColor: palette.card }]}>
        <SearchIcon color={palette.muted} />
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={onFocus}
          onSubmitEditing={onSubmit}
          placeholder="Search news, people, places"
          placeholderTextColor={palette.muted}
          returnKeyType="search"
          autoCorrect={false}
          maxLength={SEARCH_QUERY_MAX}
          accessibilityLabel="Search the news"
          style={[styles.input, { color: palette.ink }]}
        />
        {value ? (
          <Pressable onPress={() => onChange("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10}>
            <CloseIcon color={palette.muted} size={18} />
          </Pressable>
        ) : null}
      </View>
      {active ? (
        <Pressable onPress={onCancel} accessibilityRole="button" hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <Text style={[styles.cancel, { color: palette.ink }]}>Cancel</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  field: { flex: 1, height: 44, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14 },
  input: { flex: 1, height: 44, fontFamily: fonts.regular, fontSize: 16, paddingVertical: 0, includeFontPadding: false },
  cancel: { fontFamily: fonts.semibold, fontSize: 15 },
});
