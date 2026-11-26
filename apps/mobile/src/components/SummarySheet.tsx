import { StyleSheet, Text } from "react-native";
import { useSummary } from "../api/client";
import { storyDate } from "../lib/time";
import { fonts, type Palette } from "../theme/tokens";
import { Sheet, SheetMessage } from "./Sheet";
import { Bone, Shimmer } from "./Skeleton";

type Props = {
  palette: Palette;
  visible: boolean;
  storyId: string;
  // The summary is the one written when this Event joined the Story.
  eventId: string;
  eventAt: string;
  note?: string;
  onClose: () => void;
};

export function SummarySheet({ palette, visible, storyId, eventId, eventAt, note, onClose }: Props) {
  const summary = useSummary(storyId, eventId, visible);

  let content;
  if (summary.isPending)
    content = (
      <Shimmer palette={palette} label="Loading the story so far">
        <Bone height={11} width={120} />
        {[100, 97, 100, 92, 100, 95, 54].map((w, i) => (
          <Bone key={i} height={15} width={`${w}%`} style={{ marginTop: i === 0 ? 16 : 11 }} />
        ))}
      </Shimmer>
    );
  else if (summary.isError)
    content = (
      <SheetMessage palette={palette} text="Couldn't load the story so far." action={{ label: "Try again", onPress: () => void summary.refetch() }} />
    );
  else if (!summary.data)
    // The first Event of a Story has no summary, and a new one can lag a tick behind.
    content = <SheetMessage palette={palette} text="There's no summary for this point in the story yet. History lists every update." />;
  else
    content = (
      <>
        <Text style={[styles.asOf, { color: palette.muted }]}>As of {storyDate(eventAt)}</Text>
        <Text style={[styles.body, { color: palette.ink }]} textBreakStrategy="highQuality" lineBreakStrategyIOS="standard">
          {summary.data.summary}
        </Text>
      </>
    );

  return (
    <Sheet palette={palette} visible={visible} title="Story so far" note={note} onClose={onClose}>
      {content}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  asOf: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, includeFontPadding: false },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, marginTop: 8, includeFontPadding: false },
});
