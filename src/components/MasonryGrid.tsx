import { For } from "solid-js";
import type { Note } from "../lib/types";
import NoteCard from "./NoteCard";

interface MasonryGridProps {
  notes: Note[];
  hasAnyNotes: boolean;
}

export default function MasonryGrid(props: MasonryGridProps) {
  return (
    <div class="flex-1 overflow-y-auto p-4">
      <div class="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        <For each={props.notes}>
          {(note) => <NoteCard note={note} />}
        </For>
      </div>
      {props.notes.length === 0 && (
        <div class="flex items-center justify-center h-full text-gray-400 text-sm">
          {props.hasAnyNotes
            ? "No notes match the current filter"
            : 'No notes yet — click "+ 新建便签" to create one'}
        </div>
      )}
    </div>
  );
}
