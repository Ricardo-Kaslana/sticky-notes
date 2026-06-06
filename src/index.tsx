import { render } from "solid-js/web";
import { createSignal, createEffect, Switch, Match } from "solid-js";
import MainView from "./routes/MainView";
import NoteView from "./routes/NoteView";
import "./index.css";

function App() {
  const [view, setView] = createSignal<"main" | "note" | "unknown">("unknown");
  const [noteId, setNoteId] = createSignal("");

  createEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, "").replace(/^\/+/, "");
    console.log("[App] path:", path);

    if (!path || path === "/" || path === "" || path === "index.html") {
      setView("main");
    } else if (path.startsWith("note/")) {
      setView("note");
      setNoteId(path.replace("note/", ""));
    } else {
      setView("unknown");
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

render(() => <App />, document.getElementById("root")!);
