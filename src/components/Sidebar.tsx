import { createSignal, createMemo, For } from "solid-js";
import { notes, getAllTags } from "../stores/notesStore";
import { openNoteWindow } from "../lib/invoke";
import { Note } from "../lib/types";

interface SidebarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedTag: string;
  onTagSelect: (tag: string) => void;
  filterPinned: boolean;
  onFilterPinnedChange: (v: boolean) => void;
  onCreateNote: () => void;
}

export default function Sidebar(props: SidebarProps) {
  const tags = createMemo(() => getAllTags());

  return (
    <div class="w-52 bg-white border-r border-gray-200 flex flex-col h-full shrink-0">
      {/* Search */}
      <div class="p-3">
        <input
          type="text"
          placeholder="搜索便签..."
          value={props.searchQuery}
          onInput={(e) => props.onSearchChange(e.currentTarget.value)}
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
            All ({notes.length})
          </button>
          <button
            onClick={() => {
              props.onTagSelect("");
              props.onFilterPinnedChange(!props.filterPinned);
            }}
            classList={{
              "text-left text-xs px-2 py-1 rounded": true,
              "bg-gray-100 font-medium": props.filterPinned,
              "text-gray-600 hover:bg-gray-50": !props.filterPinned,
            }}
          >
            Pinned ({notes.filter((n) => n.pinned).length})
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
                <span>{tag.name}</span>
                <span class="text-gray-400">{tag.count}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* New note button */}
      <div class="p-3 border-t border-gray-100">
        <button
          onClick={props.onCreateNote}
          class="w-full py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          + 新建便签
        </button>
      </div>
    </div>
  );
}
