import type { Editor } from "@tiptap/core";
import { Image as ImageIcon } from "lucide-solid";
import { insertImageFromBlob } from "../lib/insertImageFromBlob";

interface NoteToolbarProps {
  editor: Editor | undefined | null;
  noteId: string;
}

export default function NoteToolbar(props: NoteToolbarProps) {
  const btnClass = (active: boolean) =>
    `px-1.5 py-0.5 text-xs rounded ${
      active ? "bg-gray-200 text-gray-900" : "text-gray-500 hover:bg-gray-100"
    }`;

  // Defensive: the early-return below hides the toolbar when editor is
  // missing, but each onClick also guards so a stale click event can't
  // dereference a torn-down editor.
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

  if (!props.editor) return null;

  return (
    <div class="flex gap-0.5 mb-2 flex-wrap items-center">
      <button
        class={btnClass(props.editor.isActive("bold"))}
        onClick={run((e) => e.chain().focus().toggleBold().run())}
      >
        <b>B</b>
      </button>
      <button
        class={btnClass(props.editor.isActive("italic"))}
        onClick={run((e) => e.chain().focus().toggleItalic().run())}
      >
        <i>I</i>
      </button>
      <button
        class={btnClass(props.editor.isActive("underline"))}
        onClick={run((e) => e.chain().focus().toggleUnderline().run())}
      >
        <u>U</u>
      </button>
      <button
        class={btnClass(props.editor.isActive("strike"))}
        onClick={run((e) => e.chain().focus().toggleStrike().run())}
      >
        <s>S</s>
      </button>
      <span class="w-px bg-gray-200 mx-0.5" />
      <button
        class={btnClass(props.editor.isActive("bulletList"))}
        onClick={run((e) => e.chain().focus().toggleBulletList().run())}
      >
        • List
      </button>
      <button
        class={btnClass(props.editor.isActive("orderedList"))}
        onClick={run((e) => e.chain().focus().toggleOrderedList().run())}
      >
        1. List
      </button>
      <span class="w-px bg-gray-200 mx-0.5" />
      <button
        class={btnClass(false)}
        onClick={() => fileInputRef?.click()}
        title="Insert image"
        aria-label="Insert image"
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
  );
}
