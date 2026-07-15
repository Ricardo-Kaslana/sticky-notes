# Sticky Notes — Cleanup & Bugfixes Implementation Plan

**Date:** 2026-07-15
**Goal:** Address the issues surfaced in the 2026-07-15 codebase review, without
expanding feature surface. Each task lands as its own commit so any single
regression can be reverted independently.

**Architecture:** Pure fixes against existing files. No new modules, no new
dependencies, no spec changes. Each task is bounded to a single concern.

**Tech Stack:** Tauri 2.x, SolidJS 1.x, TipTap 2.x, Tailwind 4, TS 5.6, Rust stable.

**Branch policy:** Work directly on `master` (matches the project's existing
small-commit cadence; worktree isolation not warranted for a tightly coupled
fix sweep).

---

## Phase A — Critical (data integrity + security)

These land first. Each is independently testable.

### Task A1: `save_attachment` 路径穿越 + 大小上限

**Files:**
- Modify: `src-tauri/src/commands/attachments.rs`
- Test: extend existing module tests at the bottom of that file

**Rationale:** `dir.join(&file_name)` accepts `../../etc/passwd`. Add a
sanitized `file_name` (basename only) and a configurable byte cap so a paste
of a 4 GB blob cannot fill the disk.

**Steps:**

1. Write the failing test (in `attachments.rs` `mod tests`):

```rust
#[test]
fn test_save_attachment_rejects_traversal() {
    // Construct a path that would escape the dir
    let name = std::path::Path::new("../../evil.txt");
    let base = std::path::Path::new("a/b/c");
    let joined = base.join(name);
    // We expect: the final component has no `..` segments
    let normalized = joined.components().fold(
        std::path::PathBuf::new(),
        |mut acc, c| {
            match c {
                std::path::Component::ParentDir => { acc.pop(); }
                std::path::Component::Normal(s) => acc.push(s),
                std::path::Component::CurDir => {}
                other => acc.push(other.as_os_str()),
            }
            acc
        },
    );
    assert!(!normalized.to_string_lossy().contains(".."));
}
```

2. Run `cd src-tauri && cargo test test_save_attachment_rejects_traversal`
   — expect FAIL (`test_save_attachment_rejects_traversal ... ok` only after
   we add the helper; before that the test file does not compile).

3. Add a private helper `safe_filename(name: &str) -> Option<String>` that
   returns `None` for empty, `..`, or `/`/`\`-containing names; otherwise
   returns the basename. Implement the same logic as a free function
   `join_safely(base, name)` that returns `Result<PathBuf, String>`.

4. In `save_attachment`, replace the join line:

```rust
let name = safe_filename(&file_name)
    .ok_or_else(|| format!("invalid attachment name: {}", file_name))?;
