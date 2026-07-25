import { createMemo, For, onCleanup } from "solid-js";
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

  return (
    <div class="w-52 bg-white border-r border-gray-200 flex flex-col h-full shrink-0">
      {/* Search */}
      <div class="p-3">
        <input
          type="text"
          placeholder="搜索便签..."
          value={props.searchQuery}
          onInput={(e) => debouncedSearch(e.currentTarget.value)}
          class="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-gray-50"
        />
      </div>

      {/* Tags */}
      <div class="flex-1 overflow-y-auto px-3 sidebar-scroll">
        <div class="flex flex-col gap-0.5">
          <button
            onClick={() => props.onTagSelect("")}
            classList={{
              "text-left text-xs px-2 py-1 rounded": true,
              "bg-gray-100 font-medium": props.selectedTag === "",
              "text-gray-600 hover:bg-gray-50": props.selectedTag !== "",
            }}
          >
            全部 ({notes.length})
          </button>
          <button
            onClick={() => {
              // Capture before onTagSelect: MainView resets filterPinned to
              // false inside onTagSelect, which made this toggle stick on.
              const next = !props.filterPinned;
              props.onTagSelect("");
              props.onFilterPinnedChange(next);
            }}
            classList={{
              "text-left text-xs px-2 py-1 rounded": true,
              "bg-gray-100 font-medium": props.filterPinned,
              "text-gray-600 hover:bg-gray-50": !props.filterPinned,
            }}
          >
            已置顶 ({pinnedCount()})
          </button>
          <div class="my-1 border-t border-gray-100" />
          <For each={tags()}>
            {(tag) => (
              <button
                onClick={() =>
                  props.onTagSelect(
                    props.selectedTag === tag.name ? "" : tag.name
                  )
                }
                classList={{
                  "text-left text-xs px-2 py-1 rounded flex justify-between": true,
                  "bg-gray-100 font-medium": props.selectedTag === tag.name,
                  "text-gray-600 hover:bg-gray-50":
                    props.selectedTag !== tag.name,
                }}
              >
                <span>{tag.displayName}</span>
                <span class="text-gray-400">{tag.count}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* New note button */}
      <div class="p-3 border-t border-gray-100 flex flex-col gap-1.5">
        <button
          onClick={props.onCreateNote}
          class="w-full py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          + 新建便签
        </button>
        <button
          onClick={props.onOpenSettings}
          class="w-full py-1.5 text-xs text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
        >
          设置
        </button>
      </div>
    </div>
  );
}
