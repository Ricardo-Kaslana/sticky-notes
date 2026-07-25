/// <reference types="vite/client" />

interface Window {
  /** Set by the note-window init script / on_page_load eval (windows.rs). */
  __NOTE_ID__?: string;
  /** Set by the main window's initialization_script (lib.rs). */
  __MAIN_WINDOW__?: boolean;
  /** Set by index.tsx after mount; read by index.html's error safety net. */
  __APP_MOUNTED__?: boolean;
}
