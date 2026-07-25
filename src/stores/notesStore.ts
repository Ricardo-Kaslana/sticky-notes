import { createStore, produce, reconcile } from "solid-js/store";
import type { Note } from "../lib/types";
import * as api from "../lib/invoke";

const [notes, setNotes] = createStore<Note[]>([]);

export { notes };

export async function loadNotes(): Promise<void> {
  const data = await api.listNotes();
  // Keyed diff: only notes that actually changed produce store updates,
  // so unchanged NoteCards keep their DOM.
  setNotes(reconcile(data, { key: "id" }));
}

/** Upsert from a note-updated event payload — no disk rescan needed. */
export function applyNoteUpdate(note: Note): void {
  // The backend bumps updatedAt on every write, so the updated note
  // belongs at the front of the newest-first list.
  const next = [note, ...notes.filter((n) => n.id !== note.id)];
  setNotes(reconcile(next, { key: "id" }));
}

export function removeNoteLocal(id: string): void {
  setNotes((ns) => ns.filter((n) => n.id !== id));
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
