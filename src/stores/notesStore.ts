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

export function getAllTags(notes: Note[]): {
  name: string;
  displayName: string;
  count: number;
}[] {
  const groups = new Map<
    string,
    { displayName: string; casings: Map<string, number> }
  >();
  for (const note of notes) {
    for (const tag of note.tags) {
      const lower = tag.toLowerCase();
      const entry = groups.get(lower) ?? {
        displayName: tag,
        casings: new Map<string, number>(),
      };
      entry.casings.set(tag, (entry.casings.get(tag) ?? 0) + 1);
      // Pick the most-common casing as the display name. Ties keep the
      // earlier-encountered casing because Map preserves insertion order;
      // for ties this is arbitrary but stable across runs.
      let topCasing = entry.displayName;
      let topCount = entry.casings.get(topCasing) ?? 0;
      for (const [casing, count] of entry.casings) {
        if (count > topCount) {
          topCasing = casing;
          topCount = count;
        }
      }
      entry.displayName = topCasing;
      groups.set(lower, entry);
    }
  }
  return Array.from(groups.entries())
    .map(([name, { displayName, casings }]) => ({
      name,
      displayName,
      count: Array.from(casings.values()).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
