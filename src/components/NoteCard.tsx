import { Note, getColorHex } from "../lib/types";
import { openNoteWindow, closeNoteWindow, writeNote, readNote } from "../lib/invoke";
import { deleteNoteById, updateNoteLocal } from "../stores/notesStore";
import { createSignal, createMemo, Show } from "solid-js";
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

  const openWindow = () => {
    const p = props.note.position;
    openNoteWindow(props.note.id, p.x, p.y, p.width, p.height).catch((e) =>
      console.error("[NoteCard] Failed to open note window:", e)
    );
  };

  const handleDoubleClick = () => openWindow();

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const handlePopOut = () => {
    setShowMenu(false);
    openWindow();
  };

  const handleChangeColor = async (color: Note["color"]) => {
    setShowColorPicker(false);
    // Optimistic local update so the card flips instantly.
    updateNoteLocal(props.note.id, { color });
    try {
      // Re-read before writing: the card's snapshot may be stale if the
      // note is open in a floating window that just auto-saved.
      const fresh = await readNote(props.note.id);
      await writeNote(props.note.id, { ...fresh, color });
    } catch (e) {
      console.error("[NoteCard] Failed to change color:", e);
      updateNoteLocal(props.note.id, { color: props.note.color });
    }
  };

  const handleDelete = async () => {
    setShowConfirm(false);
    setShowMenu(false);
    try {
      await closeNoteWindow(props.note.id);
    } catch (e) {
      console.error("[NoteCard] Failed to close note window:", e);
    }
    try {
      await deleteNoteById(props.note.id);
    } catch (e) {
      console.error("[NoteCard] Failed to delete note:", e);
    }
  };

  // DOMParser never loads resources nor fires event handlers, unlike
  // assigning innerHTML on a detached element.
  const stripHtml = (html: string) =>
    new DOMParser().parseFromString(html, "text/html").body.textContent || "";

  const preview = createMemo(() => stripHtml(props.note.content));

  const colorHex = () => getColorHex(props.note.color);

  return (
    <>
      <div
        class="break-inside-avoid mb-4 rounded-lg p-3 cursor-pointer shadow-sm hover:shadow-md transition-shadow relative group"
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
          <div
            class="fixed inset-0 z-10"
            onClick={(e) => {
              e.stopPropagation();
              setShowColorPicker(false);
            }}
          />
          <div class="absolute top-1 right-7 z-20">
            <ColorPicker
              selected={props.note.color}
              onChange={handleChangeColor}
            />
          </div>
        </Show>

        <h3 class="font-semibold text-sm mb-1 truncate text-gray-800">
          {props.note.title || "无标题"}
        </h3>

        <p class="text-xs text-gray-600 line-clamp-3 leading-relaxed">
          {preview()}
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
            弹出窗口
          </button>
          <button
            class="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700"
            onClick={() => {
              setShowMenu(false);
              setShowColorPicker(true);
            }}
          >
            更换颜色
          </button>
          <div class="border-t border-gray-100 my-0.5" />
          <button
            class="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600"
            onClick={() => { setShowConfirm(true); }}
          >
            删除
          </button>
        </div>
      </Show>

      <Show when={showConfirm()}>
        <ConfirmDialog
          message="删除这条便签？此操作无法撤销。"
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      </Show>
    </>
  );
}
