# Frontend Testing — Design Spec

**Date:** 2026-07-15
**Status:** Approved (post-brainstorm)

A focused, low-blast-radius test infrastructure for the Sticky Notes frontend.
Goal: lock down the two pieces of pure-ish logic that have already regressed in
ad-hoc ways during the v0.1.0 → v0.1.1 → v0.1.2 sweep, without introducing a
heavy component-testing stack.

---

## 1. Motivation

Two pieces of frontend logic carry non-trivial correctness expectations and
have been touched in every recent cleanup:

1. **`notesStore.getAllTags()`** — tag aggregation with case-insensitive
   dedup and a "most-common casing wins" display-name rule.
2. **`MainView`'s `createMemo` filter** — search + tag + pinned filters
   combined over the note list.

Today both are tested only by manual UI inspection. The most recent
v0.1.2 cleanup had to refactor `getAllTags` (adding `displayName`) and
left MainView's filter logic as an inline memo. Without tests, any
future change to either is one careful merge away from a silent
regression.

This spec adds a minimal test harness around them — no new testing
paradigm, no component-DOM testing, no coverage tooling.

---

## 2. Scope

In scope:

- New pure function `filterNotes(notes, opts)` extracted from `MainView`'s
  inline `createMemo`.
- `getAllTags(notes)` signature change to accept the notes array
  explicitly (was: reading from the module-level store).
- Vitest setup: `vitest.config.ts`, two scripts in `package.json`, dev
  dependency on `vitest`.
- Two test files: `notesStore.test.ts` and `filterNotes.test.ts`,
  co-located with the modules they exercise.
