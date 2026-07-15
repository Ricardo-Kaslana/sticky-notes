# Frontend Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal Vitest harness and lock down `notesStore.getAllTags` and `MainView`'s filter logic against future regressions.

**Architecture:** Pure-function refactor (`filterNotes` extracted from an inline `createMemo`) + `getAllTags` signature change to accept its input array. Vitest in `node` environment, no DOM, no component testing.

**Tech Stack:** Vitest 2.x, TypeScript 5.6, SolidJS 1.x (only via `solid-js/store` import in the store).

**Branch policy:** Work directly on `master` — matches the project's small-commit cadence and the pattern set by the v0.1.2 sweep.

---

## Global Constraints

- Test files use `*.test.ts` suffix, co-located with the source file.
- Vitest config: `environment: "node"`, no DOM, no coverage tooling this round.
- Production callers of `getAllTags` change from `getAllTags()` to `getAllTags(notes)` — there is exactly one caller today (`Sidebar.tsx`).
- The behaviour of `filterNotes` must match the current inline `createMemo` in `MainView.tsx:42-67` byte-for-byte, including HTML-as-raw-string search.
- All steps must pass `npx tsc --noEmit` and `npm test` before commit.

---

## Task 1: Install Vitest

**Files:**
- Modify: `package.json` (devDependencies + scripts)

**Steps:**

1. Install:

```sh
npm install --save-dev vitest@^2
```

2. Add to `package.json` `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

3. Run `npx vitest --version` to confirm install.

4. Run `npm test`. Expect:

```
No test files found, exiting with code 0
```

(or similar "0 tests, 0 failures"). This is the empty baseline.

5. Commit:

```sh
git add package.json package-lock.json
git commit -m "chore: add vitest dev dependency and test scripts"
```

---

## Task 2: Add vitest.config.ts

**Files:**
- Create: `vitest.config.ts`

**Steps:**

1. Write `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

2. Run `npm test`. Same empty baseline as Task 1, exit 0.

3. Commit:

```sh
git add vitest.config.ts
git commit -m "chore: add vitest config"
```

---

## Task 3: Extract `filterNotes` and write its tests (TDD red→green)

This is the first task that produces real test code. We do the TDD
cycle as one commit: write failing tests, run, watch compile-fail,
implement minimal code, run, watch green, commit.

**Files:**
- Create: `src/lib/filterNotes.ts`
- Create: `src/lib/filterNotes.test.ts`
- Modify: `src/routes/MainView.tsx`

**Steps:**

1. Write the failing test file `src/lib/filterNotes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filterNotes, type FilterOpts } from "./filterNotes";
import type { Note } from "./types";

function note(over: Partial<Note> & { id: string }): Note {
  return {
    id: over.id,
    title: over.title ?? "",
    content: over.content ?? "<p></p>",
    color: over.color ?? "paper",
    tags: over.tags ?? [],
    position: over.position ?? { x: 0, y: 0, width: 300, height: 240 },
    pinned: over.pinned ?? false,
    createdAt: over.createdAt ?? "2026-01-01T00:00:00Z",
    updatedAt: over.updatedAt ?? "2026-01-01T00:00:00Z",
  };
}

const NOTES: Note[] = [
  note({ id: "a", title: "Buy milk", content: "<p>from corner store</p>" }),
  note({ id: "b", title: "Fix bug", content: "<p>hello world</p>", pinned: true }),
  note({ id: "c", title: "Hello", content: "<p><b>bold</b> text</p>", tags: ["Work"] }),
  note({ id: "d", title: "Notes", content: "<p>misc</p>", tags: ["personal"], pinned: true }),
];

const NONE: FilterOpts = { query: "", tag: "", pinnedOnly: false };

describe("filterNotes", () => {
  it("empty opts returns all notes in input order", () => {
    expect(filterNotes(NOTES, NONE).map((n) => n.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("query matches title", () => {
    expect(filterNotes(NOTES, { ...NONE, query: "milk" }).map((n) => n.id)).toEqual(["a"]);
  });

  it("query matches content", () => {
    expect(filterNotes(NOTES, { ...NONE, query: "hello" }).map((n) => n.id)).toEqual(["b", "c"]);
  });

  it("query is case-insensitive", () => {
    expect(filterNotes(NOTES, { ...NONE, query: "HELLO" }).map((n) => n.id)).toEqual(["b", "c"]);
  });

  it("query matches against raw HTML content", () => {
    expect(filterNotes(NOTES, { ...NONE, query: "bold" }).map((n) => n.id)).toEqual(["c"]);
  });

  it("tag filter is case-insensitive", () => {
    expect(filterNotes(NOTES, { ...NONE, tag: "work" }).map((n) => n.id)).toEqual(["c"]);
  });

  it("empty tag means no tag filter", () => {
    expect(filterNotes(NOTES, { ...NONE, tag: "" }).map((n) => n.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("pinnedOnly=true keeps only pinned", () => {
    expect(filterNotes(NOTES, { ...NONE, pinnedOnly: true }).map((n) => n.id)).toEqual(["b", "d"]);
  });

  it("pinnedOnly=false keeps all", () => {
    expect(filterNotes(NOTES, { ...NONE, pinnedOnly: false }).map((n) => n.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("all three filters AND together", () => {
    expect(
      filterNotes(NOTES, { query: "hello", tag: "work", pinnedOnly: false }).map((n) => n.id)
    ).toEqual(["c"]);
  });

  it("no match returns empty array", () => {
    expect(filterNotes(NOTES, { ...NONE, query: "absent" })).toEqual([]);
  });
});
```

