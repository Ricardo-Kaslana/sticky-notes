import { render } from "solid-js/web";
import { createSignal, createEffect, Switch, Match } from "solid-js";
import MainView from "./routes/MainView";
import NoteView from "./routes/NoteView";
import "./index.css";

function App() {
  const [view, setView] = createSignal<"main" | "note" | "unknown">("unknown");
  const [noteId, setNoteId] = createSignal("");

  createEffect(() => {
    // Prefer the injected __NOTE_ID__ (set by Tauri initialization_script).
    // Fall back to ?noteId= query param for dev-server compatibility.
    const injected = (window as any).__NOTE_ID__ as string | undefined;
    const params = new URLSearchParams(window.location.search);
    const id = injected ?? params.get("noteId");
    if (id) {
      setView("note");
      setNoteId(id);
    } else {
      setView("main");
    }
  });

  return (
    <Switch>
      <Match when={view() === "main"}>
        <MainView />
      </Match>
      <Match when={view() === "note"}>
        <NoteView noteId={noteId()} />
      </Match>
      <Match when={view() === "unknown"}>
        <div class="p-4 text-sm text-gray-500">
          Unknown route: {window.location.pathname}
        </div>
      </Match>
    </Switch>
  );
}

const root = document.getElementById("root")!;
root.innerHTML = "";
render(() => <App />, root);
(window as any).__APP_MOUNTED__ = true;
