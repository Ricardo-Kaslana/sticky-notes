import type { Note } from "./types";

export interface FilterOpts {
  query: string;
  tag: string;
  pinnedOnly: boolean;
}

// Regex strip is enough for search purposes and keeps this module free of
// DOM dependencies (tests run in a node environment).
const stripTags = (html: string) => html.replace(/<[^>]*>/g, " ");

export function filterNotes(notes: Note[], opts: FilterOpts): Note[] {
  const q = opts.query.trim().toLowerCase();
  const t = opts.tag.toLowerCase();

  return notes
    .filter((n) => {
      if (q) {
        const haystack = (n.title + " " + stripTags(n.content)).toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (t) {
        if (!n.tags.some((tag) => tag.toLowerCase() === t)) return false;
      }
      if (opts.pinnedOnly && !n.pinned) return false;
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
