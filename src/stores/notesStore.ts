import { createStore, produce } from "solid-js/store";
import type { Note } from "../lib/types";
import * as api from "../lib/invoke";

const [notes, setNotes] = createStore<Note[]>([]);

export { notes };

export async function loadNotes(): Promise<void> {
  const data = await api.listNotes();
  setNotes(data);
}

export async function saveNote(note: Note): Promise<void> {
  await api.writeNote(note.id, note);
  setNotes(
    (n) => n.id === note.id,
    produce((draft) => {
      Object.assign(draft, note);
    })
  );
}

export async function deleteNoteById(id: string): Promise<void> {
  await api.deleteNote(id);
  setNotes((notes) => notes.filter((n) => n.id !== id));
}

export function updateNoteLocal(id: string, patch: Partial<Note>): void {
  setNotes(
    (n) => n.id === id,
    produce((draft) => {
      Object.assign(draft, patch, { updatedAt: new Date().toISOString() });
    })
  );
}

export function getNoteById(id: string): Note | undefined {
  return notes.find((n) => n.id === id);
}

export function getAllTags(): { name: string; count: number }[] {
  const tagMap = new Map<string, number>();
  for (const note of notes) {
    for (const tag of note.tags) {
      const lower = tag.toLowerCase();
      tagMap.set(lower, (tagMap.get(lower) ?? 0) + 1);
    }
  }
  return Array.from(tagMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
