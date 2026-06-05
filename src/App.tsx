import { Route } from "@solidjs/router";
import MainView from "./routes/MainView";
import NoteView from "./routes/NoteView";

export default function App() {
  return (
    <>
      <Route path="/" component={MainView} />
      <Route path="/note/:id" component={NoteView} />
    </>
  );
}
