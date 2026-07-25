import type { Editor } from "@tiptap/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { saveAttachment } from "./invoke";
import { pastedFilename } from "./pastedFilename";

/**
 * Upload `blob` to the note's attachments directory, then insert it as
 * an inline image at the editor's current cursor position. Returns false
 * on failure so callers can surface the error to the user.
 */
export async function insertImageFromBlob(
  editor: Editor,
  blob: Blob,
  noteId: string
): Promise<boolean> {
  if (!blob.type.startsWith("image/")) return true;

  const fileName = pastedFilename(blob.type);
  try {
    const buffer = await blob.arrayBuffer();
    const savedPath = await saveAttachment(noteId, fileName, new Uint8Array(buffer));
    const src = convertFileSrc(savedPath);
    editor.commands.setImage({ src, alt: "" });
    return true;
  } catch (e) {
    console.error("[insertImageFromBlob] failed:", e);
    return false;
  }
}
