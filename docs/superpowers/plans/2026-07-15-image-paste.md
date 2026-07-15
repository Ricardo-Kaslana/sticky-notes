# Image Paste UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `saveAttachment` Rust command and TipTap `Image` extension to three front-end entry points (Ctrl+V paste, drag-drop, toolbar button) so users can attach images to notes.

**Architecture:** Three handler paths funnel through one `insertImageFromBlob(editor, blob, noteId)` helper. That helper calls the existing `saveAttachment` IPC, then inserts an inline image via `editor.commands.setImage({ src: convertFileSrc(path) })`. Tauri `assetProtocol` is enabled, scoped to the attachments directory.

**Tech Stack:** Existing — TipTap 2.x, SolidJS 1.x, Tauri 2.x. New — `lucide-solid` for the toolbar icon.

**Branch policy:** Work directly on `master` — matches the project's small-commit cadence.

---

## Global Constraints

- `pastedFilename` is a pure function in `src/lib/pastedFilename.ts`; tested with 7 unit tests.
- `insertImageFromBlob` is exported from `src/lib/insertImageFromBlob.ts`; not unit-tested this round (DOM- and TipTap-bound).
- All three handler paths (paste / drop / toolbar file picker) call the same `insertImageFromBlob`.
- Failure to upload is silent (console.error only). No toast, no banner.
- Asset protocol is scoped to `$APPDATA/attachments/**` — no broader.
- `delete_attachment` stays `#[allow(dead_code)]` and out of `invoke_handler!` (not in scope).
- All steps must pass `npx tsc --noEmit`, `npm test`, and `cd src-tauri && cargo test` before commit.

---

## Task 1: Install lucide-solid and verify

**Files:**
- Modify: `package.json`, `package-lock.json`

**Steps:**

1. Install:

```sh
npm install lucide-solid@^0.4
```

(Pick the version range that matches the latest stable on npm at the
time — the caret allows patch upgrades.)

2. Sanity-check the import path:

```sh
node -e "console.log(Object.keys(require('lucide-solid')).slice(0, 5))"
```

Expect to see an array of icon component names. If this errors
("Cannot find module"), abort and pick a different version.

3. Verify `tsc` still passes:

```sh
npx tsc --noEmit
```

Expect no errors (no source file imports `lucide-solid` yet, so this
is a smoke test).

4. Commit:

```sh
git add package.json package-lock.json
git commit -m "chore: add lucide-solid for toolbar icon"
```

---

## Task 2: `pastedFilename` pure function + TDD tests

**Files:**
- Create: `src/lib/pastedFilename.ts`
- Create: `src/lib/pastedFilename.test.ts`

**Steps:**

1. Write the failing test file `src/lib/pastedFilename.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pastedFilename } from "./pastedFilename";

describe("pastedFilename", () => {
  it("png ends with .png and starts with pasted-", () => {
    const name = pastedFilename("image/png", new Date("2026-01-01T00:00:00.000Z"));
    expect(name.startsWith("pasted-")).toBe(true);
    expect(name.endsWith(".png")).toBe(true);
  });

  it("jpeg becomes .jpg", () => {
    const name = pastedFilename("image/jpeg", new Date("2026-01-01T00:00:00.000Z"));
    expect(name.endsWith(".jpg")).toBe(true);
  });

  it("webp stays .webp", () => {
    const name = pastedFilename("image/webp", new Date("2026-01-01T00:00:00.000Z"));
    expect(name.endsWith(".webp")).toBe(true);
  });

  it("svg becomes .svg", () => {
    const name = pastedFilename("image/svg+xml", new Date("2026-01-01T00:00:00.000Z"));
    expect(name.endsWith(".svg")).toBe(true);
  });

  it("unknown mime falls back to .bin", () => {
    const name = pastedFilename("application/octet-stream", new Date("2026-01-01T00:00:00.000Z"));
    expect(name.endsWith(".bin")).toBe(true);
  });

  it("uses the injected Date for the timestamp", () => {
    const name = pastedFilename("image/png", new Date("2026-07-15T10:30:00.000Z"));
    expect(name).toContain("2026-07-15T10-30-00-000Z");
  });

  it("replaces colons in the timestamp with hyphens", () => {
    const name = pastedFilename("image/png", new Date("2026-07-15T10:30:00.000Z"));
    expect(name).not.toContain(":");
    expect(name).toContain("-10-30-00-000Z");
  });
});
```

2. Run `npm test`. Expect failure — `pastedFilename` does not exist
   yet. RED.

3. Write the implementation `src/lib/pastedFilename.ts`:

