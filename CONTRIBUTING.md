# Contributing to Sticky Notes

Thanks for taking the time to contribute. This project is a Windows desktop app built with Tauri 2, Rust, SolidJS, TipTap, and Tailwind CSS 4.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Contributions are accepted under the [MIT License](LICENSE).

---

## Before you start

- **Bug?** Search the [existing issues](https://github.com/Ricardo-Kaslana/sticky-notes/issues) first, then open a bug report with reproduction steps, your Windows version, and the app version.
- **Feature?** Open an issue describing the problem and the proposed behavior before writing a large patch. Small fixes and documentation changes can go straight to a pull request.
- **Security issue?** Do **not** open a public issue. Follow [SECURITY.md](SECURITY.md).

---

## Development setup

### Prerequisites

- Windows 10/11
- Node.js 18+ (22 recommended; see `.nvmrc`)
- Rust stable via [rustup](https://rustup.rs)
- Microsoft C++ Build Tools (Desktop development with C++)
- WebView2 runtime (bundled with Windows 11 and recent Windows 10)

### Install and run

```sh
git clone https://github.com/Ricardo-Kaslana/sticky-notes.git
cd sticky-notes
npm ci
npm run tauri dev
```

`npm run tauri dev` starts Vite on port 1420 and rebuilds the Rust backend when Rust files change.

For frontend-only work you can run `npm run dev`, but note CRUD will fail because the Tauri backend is not running.

### Checks before opening a pull request

```sh
npx tsc --noEmit
npm test
cd src-tauri && cargo fmt --all -- --check && cargo clippy --all-targets -- -D warnings && cargo test
```

CI runs the same checks on `windows-latest`.

---

## Project conventions

[AGENTS.md](AGENTS.md) is the authoritative list of architectural rules. Read it before changing code. The rules most likely to affect a contribution:

- **All Tauri `invoke` calls go through `src/lib/invoke.ts`.** Components must not import `@tauri-apps/api/core` directly.
- **All cross-window events go through `src/lib/events.ts`.** Only the Rust backend emits `note-updated` and `note-deleted`.
- **No `@solidjs/router`.** Routing is a manual `Switch/Match` in `src/index.tsx`.
- **Notes are one JSON file each** under the app-data directory. Do not introduce a database or a single notes file.
- **Keep Rust models and TypeScript types in sync.** `src-tauri/src/models.rs` and `src/lib/types.ts` mirror each other, and JSON is camelCase on the wire.
- **New `Settings` fields need `#[serde(default = "...")]`**, a mirror in `src/lib/types.ts`, an entry in `DEFAULT_SETTINGS`, and validation in `write_settings`.
- **Note ordering lives only in `src/lib/sortNotes.ts`.** Do not sort in components or in the Rust `list_notes` command.
- **Tailwind CSS 4 only**, through `@tailwindcss/vite`. There is no `tailwind.config.ts` and no PostCSS config.

If a change affects user-visible behavior, update [CHANGELOG.md](CHANGELOG.md) in the appropriate section.

---

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add pinned-only filter to the sidebar
fix: flush pending saves before closing a note window
docs: document the new app-data path
test: cover title sorting with empty titles
chore: bump dependencies
```

Keep commits focused. A pull request may contain several commits, but each one should build and pass tests on its own where practical.

---

## Pull request checklist

- [ ] The change is focused and described in the PR body.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm test` passes.
- [ ] Rust checks (`fmt`, `clippy`, `test`) pass if Rust code changed.
- [ ] New behavior has tests where practical.
- [ ] User-visible changes are added to `CHANGELOG.md`.
- [ ] Screenshots or a short recording are attached for UI changes.
- [ ] Documentation is updated if behavior, paths, or commands changed.
- [ ] No secrets, personal paths, or credentials are included.

Maintainers may ask for changes or close PRs that do not fit the project's scope. Be kind; this is a small project maintained in spare time.

---

## Releases

Maintainers bump the version in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`, then push a `vX.Y.Z` tag. The release workflow builds Windows installers and creates a draft GitHub release for review.
