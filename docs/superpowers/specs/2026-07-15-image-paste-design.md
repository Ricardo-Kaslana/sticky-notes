# Image Paste UI — Design Spec

**Date:** 2026-07-15
**Status:** Approved (post-brainstorm)

Adds the missing UI surface for the v0.1.0 image-paste feature that was
already wired at the data layer: TipTap `Image` is configured, Rust
`save_attachment` exists, `saveAttachment` invoke wrapper exists, but
no front-end handler or button ever called them.

---

## 1. Motivation

`save_attachment` and `delete_attachment` were the last pieces of the
image-paste feature left without a front-end entry point. The TipTap
`Image` extension has been configured since v0.1.0 (`inline: true`,
`NoteView.tsx:87`) but with no `handlePaste`, `handleDrop`, or
toolbar button, users can only insert images by editing the note
JSON on disk.

This spec adds the three input surfaces (paste / drop / toolbar
button) and the asset-protocol plumbing needed to render local files
inside the Tauri webview.

---

## 2. Scope

In scope:

- TipTap `handlePaste` interception: paste images from clipboard into
  the editor.
- TipTap `handleDrop` interception: drop image files onto the editor.
- Toolbar button (lucide `Image` icon) that opens a hidden
  `<input type="file" accept="image/*">`.
- Tauri asset protocol enabled in `tauri.conf.json`, scoped to the
  app-data attachments directory.
- A new pure helper `pastedFilename(mime, now?)` with unit tests.
- An internal `insertImageFromBlob(editor, blob, noteId)` helper that
  all three handlers funnel through.
- CHANGELOG v0.1.4 entry, AGENTS.md note about the new capability.

Out of scope:

- Image compression / format conversion / dimension capping.
- Editing or deleting already-inserted images from the UI (the
  underlying `delete_attachment` Rust command stays reserved).
- A dedicated attachment browser / management panel.
- Drag-drop *into* the management view (note cards); this is a
  floating-window editor feature only.
- Mobile / touch long-press paste (no touch UI today).

---

## 3. Architecture

```
NoteView.tsx (floating window)
├── TipTap Editor
│   ├── StarterKit + Underline + Link + Image.configure({ inline: true })
│   ├── editorProps.handlePaste  ──┐
│   ├── editorProps.handleDrop   ──┼─→ insertImageFromBlob(blob, noteId)
│   └── toolbar (existing)       ──┘
│        ├── + new image-icon button
│        │   ↓ click
│        └── hidden <input type="file" accept="image/*" />
│             └── change ────────→ insertImageFromBlob(file, noteId)
└── …
      │
      ▼
src/lib/pastedFilename.ts        (NEW) pure function
src/lib/pastedFilename.test.ts   (NEW) unit tests
      │
      ▼
src/lib/invoke.ts                (existing) saveAttachment()
      │
      ▼
Tauri IPC → Rust save_attachment
      │
      ▼
app_data/attachments/<noteId>/pasted-<timestamp>.<ext>
      │
      ▼ (returns absolute path)
convertFileSrc(path) → asset://localhost/...
      │
      ▼
editor.commands.setImage({ src: "asset://..." })
```

---

## 4. Interface

### `src/lib/pastedFilename.ts`

```ts
/**
 * Generate a deterministic, collision-resistant file name for an image
 * pasted into or dropped onto a note. The timestamp is milliseconds since
 * the Unix epoch — vanishingly unlikely to collide inside one user session.
 *
 * @param mime e.g. "image/png". If not a recognised image MIME, the
 *   extension defaults to ".bin".
 * @param now  defaults to `new Date()`; injected in tests.
 */
export function pastedFilename(mime: string, now?: Date): string;
```

Format: `pasted-<ISO timestamp with colons replaced by hyphens>.<ext>`.

Examples:
- `pastedFilename("image/png")` → `"pasted-2026-07-15T10-30-00-123Z.png"`
- `pastedFilename("image/jpeg")` → `"pasted-2026-07-15T10-30-00-123Z.jpg"`
- `pastedFilename("image/svg+xml")` → `"pasted-2026-07-15T10-30-00-123Z.svg"`
- `pastedFilename("application/octet-stream")` → `"pasted-...bin"`

