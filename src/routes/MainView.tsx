import { createSignal, createMemo, onMount, onCleanup, Show } from "solid-js";
import { notes, loadNotes, applyNoteUpdate, removeNoteLocal } from "../stores/notesStore";
import {
  settings,
  loadSettings,
  saveSettings,
  applySettings,
} from "../stores/settingsStore";
import { onNoteUpdated, onNoteDeleted, onSettingsChanged } from "../lib/events";
import { openNoteWindow, writeNote } from "../lib/invoke";
import { filterNotes } from "../lib/filterNotes";
import Sidebar from "../components/Sidebar";
import SortBar from "../components/SortBar";
import MasonryGrid from "../components/MasonryGrid";
import SettingsDialog from "../components/SettingsDialog";
import { DEFAULT_NOTE_POSITION, Note, type SortBy } from "../lib/types";
// Deep import: the "lucide-solid" barrel pulls ~3500 icon modules in dev.
import AlertCircle from "lucide-solid/icons/alert-circle";

export default function MainView() {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedTag, setSelectedTag] = createSignal("");
  const [filterPinned, setFilterPinned] = createSignal(false);
  const [showSettings, setShowSettings] = createSignal(false);

  // Single-shot initial load.
  onMount(() => {
    loadNotes();
    loadSettings().catch((e) =>
      console.error("[MainView] failed to load settings:", e)
    );
  });

  // Register cross-window listeners. onCleanup must be registered
  // synchronously (before any await) or Solid drops it; the unlisten
  // handles resolve later and are invoked through the promises.
  onMount(() => {
    const unlistenUpdate = onNoteUpdated((note) => applyNoteUpdate(note));
    const unlistenDelete = onNoteDeleted((id) => removeNoteLocal(id));
    // Note windows write settings too (zoom), so this window must adopt the
    // broadcast or its next save would write back a stale zoom/sort pair.
    const unlistenSettings = onSettingsChanged((s) => applySettings(s));
    unlistenUpdate.catch((e) =>
      console.error("[MainView] failed to register note-updated listener:", e)
    );
    unlistenDelete.catch((e) =>
      console.error("[MainView] failed to register note-deleted listener:", e)
    );
    unlistenSettings.catch((e) =>
      console.error("[MainView] failed to register settings listener:", e)
    );
    onCleanup(() => {
      unlistenUpdate.then((un) => un()).catch(() => {});
      unlistenDelete.then((un) => un()).catch(() => {});
      unlistenSettings.then((un) => un()).catch(() => {});
    });
  });

  const filteredNotes = createMemo(() =>
    filterNotes(notes, {
      query: searchQuery(),
      tag: selectedTag(),
      pinnedOnly: filterPinned(),
      sortBy: settings().sortBy,
      sortDir: settings().sortDir,
    })
  );

  // Sort preferences live in settings.json, so they survive a restart and
  // stay consistent with whatever the settings dialog shows.
  const persistSort = (patch: { sortBy?: SortBy; sortDir?: "asc" | "desc" }) => {
    saveSettings({ ...settings(), ...patch }).catch((e) =>
      console.error("[MainView] failed to save sort preference:", e)
    );
  };

  const toggleSortDir = () =>
    persistSort({ sortDir: settings().sortDir === "asc" ? "desc" : "asc" });

  const [createError, setCreateError] = createSignal<string | null>(null);
  let creating = false;

  const handleCreateNote = async () => {
    if (creating) return;
    creating = true;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    // Cascade new windows so consecutive notes don't stack exactly on top
    // of each other.
    const step = (notes.length % 8) * 28;
    const position = {
      ...DEFAULT_NOTE_POSITION,
      x: DEFAULT_NOTE_POSITION.x + step,
      y: DEFAULT_NOTE_POSITION.y + step,
    };
    const note: Note = {
      id,
      title: "",
      content: "<p></p>",
      color: settings().defaultColor,
      tags: [],
      position,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await writeNote(id, note);
      await openNoteWindow(id, position.x, position.y, position.width, position.height);
      setCreateError(null);
    } catch (e) {
      console.error("[MainView] Failed to create note:", e);
      setCreateError(String(e));
    } finally {
      creating = false;
    }
  };

  return (
    <div class="flex flex-col h-screen bg-surface">
      {/* Error banner */}
      {createError() && (
        <div class="flex items-center justify-center gap-1.5 bg-red-50 text-red-700 text-xs p-2 shrink-0 border-b border-red-100">
          <AlertCircle size={14} />
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
          onOpenSettings={() => setShowSettings(true)}
        />
        <div class="flex-1 flex flex-col min-w-0">
          <SortBar
            sortBy={settings().sortBy}
            sortDir={settings().sortDir}
            onSortByChange={(v) => persistSort({ sortBy: v })}
            onSortDirToggle={toggleSortDir}
            shownCount={filteredNotes().length}
            totalCount={notes.length}
          />
          <MasonryGrid
            notes={filteredNotes()}
            hasAnyNotes={notes.length > 0}
            onCreateNote={handleCreateNote}
          />
        </div>
      </div>
      <Show when={showSettings()}>
        <SettingsDialog
          settings={settings()}
          onCancel={() => setShowSettings(false)}
          onSave={(next) => {
            setShowSettings(false);
            saveSettings(next).catch((e) =>
              console.error("[MainView] failed to save settings:", e)
            );
          }}
        />
      </Show>
    </div>
  );
}
