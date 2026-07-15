import { Note, getColorHex } from "../lib/types";
import { openNoteWindow, closeNoteWindow, writeNote } from "../lib/invoke";
import { deleteNoteById, updateNoteLocal } from "../stores/notesStore";
import { createSignal, Show } from "solid-js";
import ConfirmDialog from "./ConfirmDialog";
import ColorPicker from "./ColorPicker";

interface NoteCardProps {
  note: Note;
}

export default function NoteCard(props: NoteCardProps) {
  const [showMenu, setShowMenu] = createSignal(false);
  const [menuPos, setMenuPos] = createSignal({ x: 0, y: 0 });
  const [showConfirm, setShowConfirm] = createSignal(false);
  const [showColorPicker, setShowColorPicker] = createSignal(false);

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

  const handleChangeColor = (color: Note["color"]) => {
    setShowColorPicker(false);
    // Optimistic local update so the card flips instantly.
    updateNoteLocal(props.note.id, { color });
    const updated: Note = {
      ...props.note,
      color,
      updatedAt: new Date().toISOString(),
    };
    writeNote(props.note.id, updated).catch((e) => {
      console.error("[NoteCard] Failed to change color:", e);
    });
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

        {/* Inline color picker (toggled by right-click → "Change color") */}
        <Show when={showColorPicker()}>
          <div class="absolute top-1 right-7 z-20">
            <ColorPicker
              selected={props.note.color}
              onChange={handleChangeColor}
            />
          </div>
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
            onClick={() => {
              setShowMenu(false);
              setShowColorPicker(true);
            }}
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