### Internal `insertImageFromBlob` (not exported)

Lives in `NoteView.tsx`. Signature:

```ts
async function insertImageFromBlob(editor: Editor, blob: Blob, noteId: string): Promise<void>
```

Behaviour:
1. Reads the blob's MIME via `blob.type`. If empty, returns silently
   (TipTap's default paste handler takes over for non-image data).
2. Generates `pastedFilename(mime, new Date())`.
3. Converts blob to `Uint8Array`, then to a `number[]` for the
   existing `saveAttachment(noteId, fileName, data: number[])`
   signature.
4. Awaits `saveAttachment`. On failure, `console.error` and return —
   the user sees no image inserted.
5. On success, runs `editor.commands.setImage({ src: convertFileSrc(savedPath), alt: "" })`
   which inserts an inline `<img>` at the current cursor position.

### `editorProps`

```ts
editorProps: {
  attributes: { class: "prose prose-sm max-w-none outline-none" },
  handlePaste: (view, event) => {
    const items = event.clipboardData?.items;
    if (!items) return false; // let default handler run
    const blobs: Blob[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const blob = item.getType(item.type);
        if (blob) blobs.push(blob);
      }
    }
    if (blobs.length === 0) return false; // not an image paste
    event.preventDefault();
    void Promise.all(blobs.map((b) => insertImageFromBlob(editor, b, props.noteId)));
    return true;
  },
  handleDrop: (view, event, _slice, moved) => {
    if (moved) return false; // internal drag, let default run
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return false;
    const blobs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (blobs.length === 0) return false;
    event.preventDefault();
    void Promise.all(blobs.map((b) => insertImageFromBlob(editor, b, props.noteId)));
    return true;
  },
}
```

Returning `true` from a TipTap handler tells TipTap "I handled this,
don't run the default." Returning `false` lets the default run. This
matters because non-image pastes (text, HTML) must still work.

### Toolbar additions

A new icon button after the list buttons. The component `NoteToolbar`
does not import lucide today; we add the dependency in this spec.

Button:
```tsx
<button
  class={btnClass(false)}
  onClick={() => fileInputRef?.click()}
  title="Insert image"
>
  <Image size={14} />
</button>
<input
  ref={fileInputRef!}
  type="file"
  accept="image/*"
  class="hidden"
  onChange={(e) => {
    const files = e.currentTarget.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      void insertImageFromBlob(props.editor!, file, props.noteId);
    }
    e.currentTarget.value = ""; // allow re-selecting the same file
  }}
/>
```

The toolbar needs access to `noteId` and the hidden file input ref.
`NoteToolbarProps` gains:

```ts
interface NoteToolbarProps {
  editor: Editor | undefined | null;
  noteId: string;
}
```

The hidden input lives in the toolbar so its lifecycle ties to the
toolbar's. `NoteView` passes `noteId` down.

`insertImageFromBlob` lives in `NoteView.tsx` and is exported to the
toolbar via a small helper module (`src/lib/insertImageFromBlob.ts`)
so the toolbar doesn't have to take the entire `editor` closure.

Wait — the toolbar already receives `editor`. So:

```ts
// src/lib/insertImageFromBlob.ts
import type { Editor } from "@tiptap/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { saveAttachment } from "./invoke";
import { pastedFilename } from "./pastedFilename";

export async function insertImageFromBlob(
  editor: Editor,
  blob: Blob,
  noteId: string
): Promise<void> { ... }
```

Both `NoteView` and `NoteToolbar` import this. Cleaner than passing
the function as a prop.

### `tauri.conf.json` asset protocol

```json
"security": {
  "csp": null,
  "assetProtocol": {
    "enable": true,
    "scope": ["$APPDATA/attachments/**"]
  }
}
```

`$APPDATA` is a Tauri 2 placeholder that resolves to the same
`app_data_dir()` that `save_attachment` writes into. Scoping to
`attachments/**` blocks the webview from loading any other local
path (the user's home directory, system files, etc.) — defense in
depth on top of the Rust-side `safe_filename` guard from v0.1.2.

### `src-tauri/src/commands/attachments.rs`

No change this round. `delete_attachment` stays as
`#[allow(dead_code)]` outside the `invoke_handler!` list, exactly
as v0.1.2 left it. We are not adding a "remove image" affordance
in this spec — `insertImageFromBlob` only inserts, never deletes.

---

## 5. Dependencies

| Change | Reason |
|---|---|
| Add `lucide-solid` (or use an inline SVG) | The toolbar needs an image icon. Check what's lightest; the project has no icon library today. |

Investigation needed at plan time:
- Does the project already have an icon pattern? (Grep for SVG icons
  in components — there are a few but no library.)
- Tauri 2's `convertFileSrc` — confirm import path is
  `@tauri-apps/api/core`.

If `lucide-solid` is too heavy (it pulls a lot of icons), inline a
simple 14×14 SVG for the image button. Decision deferred to
implementation.

---

## 6. Test Cases

### `src/lib/pastedFilename.test.ts`

| # | Name | Input | Expected |
|---|---|---|---|
| 1 | `png` | `"image/png"` | ends with `.png`, starts with `pasted-` |
| 2 | `jpeg` | `"image/jpeg"` | ends with `.jpg` |
| 3 | `webp` | `"image/webp"` | ends with `.webp` |
| 4 | `svg` | `"image/svg+xml"` | ends with `.svg` |
| 5 | `unknown` | `"application/octet-stream"` | ends with `.bin` |
| 6 | `timestamp uses injected Date` | `"image/png"`, `new Date("2026-01-01T00:00:00.000Z")` | contains `2026-01-01T00-00-00-000Z` |
| 7 | `colons in timestamp are replaced` | inject `new Date("2026-07-15T10:30:00.000Z")` | contains `-10-30-00-000Z`, not `:` |

7 tests total. TipTap handler tests are out of scope (component
testing deferred per the testing spec).

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `convertFileSrc` URL encoding differs across platforms | Test in dev. Fall back to manual `pathToFileURL`-style encoding if needed. |
| Image paste takes 1-2 s because of upload roundtrip; user may try to paste again | `saveAttachment` is idempotent on the filename because the timestamp is per-millisecond. Worst case: 2 copies of the same image inserted. |
| `assetProtocol` scope too narrow — image fails to load | In the worst case, broaden to `$APPDATA/**` and document. Asset protocol failure is loud (broken `<img>` icon in editor), so easy to detect. |
| `assetProtocol` scope too broad — security regression | Stick to `$APPDATA/attachments/**`. Re-confirm with a `console.log(convertFileSrc(...))` at runtime during dev. |
| User drops a 100 MB PNG | `save_attachment` rejects at 25 MB; `console.error`. UI shows nothing — by design. |
| Image elements inserted via paste are not selected/highlighted | TipTap default `setImage` behaviour: cursor moves to after the image. Acceptable. |
| `handlePaste` returns `true` but `Promise.all` rejects later | OK — handler already returned, TipTap won't double-insert. Failures logged to console. |

---

## 8. Out of Scope, Revisit Later

- Inline image editing (resize handle, alignment toolbar, alt text
  field).
- A "remove image" affordance (`delete_attachment` is ready).
- Drag from web sources (URLs): requires CSP changes; deferred.
- Image paste into the management view card preview.

---

## 9. Version & Documentation

- Bump to **v0.1.4** in `package.json`, `src-tauri/Cargo.toml`,
  `src-tauri/tauri.conf.json`.
- New `CHANGELOG.md` `## [0.1.4]` section summarising this.
- `AGENTS.md` quick commands table — no change needed.
- `README.md` Features section: add "**Image paste / drop / insert
  via toolbar** — saved to `attachments/<uuid>/`" line.