- Documentation: this spec + a short note in `AGENTS.md` ("run tests
  with `npm test`") and a `CHANGELOG.md` v0.1.3 entry.

Out of scope (explicitly deferred):

- Component-level tests (`@solidjs/testing-library` or equivalent).
- DOM-environment tests (`jsdom` / `happy-dom`).
- Coverage tooling (`@vitest/coverage-v8` / `c8`).
- CI integration.
- Testing `MainView`'s event-listener lifecycle, `NoteView`'s editor
  lifecycle, or any Tauri IPC surface — these need either component
  tests (heavy) or a Tauri mocking layer (heavier); neither is
  justified today.

---

## 3. Architecture

```
src/
├── lib/
│   ├── filterNotes.ts          (NEW)  pure function
│   ├── filterNotes.test.ts     (NEW)  unit tests
│   ├── events.ts                      (unchanged)
│   ├── invoke.ts                      (unchanged)
│   └── types.ts                       (unchanged)
├── stores/
│   ├── notesStore.ts           (MOD)  getAllTags signature change
│   └── notesStore.test.ts      (NEW)  unit tests
├── components/
│   ├── Sidebar.tsx             (MOD)  pass notes to getAllTags
│   └── …
├── routes/
│   └── MainView.tsx            (MOD)  call filterNotes(notes, opts)
└── …
vitest.config.ts                (NEW)
package.json                     (MOD)  scripts + devDependency
tsconfig.json                    (unchanged)
tsconfig.node.json               (unchanged — vitest.config.ts uses it)
```

---

## 4. Interface

### `src/lib/filterNotes.ts`

```ts
import type { Note } from "./types";

export interface FilterOpts {
  query: string;
  tag: string;
  pinnedOnly: boolean;
}

export function filterNotes(notes: Note[], opts: FilterOpts): Note[]
```

Behaviour (verbatim from `MainView.tsx:42-67`, copied so the spec is
self-contained):

- `query.trim().toLowerCase()` → filter where
  `(title + " " + content).toLowerCase()` contains the query. Empty
  string ⇒ no query filter.
- `tag.toLowerCase()` → filter where any `note.tags[i].toLowerCase()`
  equals it. Empty string ⇒ no tag filter.
- `pinnedOnly === true` → filter where `note.pinned === true`. `false`
  ⇒ no pinned filter.
- All three predicates are AND-ed. Returned array preserves input
  order (the source array is not sorted by this function).
- **HTML content is matched as raw string** — matches the current
  inline behaviour. Stripping HTML on the search path is out of
  scope.

### `src/stores/notesStore.ts` — `getAllTags` signature

Before:
```ts
export function getAllTags(): { name: string; displayName: string; count: number }[]
```

After:
```ts
export function getAllTags(notes: Note[]): { name: string; displayName: string; count: number }[]
```

Implementation unchanged: lowercase grouping, most-common casing as
displayName, ties keep the earlier-encountered casing (insertion-order
stable across runs because we iterate `notes` in stable order).

### `src/components/Sidebar.tsx` — call site

```ts
const tags = createMemo(() => getAllTags(notes));
```

Already passes `notes`; the only change is adding it as an argument.

### `src/routes/MainView.tsx` — call site

Replace the inline `createMemo` body with a call to `filterNotes`:

```ts
const filteredNotes = createMemo(() =>
  filterNotes(notes, {
    query: searchQuery(),
    tag: selectedTag(),
    pinnedOnly: filterPinned(),
  })
);
```

The three `createSignal` declarations above stay as-is.

---

## 5. Vitest Configuration

`vitest.config.ts`:
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

Why `solid()`: some imports (`notesStore.ts`) pull in `solid-js/store`,
and Vite needs the JSX/Solid transform configured so that TypeScript
files referencing `solid-js` JSX compile in the test runner.

Why `environment: "node"`: tests exercise pure functions only. No DOM.

`package.json` additions:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
},
"devDependencies": {
  "vitest": "^2"
}
```

(Vitest 2 is the latest line that runs on Vite 6 + Node 18+.)

No `tsconfig.test.json` — `tsconfig.json`'s `moduleResolution:
"bundler"` already covers the test files.

---

## 6. Test Cases

### `src/stores/notesStore.test.ts`

Covers `getAllTags`:

| # | Name | Fixture | Assertion |
|---|---|---|---|
| 1 | `returns empty for empty notes` | `[]` | `[]` |
| 2 | `skips notes with no tags` | one note, `tags: []` | `[]` |
| 3 | `aggregates a single tag` | two notes, both `tags: ["work"]` | one entry, `name: "work"`, `displayName: "work"`, `count: 2` |
| 4 | `groups case-insensitively` | `["Work"]` and `["WORK"]` and `["work"]` | one entry, `count: 3` |
| 5 | `picks most-common casing` | 2× `["Work"]`, 1× `["WORK"]` | one entry, `displayName: "Work"`, `count: 3` |
| 6 | `breaks casing ties by first-encountered` | 1× `["Work"]`, 1× `["work"]` (Work first) | `displayName: "Work"` |
| 7 | `sorts by name ascending` | tags `["zebra"]`, `["apple"]`, `["mango"]` | returned order: apple, mango, zebra |
| 8 | `counts across notes with multiple tags` | one note, `tags: ["a", "b"]`; one note, `tags: ["a", "c"]` | three entries; a:2, b:1, c:1 |

### `src/lib/filterNotes.test.ts`

Covers `filterNotes`:

| # | Name | Fixture | Opts | Assertion |
|---|---|---|---|---|
| 1 | `empty opts returns all` | 3 notes | `{ query: "", tag: "", pinnedOnly: false }` | length 3, order preserved |
| 2 | `query matches title` | notes with titles "Buy milk", "Fix bug" | `{ query: "milk", ... }` | only the milk note |
| 3 | `query matches content` | note with content `"<p>hello world</p>"` | `{ query: "hello", ... }` | the note |
| 4 | `query is case-insensitive` | note with title `"Hello"` | `{ query: "hello", ... }` | the note |
| 5 | `query matches against HTML content` | note with content `"<p><b>bold</b></p>"` | `{ query: "bold", ... }` | the note (matches raw HTML string per current behaviour) |
| 6 | `tag filter is case-insensitive` | note with tags `["Work"]` | `{ tag: "work", ... }` | the note |
| 7 | `empty tag means no tag filter` | mixed tags | `{ tag: "", ... }` | all returned |
| 8 | `pinnedOnly=true keeps only pinned` | pinned: true and false mix | `{ pinnedOnly: true, ... }` | only pinned |
| 9 | `pinnedOnly=false keeps all` | mixed | `{ pinnedOnly: false, ... }` | all returned |
| 10 | `all three filters AND together` | 4 notes covering every combination | `{ query, tag, pinnedOnly }` | only the one matching all three |
| 11 | `no match returns empty array` | 3 notes | `{ query: "absent", ... }` | `[]` |

Fixtures are inline `const` arrays of 3–5 `Note` objects per test.
No shared fixture file.

---

## 7. Documentation & Version

- New `CHANGELOG.md` entry `## [0.1.3]` summarising the testing
  addition.
- `AGENTS.md` Quick commands table gains `npm test` / `npm run
  test:watch` rows.
- `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`
  bumped to `0.1.3`.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Vitest 2 has a Vite 6 incompatibility on some Node versions | Pin to a version known to work; fallback is Vitest 1.x which is also Vite-6-compatible. Choose at implementation time. |
| `getAllTags(notes)` signature change breaks a future caller we haven't seen | TS will flag any missed call site at compile time. |
| Solid store import in tests pulls a lot of transitive deps | Acceptable — these are already in the production bundle. Test execution cost is a few hundred ms warm, well under CI budget. |
| `filterNotes` diverges from `MainView`'s inlined logic if I forget to copy something | The tests are written to assert the spec'd behaviour, not the current behaviour. Any divergence from current behaviour must be deliberate and called out at PR time. |

---

## 9. Out of Scope, Revisit Later

- Component tests for `MainView` / `NoteView`.
- Tauri IPC mocking for end-to-end-ish tests.
- Coverage thresholds in CI.
- Property-based testing for `filterNotes` (a 1-line fast-check would
  be cheap, but not justified until the function grows).