2. Run `npm test`. Expect failure — `filterNotes` does not exist yet, so TypeScript will complain `Cannot find module './filterNotes'`. This is the RED step.

3. Write the implementation `src/lib/filterNotes.ts`:

```ts
import type { Note } from "./types";

export interface FilterOpts {
  query: string;
  tag: string;
  pinnedOnly: boolean;
}

export function filterNotes(notes: Note[], opts: FilterOpts): Note[] {
  const q = opts.query.toLowerCase().trim();
  const t = opts.tag.toLowerCase();

  return notes.filter((n) => {
    if (q) {
      const haystack = (n.title + " " + n.content).toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (t) {
      if (!n.tags.some((tag) => tag.toLowerCase() === t)) return false;
    }
    if (opts.pinnedOnly && !n.pinned) return false;
    return true;
  });
}
```

NOTE on the `query.trim()`: the spec says the behaviour matches the
current inline `createMemo` byte-for-byte, and the current code does
NOT trim the query (it only does `.toLowerCase()`). The implementation
above matches — `q` is `query.toLowerCase().trim()` which produces
the same `q !== ""` short-circuit semantics for whitespace-only
strings, but `.includes(" ")` will still match spaces inside content.
Actually, re-reading the current code:

```ts
const q = searchQuery().toLowerCase();
if (q) {
  result = result.filter((n) => {
    const text = (n.title + " " + n.content).toLowerCase();
    return text.includes(q);
  });
}
```

There is no `.trim()`. Drop it to match exactly:

```ts
const q = opts.query.toLowerCase();
```

4. Update `MainView.tsx`. Replace the existing `createMemo` body with
   a `filterNotes` call:

```tsx
import { filterNotes } from "../lib/filterNotes";
// ...
const filteredNotes = createMemo(() =>
  filterNotes(notes, {
    query: searchQuery(),
    tag: selectedTag(),
    pinnedOnly: filterPinned(),
  })
);
```

The local `const q = searchQuery().toLowerCase();` etc. block is
removed; the imports already include `createMemo`.

5. Run `npm test`. Expect 11 tests passing.

6. Run `npx tsc --noEmit`. Expect no errors.

7. Commit:

```sh
git add src/lib/filterNotes.ts src/lib/filterNotes.test.ts src/routes/MainView.tsx
git commit -m "feat: extract MainView filter logic into pure filterNotes function

Moves the search + tag + pinned filter createMemo body into a pure
function so it can be unit-tested without a DOM or Solid component
harness. MainView now imports filterNotes and feeds it the current
signal values. 11 unit tests cover empty opts, query (title,
content, case-insensitivity, raw HTML matching), tag (case-
insensitive, empty), pinnedOnly, combined filters, and empty result."
```

---

## Task 4: `getAllTags` signature change with tests (TDD red→green)

**Files:**
- Create: `src/stores/notesStore.test.ts`
- Modify: `src/stores/notesStore.ts`
- Modify: `src/components/Sidebar.tsx`

**Steps:**

