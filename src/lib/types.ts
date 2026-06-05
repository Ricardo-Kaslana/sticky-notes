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
}

export const COLORS: ColorDef[] = [
  { key: "paper", name: "Paper", hex: "#fff9c4" },
  { key: "blush", name: "Blush", hex: "#f8bbd0" },
  { key: "sky", name: "Sky", hex: "#b3e5fc" },
  { key: "sage", name: "Sage", hex: "#c8e6c9" },
  { key: "apricot", name: "Apricot", hex: "#ffe0b2" },
  { key: "lavender", name: "Lavender", hex: "#d1c4e9" },
];

export function getColorHex(key: ColorKey): string {
  return COLORS.find((c) => c.key === key)?.hex ?? "#fff9c4";
}

export interface Settings {
  defaultColor: ColorKey;
  autoSaveIntervalMs: number;
  launchOnStartup: boolean;
  trayOnClose: boolean;
}
