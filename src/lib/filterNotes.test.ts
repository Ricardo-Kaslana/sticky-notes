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

// Distinct updatedAt values (a newest → d oldest) so the default sort —
// updatedAt descending — lines up with the natural a,b,c,d reading order.
// Without them every fixture ties and the assertions would only be testing
// the tiebreak.
const NOTES: Note[] = [
  note({ id: "a", title: "Buy milk", content: "<p>from corner store</p>", updatedAt: "2026-01-04T00:00:00Z" }),
  note({ id: "b", title: "Fix bug", content: "<p>hello world</p>", pinned: true, updatedAt: "2026-01-03T00:00:00Z" }),
  note({ id: "c", title: "Hello", content: "<p><b>bold</b> text</p>", tags: ["Work"], updatedAt: "2026-01-02T00:00:00Z" }),
  note({ id: "d", title: "Notes", content: "<p>misc</p>", tags: ["personal"], pinned: true, updatedAt: "2026-01-01T00:00:00Z" }),
];

const NONE: FilterOpts = { query: "", tag: "", pinnedOnly: false };

describe("filterNotes", () => {
  it("empty opts returns every note, newest-updated first", () => {
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

  it("query matches text content, not HTML markup", () => {
    expect(filterNotes(NOTES, { ...NONE, query: "bold" }).map((n) => n.id)).toEqual(["c"]);
    expect(filterNotes(NOTES, { ...NONE, query: "<p>" })).toEqual([]);
    expect(filterNotes(NOTES, { ...NONE, query: "b>" })).toEqual([]);
  });

  it("results are sorted by updatedAt descending", () => {
    const dated = [
      note({ id: "old", updatedAt: "2026-01-01T00:00:00Z" }),
      note({ id: "new", updatedAt: "2026-06-01T00:00:00Z" }),
      note({ id: "mid", updatedAt: "2026-03-01T00:00:00Z" }),
    ];
    expect(filterNotes(dated, NONE).map((n) => n.id)).toEqual(["new", "mid", "old"]);
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

describe("filterNotes sorting", () => {
  const DATED: Note[] = [
    note({ id: "a", title: "Beta", createdAt: "2026-05-01T00:00:00Z", updatedAt: "2026-05-01T00:00:00Z" }),
    note({ id: "b", title: "Alpha", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" }),
    note({ id: "c", title: "", createdAt: "2026-03-01T00:00:00Z", updatedAt: "2026-03-01T00:00:00Z" }),
  ];

  it("defaults to updatedAt descending when no sort is given", () => {
    expect(filterNotes(DATED, NONE).map((n) => n.id)).toEqual(["b", "a", "c"]);
  });

  it("honours sortBy createdAt in both directions", () => {
    expect(filterNotes(DATED, { ...NONE, sortBy: "createdAt", sortDir: "asc" }).map((n) => n.id))
      .toEqual(["b", "c", "a"]);
    expect(filterNotes(DATED, { ...NONE, sortBy: "createdAt", sortDir: "desc" }).map((n) => n.id))
      .toEqual(["a", "c", "b"]);
  });

  it("honours sortBy title with untitled notes last", () => {
    expect(filterNotes(DATED, { ...NONE, sortBy: "title", sortDir: "asc" }).map((n) => n.id))
      .toEqual(["b", "a", "c"]);
    expect(filterNotes(DATED, { ...NONE, sortBy: "title", sortDir: "desc" }).map((n) => n.id))
      .toEqual(["a", "b", "c"]);
  });

  it("sorts the filtered subset, not the full list", () => {
    expect(
      filterNotes(DATED, { ...NONE, query: "a", sortBy: "updatedAt", sortDir: "asc" }).map((n) => n.id)
    ).toEqual(["a", "b"]);
  });
});
