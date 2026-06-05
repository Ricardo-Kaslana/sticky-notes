import { Route, Routes } from "@solidjs/router";
import MainView from "./routes/MainView";
import NoteView from "./routes/NoteView";

export default function App() {
  return (
    <Routes>
      <Route path="/" component={MainView} />
      <Route path="/note/:id" component={NoteView} />
    </Routes>
  );
}
