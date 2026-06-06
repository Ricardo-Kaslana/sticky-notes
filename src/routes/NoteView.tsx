import { useParams } from "@solidjs/router";
import { createSignal, createEffect, Show, onMount, onCleanup } from "solid-js";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import type { Note } from "../lib/types";
import * as api from "../lib/invoke";
import { emitNoteUpdated } from "../lib/events";
import { COLORS, getColorHex } from "../lib/types";
import NoteToolbar from "../components/NoteToolbar";
import TagInput from "../components/TagInput";
import { debounce } from "../utils/debounce";

export default function NoteView() {
  const params = useParams<{ id: string }>();
  const [note, setNote] = createSignal<Note | null>(null);
  const [title, setTitle] = createSignal("");
  const [tags, setTags] = createSignal<string[]>([]);
  const [color, setColor] = createSignal("paper");
  const [pinned, setPinned] = createSignal(false);
  const [showColorPicker, setShowColorPicker] = createSignal(false);
  const [editorReady, setEditorReady] = createSignal(false);

  let editorContainer!: HTMLDivElement;
  let editor: Editor | undefined;

  // Debounced auto-save
  const autoSave = debounce(async () => {
    const current = note();
    if (!current || !editor) return;
    const updated: Note = {
      ...current,
      title: title(),
      content: editor.getHTML(),
      tags: tags(),
      color: color() as Note["color"],
      pinned: pinned(),
      updatedAt: new Date().toISOString(),
    };
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const pos = await win.outerPosition();
      const size = await win.outerSize();
      updated.position = {
        x: pos.x / await win.scaleFactor(),
        y: pos.y / await win.scaleFactor(),
        width: size.width / await win.scaleFactor(),
        height: size.height / await win.scaleFactor(),
      };
    } catch {}
    await api.writeNote(current.id, updated);
    setNote(updated);
    emitNoteUpdated(updated);
  }, 2000);

  // Create editor after DOM mounts
  onMount(() => {
    if (!editorContainer) return;

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
      },
      onUpdate: () => {
        autoSave();
      },
    });

    setEditorReady(true);
  });

  // Load note data after editor is ready
  createEffect(() => {
    if (!editorReady()) return;
    const id = params.id;
    api.readNote(id).then((data) => {
      setNote(data);
      setTitle(data.title);
      setTags(data.tags);
      setColor(data.color);
      setPinned(data.pinned);
      if (editor) editor.commands.setContent(data.content);
    });
  });

  // Cleanup on unmount
  onCleanup(() => {
    editor?.destroy();
  });

  // Handle close — save and destroy window
  const handleClose = async () => {
    autoSave.cancel();
    const current = note();
    if (current && editor) {
      const updated: Note = {
        ...current,
        title: title(),
        content: editor.getHTML(),
        tags: tags(),
        color: color() as Note["color"],
        pinned: pinned(),
        updatedAt: new Date().toISOString(),
      };
      await api.writeNote(current.id, updated);
      emitNoteUpdated(updated);
    }
    await api.closeNoteWindow(params.id);
  };

  const handlePinToggle = async () => {
    const newPinned = !pinned();
    setPinned(newPinned);
    await api.setNoteWindowPinned(params.id, newPinned);
  };

  const colorHex = () => getColorHex(color() as Note["color"]);

  return (
    <div class="note-window h-full flex flex-col bg-white select-none">
      {/* Drag handle / header */}
      <div
        class="flex items-center justify-between px-4 pt-3 pb-1"
        data-tauri-drag-region
      >
        <div class="flex gap-1.5">
          <button
            onClick={handlePinToggle}
            class="w-3 h-3 rounded-full"
            classList={{
              "bg-gray-300 hover:bg-gray-400": !pinned(),
              "bg-gray-600": pinned(),
            }}
            title="Pin / unpin"
          />
          <button
            onClick={handleClose}
            class="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500"
            title="Close"
          />
        </div>
        <button
          onClick={() => setShowColorPicker(!showColorPicker())}
          class="w-4 h-4 rounded-sm border border-gray-300"
          style={{ background: colorHex() }}
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
        onInput={(e) => setTitle(e.currentTarget.value)}
        placeholder="Title"
        class="px-4 text-lg font-semibold text-gray-800 outline-none bg-transparent placeholder-gray-300"
      />

      {/* Toolbar */}
      <div class="px-4">
        <NoteToolbar editor={editor ?? null} />
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
        <TagInput tags={tags()} onChange={setTags} />
      </div>

      {/* Left color accent border */}
      <div
        class="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: colorHex() }}
      />
    </div>
  );
}
