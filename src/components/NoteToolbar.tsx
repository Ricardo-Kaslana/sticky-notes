import type { Editor } from "@tiptap/core";

interface NoteToolbarProps {
  editor: Editor | undefined | null;
}

export default function NoteToolbar(props: NoteToolbarProps) {
  const btnClass = (active: boolean) =>
    `px-1.5 py-0.5 text-xs rounded ${
      active ? "bg-gray-200 text-gray-900" : "text-gray-500 hover:bg-gray-100"
    }`;

  if (!props.editor) return null;

  return (
    <div class="flex gap-0.5 mb-2 flex-wrap">
      <button
        class={btnClass(props.editor.isActive("bold"))}
        onClick={() => props.editor!.chain().focus().toggleBold().run()}
      >
        <b>B</b>
      </button>
      <button
        class={btnClass(props.editor.isActive("italic"))}
        onClick={() => props.editor!.chain().focus().toggleItalic().run()}
      >
        <i>I</i>
      </button>
      <button
        class={btnClass(props.editor.isActive("underline"))}
        onClick={() => props.editor!.chain().focus().toggleUnderline().run()}
      >
        <u>U</u>
      </button>
      <button
        class={btnClass(props.editor.isActive("strike"))}
        onClick={() => props.editor!.chain().focus().toggleStrike().run()}
      >
        <s>S</s>
      </button>
      <span class="w-px bg-gray-200 mx-0.5" />
      <button
        class={btnClass(props.editor.isActive("bulletList"))}
        onClick={() => props.editor!.chain().focus().toggleBulletList().run()}
      >
        • List
      </button>
      <button
        class={btnClass(props.editor.isActive("orderedList"))}
        onClick={() => props.editor!.chain().focus().toggleOrderedList().run()}
      >
        1. List
      </button>
    </div>
  );
}
