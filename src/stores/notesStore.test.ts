import { describe, it, expect } from "vitest";
import { getAllTags } from "./notesStore";
import type { Note } from "../lib/types";

function note(id: string, tags: string[]): Note {
  return {
    id,
    title: "",
    content: "<p></p>",
    color: "paper",
    tags,
    position: { x: 0, y: 0, width: 300, height: 240 },
    pinned: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("getAllTags", () => {
  it("returns empty for empty notes", () => {
    expect(getAllTags([])).toEqual([]);
  });

  it("skips notes with no tags", () => {
    expect(getAllTags([note("a", [])])).toEqual([]);
  });

  it("aggregates a single tag across notes", () => {
    const result = getAllTags([note("a", ["work"]), note("b", ["work"])]);
    expect(result).toEqual([{ name: "work", displayName: "work", count: 2 }]);
  });

  it("groups case-insensitively", () => {
    const result = getAllTags([
      note("a", ["Work"]),
      note("b", ["WORK"]),
      note("c", ["work"]),
    ]);
    expect(result).toEqual([{ name: "work", displayName: "Work", count: 3 }]);
  });

  it("picks the most-common casing as displayName", () => {
    const result = getAllTags([
      note("a", ["Work"]),
      note("b", ["Work"]),
      note("c", ["WORK"]),
    ]);
    expect(result).toEqual([{ name: "work", displayName: "Work", count: 3 }]);
  });

  it("breaks casing ties by first-encountered casing", () => {
    const result = getAllTags([
      note("a", ["Work"]),
      note("b", ["work"]),
    ]);
    // Tie 1-1; the first note's "Work" wins because Map insertion order
    // is stable and we iterate notes in order.
    expect(result).toEqual([{ name: "work", displayName: "Work", count: 2 }]);
  });

  it("sorts by name ascending", () => {
    const result = getAllTags([
      note("a", ["zebra"]),
      note("b", ["apple"]),
      note("c", ["mango"]),
    ]);
    expect(result.map((t) => t.name)).toEqual(["apple", "mango", "zebra"]);
  });

  it("counts across notes with multiple tags", () => {
    const result = getAllTags([
      note("a", ["a", "b"]),
      note("b", ["a", "c"]),
    ]);
    const map = Object.fromEntries(result.map((t) => [t.name, t.count]));
    expect(map).toEqual({ a: 2, b: 1, c: 1 });
  });
});
