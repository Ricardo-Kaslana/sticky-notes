import { Note, getColorHex } from "../lib/types";
import { openNoteWindow, closeNoteWindow, writeNote, readNote } from "../lib/invoke";
import { deleteNoteById, updateNoteLocal } from "../stores/notesStore";
import { createSignal, createMemo, Show, For } from "solid-js";
import ConfirmDialog from "./ConfirmDialog";
import ColorPicker from "./ColorPicker";
// Deep imports: the "lucide-solid" barrel pulls ~3500 icon modules in dev.
import Pin from "lucide-solid/icons/pin";
import ExternalLink from "lucide-solid/icons/external-link";
import Palette from "lucide-solid/icons/palette";
import Trash2 from "lucide-solid/icons/trash-2";
import CalendarClock from "lucide-solid/icons/calendar-clock";
import { DELETE_NOTE_CONFIRM } from "../lib/uiText";
import { formatDateTime } from "../lib/formatTime";

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
    // Clamp so the menu never overflows the viewport near right/bottom edges.
    const MENU_W = 160;
    const MENU_H = 120;
    setMenuPos({
      x: Math.min(e.clientX, window.innerWidth - MENU_W),
      y: Math.min(e.clientY, window.innerHeight - MENU_H),
    });
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

  // Cheaper than DOMParser: a regex tag-strip is enough for a 3-line preview
  // and avoids constructing a full DOM tree per card on every render pass.
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").trim();

  const preview = createMemo(() => stripHtml(props.note.content));

  const colorHex = () => getColorHex(props.note.color);

  return (
    <>
      <div
        class="break-inside-avoid mb-4 rounded-md p-3 cursor-pointer shadow-card hover:shadow-pop hover:-translate-y-px transition-[box-shadow,transform] duration-150 relative group"
        style={{ background: colorHex() }}
        onDblClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Pin indicator */}
        <Show when={props.note.pinned}>
          <Pin size={12} class="absolute top-1.5 right-1.5 text-ink/40" />
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

        <h3 class="font-semibold text-sm mb-1 truncate text-ink">
          {props.note.title || "无标题"}
        </h3>

        <p class="text-xs text-ink-muted line-clamp-3 leading-relaxed">
          {preview()}
        </p>

        <Show when={props.note.tags.length > 0}>
          <div class="flex gap-1 mt-2 flex-wrap">
            <For each={props.note.tags}>
              {(tag) => (
                <span class="text-[10px] bg-black/10 px-1.5 py-0.5 rounded-full text-ink-muted">
                  {tag}
                </span>
              )}
            </For>
          </div>
        </Show>

        {/* Modification time only — this app has no notion of "last
            accessed" and must never gain one, or the grid would reorder
            itself merely because a note was opened. */}
        <div class="mt-2 pt-1.5 border-t border-black/10 text-[10px] leading-3 text-ink/50">
          <Show when={formatDateTime(props.note.updatedAt)}>
            {(updated) => (
              <span class="flex items-center gap-1" title="修改时间">
                <CalendarClock size={9} class="shrink-0" />
                <span class="truncate">修改 {updated()}</span>
              </span>
            )}
          </Show>
        </div>
      </div>

      {/* Context menu */}
      <Show when={showMenu()}>
        <div
          class="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
        <div
          class="fixed z-50 bg-panel rounded-md shadow-pop border border-line py-1 min-w-36 text-sm animate-fade-in"
          style={{ left: `${menuPos().x}px`, top: `${menuPos().y}px` }}
        >
          <button
            class="w-full text-left px-3 py-1.5 hover:bg-neutral-50 text-ink flex items-center gap-2"
            onClick={handlePopOut}
          >
            <ExternalLink size={14} class="text-ink-muted" />
            弹出窗口
          </button>
          <button
            class="w-full text-left px-3 py-1.5 hover:bg-neutral-50 text-ink flex items-center gap-2"
            onClick={() => {
              setShowMenu(false);
              setShowColorPicker(true);
            }}
          >
            <Palette size={14} class="text-ink-muted" />
            更换颜色
          </button>
          <div class="border-t border-line my-0.5" />
          <button
            class="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2"
            onClick={() => { setShowConfirm(true); }}
          >
            <Trash2 size={14} />
            删除
          </button>
        </div>
      </Show>

      <Show when={showConfirm()}>
        <ConfirmDialog
          message={DELETE_NOTE_CONFIRM}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      </Show>
    </>
  );
}