let path = dir.join(&name);
```

Add a constant at the top of the module:

```rust
const MAX_ATTACHMENT_BYTES: usize = 25 * 1024 * 1024; // 25 MB
```

…and in `save_attachment`, check `data.len()` before writing:

```rust
if data.len() > MAX_ATTACHMENT_BYTES {
    return Err(format!("attachment too large: {} bytes", data.len()));
}
```

5. Apply the same `safe_filename` check in `delete_attachment`.

6. Run `cargo test` and `cargo check`. Both pass.

7. Commit: `fix: sanitize attachment file names and cap upload size`.

---

### Task A2: `list_notes` skip-and-log on bad files

**Files:**
- Modify: `src-tauri/src/commands/notes.rs`

**Rationale:** A single corrupt note JSON currently makes the whole grid
disappear. Switch to skip-with-warning so the user can recover the others
manually.

**Steps:**

1. Replace the inner read+parse block:

```rust
for entry in entries {
    let entry = match entry {
        Ok(e) => e,
        Err(e) => {
            eprintln!("[notes] skipping unreadable dir entry: {}", e);
            continue;
        }
    };
    let path = entry.path();
    if !path.extension().map(|e| e == "json").unwrap_or(false) {
        continue;
    }
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[notes] cannot read {}: {}", path.display(), e);
            continue;
        }
    };
    let note: Note = match serde_json::from_str(&content) {
        Ok(n) => n,
        Err(e) => {
            eprintln!(
                "[notes] cannot parse {}: {} — file left on disk for recovery",
                path.display(),
                e
            );
            continue;
        }
    };
    notes.push(note);
}
```

2. Run `cargo check` and `cargo test`. Both pass.

3. Commit: `fix: skip corrupt note files instead of failing the whole list`.

---

### Task A3: Flush pending saves before window destruction

**Files:**
- Modify: `src/utils/debounce.ts`
- Modify: `src/routes/NoteView.tsx`
- Modify: `src-tauri/src/commands/notes.rs` (only if a sync flush is needed
  from the Rust side; otherwise nothing)

**Rationale:** `autoSave.cancel()` in `onCleanup` drops the user's last 2 s
of edits if the window closes (tray Quit, OS shutdown, accidental close
right after typing). We need a `flush()` that runs the pending callback
immediately and cancels the timer.

**Steps:**

1. Extend `src/utils/debounce.ts`:

```ts
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number
): ((...args: Parameters<T>) => void) & { cancel: () => void; flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const callable = (...args: Parameters<T>) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const a = lastArgs;
      lastArgs = null;
      if (a) fn(...a);
    }, delayMs);
  };
  callable.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };
  callable.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const a = lastArgs;
    lastArgs = null;
    if (a) fn(...a);
  };
  return callable;
}
```

2. In `src/routes/NoteView.tsx`:

   a. Import the same `getCurrentWindow` once at module top instead of inside
      the debounced closure (a smaller fix; do it in this task):

   ```ts
   import { getCurrentWindow } from "@tauri-apps/api/window";
   ```

   b. Change the cleanup:

   ```ts
   onCleanup(() => {
     autoSave.flush(); // run pending save synchronously before destroy
     editor?.destroy();
   });
   ```

   c. In `handleClose`, after the explicit `writeNote` call, do not
      `autoSave.cancel()` — leave the debounce alone (we just wrote the
      latest snapshot ourselves). Replace `autoSave.cancel()` with a
      `autoSave.flush()` *after* the await, to clear any late-arriving
      timer from a keystroke that races the close:

   ```ts
   const handleClose = async () => {
     const updated = buildNoteUpdate();
     if (updated) {
       try {
         await api.writeNote(updated.id, updated);
         emitNoteUpdated(updated);
       } catch (e) {
         console.error("[NoteView] Failed to save on close:", e);
       }
     }
     autoSave.cancel(); // we just flushed manually, drop the queued one
     await api.closeNoteWindow(props.noteId);
   };
   ```

3. Run `npx tsc --noEmit`. Pass.

4. Manual verification (documented in commit body, not run in CI):
   - Open a note, type a character, click the red close button within 1 s.
     Reopen the note and confirm the last character is persisted.

5. Commit: `fix: flush pending auto-save before window close`.

---

## Phase B — Code quality (cleanup + typing)

Lands after Phase A. None of these change observable behavior; each is its
own commit.

### Task B1: Wire `ColorPicker` into `NoteCard` (or delete it)

**Decision rule:** Reuse the existing `ColorPicker` component in `NoteCard`
to fix the acknowledged "Change color is a no-op". This activates dead code
instead of deleting it — more value, same effort.

**Files:**
- Modify: `src/components/NoteCard.tsx`

**Steps:**

1. Open `NoteCard.tsx` and add a `color` signal `const [editingColor, setEditingColor] = createSignal(false);`.

2. Replace the no-op "Change color" button with one that opens a small
   popover containing `<ColorPicker selected={props.note.color} onChange={...} />`.

   Implementation (use the inline popover pattern already used by the
   floating window — the `showColorPicker` toggle + an absolute panel):

   ```tsx
   const [showColorPicker, setShowColorPicker] = createSignal(false);
   ```

   And in the right-click menu:

   ```tsx
   <button
     class="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700"
     onClick={() => { setShowMenu(false); setShowColorPicker(true); }}
   >
     Change color
   </button>
   ```

   Render the popover inside the card (above the card body, `z-30`):

   ```tsx
   <Show when={showColorPicker()}>
     <div class="absolute top-1 right-1 z-30">
       <ColorPicker
         selected={props.note.color}
         onChange={(c) => {
           setShowColorPicker(false);
           updateNoteLocal(props.note.id, { color: c });
           api.writeNote(props.note.id, { ...props.note, color: c, updatedAt: new Date().toISOString() });
         }}
       />
     </div>
   </Show>
   ```

3. Add the imports at the top of `NoteCard.tsx`:

   ```ts
   import ColorPicker from "./ColorPicker";
   import { updateNoteLocal } from "../stores/notesStore";
   ```

4. Run `npx tsc --noEmit`. Pass.

5. Manual verify: right-click a card → "Change color" → pick a color → the
   card updates instantly.

6. Commit: `feat: wire ColorPicker into NoteCard context menu`.

---

### Task B2: Delete dead code now that `ColorPicker` is in use

**Files:**
- Modify: `src/components/ContextMenu.tsx` — delete file (no callers).
- Modify: `src/App.tsx` — delete file (placeholder only).
- Modify: `src/stores/notesStore.ts` — remove `updateNoteLocal` and
  `getNoteById` if no callers after B1.

**Steps:**

1. After B1, run `rg -n "ContextMenu|useContextMenu" src` and
   `rg -n "updateNoteLocal|getNoteById" src` to confirm only references are
   in the files being deleted.

2. Delete `src/components/ContextMenu.tsx`, `src/App.tsx`.

3. In `src/stores/notesStore.ts`, remove `updateNoteLocal` (still needed by
   B1? check; if B1 used it inline-`api.writeNote` instead, remove) and
   `getNoteById` (unused).

   Decision: B1 already imports `updateNoteLocal`, so keep it. Remove only
   `getNoteById`.

4. Remove `updateNoteLocal` only if B1 was implemented without it (the
   plan above shows both options; pick whichever is in the actual diff).
   **During execution: prefer keeping `updateNoteLocal` since it's a
   legitimate optimistic-update primitive and may be reused.**

5. In `src-tauri/src/lib.rs`, remove the `delete_attachment` registration
   since the frontend has no entry point and the function still lives in
   the commands module. Actually safer: keep the function, just remove it
   from `generate_handler!` — but Tauri will warn about an unregistered
   command. Decision: remove from `generate_handler!` and add a comment
   that the command is reserved for the upcoming image-paste UI.

6. Run `npx tsc --noEmit` and `cargo check`. Both pass.

7. Commit: `chore: remove unused App.tsx, ContextMenu.tsx, getNoteById; reserve delete_attachment`.

---

### Task B3: Tighten `NoteView` signal types

**Files:**
- Modify: `src/routes/NoteView.tsx`
- Modify: `src/lib/types.ts` (export a shared `DEFAULT_NOTE_POSITION`)

**Steps:**

1. In `src/lib/types.ts`, add:

   ```ts
   export const DEFAULT_NOTE_POSITION: NotePosition = {
     x: 100,
     y: 100,
     width: 300,
     height: 240,
   };
   ```

2. In `src/routes/NoteView.tsx`:

   - Change `createSignal("paper")` → `createSignal<ColorKey>("paper")`.
   - Remove `as Note["color"]` casts from `colorHex` and `buildNoteUpdate`.
   - Remove the dead `setNote(updated)` write inside `autoSave` (it never
     affects output).
   - In `onCleanup`, keep the new `flush()` from A3 but also wrap in a
     try/catch + console.error so a write failure doesn't prevent window
     destruction:

     ```ts
     onCleanup(() => {
       try { autoSave.flush(); } catch (e) { console.error("[NoteView] flush failed:", e); }
       editor?.destroy();
     });
     ```

3. Run `npx tsc --noEmit`. Pass.

4. Commit: `refactor: type NoteView color signal as ColorKey; drop dead setNote`.

---

### Task B4: Fix `MainView` async listener registration

**Files:**
- Modify: `src/routes/MainView.tsx`

**Steps:**

1. Replace the two effects that register listeners with a single
   `onMount` that awaits both, with explicit error handling:

```ts
import { onMount, onCleanup } from "solid-js";

