import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import type { Editor } from "@tiptap/core";
// Deep import: the "lucide-solid" barrel pulls ~3500 icon modules in dev.
import ImageIcon from "lucide-solid/icons/image";
import { insertImageFromBlob } from "../lib/insertImageFromBlob";

interface NoteToolbarProps {
  editor: Editor | undefined | null;
  noteId: string;
}

export default function NoteToolbar(props: NoteToolbarProps) {
  // TipTap state is not reactive for Solid; bump a version signal on every
  // editor transaction so isActive() re-evaluates.
  const [version, setVersion] = createSignal(0);
  createEffect(() => {
    const ed = props.editor;
    if (!ed) return;
    const bump = () => setVersion((v) => v + 1);
    ed.on("transaction", bump);
    onCleanup(() => ed.off("transaction", bump));
  });

  const isActive = (name: string) => {
    version();
    return props.editor?.isActive(name) ?? false;
  };

  const btnClass = (active: boolean) =>
    `px-1.5 py-0.5 text-xs rounded ${
      active ? "bg-gray-200 text-gray-900" : "text-gray-500 hover:bg-gray-100"
    }`;

  // Defensive: each onClick guards so a stale click event can't dereference
  // a torn-down editor.
  const run = (fn: (e: Editor) => void) => () => {
    if (!props.editor) return;
    fn(props.editor);
  };

  let fileInputRef: HTMLInputElement | undefined;

  const handleFileChange = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const files = input.files;
    if (!files || !props.editor) return;
    for (const file of Array.from(files)) {
      void insertImageFromBlob(props.editor, file, props.noteId);
    }
    // Allow re-selecting the same file later (otherwise the change event
    // would not fire when the user picks the same path twice).
    input.value = "";
  };

  return (
    <Show when={props.editor}>
      <div class="flex gap-0.5 mb-2 flex-wrap items-center">
        <button
          class={btnClass(isActive("bold"))}
          onClick={run((e) => e.chain().focus().toggleBold().run())}
        >
          <b>B</b>
        </button>
        <button
          class={btnClass(isActive("italic"))}
          onClick={run((e) => e.chain().focus().toggleItalic().run())}
        >
          <i>I</i>
        </button>
        <button
          class={btnClass(isActive("underline"))}
          onClick={run((e) => e.chain().focus().toggleUnderline().run())}
        >
          <u>U</u>
        </button>
        <button
          class={btnClass(isActive("strike"))}
          onClick={run((e) => e.chain().focus().toggleStrike().run())}
        >
          <s>S</s>
        </button>
        <span class="w-px bg-gray-200 mx-0.5" />
        <button
          class={btnClass(isActive("bulletList"))}
          onClick={run((e) => e.chain().focus().toggleBulletList().run())}
        >
          • List
        </button>
        <button
          class={btnClass(isActive("orderedList"))}
          onClick={run((e) => e.chain().focus().toggleOrderedList().run())}
        >
          1. List
        </button>
        <span class="w-px bg-gray-200 mx-0.5" />
        <button
          class={btnClass(false)}
          onClick={() => fileInputRef?.click()}
          title="插入图片"
          aria-label="插入图片"
        >
          <ImageIcon size={14} />
        </button>
        <input
          ref={fileInputRef!}
          type="file"
          accept="image/*"
          class="hidden"
          onChange={handleFileChange}
        />
      </div>
    </Show>
  );
}
