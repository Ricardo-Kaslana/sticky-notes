import { listen } from "@tauri-apps/api/event";
import type { Note, Settings } from "./types";

// The backend is the single emitter of note events (write_note/delete_note).
// `source` is the label of the window whose invoke caused the write ("tray"
// for tray-created notes), so windows can ignore echoes of their own saves.
export interface NoteUpdatedPayload {
  note: Note;
  source: string;
}

export function onNoteUpdated(
  callback: (note: Note, source: string) => void
): Promise<() => void> {
  return listen<NoteUpdatedPayload>("note-updated", (event) =>
    callback(event.payload.note, event.payload.source)
  );
}

export function onNoteDeleted(callback: (noteId: string) => void): Promise<() => void> {
  return listen<string>("note-deleted", (event) => callback(event.payload));
}

export function onSettingsChanged(
  callback: (settings: Settings) => void
): Promise<() => void> {
  return listen<Settings>("settings-changed", (event) => callback(event.payload));
}