1. Write the failing test file `src/stores/notesStore.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getAllTags } from "./notesStore";
import type { Note } from "../lib/types";

function note(id: string, tags: string[]): Note {
  return {
    id,
    title: "",
    content: "<p></p>",
    color: "paper",
    tags,
    position: { x: 0, y: 0, width: 300, height: 240 },
    pinned: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("getAllTags", () => {
  it("returns empty for empty notes", () => {
    expect(getAllTags([])).toEqual([]);
  });

  it("skips notes with no tags", () => {
    expect(getAllTags([note("a", [])])).toEqual([]);
  });

  it("aggregates a single tag across notes", () => {
    const result = getAllTags([note("a", ["work"]), note("b", ["work"])]);
    expect(result).toEqual([{ name: "work", displayName: "work", count: 2 }]);
  });

  it("groups case-insensitively", () => {
    const result = getAllTags([
      note("a", ["Work"]),
      note("b", ["WORK"]),
      note("c", ["work"]),
    ]);
    expect(result).toEqual([{ name: "work", displayName: "Work", count: 3 }]);
  });

  it("picks the most-common casing as displayName", () => {
    const result = getAllTags([
      note("a", ["Work"]),
      note("b", ["Work"]),
      note("c", ["WORK"]),
    ]);
    expect(result).toEqual([{ name: "work", displayName: "Work", count: 3 }]);
  });

  it("breaks casing ties by first-encountered casing", () => {
    const result = getAllTags([
      note("a", ["Work"]),
      note("b", ["work"]),
    ]);
    // Tie 1-1; the first note's "Work" wins because Map insertion order
    // is stable and we iterate notes in order.
    expect(result).toEqual([{ name: "work", displayName: "Work", count: 2 }]);
  });

  it("sorts by name ascending", () => {
    const result = getAllTags([
      note("a", ["zebra"]),
      note("b", ["apple"]),
      note("c", ["mango"]),
    ]);
    expect(result.map((t) => t.name)).toEqual(["apple", "mango", "zebra"]);
  });

  it("counts across notes with multiple tags", () => {
    const result = getAllTags([
      note("a", ["a", "b"]),
      note("b", ["a", "c"]),
    ]);
    const map = Object.fromEntries(result.map((t) => [t.name, t.count]));
    expect(map).toEqual({ a: 2, b: 1, c: 1 });
  });
});
```

2. Run `npm test`. Expect failure — `getAllTags()` no longer matches
   the new `getAllTags(notes)` signature, so the test file fails to
   type-check. The filterNotes tests still pass. RED.

3. Update `src/stores/notesStore.ts`. Change the `getAllTags` signature:

```ts
export function getAllTags(notes: Note[]): {
  name: string;
  displayName: string;
  count: number;
}[] {
  const groups = new Map<
    string,
    { displayName: string; casings: Map<string, number> }
  >();
  for (const note of notes) {
    for (const tag of note.tags) {
      const lower = tag.toLowerCase();
      const entry = groups.get(lower) ?? {
        displayName: tag,
        casings: new Map<string, number>(),
      };
      entry.casings.set(tag, (entry.casings.get(tag) ?? 0) + 1);
      let topCasing = entry.displayName;
      let topCount = entry.casings.get(topCasing) ?? 0;
      for (const [casing, count] of entry.casings) {
        if (count > topCount) {
          topCasing = casing;
          topCount = count;
        }
      }
      entry.displayName = topCasing;
      groups.set(lower, entry);
    }
  }
  return Array.from(groups.entries())
    .map(([name, { displayName, casings }]) => ({
      name,
      displayName,
      count: Array.from(casings.values()).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

The body is identical to v0.1.2's; only the signature changes.

4. Update `src/components/Sidebar.tsx`. The call site already has
   `notes` in scope (line 36 reads `notes.length`), so the change is
   mechanical:

```ts
const tags = createMemo(() => getAllTags(notes));
```

5. Run `npm test`. Expect 19 tests passing (11 filterNotes + 8
   getAllTags).

6. Run `npx tsc --noEmit`. Expect no errors.

7. Commit:

```sh
git add src/stores/notesStore.ts src/stores/notesStore.test.ts src/components/Sidebar.tsx
git commit -m "refactor: getAllTags takes notes array as parameter

