import { Note, COLORS, getColorHex } from "../lib/types";
import { openNoteWindow, closeNoteWindow, deleteNote } from "../lib/invoke";
import { deleteNoteById } from "../stores/notesStore";
import { createSignal, Show } from "solid-js";
import ConfirmDialog from "./ConfirmDialog";

interface NoteCardProps {
  note: Note;
}

export default function NoteCard(props: NoteCardProps) {
  const [showMenu, setShowMenu] = createSignal(false);
  const [menuPos, setMenuPos] = createSignal({ x: 0, y: 0 });
  const [showConfirm, setShowConfirm] = createSignal(false);

  const handleDoubleClick = () => {
    const p = props.note.position;
    openNoteWindow(props.note.id, p.x, p.y, p.width, p.height);
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const handlePopOut = () => {
    setShowMenu(false);
    const p = props.note.position;
    openNoteWindow(props.note.id, p.x, p.y, p.width, p.height);
  };

  const handleDelete = async () => {
    setShowConfirm(false);
    setShowMenu(false);
    await closeNoteWindow(props.note.id);
    await deleteNoteById(props.note.id);
  };

  const stripHtml = (html: string) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || "";
  };

  const colorHex = () => getColorHex(props.note.color);

  return (
    <>
      <div
        class="rounded-lg p-3 cursor-pointer shadow-sm hover:shadow-md transition-shadow relative group"
        style={{ background: colorHex() }}
        onDblClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Pin indicator */}
        <Show when={props.note.pinned}>
          <div class="absolute top-1 right-1 text-gray-400 text-xs">📌</div>
        </Show>

        <h3 class="font-semibold text-sm mb-1 truncate text-gray-800">
          {props.note.title || "Untitled"}
        </h3>

        <p class="text-xs text-gray-600 line-clamp-3 leading-relaxed">
          {stripHtml(props.note.content)}
        </p>

        <Show when={props.note.tags.length > 0}>
          <div class="flex gap-1 mt-2 flex-wrap">
            {props.note.tags.map((tag) => (
              <span class="text-[10px] bg-black/5 px-1.5 py-0.5 rounded-full text-gray-500">
                {tag}
              </span>
            ))}
          </div>
        </Show>
      </div>

      {/* Context menu */}
      <Show when={showMenu()}>
        <div
          class="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
        <div
          class="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-36 text-sm"
          style={{ left: `${menuPos().x}px`, top: `${menuPos().y}px` }}
        >
          <button
            class="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700"
            onClick={handlePopOut}
          >
            Pop out
          </button>
          <button
            class="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700"
            onClick={() => { setShowMenu(false); }}
          >
            Change color
          </button>
          <div class="border-t border-gray-100 my-0.5" />
          <button
            class="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600"
            onClick={() => { setShowConfirm(true); }}
          >
            Delete
          </button>
        </div>
      </Show>

      <Show when={showConfirm()}>
        <ConfirmDialog
          message="Delete this note? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      </Show>
    </>
  );
}
