import { createSignal } from "solid-js";
import type { Settings } from "../lib/types";
import { DEFAULT_SORT_BY, DEFAULT_SORT_DIR } from "../lib/types";
import { NOTE_ZOOM_DEFAULT, clampZoom } from "../lib/zoom";
import { isSortBy, isSortDir } from "../lib/sortNotes";
import { readSettings, writeSettings } from "../lib/invoke";

export const DEFAULT_SETTINGS: Settings = {
  defaultColor: "paper",
  autoSaveIntervalMs: 2000,
  launchOnStartup: false,
  trayOnClose: true,
  sortBy: DEFAULT_SORT_BY,
  sortDir: DEFAULT_SORT_DIR,
  noteZoom: NOTE_ZOOM_DEFAULT,
};

const [settings, setSettings] = createSignal<Settings>(DEFAULT_SETTINGS);

export { settings };

/**
 * Coerce anything that claims to be Settings into a usable value. A
 * `settings.json` written by an older build has no sort/zoom keys, and a
 * hand-edited one can hold junk — neither should be able to produce an
 * unsortable grid or a note window scaled to 0%.
 */
export function normalizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  return {
    ...merged,
    sortBy: isSortBy(merged.sortBy) ? merged.sortBy : DEFAULT_SORT_BY,
    sortDir: isSortDir(merged.sortDir) ? merged.sortDir : DEFAULT_SORT_DIR,
    noteZoom: clampZoom(merged.noteZoom),
  };
}

export async function loadSettings(): Promise<Settings> {
  const next = normalizeSettings(await readSettings());
  setSettings(next);
  return next;
}

/** Adopt settings pushed by another window via the `settings-changed` event. */
export function applySettings(next: Settings): void {
  setSettings(normalizeSettings(next));
}

/**
 * Update the in-memory settings only. For interactions that must repaint on
 * the same frame but should not hit the disk on every event — zooming with
 * Ctrl+wheel fires dozens of these per gesture.
 */
export function patchSettingsLocal(patch: Partial<Settings>): void {
  setSettings((prev) => normalizeSettings({ ...prev, ...patch }));
}

export async function saveSettings(next: Settings): Promise<void> {
  const normalized = normalizeSettings(next);
  // Apply before awaiting: toggling sort or zoom must repaint immediately,
  // and the IPC round trip to a local file is long enough to feel laggy.
  setSettings(normalized);
  await writeSettings(normalized);
}
