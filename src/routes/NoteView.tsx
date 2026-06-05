import { useParams } from "@solidjs/router";

export default function NoteView() {
  const params = useParams();
  return <div class="note-window p-4">Note: {params.id}</div>;
}
