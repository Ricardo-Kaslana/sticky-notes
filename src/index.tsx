import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import MainView from "./routes/MainView";
import NoteView from "./routes/NoteView";
import "./index.css";

render(
  () => (
    <Router>
      <Route path="/" component={MainView} />
      <Route path="/note/:id" component={NoteView} />
      <Route path="note/:id" component={NoteView} />
      <Route path="*" component={() => {
        console.log("Fallback route hit, path:", window.location.pathname);
        return <div class="p-4 text-sm">Route not found: {window.location.pathname}</div>;
      }} />
    </Router>
  ),
  document.getElementById("root")!
);
