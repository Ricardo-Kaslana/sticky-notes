import { For, Show } from "solid-js";
// Deep imports: the "lucide-solid" barrel pulls ~3500 icon modules in dev.
import StickyNote from "lucide-solid/icons/sticky-note";
import Plus from "lucide-solid/icons/plus";
import type { Note } from "../lib/types";
import NoteCard from "./NoteCard";

interface MasonryGridProps {
  notes: Note[];
  hasAnyNotes: boolean;
  onCreateNote?: () => void;
}

export default function MasonryGrid(props: MasonryGridProps) {
  return (
    <div class="flex-1 overflow-y-auto px-5 pb-5 pt-3 min-h-0">
      <div class="columns-2 md:columns-3 lg:columns-4 gap-4">
        <For each={props.notes}>
          {(note) => <NoteCard note={note} />}
        </For>
      </div>
      {props.notes.length === 0 && (
        <div class="flex flex-col items-center justify-center h-full gap-3 text-ink-muted text-sm">
          <StickyNote size={40} class="text-neutral-300" />
          <p>
            {props.hasAnyNotes
              ? "没有符合当前筛选条件的便签"
              : "还没有便签，从第一条开始吧"}
          </p>
          <Show when={!props.hasAnyNotes && props.onCreateNote}>
            <button
              onClick={() => props.onCreateNote?.()}
              class="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-ink text-white rounded-sm hover:bg-neutral-800 active:scale-[0.98] transition"
            >
              <Plus size={15} />
              新建便签
            </button>
          </Show>
        </div>
      )}
    </div>
  );
}
