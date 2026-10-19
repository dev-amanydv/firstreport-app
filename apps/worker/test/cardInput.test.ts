import { describe, expect, it } from "vitest";
import { pickReports } from "../src/pipeline/cardInput.js";

function member(sourceId: string, title: string) {
  return { sourceId, source: sourceId, title, lede: "", publishedAt: new Date() };
}

describe("pickReports", () => {
  it("takes one article per source before a second from the same source", () => {
    const members = [member("A", "a1"), member("A", "a2"), member("B", "b1"), member("A", "a3"), member("C", "c1")];
    expect(pickReports(members, 4).map((m) => m.title)).toEqual(["a1", "b1", "c1", "a2"]);
  });

  it("caps the number of reports", () => {
    const members = ["A", "B", "C", "D", "E", "F"].map((source) => member(source, source));
    expect(pickReports(members)).toHaveLength(5);
  });
});
