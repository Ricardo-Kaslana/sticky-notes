# docs/archive

Historical documents, kept for traceability. **Nothing here is a live source of truth.**

Current documentation lives at the repo root: [README.md](../../README.md), [CHANGELOG.md](../../CHANGELOG.md), [AGENTS.md](../../AGENTS.md).

Archived on 2026-09-16. Files were moved with `git mv`, so `git log --follow` still works.

---

## `superpowers/specs/` — design specs

Approved designs for shipped or superseded work.

| Doc | Date | Status |
|---|---|---|
| [2026-06-06-sticky-notes-design.md](./superpowers/specs/2026-06-06-sticky-notes-design.md) | 2026-06-06 | Approved — v1 design; see the "Implementation Status" addendum at the bottom for drift |
| [2026-07-15-frontend-testing-design.md](./superpowers/specs/2026-07-15-frontend-testing-design.md) | 2026-07-15 | Approved — Vitest harness for `getAllTags` / `filterNotes` |
| [2026-07-15-image-paste-design.md](./superpowers/specs/2026-07-15-image-paste-design.md) | 2026-07-15 | Approved — paste / drop / toolbar image insertion |
| [2026-07-26-ui-polish-design.md](./superpowers/specs/2026-07-26-ui-polish-design.md) | 2026-07-26 | Approved — token-driven visual unification |

## `superpowers/plans/` — implementation plans

Task-by-task build plans with verification checklists. All tasks in each plan are committed; checkboxes reflect the state at the time of writing.

| Doc | Date | Scope |
|---|---|---|
| [2026-06-06-sticky-notes.md](./superpowers/plans/2026-06-06-sticky-notes.md) | 2026-06-06 | 18-task v1 build plan (largest doc in the repo) |
| [2026-07-15-cleanup-and-bugfixes.md](./superpowers/plans/2026-07-15-cleanup-and-bugfixes.md) | 2026-07-15 | Codebase-review fixes, one commit per task |
| [2026-07-15-frontend-testing.md](./superpowers/plans/2026-07-15-frontend-testing.md) | 2026-07-15 | Vitest harness |
| [2026-07-15-image-paste.md](./superpowers/plans/2026-07-15-image-paste.md) | 2026-07-15 | Image paste UI wiring |
| [2026-07-26-ui-polish.md](./superpowers/plans/2026-07-26-ui-polish.md) | 2026-07-26 | UI polish sweep |

## `agents/` — upstream skill-pack conventions

Conventions inherited from the upstream skill pack. **Not used by this project** — reference only.

| Doc | Purpose |
|---|---|
| [domain.md](./agents/domain.md) | `CONTEXT.md` + `docs/adr/` convention |
| [issue-tracker.md](./agents/issue-tracker.md) | `.scratch/<feature>/PRD.md` convention |
| [triage-labels.md](./agents/triage-labels.md) | Five canonical triage roles |

## `CLAUDE.md`

The former Claude Code entry point. It only pointed at `AGENTS.md`; archived because `AGENTS.md` is the single source of truth for agent conventions. If you use Claude Code on this repo, recreate a root `CLAUDE.md` that points to `AGENTS.md`.
