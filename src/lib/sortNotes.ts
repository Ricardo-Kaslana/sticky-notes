import type { Note, SortBy, SortDir } from "./types";
import { DEFAULT_SORT_BY, DEFAULT_SORT_DIR, SORT_BY_VALUES, SORT_DIR_VALUES } from "./types";

export const SORT_BY_LABELS: Record<SortBy, string> = {
  updatedAt: "修改时间",
  createdAt: "创建时间",
  title: "标题",
};

export function isSortBy(v: unknown): v is SortBy {
  return typeof v === "string" && (SORT_BY_VALUES as readonly string[]).includes(v);
}

export function isSortDir(v: unknown): v is SortDir {
  return typeof v === "string" && (SORT_DIR_VALUES as readonly string[]).includes(v);
}

/**
 * `numeric` makes "便签 2" sort before "便签 10"; `base` folds case and
 * accents so "Todo" and "todo" are neighbours instead of far apart.
 */
const collator = new Intl.Collator("zh-Hans-CN", { numeric: true, sensitivity: "base" });

/**
 * Timestamps on disk are RFC3339 but NOT one canonical spelling: Rust writes
 * `+00:00` (`chrono::Utc::now().to_rfc3339()`) while the frontend writes `Z`
 * (`Date#toISOString`). Lexicographic comparison happens to be right most of
 * the time, so parse to epoch ms instead of relying on that coincidence.
 * Unparseable values sort as epoch 0 rather than poisoning the comparator
 * with NaN.
 */
function timestamp(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function compareTime(a: Note, b: Note, by: SortBy): number {
  const av = timestamp(by === "createdAt" ? a.createdAt : a.updatedAt);
  const bv = timestamp(by === "createdAt" ? b.createdAt : b.updatedAt);
  return av === bv ? 0 : av < bv ? -1 : 1;
}

/**
 * Sort a copy of `notes` by `by`/`dir`.
 *
 * `dir` is applied to the primary key only — two rules stay direction
 * independent on purpose:
 * - untitled notes always sink to the bottom (ascending order would
 *   otherwise open with a wall of "无标题");
 * - the `id` tiebreak keeps equal keys in a stable, reproducible order.
 */
export function sortNotes(notes: Note[], by: SortBy, dir: SortDir): Note[] {
  const sign = dir === "asc" ? 1 : -1;
  const byId = (a: Note, b: Note) => collator.compare(a.id, b.id) * sign;

  return [...notes].sort((a, b) => {
    if (by === "title") {
      const at = a.title.trim();
      const bt = b.title.trim();
      if (!at || !bt) {
        if (!at && !bt) return byId(a, b);
        return at ? -1 : 1;
      }
      const c = collator.compare(at, bt);
      return c !== 0 ? c * sign : byId(a, b);
    }
    const c = compareTime(a, b, by);
    return c !== 0 ? c * sign : byId(a, b);
  });
}

export { DEFAULT_SORT_BY, DEFAULT_SORT_DIR };
