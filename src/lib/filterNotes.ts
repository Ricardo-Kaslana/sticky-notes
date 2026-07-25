import type { Note } from "./types";

export interface FilterOpts {
  query: string;
  tag: string;
  pinnedOnly: boolean;
}

// Regex strip is enough for search purposes and keeps this module free of
// DOM dependencies (tests run in a node environment).
const stripTags = (html: string) => html.replace(/<[^>]*>/g, " ");

// Stripping + lowercasing every note's full HTML on each keystroke is the
// search hot path; cache per note, invalidated by updatedAt.
const textCache = new Map<string, { updatedAt: string; text: string }>();

function searchText(n: Note): string {
  const hit = textCache.get(n.id);
  if (hit && hit.updatedAt === n.updatedAt) return hit.text;
  const text = (n.title + " " + stripTags(n.content)).toLowerCase();
  textCache.set(n.id, { updatedAt: n.updatedAt, text });
  return text;
}

export function filterNotes(notes: Note[], opts: FilterOpts): Note[] {
  const q = opts.query.trim().toLowerCase();
  const t = opts.tag.toLowerCase();

  return notes
    .filter((n) => {
      if (q) {
        if (!searchText(n).includes(q)) return false;
      }
      if (t) {
        if (!n.tags.some((tag) => tag.toLowerCase() === t)) return false;
      }
      if (opts.pinnedOnly && !n.pinned) return false;
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
