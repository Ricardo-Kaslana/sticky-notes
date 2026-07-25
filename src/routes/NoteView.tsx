import { createSignal, createEffect, Show, onMount, onCleanup } from "solid-js";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { getCurrentWindow } from "@tauri-apps/api/window";
// Deep import: the "lucide-solid" barrel pulls ~3500 icon modules in dev.
import Trash2 from "lucide-solid/icons/trash-2";
import type { Note, ColorKey } from "../lib/types";
import * as api from "../lib/invoke";
import { emitNoteUpdated } from "../lib/events";
import { COLORS, getColorHex } from "../lib/types";
import NoteToolbar from "../components/NoteToolbar";
import TagInput from "../components/TagInput";
import ConfirmDialog from "../components/ConfirmDialog";
import { debounce } from "../utils/debounce";
import { insertImageFromBlob } from "../lib/insertImageFromBlob";

export default function NoteView(props: { noteId: string }) {
  const [note, setNote] = createSignal<Note | null>(null);
  const [title, setTitle] = createSignal("");
  const [tags, setTags] = createSignal<string[]>([]);
  const [color, setColor] = createSignal<ColorKey>("paper");
  const [pinned, setPinned] = createSignal(false);
  const [showColorPicker, setShowColorPicker] = createSignal(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [editorReady, setEditorReady] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  let editorContainer!: HTMLDivElement;
  let editor: Editor | undefined;

  // Build a Note update object from current editor/signal state
  const buildNoteUpdate = (): Note | null => {
    const current = note();
    if (!current || !editor) return null;
    return {
      ...current,
      title: title(),
      content: editor.getHTML(),
      tags: tags(),
      color: color(),
      pinned: pinned(),
      updatedAt: new Date().toISOString(),
    };
  };

  // Save the full current state (including window rect) immediately.
  const saveNow = async () => {
    const updated = buildNoteUpdate();
    if (!updated) return;
    try {
      const win = getCurrentWindow();
      const [pos, size, sf] = await Promise.all([
        win.outerPosition(),
        win.outerSize(),
        win.scaleFactor(),
      ]);
      if (sf > 0) {
        updated.position = {
          x: pos.x / sf,
          y: pos.y / sf,
          width: size.width / sf,
          height: size.height / sf,
        };
      }
    } catch (e) {
      console.error("Failed to capture window position:", e);
    }
    try {
      await api.writeNote(updated.id, updated);
      emitNoteUpdated(updated);
    } catch (e) {
      console.error("Failed to save note:", e);
    }
  };

  // Debounced auto-save. Interval is re-created from settings once loaded.
  let autoSave = debounce(saveNow, 2000);
  onMount(() => {
    api
      .readSettings()
      .then((s) => {
        if (s.autoSaveIntervalMs >= 500) {
          autoSave = debounce(saveNow, s.autoSaveIntervalMs);
        }
      })
      .catch((e) => console.error("[NoteView] failed to read settings:", e));
  });

  // Create editor after DOM mounts
  onMount(() => {
    if (!editorContainer) {
      setError("Editor container not found");
      return;
    }

    try {
      editor = new Editor({
        element: editorContainer,
        extensions: [
          StarterKit,
          Underline,
          Link.configure({ openOnClick: false }),
          Image.configure({ inline: true }),
          Placeholder.configure({ placeholder: "开始写..." }),
        ],
        editorProps: {
          attributes: { class: "prose prose-sm max-w-none outline-none" },
          handlePaste: (_view, event) => {
            const items = event.clipboardData?.items;
            if (!items) return false;
            const blobs: Blob[] = [];
            for (const item of Array.from(items)) {
              if (item.kind === "file" && item.type.startsWith("image/")) {
                const blob = item.getAsFile();
                if (blob) blobs.push(blob);
              }
            }
            if (blobs.length === 0) return false;
            event.preventDefault();
            if (!editor) return true;
            for (const blob of blobs) {
              void insertImageFromBlob(editor, blob, props.noteId);
            }
            return true;
          },
          handleDrop: (_view, event, _slice, moved) => {
            if (moved) return false;
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return false;
            const blobs = Array.from(files).filter((f) =>
              f.type.startsWith("image/")
            );
            if (blobs.length === 0) return false;
            event.preventDefault();
            if (!editor) return true;
            for (const blob of blobs) {
              void insertImageFromBlob(editor, blob, props.noteId);
            }
            return true;
          },
        },
        onUpdate: () => {
          autoSave();
        },
      });
      setEditorReady(true);
    } catch (e) {
      console.error("[NoteView] Failed to create editor:", e);
      setError(`Failed to create editor: ${e}`);
    }
  });

  // Load note data: fetch starts immediately (parallel with editor
  // creation); applying it waits for the editor to be ready.
  const noteFetch = api.readNote(props.noteId);
  createEffect(() => {
    const ready = editorReady();
    if (!ready) return;

    noteFetch.then((data) => {
      setNote(data);
      setTitle(data.title);
      setTags(data.tags);
      setColor(data.color);
      setPinned(data.pinned);
      if (editor) {
        editor.commands.setContent(data.content);
      }
    }).catch((e) => {
      console.error("[NoteView] Failed to load note:", e);
      setError(`Failed to load note: ${e}`);
    });
  });

  // Cleanup on unmount — flush any pending save so a quit/close that
  // races a debounce does not drop the user's last edits.
  onCleanup(() => {
    try {
      autoSave.flush();
    } catch (e) {
      console.error("[NoteView] flush on cleanup failed:", e);
    }
    editor?.destroy();
  });

  const handleClose = async () => {
    // Drop any pending debounced save — saveNow() below writes the latest
    // snapshot including the final window position.
    autoSave.cancel();
    try {
      await saveNow();
    } catch (e) {
      console.error("[NoteView] Failed to save on close:", e);
    }
    await api.closeNoteWindow(props.noteId);
  };

  const handlePinToggle = async () => {
    const newPinned = !pinned();
    setPinned(newPinned);
    try {
      await api.setNoteWindowPinned(props.noteId, newPinned);
      autoSave();
    } catch (e) {
      console.error("[NoteView] Failed to toggle pin:", e);
      setPinned(!newPinned);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    // A pending debounced save would re-create the file after deletion.
    autoSave.cancel();
    try {
      await api.deleteNote(props.noteId);
    } catch (e) {
      console.error("[NoteView] Failed to delete note:", e);
      return;
    }
    await api.closeNoteWindow(props.noteId);
  };

  const colorHex = () => getColorHex(color());

  return (
    <div
      class="note-window h-full flex flex-col bg-[#fafafa] select-none"
    >
      {/* Loading indicator while editor initializes */}
      <Show when={!editorReady() && !error()}>
        <div class="bg-blue-100 text-blue-700 text-xs p-2 text-center">
          编辑器初始化中…
        </div>
      </Show>

      {/* Error banner */}
      <Show when={error()}>
        <div class="bg-red-100 text-red-700 text-xs p-2 text-center">
          {error()}
        </div>
      </Show>

      {/* Header — only the middle spacer is a drag region. Buttons sit outside
          it so their click events are never consumed by a drag start. */}
      <div class="flex items-center px-4 pt-3 pb-1">
        <div class="flex gap-2">
          <button
            onClick={handlePinToggle}
            class="w-3.5 h-3.5 rounded-full"
            classList={{
              "bg-gray-300 hover:bg-gray-400": !pinned(),
              "bg-gray-600": pinned(),
            }}
            title="置顶/取消置顶"
          />
          <button
            onClick={handleClose}
            class="w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-600 border border-red-600"
            title="关闭"
          />
        </div>
        {/* Middle spacer — the sole drag region */}
        <div class="flex-1 self-stretch" data-tauri-drag-region />
        <button
          onClick={() => setShowDeleteConfirm(true)}
          class="mr-2 text-gray-400 hover:text-red-500"
          title="删除便签"
          aria-label="删除便签"
        >
          <Trash2 size={14} />
        </button>
        <button
          onClick={() => setShowColorPicker(!showColorPicker())}
          class="w-4 h-4 rounded-sm border border-gray-300"
          style={{ background: colorHex() }}
          title="更换颜色"
        />
      </div>

      {/* Color picker */}
      <Show when={showColorPicker()}>
        <div class="px-4 pb-2 flex gap-1.5">
          {COLORS.map((c) => (
            <button
              onClick={() => {
                setColor(c.key);
                setShowColorPicker(false);
                autoSave();
              }}
              class="w-5 h-5 rounded-sm border"
              classList={{ "border-gray-900": color() === c.key, "border-gray-200": color() !== c.key }}
              style={{ background: c.hex }}
              title={c.name}
            />
          ))}
        </div>
      </Show>

      {/* Title */}
      <input
        type="text"
        value={title()}
        onInput={(e) => {
          setTitle(e.currentTarget.value);
          autoSave();
        }}
        placeholder="标题"
        class="px-4 text-lg font-semibold text-gray-800 outline-none bg-transparent placeholder-gray-300"
      />

      {/* Toolbar */}
      <div class="px-4">
        <NoteToolbar editor={editorReady() ? editor ?? null : null} noteId={props.noteId} />
      </div>

      {/* Editor */}
      <div class="flex-1 px-4 pb-2 overflow-y-auto">
        <div
          ref={editorContainer!}
          class="min-h-[120px]"
        />
      </div>

      {/* Tags */}
      <div class="px-4 pb-3">
        <TagInput
          tags={tags()}
          onChange={(t) => {
            setTags(t);
            autoSave();
          }}
        />
      </div>

      {/* Left color accent border */}
      <div
        class="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: colorHex() }}
      />

      <Show when={showDeleteConfirm()}>
        <ConfirmDialog
          message="删除这条便签？此操作无法撤销。"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      </Show>
    </div>
  );
}

