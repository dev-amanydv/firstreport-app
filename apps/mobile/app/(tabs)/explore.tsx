import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Keyboard, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { SEARCH_QUERY_MIN, type Explore as ExploreData } from "@fr/shared";
import { useExplore, useSearch } from "../../src/api/client";
import { EventRow } from "../../src/components/explore/EventRow";
import { ExploreSkeleton, ResultsSkeleton } from "../../src/components/explore/ExploreSkeleton";
import { SearchBar } from "../../src/components/explore/SearchBar";
import { StoryRail } from "../../src/components/explore/StoryRail";
import { TopicChips } from "../../src/components/explore/TopicChips";
import { ClockIcon } from "../../src/components/icons";
import { SheetMessage } from "../../src/components/Sheet";
import { clearRecentSearches, loadRecentSearches, rememberSearch, useRecentSearches } from "../../src/recentSearches";
import { fonts, metrics, type Palette } from "../../src/theme/tokens";
import { usePalette } from "../../src/theme/useTheme";

const DEBOUNCE_MS = 300;

const openEvent = (id: string) => router.push(`/event/${id}`);

// Home is "what's new"; Explore is "what matters, and help me find something": search, today's topics,
// storylines still developing, and the events most outlets covered.
export default function Explore() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    void loadRecentSearches();
  }, []);

  const startSearch = (text: string) => {
    setQuery(text);
    setSearching(true);
    rememberSearch(text);
    Keyboard.dismiss();
  };

  const cancel = () => {
    setQuery("");
    setSearching(false);
    Keyboard.dismiss();
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas, paddingTop: insets.top + 12 }}>
      <View style={styles.top}>
        {searching ? null : (
          <Text style={[styles.title, { color: palette.ink }]} accessibilityRole="header">
            Explore
          </Text>
        )}
        <SearchBar
          palette={palette}
          value={query}
          active={searching}
          onChange={setQuery}
          onFocus={() => setSearching(true)}
          onSubmit={() => rememberSearch(query)}
          onCancel={cancel}
        />
      </View>
      {searching ? <SearchView palette={palette} query={query} onPick={startSearch} /> : <Sections palette={palette} onTopic={startSearch} />}
    </View>
  );
}

function Sections({ palette, onTopic }: { palette: Palette; onTopic: (name: string) => void }) {
  const explore = useExplore();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await explore.refetch().catch(() => {});
    setRefreshing(false);
  };

  let content: ReactNode;
  if (explore.isPending) content = <ExploreSkeleton palette={palette} />;
  else if (explore.isError)
    content = <SheetMessage palette={palette} text="Couldn't load Explore." action={{ label: "Try again", onPress: () => void explore.refetch() }} />;
  else if (isEmpty(explore.data)) content = <SheetMessage palette={palette} text="Nothing to explore yet. Check back in a little while." />;
  else {
    const { topics, developing, mostCovered } = explore.data;
    content = (
      <>
        {topics.length ? (
          <Section palette={palette} label="Trending today" bleed>
            <TopicChips palette={palette} topics={topics} onPick={onTopic} />
          </Section>
        ) : null}
        {developing.length ? (
          <Section palette={palette} label="Developing stories" bleed>
            <StoryRail
              palette={palette}
              stories={developing}
              onOpen={(story) =>
                router.push(
                  `/story/${story.storyId}?${new URLSearchParams({ label: story.label, count: String(story.eventCount) })}`,
                )
              }
            />
          </Section>
        ) : null}
        {mostCovered.length ? (
          <Section palette={palette} label="Most covered today">
            <View style={[styles.panel, { backgroundColor: palette.card }]}>
              {mostCovered.map((event, i) => (
                <Fragment key={event.id}>
                  {i > 0 ? <View style={[styles.divider, { backgroundColor: palette.hairline }]} /> : null}
                  <EventRow palette={palette} event={event} rank={i + 1} note={`Covered by ${event.sourceCount} outlets`} onOpen={openEvent} />
                </Fragment>
              ))}
            </View>
          </Section>
        ) : null}
      </>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={palette.muted} colors={[palette.neutral]} />}
    >
      {content}
    </ScrollView>
  );
}

