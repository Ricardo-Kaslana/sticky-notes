import type { Note, SortBy, SortDir } from "./types";
import { DEFAULT_SORT_BY, DEFAULT_SORT_DIR } from "./types";
import { sortNotes } from "./sortNotes";

export interface FilterOpts {
  query: string;
  tag: string;
  pinnedOnly: boolean;
  /** Defaults to `DEFAULT_SORT_BY` (updatedAt). */
  sortBy?: SortBy;
  /** Defaults to `DEFAULT_SORT_DIR` (desc). */
  sortDir?: SortDir;
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

  const matched = notes.filter((n) => {
    if (q) {
      if (!searchText(n).includes(q)) return false;
    }
    if (t) {
      if (!n.tags.some((tag) => tag.toLowerCase() === t)) return false;
    }
    if (opts.pinnedOnly && !n.pinned) return false;
    return true;
  });

  return sortNotes(
    matched,
    opts.sortBy ?? DEFAULT_SORT_BY,
    opts.sortDir ?? DEFAULT_SORT_DIR
  );
}
