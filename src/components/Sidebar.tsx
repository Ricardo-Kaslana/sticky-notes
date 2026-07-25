import { createMemo, For, onCleanup } from "solid-js";
// Deep imports: the "lucide-solid" barrel pulls ~3500 icon modules in dev.
import Search from "lucide-solid/icons/search";
import Hash from "lucide-solid/icons/hash";
import Pin from "lucide-solid/icons/pin";
import Plus from "lucide-solid/icons/plus";
import Settings from "lucide-solid/icons/settings";
import { notes, getAllTags } from "../stores/notesStore";
import { debounce } from "../utils/debounce";

interface SidebarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedTag: string;
  onTagSelect: (tag: string) => void;
  filterPinned: boolean;
  onFilterPinnedChange: (v: boolean) => void;
  onCreateNote: () => void;
  onOpenSettings: () => void;
}

export default function Sidebar(props: SidebarProps) {
  const tags = createMemo(() => getAllTags(notes));
  const pinnedCount = createMemo(() => notes.filter((n) => n.pinned).length);
  const debouncedSearch = debounce((q: string) => props.onSearchChange(q), 200);
  onCleanup(() => debouncedSearch.cancel());

  const itemClass = (active: boolean) =>
    `relative text-left text-xs px-2.5 py-1.5 rounded-sm transition-colors flex items-center gap-1.5 ${
      active
        ? "bg-neutral-100 font-medium text-ink"
        : "text-ink-muted hover:bg-neutral-50"
    }`;

  const ActiveBar = () => (
    <span class="absolute left-0 top-1 bottom-1 w-0.5 bg-ink rounded-full" />
  );

  return (
    <div class="w-56 bg-panel border-r border-line flex flex-col h-full shrink-0">
      {/* Search */}
      <div class="p-3">
        <div class="relative">
          <Search
            size={14}
            class="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
          />
          <input
            type="text"
            placeholder="搜索便签..."
            value={props.searchQuery}
            onInput={(e) => debouncedSearch(e.currentTarget.value)}
            class="w-full pl-8 pr-3 py-1.5 text-sm border border-line rounded-sm bg-surface focus:outline-none focus:border-neutral-400 transition-colors"
          />
        </div>
      </div>

      {/* Tags */}
      <div class="flex-1 overflow-y-auto px-3">
        <div class="flex flex-col gap-0.5">
          <button
            onClick={() => props.onTagSelect("")}
            class={itemClass(props.selectedTag === "")}
          >
            {props.selectedTag === "" && <ActiveBar />}
            <span class="flex-1">全部</span>
            <span class="text-neutral-400">{notes.length}</span>
          </button>
          <button
            onClick={() => {
              // Capture before onTagSelect: MainView resets filterPinned to
              // false inside onTagSelect, which made this toggle stick on.
              const next = !props.filterPinned;
              props.onTagSelect("");
              props.onFilterPinnedChange(next);
            }}
            class={itemClass(props.filterPinned)}
          >
            {props.filterPinned && <ActiveBar />}
            <Pin size={12} />
            <span class="flex-1">已置顶</span>
            <span class="text-neutral-400">{pinnedCount()}</span>
          </button>
          <div class="my-1 border-t border-line" />
          <For each={tags()}>
            {(tag) => (
              <button
                onClick={() =>
                  props.onTagSelect(
                    props.selectedTag === tag.name ? "" : tag.name
                  )
                }
                class={itemClass(props.selectedTag === tag.name)}
              >
                {props.selectedTag === tag.name && <ActiveBar />}
                <Hash size={12} />
                <span class="flex-1 truncate">{tag.displayName}</span>
                <span class="text-neutral-400">{tag.count}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* New note button */}
      <div class="p-3 border-t border-line flex flex-col gap-1.5">
        <button
          onClick={props.onCreateNote}
          class="w-full py-2 text-sm bg-ink text-white rounded-sm hover:bg-neutral-800 active:scale-[0.98] transition flex items-center justify-center gap-1.5"
        >
          <Plus size={15} />
          新建便签
        </button>
        <button
          onClick={props.onOpenSettings}
          class="w-full py-1.5 text-xs text-ink-muted rounded-sm hover:bg-neutral-50 transition-colors flex items-center justify-center gap-1.5"
        >
          <Settings size={13} />
          设置
        </button>
      </div>
    </div>
  );
}