Lets tests inject fixtures without exporting the store's setter.
Existing caller Sidebar passes the imported notes store, so the
behaviour is unchanged for users. 8 unit tests cover empty notes,
no-tag notes, single tag aggregation, case-insensitive grouping,
most-common-casing displayName, tie-breaking by first-encountered,
sort order, and multi-tag counts."
```

---

## Task 5: Update documentation and bump version

**Files:**
- Modify: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` (all 0.1.2 → 0.1.3)
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`

**Steps:**

1. Bump versions:

```sh
# package.json
sed -i 's/"version": "0.1.2"/"version": "0.1.3"/' package.json

# src-tauri/Cargo.toml
sed -i 's/version = "0.1.2"/version = "0.1.3"/' src-tauri/Cargo.toml

# src-tauri/tauri.conf.json
sed -i 's/"version": "0.1.2"/"version": "0.1.3"/' src-tauri/tauri.conf.json
```

On Windows / PowerShell, `sed` may not be available — fall back to
manual Edit if needed.

2. Prepend a `## [0.1.3]` section to `CHANGELOG.md`:

```markdown
## [0.1.3] — 2026-07-15

### Added

- **Vitest harness** for the frontend: `npm test` runs `vitest run`,
  `npm run test:watch` runs in watch mode. Node environment, no DOM,
  no component testing this round.
- **`filterNotes(notes, opts)`** extracted from `MainView`'s inline
  `createMemo` into a pure function in `src/lib/filterNotes.ts`. The
  inline memo now delegates to it.
- **`getAllTags(notes)` signature change**: takes the notes array
  explicitly instead of reading from the module-level store. Sole
  caller `Sidebar` passes `notes`.

### Tests

- 11 unit tests for `filterNotes` (empty opts, query title/content/
  case/HTML-raw matching, tag case-insensitivity + empty tag,
  pinnedOnly on/off, combined filters, empty result).
- 8 unit tests for `getAllTags` (empty notes, no-tag notes, single
  tag aggregation, case-insensitive grouping, most-common-casing
  displayName, tie-breaking by first-encountered, sort order,
  multi-tag counts).
- 19 tests total, all passing. `tsc --noEmit` clean.
```

3. Update `AGENTS.md` Quick commands table — add two rows:

```markdown
| Goal | Command |
|---|---|
| Run frontend tests | `npm test` |
| Run frontend tests (watch) | `npm run test:watch` |
```

4. Run final verification:

```sh
npx tsc --noEmit
npm test
cd src-tauri && cargo test
```

All three must be clean.

5. Commit:

```sh
git add -A package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json CHANGELOG.md AGENTS.md
git commit -m "chore: bump to v0.1.3 — frontend testing

Add 'Run frontend tests' rows to AGENTS.md quick-commands table
and a [0.1.3] entry to CHANGELOG.md. Bump package.json, Cargo.toml,
and tauri.conf.json to 0.1.3 to match."
```

---

## Verification

After all five tasks:

- `npx tsc --noEmit` — clean
- `npm test` — 19 tests, 0 failures
- `cd src-tauri && cargo test` — 9 tests, 0 failures (unchanged from
  v0.1.2)
- `git log --oneline 53dc3d1..HEAD` shows 5 commits

---

## Self-Review

**Spec coverage:** Spec §2 scope (vitest install, vitest.config,
filterNotes extraction, getAllTags signature, two test files,
CHANGELOG/AGENTS updates, version bump) maps 1:1 to tasks. Spec §6
test catalogue (8 + 11 = 19) matches the test bodies in Tasks 3 and
4. Spec §4 interface is the literal contents of `filterNotes.ts` and
the `getAllTags` rewrite in Task 4.

**Placeholder scan:** No TBDs. Every code block is complete. The
`sed -i` step in Task 5 includes a documented Windows fallback.

**Type consistency:** `FilterOpts` and `Note` shapes match in both
test files. `getAllTags(notes)` in tests matches the new signature in
production. `filterNotes(notes, opts)` in tests matches the signature
in production. The `query.trim()` detail is explicitly walked through
in Task 3 step 3 and removed before commit to match current MainView
behaviour byte-for-byte.

**TDD discipline:** Tasks 3 and 4 follow RED→GREEN→commit. Tasks 1,
2, 5 are setup/wrap-up and don't have meaningful unit-test coverage
of their own.
