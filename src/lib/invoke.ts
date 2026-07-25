import { invoke } from "@tauri-apps/api/core";
import type { Note, Settings } from "./types";

export async function listNotes(): Promise<Note[]> {
  return invoke<Note[]>("list_notes");
}

export async function readNote(id: string): Promise<Note> {
  return invoke<Note>("read_note", { id });
}

export async function writeNote(id: string, note: Note): Promise<void> {
  return invoke("write_note", { id, note });
}

export async function deleteNote(id: string): Promise<void> {
  return invoke("delete_note", { id });
}

export async function saveAttachment(
  noteId: string,
  fileName: string,
  data: Uint8Array
): Promise<string> {
  // Raw-body invoke: bytes go over IPC untouched instead of being
  // serialized into a JSON number array.
  return invoke<string>("save_attachment", data, {
    headers: {
      "x-note-id": encodeURIComponent(noteId),
      "x-file-name": encodeURIComponent(fileName),
    },
  });
}

export async function deleteAttachment(
  noteId: string,
  fileName: string
): Promise<void> {
  return invoke("delete_attachment", { noteId, fileName });
}

export async function readSettings(): Promise<Settings> {
  return invoke<Settings>("read_settings");
}

export async function writeSettings(settings: Settings): Promise<void> {
  return invoke("write_settings", { settings });
}

export async function openNoteWindow(
  noteId: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  return invoke("open_note_window", { noteId, x, y, width, height });
}

export async function closeNoteWindow(noteId: string): Promise<void> {
  return invoke("close_note_window", { noteId });
}

export async function setNoteWindowPinned(
  noteId: string,
  pinned: boolean
): Promise<void> {
  return invoke("set_note_window_pinned", { noteId, pinned });
}

/** Returns the note ID if current window is a note window, throws otherwise. */
export async function getNoteId(): Promise<string> {
  return invoke<string>("get_note_id");
}
