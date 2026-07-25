import { createSignal } from "solid-js";
import type { Settings } from "../lib/types";
import { readSettings, writeSettings } from "../lib/invoke";

export const DEFAULT_SETTINGS: Settings = {
  defaultColor: "paper",
  autoSaveIntervalMs: 2000,
  launchOnStartup: false,
  trayOnClose: true,
};

const [settings, setSettings] = createSignal<Settings>(DEFAULT_SETTINGS);

export { settings };

export async function loadSettings(): Promise<Settings> {
  const s = await readSettings();
  setSettings(s);
  return s;
}

export async function saveSettings(next: Settings): Promise<void> {
  await writeSettings(next);
  setSettings(next);
}
