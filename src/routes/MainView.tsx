import { createSignal, createEffect, createMemo, onCleanup } from "solid-js";
import { notes, loadNotes } from "../stores/notesStore";
import { onNoteUpdated, onNoteDeleted } from "../lib/events";
import { openNoteWindow, writeNote } from "../lib/invoke";
import Sidebar from "../components/Sidebar";
import MasonryGrid from "../components/MasonryGrid";
import { Note } from "../lib/types";

export default function MainView() {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedTag, setSelectedTag] = createSignal("");
  const [filterPinned, setFilterPinned] = createSignal(false);
  let unlistenUpdate: (() => void) | undefined;
  let unlistenDelete: (() => void) | undefined;

  createEffect(() => {
    loadNotes();
  });

  // Listen for updates from floating windows
  createEffect(() => {
    onNoteUpdated((_note) => loadNotes()).then((fn) => (unlistenUpdate = fn));
    onNoteDeleted((_id) => loadNotes()).then((fn) => (unlistenDelete = fn));
  });

  onCleanup(() => {
    unlistenUpdate?.();
    unlistenDelete?.();
  });

  const filteredNotes = createMemo(() => {
    let result = notes;
    const q = searchQuery().toLowerCase();
    const tag = selectedTag().toLowerCase();

    if (q) {
      result = result.filter((n) => {
        const text = (n.title + " " + n.content).toLowerCase();
        return text.includes(q);
      });
    }

    if (tag) {
      result = result.filter((n) =>
        n.tags.some((t) => t.toLowerCase() === tag)
      );
    }

    if (filterPinned()) {
      result = result.filter((n) => n.pinned);
    }

    return result;
  });

  const [createError, setCreateError] = createSignal<string | null>(null);

  const handleCreateNote = async () => {
    const id = crypto.randomUUID();
    const note: Note = {
      id,
      title: "",
      content: "<p></p>",
      color: "paper",
      tags: [],
      position: { x: 200, y: 150, width: 320, height: 260 },
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await writeNote(id, note);
      await openNoteWindow(id, 200, 150, 320, 260);
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
        <MasonryGrid notes={filteredNotes()} />
      </div>
    </div>
  );
}