```ts
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
};

export function pastedFilename(mime: string, now: Date = new Date()): string {
  const ext = MIME_TO_EXT[mime] ?? "bin";
  // ISO 8601 with colons replaced — safe across Windows / POSIX filenames.
  const stamp = now.toISOString().replace(/:/g, "-");
  return `pasted-${stamp}.${ext}`;
}
```

4. Run `npm test`. Expect 7 tests passing (this file only — 26 total).

5. Run `npx tsc --noEmit`. Expect no errors.

6. Commit:

```sh
git add src/lib/pastedFilename.ts src/lib/pastedFilename.test.ts
git commit -m "feat: add pastedFilename pure helper for pasted image names"
```

---

## Task 3: `insertImageFromBlob` helper

This is glue code that touches TipTap and Tauri IPC. Not unit-tested
in this round per the testing spec.

**Files:**
- Create: `src/lib/insertImageFromBlob.ts`

**Steps:**

1. Write `src/lib/insertImageFromBlob.ts`:

```ts
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
```

2. Run `npx tsc --noEmit`. Expect no errors.

3. Commit:

```sh
git add src/lib/insertImageFromBlob.ts
git commit -m "feat: add insertImageFromBlob helper"
```

---

## Task 4: NoteToolbar gains image button + hidden file input

**Files:**
- Modify: `src/components/NoteToolbar.tsx`

**Steps:**

1. Replace `src/components/NoteToolbar.tsx` contents:

```tsx
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
    input.value = ""; // allow re-selecting the same file later
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
```

2. Update the `NoteToolbar` call site in `src/routes/NoteView.tsx`:

Find the existing:
```tsx
<NoteToolbar editor={editor ?? null} />
```

Replace with:
```tsx
<NoteToolbar editor={editor ?? null} noteId={props.noteId} />
```

3. Run `npx tsc --noEmit`. Expect no errors.

4. Commit:

```sh
git add src/components/NoteToolbar.tsx src/routes/NoteView.tsx
git commit -m "feat: add image button + hidden file input to NoteToolbar

Toolbar now imports lucide-solid's Image icon and renders it as a
new button. Click triggers a hidden <input type=\"file\" accept=
\"image/*\">. The change event funnels through insertImageFromBlob
which uploads to saveAttachment and inserts via setImage.

NoteToolbarProps gained a required noteId prop; NoteView passes it
through."
```

---

## Task 5: TipTap `handlePaste` and `handleDrop` in NoteView

**Files:**
- Modify: `src/routes/NoteView.tsx`

**Steps:**

1. In `src/routes/NoteView.tsx`, add the import near the top of the
   file (after the existing TipTap imports):

```ts
import { insertImageFromBlob } from "../lib/insertImageFromBlob";
```

2. Modify the TipTap `Editor` instantiation in `onMount`. Find the
   existing:

```tsx
editorProps: {
  attributes: { class: "prose prose-sm max-w-none outline-none" },
},
```

Replace with:

```tsx
editorProps: {
  attributes: { class: "prose prose-sm max-w-none outline-none" },
  handlePaste: (view, event) => {
    const items = event.clipboardData?.items;
    if (!items) return false;
    const blobs: Blob[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const blob = item.getType(item.type);
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
  handleDrop: (view, event, _slice, moved) => {
    if (moved) return false;
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return false;
    const blobs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (blobs.length === 0) return false;
    event.preventDefault();
    if (!editor) return true;
    for (const blob of blobs) {
      void insertImageFromBlob(editor, blob, props.noteId);
    }
    return true;
  },
},
```

3. Run `npx tsc --noEmit`. Expect no errors.

4. Commit:

```sh
git add src/routes/NoteView.tsx
git commit -m "feat: handle paste and drop of image files in NoteView

Two new editorProps handlers intercept paste and drop events on
the TipTap editor, extract any image Blob from the event, and
funnel each through insertImageFromBlob. Non-image pastes and
internal drags fall through to TipTap's default behaviour by
returning false."
```

---

## Task 6: Enable asset protocol in tauri.conf.json

**Files:**
- Modify: `src-tauri/tauri.conf.json`

**Steps:**

1. Find the existing `security` block:

```json
"security": {
  "csp": null
}
```

Replace with:

```json
"security": {
  "csp": null,
  "assetProtocol": {
    "enable": true,
    "scope": ["$APPDATA/attachments/**"]
  }
}
```

2. Validate the JSON is still well-formed:

```sh
node -e "console.log(JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json','utf8')).app.security.assetProtocol.scope)"
```

Expect: `[ '$APPDATA/attachments/**' ]`

