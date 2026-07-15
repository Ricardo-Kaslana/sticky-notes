import { describe, it, expect } from "vitest";
import { filterNotes, type FilterOpts } from "./filterNotes";
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

const NOTES: Note[] = [
  note({ id: "a", title: "Buy milk", content: "<p>from corner store</p>" }),
  note({ id: "b", title: "Fix bug", content: "<p>hello world</p>", pinned: true }),
  note({ id: "c", title: "Hello", content: "<p><b>bold</b> text</p>", tags: ["Work"] }),
  note({ id: "d", title: "Notes", content: "<p>misc</p>", tags: ["personal"], pinned: true }),
];

const NONE: FilterOpts = { query: "", tag: "", pinnedOnly: false };

describe("filterNotes", () => {
  it("empty opts returns all notes in input order", () => {
    expect(filterNotes(NOTES, NONE).map((n) => n.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("query matches title", () => {
    expect(filterNotes(NOTES, { ...NONE, query: "milk" }).map((n) => n.id)).toEqual(["a"]);
  });

  it("query matches content", () => {
    expect(filterNotes(NOTES, { ...NONE, query: "hello" }).map((n) => n.id)).toEqual(["b", "c"]);
  });

  it("query is case-insensitive", () => {
    expect(filterNotes(NOTES, { ...NONE, query: "HELLO" }).map((n) => n.id)).toEqual(["b", "c"]);
  });

  it("query matches against raw HTML content", () => {
    expect(filterNotes(NOTES, { ...NONE, query: "bold" }).map((n) => n.id)).toEqual(["c"]);
  });

  it("tag filter is case-insensitive", () => {
    expect(filterNotes(NOTES, { ...NONE, tag: "work" }).map((n) => n.id)).toEqual(["c"]);
  });

  it("empty tag means no tag filter", () => {
    expect(filterNotes(NOTES, { ...NONE, tag: "" }).map((n) => n.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("pinnedOnly=true keeps only pinned", () => {
    expect(filterNotes(NOTES, { ...NONE, pinnedOnly: true }).map((n) => n.id)).toEqual(["b", "d"]);
  });

  it("pinnedOnly=false keeps all", () => {
    expect(filterNotes(NOTES, { ...NONE, pinnedOnly: false }).map((n) => n.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("all three filters AND together", () => {
    expect(
      filterNotes(NOTES, { query: "hello", tag: "work", pinnedOnly: false }).map((n) => n.id)
    ).toEqual(["c"]);
  });

  it("no match returns empty array", () => {
    expect(filterNotes(NOTES, { ...NONE, query: "absent" })).toEqual([]);
  });
});
