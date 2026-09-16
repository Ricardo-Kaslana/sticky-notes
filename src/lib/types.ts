export interface NotePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: ColorKey;
  tags: string[];
  position: NotePosition;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ColorKey = "paper" | "blush" | "sky" | "sage" | "apricot" | "lavender";

export interface ColorDef {
  key: ColorKey;
  name: string;
  hex: string;
  /** Darker sibling used for swatch borders on light surfaces. */
  deepHex: string;
}

export const COLORS: ColorDef[] = [
  { key: "paper", name: "Paper", hex: "#fff9c4", deepHex: "#e8d972" },
  { key: "blush", name: "Blush", hex: "#f8bbd0", deepHex: "#e991ae" },
  { key: "sky", name: "Sky", hex: "#b3e5fc", deepHex: "#7bc8ec" },
  { key: "sage", name: "Sage", hex: "#c8e6c9", deepHex: "#94cf98" },
  { key: "apricot", name: "Apricot", hex: "#ffe0b2", deepHex: "#f2bc73" },
  { key: "lavender", name: "Lavender", hex: "#d1c4e9", deepHex: "#a893d6" },
];

export function getColorHex(key: ColorKey): string {
  return COLORS.find((c) => c.key === key)?.hex ?? "#fff9c4";
}

export function getColorDeepHex(key: ColorKey): string {
  return COLORS.find((c) => c.key === key)?.deepHex ?? "#e8d972";
}

/**
 * Sort keys. Deliberately only two timestamps + title: this app has no
 * "last accessed" notion and never will — sorting by access time would make
 * the grid reshuffle itself just because a note was opened. Keep it that way.
 */
export type SortBy = "updatedAt" | "createdAt" | "title";
export type SortDir = "asc" | "desc";

export const SORT_BY_VALUES: readonly SortBy[] = ["updatedAt", "createdAt", "title"];
export const SORT_DIR_VALUES: readonly SortDir[] = ["asc", "desc"];

export const DEFAULT_SORT_BY: SortBy = "updatedAt";
export const DEFAULT_SORT_DIR: SortDir = "desc";

export interface Settings {
  defaultColor: ColorKey;
  autoSaveIntervalMs: number;
  launchOnStartup: boolean;
  trayOnClose: boolean;
  sortBy: SortBy;
  sortDir: SortDir;
  /** Note-window zoom factor; 1 = 100%. See src/lib/zoom.ts for the range. */
  noteZoom: number;
}

/**
 * Default window position/size for a newly created note. Single source of
 * truth for the frontend; mirrored as constants in src-tauri/src/tray.rs
 * (kept in sync manually — Rust cannot import the TS module).
 *
 * 340x320 rather than the original 300x240: the note window now carries
 * labelled panels for toolbar / body / tags, and at 240px tall the body text
 * was left with almost no room.
 */
export const DEFAULT_NOTE_POSITION: NotePosition = {
  x: 100,
  y: 100,
  width: 340,
  height: 320,
};