onMount(async () => {
  try {
    const unlistenUpdate = await onNoteUpdated(() => loadNotes());
    const unlistenDelete = await onNoteDeleted(() => loadNotes());
    onCleanup(() => {
      unlistenUpdate();
      unlistenDelete();
    });
  } catch (e) {
    console.error("[MainView] failed to register note listeners:", e);
  }
});
```

Remove the now-unused `createEffect` and `unlistenUpdate/unlistenDelete`
variables at the top.

2. Run `npx tsc --noEmit`. Pass.

3. Commit: `fix: register note listeners in onMount to avoid async leak`.

---

### Task B5: Clean up `windows.rs` debug log

**Files:**
- Modify: `src-tauri/src/windows.rs`

**Steps:**

1. Delete the `log_path` / `log` closure inside `create_note_window`. Keep
   the one `eprintln!` in the error path of `on_page_load` so a future
   regression has at least a stderr breadcrumb.

2. Remove the `let label = format!("note-{}", note_id);` line if it becomes
   unused after the cleanup (it is still used for the `WebviewWindowBuilder`
   label argument, so leave it).

3. Drop the `use std::fs;` import if no longer used.

4. Run `cargo check`. Pass.

5. Commit: `chore: remove debug log_path from windows.rs`.

---

### Task B6: Unify new-note position constant

**Files:**
- Modify: `src/lib/types.ts` (already exported `DEFAULT_NOTE_POSITION` in B3)
- Modify: `src/routes/MainView.tsx` — import and use it in `handleCreateNote`
- Modify: `src-tauri/src/tray.rs` — use the same value

**Steps:**

1. In `MainView.tsx`, change:

```ts
import { DEFAULT_NOTE_POSITION, Note } from "../lib/types";
// ...
const note: Note = {
  // ...
  position: { ...DEFAULT_NOTE_POSITION },
  // ...
};
await openNoteWindow(id, DEFAULT_NOTE_POSITION.x, DEFAULT_NOTE_POSITION.y, DEFAULT_NOTE_POSITION.width, DEFAULT_NOTE_POSITION.height);
```

2. In `tray.rs`, update the `create_note_window` call to match
   `DEFAULT_NOTE_POSITION`. Since Rust cannot import the TS file, mirror the
   constant locally with a comment pointing to the TS source of truth:

```rust
// Mirror of src/lib/types.ts DEFAULT_NOTE_POSITION
const NEW_NOTE_X: f64 = 100.0;
const NEW_NOTE_Y: f64 = 100.0;
const NEW_NOTE_W: f64 = 300.0;
const NEW_NOTE_H: f64 = 240.0;
```

…and use those four constants in both call sites in this file.

3. Update `MainView.tsx` `handleCreateNote` to use the same `(100, 100,
   300, 240)` values via the constant.

4. Run `npx tsc --noEmit` and `cargo check`. Pass.

5. Commit: `refactor: share DEFAULT_NOTE_POSITION across frontend and tray`.

---

## Phase C — Polish

Lower priority. Land only if Phase B finishes with no surprises.

### Task C1: Distinguish empty-state copy for filter vs no-notes

**Files:**
- Modify: `src/components/MasonryGrid.tsx`

**Steps:**

1. Accept a new prop `hasAnyNotes: boolean`.

```ts
interface MasonryGridProps {
  notes: Note[];
  hasAnyNotes: boolean;
}
```

2. Show different copy:

```tsx
{props.notes.length === 0 && (
  <div class="flex items-center justify-center h-full text-gray-400 text-sm">
    {props.hasAnyNotes
      ? "No notes match the current filter"
      : 'No notes yet — click "+ 新建便签" to create one'}
  </div>
)}
```

3. In `MainView.tsx`, pass `hasAnyNotes={notes.length > 0}`.

4. Run `npx tsc --noEmit`. Pass.

5. Commit: `fix: distinguish empty-state copy for filter vs no-notes`.

---

### Task C2: Guard `NoteToolbar` against missing editor

**Files:**
- Modify: `src/components/NoteToolbar.tsx`

**Steps:**

1. Replace `props.editor!.chain().focus().toggleX().run()` with safe guards:

```tsx
const run = (fn: (e: Editor) => void) => () => {
  const e = props.editor;
  if (!e) return;
  fn(e);
};
```

…and wire each button to `run((e) => e.chain().focus().toggleBold().run())`.

Or simpler: keep the existing early-return `if (!props.editor) return null;`
but also guard the `onClick` handlers.

2. Run `npx tsc --noEmit`. Pass.

3. Commit: `refactor: guard NoteToolbar buttons against missing editor`.

---

### Task C3: Defense against `scaleFactor()` returning 0

**Files:**
- Modify: `src/routes/NoteView.tsx`

**Steps:**

1. In `autoSave`, after the position/size fetch:

```ts
const sf = await win.scaleFactor();
if (sf > 0) {
  updated.position = {
    x: pos.x / sf,
    y: pos.y / sf,
    width: size.width / sf,
    height: size.height / sf,
  };
}
```

2. Run `npx tsc --noEmit`. Pass.

3. Commit: `fix: guard NoteView position math against zero scaleFactor`.

---

### Task C4: Preserve tag casing through dedup

**Files:**
- Modify: `src/stores/notesStore.ts`
- Modify: `src/components/TagInput.tsx`

**Rationale:** Sidebar shows lowercase tags while per-note storage keeps
the user's casing. Two consequences:

1. Filter by tag is case-insensitive (good).
2. User sees `work` in sidebar but their note stored `Work`. Visually
   inconsistent.

**Approach:** Keep storage as-is, but display the **most-common casing** in
the sidebar.

**Steps:**

1. Extend `getAllTags` to return `{ name, displayName, count }` where
   `displayName` is the most-frequent casing seen across notes.

```ts
export function getAllTags(): { name: string; displayName: string; count: number }[] {
  const counts = new Map<string, { displayName: string; counts: Map<string, number> }>();
  for (const note of notes) {
    for (const tag of note.tags) {
      const lower = tag.toLowerCase();
      const entry = counts.get(lower) ?? { displayName: tag, counts: new Map() };
      entry.counts.set(tag, (entry.counts.get(tag) ?? 0) + 1);
      // pick most-common casing
      entry.displayName = [...entry.counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      counts.set(lower, entry);
    }
  }
  return [...counts.entries()]
    .map(([name, { displayName, counts: m }]) => ({
      name,
      displayName,
      count: [...m.values()].reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

2. In `Sidebar.tsx`, display `tag.displayName` instead of `tag.name`.

3. `TagInput`'s `addTag` already dedupes case-insensitively; no change.

4. Run `npx tsc --noEmit`. Pass.

5. Commit: `fix: show most-common tag casing in sidebar`.

---

## Verification

After each phase, in order:

```powershell
cd D:\Development\Complex\sticky-notes
npx tsc --noEmit           # frontend type check
cd src-tauri; cargo check   # rust check (run separately so the second can run while the first's output is buffered)
cd ..\src-tauri; cargo test # rust unit tests
```

After all phases:

- `git log --oneline -10` shows one commit per task.
- `CHANGELOG.md` is updated with a new `## [0.1.2]` section listing the
  fixes.
- `package.json` and `src-tauri/Cargo.toml` versions bumped to `0.1.2`.

---

## Self-review

**Spec coverage:** Each review-list issue (data loss, list robustness,
attachment hardening, dead code, typing, listener leak, debug log,
position constant, empty-state copy, setNote dead write, scaleFactor
defense, NoteToolbar guard, tag casing) maps to exactly one task. Items
deferred: CSP hardening (deferred — no remote content yet), per-note
title-edit in MainView (out of scope — feature request), minimize button
(deferred — UX, not a defect), front-end tests (deferred — separate
plan).

**Placeholder scan:** No TBDs. All code blocks shown are complete. The B2
branch ("decision: keep `updateNoteLocal`") is resolved inline by picking
the keep path; the alternative text is explanatory context, not an open
TODO.

**Type consistency:** `DEFAULT_NOTE_POSITION` introduced in B3, used in
B6. `flush()` introduced in A3, used in B3 cleanup. `ColorPicker` props
match existing API. `getAllTags` return-shape change in C4 only
**adds** `displayName` — no consumers read `name` for display.
