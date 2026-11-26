import { describe, expect, it } from "vitest";
import { SAVED_MAX, type SavedItem } from "@fr/shared";
import { applyServer, NO_SAVED, parseSaved, save, unsave } from "./saved";

const item = (id: string, minutesAgo = 0): SavedItem => ({
  id,
  headline: `Headline ${id}`,
  imageUrl: null,
  firstSeenAt: "2026-11-26T08:00:00.000Z",
  category: "national",
  savedAt: new Date(Date.parse("2026-11-26T10:00:00Z") - minutesAgo * 60_000).toISOString(),
});
const idsOf = (items: SavedItem[]) => items.map((i) => i.id);

describe("parseSaved", () => {
  it("survives missing or broken storage and drops bad rows", () => {
    expect(parseSaved(null)).toEqual(NO_SAVED);
    expect(parseSaved("{oops")).toEqual(NO_SAVED);
    const id = "00000000-0000-4000-8000-00000000000a";
    const raw = JSON.stringify({ items: [item(id), item("not-a-uuid"), { id: 3 }], toAdd: [id, 7], toRemove: [] });
    expect(parseSaved(raw)).toEqual({ items: [item(id)], toAdd: [id], toRemove: [] });
  });
});

describe("save and unsave", () => {
  it("puts the newest save first, once, and marks it for upload", () => {
    const state = save(save(NO_SAVED, item("a")), item("b"));
    expect(idsOf(state.items)).toEqual(["b", "a"]);
    expect(idsOf(save(state, item("a")).items)).toEqual(["a", "b"]);
    expect(state.toAdd).toEqual(["a", "b"]);
  });

  it("unsaving cancels a pending upload and queues the removal", () => {
    const state = unsave(save(NO_SAVED, item("a")), "a");
    expect(state).toEqual({ items: [], toAdd: [], toRemove: ["a"] });
    expect(save(state, item("a")).toRemove).toEqual([]);
  });

  it("keeps at most SAVED_MAX, dropping the oldest", () => {
    let state = NO_SAVED;
    for (let i = 0; i <= SAVED_MAX; i++) state = save(state, item(String(i)));
    expect(state.items).toHaveLength(SAVED_MAX);
    expect(state.items.at(-1)!.id).toBe("1");
  });
});

describe("applyServer", () => {
  it("takes the account's list once the changes were sent", () => {
    const state = save(NO_SAVED, item("a", 1));
    const next = applyServer(state, [item("a", 1), item("z", 60)], { added: ["a"], removed: [] });
    expect(next).toEqual({ items: [item("a", 1), item("z", 60)], toAdd: [], toRemove: [] });
  });

  it("drops a save that another phone removed", () => {
    const state = { items: [item("a")], toAdd: [], toRemove: [] };
    expect(applyServer(state, [], { added: [], removed: [] }).items).toEqual([]);
  });

  it("keeps changes made while the request was out", () => {
    // "a" was sent; then "b" was saved and "a" unsaved before the answer came back.
    const sent = save(NO_SAVED, item("a", 5));
    const during = unsave(save(sent, item("b", 0)), "a");
    const next = applyServer(during, [item("a", 5)], { added: ["a"], removed: [] });
    expect(idsOf(next.items)).toEqual(["b"]);
    expect(next.toAdd).toEqual(["b"]);
    expect(next.toRemove).toEqual(["a"]);
  });
});
