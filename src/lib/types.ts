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

export interface Settings {
  defaultColor: ColorKey;
  autoSaveIntervalMs: number;
  launchOnStartup: boolean;
  trayOnClose: boolean;
}

/**
 * Default window position/size for a newly created note. Single source of
 * truth for the frontend; mirrored as constants in src-tauri/src/tray.rs
 * (kept in sync manually — Rust cannot import the TS module).
 */
export const DEFAULT_NOTE_POSITION: NotePosition = {
  x: 100,
  y: 100,
  width: 300,
  height: 240,
};
