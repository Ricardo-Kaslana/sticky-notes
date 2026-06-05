import { listen, emit } from "@tauri-apps/api/event";
import type { Note } from "./types";

export function onNoteUpdated(callback: (note: Note) => void): Promise<() => void> {
  return listen<Note>("note-updated", (event) => callback(event.payload));
}

export function onNoteDeleted(callback: (noteId: string) => void): Promise<() => void> {
  return listen<string>("note-deleted", (event) => callback(event.payload));
}

export function emitNoteUpdated(note: Note): void {
  emit("note-updated", note);
}

export function emitNoteDeleted(noteId: string): void {
  emit("note-deleted", noteId);
}
