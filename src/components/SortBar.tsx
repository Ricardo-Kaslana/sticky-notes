import { For } from "solid-js";
// Deep imports: the "lucide-solid" barrel pulls ~3500 icon modules in dev.
import ArrowDownNarrowWide from "lucide-solid/icons/arrow-down-narrow-wide";
import ArrowUpNarrowWide from "lucide-solid/icons/arrow-up-narrow-wide";
import ChevronDown from "lucide-solid/icons/chevron-down";
import { SORT_BY_VALUES, type SortBy, type SortDir } from "../lib/types";
import { SORT_BY_LABELS } from "../lib/sortNotes";

interface SortBarProps {
  sortBy: SortBy;
  sortDir: SortDir;
  onSortByChange: (v: SortBy) => void;
  onSortDirToggle: () => void;
  /** Notes after filtering, vs. the total on disk. */
  shownCount: number;
  totalCount: number;
}

export default function SortBar(props: SortBarProps) {
  const dirLabel = () => (props.sortDir === "asc" ? "升序" : "降序");

  return (
    <div class="flex items-center justify-between gap-3 px-5 pt-4 pb-1 shrink-0">
      <p class="text-xs text-ink-muted">
        共 {props.totalCount} 条便签
        {props.shownCount !== props.totalCount && ` · 显示 ${props.shownCount} 条`}
      </p>

      <div class="flex items-center gap-1.5">
        <label for="sort-by" class="text-xs text-ink-muted">
          排序
        </label>
        <div class="relative">
          <select
            id="sort-by"
            value={props.sortBy}
            onChange={(e) => props.onSortByChange(e.currentTarget.value as SortBy)}
            class="appearance-none pl-2.5 pr-7 py-1 text-xs border border-line rounded-sm bg-panel text-ink cursor-pointer focus:outline-none focus:border-neutral-400 transition-colors"
          >
            <For each={SORT_BY_VALUES}>
              {(value) => <option value={value}>{SORT_BY_LABELS[value]}</option>}
            </For>
          </select>
          <ChevronDown
            size={12}
            class="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
          />
        </div>
        <button
          onClick={props.onSortDirToggle}
          class="p-1.5 rounded-sm border border-line text-ink-muted hover:text-ink hover:bg-neutral-50 transition-colors"
          title={`按${SORT_BY_LABELS[props.sortBy]}${dirLabel()}，点击切换为${
            props.sortDir === "asc" ? "降序" : "升序"
          }`}
          aria-label={`切换为${props.sortDir === "asc" ? "降序" : "升序"}`}
        >
          {props.sortDir === "asc" ? (
            <ArrowUpNarrowWide size={13} />
          ) : (
            <ArrowDownNarrowWide size={13} />
          )}
        </button>
      </div>
    </div>
  );
}