3. Run `cd src-tauri && cargo check`. Expect no errors. The
   asset-protocol change is read by `tauri::generate_context!()` at
   compile time.

4. Commit:

```sh
git add src-tauri/tauri.conf.json
git commit -m "feat: enable Tauri asset protocol scoped to attachments dir

Without this, the webview cannot load <img src=\"asset://...\">
URLs returned by convertFileSrc. Scope is restricted to the
attachments subdirectory under app_data so the webview cannot
pull arbitrary local files."
```

---

## Task 7: Version bump, CHANGELOG, README

**Files:**
- Modify: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`
- Modify: `CHANGELOG.md`
- Modify: `README.md`

**Steps:**

1. Bump versions from `0.1.3` → `0.1.4` in three files:

```sh
# package.json
(Get-Content package.json) -replace '"version": "0.1.3"', '"version": "0.1.4"' | Set-Content package.json

# src-tauri/Cargo.toml
(Get-Content src-tauri/Cargo.toml) -replace 'version = "0.1.3"', 'version = "0.1.4"' | Set-Content src-tauri/Cargo.toml

# src-tauri/tauri.conf.json
(Get-Content src-tauri/tauri.conf.json) -replace '"version": "0.1.3"', '"version": "0.1.4"' | Set-Content src-tauri/tauri.conf.json
```

2. Prepend a `## [0.1.4]` section to `CHANGELOG.md` (insert between
   the file header and `## [0.1.3]`). The new section:

```markdown
## [0.1.4] — 2026-07-15

### Added

- **Image paste / drop / insert via toolbar** — three entry points
  (Ctrl+V, file drag, toolbar button) all funnel through
  `insertImageFromBlob`. The blob is uploaded via the existing
  `save_attachment` Rust command and inserted as an inline `<img>`
  using `convertFileSrc` to map the local path into an `asset://`
  URL the Tauri webview can load.
- **`pastedFilename(mime, now?)`** — pure helper for collision-
  resistant image filenames (`pasted-<ISO timestamp>.<ext>`).
  Extracted so the timestamp logic is unit-testable.
- **`lucide-solid`** dependency for the toolbar image button icon.
- **Tauri `assetProtocol`** enabled, scoped to
  `$APPDATA/attachments/**` so the webview can only load files
  written by `save_attachment`, not arbitrary disk paths.

### Tests

- 7 new unit tests for `pastedFilename` (png/jpeg/webp/svg/unknown
  mime + injected Date + colon replacement).
- 26 frontend tests total, all passing.

```

3. Update `README.md` Features section — add one bullet:

```markdown
- **Image paste / drop / insert via toolbar** — saved to `attachments/<uuid>/` and rendered as inline `<img>` via `asset://`
```

Find the existing Features list and insert this bullet. Existing
bullets use the same `**Bold** — description` format.

4. Run final verification:

```sh
npx tsc --noEmit
npm test
cd src-tauri && cargo test
```

All three must be clean.

5. Commit:

```sh
git add -A package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json CHANGELOG.md README.md
git commit -m "chore: bump to v0.1.4 — image paste UI"
```

---

## Verification

After all seven tasks:

- `npx tsc --noEmit` — clean
- `npm test` — 26 tests, 0 failures (7 new pastedFilename + 19 existing)
- `cd src-tauri && cargo test` — 9 tests, 0 failures (unchanged)
- `git log --oneline 9c2bafb..HEAD` shows 7 commits

---

## Self-Review

**Spec coverage:** §4 interface (pastedFilename signature, insertImageFromBlob signature, editorProps handlers, toolbar additions, tauri.conf.json) maps 1:1 to tasks. §6 test cases (7 for pastedFilename) match Task 2. §9 (version bump, CHANGELOG, README) is Task 7.

**Placeholder scan:** No TBDs. Every code block is complete and runnable. Task 1 step 2 includes a smoke-test command to detect a bad lucide-solid install before proceeding.

**Type consistency:** `pastedFilename(mime: string, now?: Date): string` matches across spec §4, test file, and implementation. `insertImageFromBlob(editor: Editor, blob: Blob, noteId: string): Promise<void>` matches across spec §4, NoteView handler call sites, and NoteToolbar handler call site. `NoteToolbarProps.editor` and `NoteToolbarProps.noteId` are both required — TS will catch any missed call site.

**TDD discipline:** Tasks 2 follows RED → GREEN → commit. Tasks 1, 3, 4, 5, 6, 7 are setup / wiring / docs and don't have meaningful unit-test coverage of their own (handler logic is DOM- and TipTap-bound, deferred to a future component-testing round per the v0.1.3 testing spec).
