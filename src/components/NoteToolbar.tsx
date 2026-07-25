import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import type { Editor } from "@tiptap/core";
// Deep imports: the "lucide-solid" barrel pulls ~3500 icon modules in dev.
import Bold from "lucide-solid/icons/bold";
import Italic from "lucide-solid/icons/italic";
import UnderlineIcon from "lucide-solid/icons/underline";
import Strikethrough from "lucide-solid/icons/strikethrough";
import List from "lucide-solid/icons/list";
import ListOrdered from "lucide-solid/icons/list-ordered";
import ImageIcon from "lucide-solid/icons/image";
import { insertImageFromBlob } from "../lib/insertImageFromBlob";

interface NoteToolbarProps {
  editor: Editor | undefined | null;
  noteId: string;
  onImageError?: (msg: string) => void;
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
    `p-1 rounded-sm transition-colors ${
      active ? "bg-black/10 text-ink" : "text-ink/50 hover:bg-black/5 hover:text-ink"
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
    const blobs = Array.from(files);
    // Allow re-selecting the same file later (otherwise the change event
    // would not fire when the user picks the same path twice).
    input.value = "";
    void (async () => {
      let failed = 0;
      for (const file of blobs) {
        if (!props.editor) return;
        const ok = await insertImageFromBlob(props.editor, file, props.noteId);
        if (!ok) failed++;
      }
      if (failed > 0) props.onImageError?.(`${failed} 张图片插入失败，请重试。`);
    })();
  };

  return (
    <Show when={props.editor}>
      <div class="flex gap-0.5 mb-2 flex-wrap items-center">
        <button
          class={btnClass(isActive("bold"))}
          onClick={run((e) => e.chain().focus().toggleBold().run())}
          title="加粗"
          aria-label="加粗"
        >
          <Bold size={15} />
        </button>
        <button
          class={btnClass(isActive("italic"))}
          onClick={run((e) => e.chain().focus().toggleItalic().run())}
          title="斜体"
          aria-label="斜体"
        >
          <Italic size={15} />
        </button>
        <button
          class={btnClass(isActive("underline"))}
          onClick={run((e) => e.chain().focus().toggleUnderline().run())}
          title="下划线"
          aria-label="下划线"
        >
          <UnderlineIcon size={15} />
        </button>
        <button
          class={btnClass(isActive("strike"))}
          onClick={run((e) => e.chain().focus().toggleStrike().run())}
          title="删除线"
          aria-label="删除线"
        >
          <Strikethrough size={15} />
        </button>
        <span class="w-px h-4 bg-black/10 mx-1" />
        <button
          class={btnClass(isActive("bulletList"))}
          onClick={run((e) => e.chain().focus().toggleBulletList().run())}
          title="无序列表"
          aria-label="无序列表"
        >
          <List size={15} />
        </button>
        <button
          class={btnClass(isActive("orderedList"))}
          onClick={run((e) => e.chain().focus().toggleOrderedList().run())}
          title="有序列表"
          aria-label="有序列表"
        >
          <ListOrdered size={15} />
        </button>
        <span class="w-px h-4 bg-black/10 mx-1" />
        <button
          class={btnClass(false)}
          onClick={() => fileInputRef?.click()}
          title="插入图片"
          aria-label="插入图片"
        >
          <ImageIcon size={15} />
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
