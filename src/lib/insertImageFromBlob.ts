import type { Editor } from "@tiptap/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { saveAttachment } from "./invoke";
import { pastedFilename } from "./pastedFilename";

/**
 * Upload `blob` to the note's attachments directory, then insert it as
 * an inline image at the editor's current cursor position. All errors
 * are logged to console and swallowed — failed pastes look like
 * "nothing happened", which is acceptable because nothing was inserted.
 */
export async function insertImageFromBlob(
  editor: Editor,
  blob: Blob,
  noteId: string
): Promise<void> {
  if (!blob.type.startsWith("image/")) return;

  const fileName = pastedFilename(blob.type);
  try {
    const buffer = await blob.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buffer));
    const savedPath = await saveAttachment(noteId, fileName, bytes);
    const src = convertFileSrc(savedPath);
    editor.commands.setImage({ src, alt: "" });
  } catch (e) {
    console.error("[insertImageFromBlob] failed:", e);
  }
}
