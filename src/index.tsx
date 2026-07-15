import { render } from "solid-js/web";
import { createSignal, createEffect, Show } from "solid-js";

import { getNoteId } from "./lib/invoke";
import MainView from "./routes/MainView";
import NoteView from "./routes/NoteView";
import "./index.css";

type Route = { view: "main" | "note"; noteId: string };

function App() {
  // Check window.__NOTE_ID__ synchronously (set by initialization_script
  // or eval() before page scripts).
  const injectedId = (window as any).__NOTE_ID__ as string | undefined;

  const [route, setRoute] = createSignal<Route | null>(
    injectedId ? { view: "note", noteId: injectedId } : null
  );

  let routed = false;

  const doRoute = (view: "main" | "note", noteId: string) => {
    if (routed) return;
    routed = true;
    setRoute({ view, noteId });
  };

  // Resolve window identity. Two sources, in order:
  // 1. __NOTE_ID__ already checked synchronously above
  // 2. get_note_id IPC (reads window.label() on Rust side)
  createEffect(() => {
    if (routed || route() !== null) return;

    getNoteId()
      .then((noteId) => {
        // IPC succeeded — this is a note window with correct label
        doRoute("note", noteId);
      })
      .catch(() => {
        // IPC failed — this is the main window (or a note window with
        // a broken label; in that rare case we fall through to MainView).
        doRoute("main", "");
      });
  });

  return (
    <Show
      when={route()}
      fallback={
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-size:14px;">
          Loading…
        </div>
      }
    >
      {route()!.view === "note" ? (
        <NoteView noteId={route()!.noteId} />
      ) : (
        <MainView />
      )}
    </Show>
  );
}

try {
  const root = document.getElementById("root")!;
  root.innerHTML = "";
  render(() => <App />, root);
} catch (e) {
  console.error("Failed to render app:", e);
  throw e;
}
(window as any).__APP_MOUNTED__ = true;
