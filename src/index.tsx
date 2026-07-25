import { render } from "solid-js/web";
import { createSignal, createEffect, lazy, Suspense, Show } from "solid-js";

import { getNoteId } from "./lib/invoke";
import MainView from "./routes/MainView";
import "./index.css";

// Lazy: keeps TipTap + editor deps out of the main window's initial
// bundle — the grid view never needs them.
let noteViewImport: Promise<typeof import("./routes/NoteView")> | undefined;
const loadNoteView = () => (noteViewImport ??= import("./routes/NoteView"));
const NoteView = lazy(loadNoteView);

type Route = { view: "main" | "note"; noteId: string };

function App() {
  // Synchronous identity checks, in priority order:
  // 1. __NOTE_ID__ (set by on_page_load eval in note windows)
  // 2. __MAIN_WINDOW__ (set by initialization_script on the main window)
  const injectedId = window.__NOTE_ID__;
  const isMain = window.__MAIN_WINDOW__ === true;

  // Not the main window → this is (almost certainly) a note window.
  // Start fetching the editor chunk now, in parallel with route
  // resolution, instead of after the IPC round trip completes.
  if (!isMain) void loadNoteView();

  const [route, setRoute] = createSignal<Route | null>(
    injectedId
      ? { view: "note", noteId: injectedId }
      : isMain
        ? { view: "main", noteId: "" }
        : null
  );

  let routed = route() !== null;

  const doRoute = (view: "main" | "note", noteId: string) => {
    if (routed) return;
    routed = true;
    setRoute({ view, noteId });
  };

  // Async fallback for windows with no injected marker:
  // get_note_id IPC reads window.label() on the Rust side.
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

  // Factory, not a shared element: Solid JSX is a real DOM node, and the
  // same node can't live in two fallbacks.
  const loading = () => (
    <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-size:14px;">
      加载中…
    </div>
  );

  return (
    <Show when={route()} fallback={loading()}>
      {route()!.view === "note" ? (
        <Suspense fallback={loading()}>
          <NoteView noteId={route()!.noteId} />
        </Suspense>
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
(window as Window).__APP_MOUNTED__ = true;