const isEmpty = (data: ExploreData) => !data.topics.length && !data.developing.length && !data.mostCovered.length;

function SearchView({ palette, query, onPick }: { palette: Palette; query: string; onPick: (text: string) => void }) {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);
  const results = useSearch(debounced);
  const recent = useRecentSearches();
  const ready = debounced.trim().length >= SEARCH_QUERY_MIN;

  let content: ReactNode;
  if (!ready)
    content = recent.length ? (
      <Section
        palette={palette}
        label="Recent searches"
        action={{ label: "Clear", onPress: clearRecentSearches }}
      >
        <View style={[styles.panel, { backgroundColor: palette.card }]}>
          {recent.map((item, i) => (
            <Fragment key={item}>
              {i > 0 ? <View style={[styles.divider, { backgroundColor: palette.hairline }]} /> : null}
              <Pressable
                onPress={() => onPick(item)}
                accessibilityRole="button"
                accessibilityLabel={`Search for ${item}`}
                style={({ pressed }) => [styles.recent, pressed && { opacity: 0.5 }]}
              >
                <ClockIcon color={palette.muted} size={18} />
                <Text style={[styles.recentText, { color: palette.ink }]} numberOfLines={1}>
                  {item}
                </Text>
              </Pressable>
            </Fragment>
          ))}
        </View>
      </Section>
    ) : (
      <SheetMessage palette={palette} text="Search the last 30 days of stories by topic, person or place." />
    );
  else if (results.isPending) content = <ResultsSkeleton palette={palette} />;
  else if (results.isError)
    content = <SheetMessage palette={palette} text="Couldn't search right now." action={{ label: "Try again", onPress: () => void results.refetch() }} />;
  else if (!results.data.items.length) content = <SheetMessage palette={palette} text={`No stories match “${debounced.trim()}”.`} />;
  else
    content = (
      <View style={[styles.panel, styles.results, { backgroundColor: palette.card }]}>
        {results.data.items.map((event, i) => (
          <Fragment key={event.id}>
            {i > 0 ? <View style={[styles.divider, { backgroundColor: palette.hairline }]} /> : null}
            <EventRow
              palette={palette}
              event={event}
              onOpen={(id) => {
                rememberSearch(debounced);
                openEvent(id);
              }}
            />
          </Fragment>
        ))}
      </View>
    );

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {content}
    </ScrollView>
  );
}

type SectionProps = {
  palette: Palette;
  label: string;
  // Horizontal rails run to the screen edges and pad themselves.
  bleed?: boolean;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
};

function Section({ palette, label, bleed, action, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionLabel, { color: palette.muted }]} accessibilityRole="header">
          {label.toUpperCase()}
        </Text>
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={10} style={({ pressed }) => pressed && { opacity: 0.5 }}>
            <Text style={[styles.sectionAction, { color: palette.ink }]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={bleed ? null : styles.inset}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: metrics.cardInset * 2, paddingBottom: 4 },
  title: { fontFamily: fonts.headline, fontSize: 30, lineHeight: 34, letterSpacing: -0.45, marginBottom: 12, paddingHorizontal: 4 },
  scroll: { paddingBottom: 32 },
  section: { marginTop: 24 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingHorizontal: 20 },
  sectionLabel: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.2 },
  sectionAction: { fontFamily: fonts.semibold, fontSize: 13 },
  inset: { paddingHorizontal: metrics.cardInset * 2 },
  panel: { borderRadius: metrics.cardRadius, paddingHorizontal: 16 },
  results: { marginTop: 16, marginHorizontal: metrics.cardInset * 2 },
  divider: { height: StyleSheet.hairlineWidth * 2 },
  recent: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 },
  recentText: { flex: 1, fontFamily: fonts.medium, fontSize: 15 },
});
