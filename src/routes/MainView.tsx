import { createSignal, createMemo, onMount, onCleanup } from "solid-js";
import { notes, loadNotes } from "../stores/notesStore";
import { onNoteUpdated, onNoteDeleted } from "../lib/events";
import { openNoteWindow, writeNote } from "../lib/invoke";
import { filterNotes } from "../lib/filterNotes";
import Sidebar from "../components/Sidebar";
import MasonryGrid from "../components/MasonryGrid";
import { DEFAULT_NOTE_POSITION, Note } from "../lib/types";

export default function MainView() {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedTag, setSelectedTag] = createSignal("");
  const [filterPinned, setFilterPinned] = createSignal(false);

  // Single-shot initial load.
  onMount(() => {
    loadNotes();
  });

  // Register cross-window listeners. We await the listen() promises so
  // the unlisten handles are assigned before onMount returns; onCleanup
  // then runs them synchronously on unmount, with no window in which a
  // leaked listener could fire.
  onMount(async () => {
    try {
      const unlistenUpdate = await onNoteUpdated(() => loadNotes());
      const unlistenDelete = await onNoteDeleted(() => loadNotes());
      onCleanup(() => {
        unlistenUpdate();
        unlistenDelete();
      });
    } catch (e) {
      console.error("[MainView] failed to register note listeners:", e);
    }
  });

  const filteredNotes = createMemo(() =>
    filterNotes(notes, {
      query: searchQuery(),
      tag: selectedTag(),
      pinnedOnly: filterPinned(),
    })
  );

  const [createError, setCreateError] = createSignal<string | null>(null);

  const handleCreateNote = async () => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const note: Note = {
      id,
      title: "",
      content: "<p></p>",
      color: "paper",
      tags: [],
      position: { ...DEFAULT_NOTE_POSITION },
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await writeNote(id, note);
      await openNoteWindow(
        id,
        DEFAULT_NOTE_POSITION.x,
        DEFAULT_NOTE_POSITION.y,
        DEFAULT_NOTE_POSITION.width,
        DEFAULT_NOTE_POSITION.height
      );
      await loadNotes();
      setCreateError(null);
    } catch (e) {
      console.error("[MainView] Failed to create note:", e);
      setCreateError(String(e));
    }
  };

  return (
    <div class="flex flex-col h-screen bg-gray-50">
      {/* Error banner */}
      {createError() && (
        <div class="bg-red-100 text-red-700 text-xs p-2 text-center shrink-0">
          Failed to create note: {createError()}
        </div>
      )}
      <div class="flex flex-1 min-h-0">
        <Sidebar
          searchQuery={searchQuery()}
          onSearchChange={setSearchQuery}
          selectedTag={selectedTag()}
          onTagSelect={(tag) => {
            setFilterPinned(false);
            setSelectedTag(tag);
          }}
          filterPinned={filterPinned()}
          onFilterPinnedChange={setFilterPinned}
          onCreateNote={handleCreateNote}
        />
        <MasonryGrid notes={filteredNotes()} hasAnyNotes={notes.length > 0} />
      </div>
    </div>
  );
}
