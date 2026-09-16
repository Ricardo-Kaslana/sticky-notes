import { describe, expect, it } from "vitest";
import { sortNotes } from "./sortNotes";
import type { Note } from "./types";

function note(over: Partial<Note> & { id: string }): Note {
  return {
    id: over.id,
    title: over.title ?? "",
    content: over.content ?? "<p></p>",
    color: over.color ?? "paper",
    tags: over.tags ?? [],
    position: over.position ?? { x: 0, y: 0, width: 300, height: 240 },
    pinned: over.pinned ?? false,
    createdAt: over.createdAt ?? "2026-01-01T00:00:00Z",
    updatedAt: over.updatedAt ?? "2026-01-01T00:00:00Z",
  };
}

const ids = (notes: Note[]) => notes.map((n) => n.id);

describe("sortNotes", () => {
  const byUpdated = [
    note({ id: "old", updatedAt: "2026-01-01T00:00:00Z" }),
    note({ id: "new", updatedAt: "2026-06-01T00:00:00Z" }),
    note({ id: "mid", updatedAt: "2026-03-01T00:00:00Z" }),
  ];

  it("sorts by updatedAt descending", () => {
    expect(ids(sortNotes(byUpdated, "updatedAt", "desc"))).toEqual(["new", "mid", "old"]);
  });

  it("sorts by updatedAt ascending", () => {
    expect(ids(sortNotes(byUpdated, "updatedAt", "asc"))).toEqual(["old", "mid", "new"]);
  });

  it("sorts by createdAt, which is independent of updatedAt", () => {
    const notes = [
      note({ id: "a", createdAt: "2026-05-01T00:00:00Z", updatedAt: "2026-05-01T00:00:00Z" }),
      note({ id: "b", createdAt: "2026-02-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" }),
    ];
    expect(ids(sortNotes(notes, "createdAt", "asc"))).toEqual(["b", "a"]);
    expect(ids(sortNotes(notes, "createdAt", "desc"))).toEqual(["a", "b"]);
    expect(ids(sortNotes(notes, "updatedAt", "desc"))).toEqual(["b", "a"]);
  });

  it("compares timestamps across the two RFC3339 spellings Rust and JS emit", () => {
    const notes = [
      note({ id: "rust", updatedAt: "2026-06-01T12:00:00.123456789+00:00" }),
      note({ id: "js", updatedAt: "2026-06-01T12:00:00.123Z" }),
      note({ id: "later", updatedAt: "2026-06-01T12:00:00.500Z" }),
    ];
    // Both spellings denote the same instant; `later` must still come first.
    expect(ids(sortNotes(notes, "updatedAt", "desc"))[0]).toBe("later");
  });

  it("sorts by title using locale collation, not raw code points", () => {
    const notes = [
      note({ id: "n10", title: "便签 10" }),
      note({ id: "n2", title: "便签 2" }),
      note({ id: "apple", title: "apple" }),
    ];
    // zh-Hans-CN: Han sorts by pinyin and forms its own block ahead of Latin.
    expect(ids(sortNotes(notes, "title", "asc"))).toEqual(["n2", "n10", "apple"]);
    expect(ids(sortNotes(notes, "title", "desc"))).toEqual(["apple", "n10", "n2"]);
  });

  it("orders Han titles by pinyin", () => {
    const notes = [
      note({ id: "sh", title: "上海" }),
      note({ id: "bj", title: "北京" }),
      note({ id: "gz", title: "广州" }),
    ];
    expect(ids(sortNotes(notes, "title", "asc"))).toEqual(["bj", "gz", "sh"]);
  });

  it("is case- and accent-insensitive for titles", () => {
    const notes = [
      note({ id: "upper", title: "TODO" }),
      note({ id: "lower", title: "todo" }),
      note({ id: "mixed", title: "Todo" }),
    ];
    // All three tie on the primary key, so the id tiebreak decides.
    expect(ids(sortNotes(notes, "title", "asc"))).toEqual(["lower", "mixed", "upper"]);
  });

  it("keeps untitled notes last in both directions", () => {
    const notes = [
      note({ id: "z", title: "" }),
      note({ id: "a", title: "Alpha" }),
      note({ id: "b", title: "Beta" }),
    ];
    expect(ids(sortNotes(notes, "title", "asc"))).toEqual(["a", "b", "z"]);
    expect(ids(sortNotes(notes, "title", "desc"))).toEqual(["b", "a", "z"]);
  });

  it("treats a whitespace-only title as untitled", () => {
    const notes = [note({ id: "blank", title: "   " }), note({ id: "a", title: "Alpha" })];
    expect(ids(sortNotes(notes, "title", "asc"))).toEqual(["a", "blank"]);
  });

  it("breaks ties deterministically by id", () => {
    const notes = [note({ id: "c" }), note({ id: "a" }), note({ id: "b" })];
    expect(ids(sortNotes(notes, "updatedAt", "asc"))).toEqual(["a", "b", "c"]);
    expect(ids(sortNotes(notes, "updatedAt", "desc"))).toEqual(["c", "b", "a"]);
  });

  it("does not mutate the input array", () => {
    const input = [...byUpdated];
    sortNotes(input, "updatedAt", "asc");
    expect(ids(input)).toEqual(["old", "new", "mid"]);
  });

  it("survives an unparseable timestamp instead of returning NaN order", () => {
    const notes = [
      note({ id: "broken", updatedAt: "nope" }),
      note({ id: "real", updatedAt: "2026-06-01T00:00:00Z" }),
    ];
    expect(ids(sortNotes(notes, "updatedAt", "desc"))).toEqual(["real", "broken"]);
    expect(ids(sortNotes(notes, "updatedAt", "asc"))).toEqual(["broken", "real"]);
  });

  it("returns an empty array unchanged", () => {
    expect(sortNotes([], "title", "asc")).toEqual([]);
  });
});
