# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It holds only what every session needs. Area-specific detail lives in `.claude/rules/` (see [Where the details are](#where-the-details-are)) and loads automatically when matching files are read.

## Project

A client-side file manager React component built with React 19, TypeScript, Vite 8 and Material UI (`@mui/material` 9.x). It will later be extracted and published as a package, so write components with that in mind: self-contained, with no app-specific assumptions baked in. `src/` is the component and nothing else, laid out as it will be published. The Vite app in `playground/` is its development host and is never published.

A published component shouldn't force a global `CssBaseline` or its own `ThemeProvider` on consumers, so those stay in the playground and the component itself stays theme-agnostic.

**Pigment CSS is not used, and will not be.** The repo name mentions it, but styling runs on MUI's default Emotion runtime (`@emotion/react`, `@emotion/styled`). Do not add `@mui/material-pigment-css` or its Vite plugin, and do not write Pigment-style (`css`, `styled` from Pigment) code.

## Commands

The package manager is **Bun** (`bun.lock`). Use `bun` / `bunx` for everything, including installs and registry lookups such as `bun info <pkg>`. **Never use `npm` or `npx`**; they are broken on the maintainer's machine.

- `bun run dev` starts the Vite dev server.
- `bun run build` runs `tsc -b && vite build`. This is the only type-check; Vite itself does not type-check.
- `bun run lint` runs `oxlint` (not ESLint).
- `bun run preview` serves the production build.

There is no test runner configured.

## Layout

**Playground.** `index.html` loads `playground/main.tsx`, which mounts `<App />` (`playground/app.tsx`) inside `StrictMode` and the `Theme` wrapper (`playground/theme.tsx`, `ThemeProvider` plus `CssBaseline`). The theme in `playground/styles/theme.ts` (CSS variables, light and dark following the OS, GNOME-like colors, ripples off) styles the dev host only. `App` renders `<FileManager>` full-viewport, imported from `src/index.ts` as a consumer would, with data from `playground/mocks/`: an in-memory adapter with simulated latency keyed by full paths, plus fake sections and demo actions. A folder named `restricted` deliberately fails to load, to show the error state.

**Source.** `src/` is organised by kind of code, and `src/components/` holds only components. File names are lowercase.

- `index.ts` is the public entry. It exports `FileManager`, `IconProvider` and the public types, and nothing else is public.
- `components/file-manager/` is the frame and its parts (`sidebar/`, `header-bar/`, `content/`, `context-menu/`, `dialogs/`).
- `components/uploads/` has the upload panel, kept free of file manager imports so the planned media manager can reuse it (see `uploads.md`).
- `components/icons/` has `Icon`, `IconProvider`, and `FileTypeIcon` / `FolderTypeIcon`, the only way to render `@react-symbols/icons`.
- `types/` holds shared and exported types, one file per domain, re-exported from `types/index.ts`. Files marked internal stay out of `src/index.ts`.
- `hooks/`, `contexts/`, `store/` (the folder listing cache and the upload queue), `utils/` (plain functions), `styles/` (container-query constants, style helpers) and `icon-sets/`.

Imports are relative, with no path alias. The only barrels are `src/index.ts` and `src/types/index.ts`; everything else is imported by file, e.g. `components/icons/icon`.

## The three props

`FileManager` (`src/components/file-manager/file-manager.tsx`) is a file manager for the web, so it has no built-in locations (no Home, Trash or Network). The consumer supplies everything:

- **`adapter`** (`types/adapter.ts`) is the backend contract. It is lazy: `list(folderId, { signal })` returns `{ entries }` for one folder, called only when a folder is first opened or expanded. `FileEntry.id` is opaque (a full path or a database id) and is only ever handed back to the adapter; the component never parses or joins paths. Grow the contract by adding optional members, never by changing `list`, so existing adapters keep working. Optional members switch features on: `createFolder`, `rename`, `copy`, `move`, `delete` and `upload` so far.
- **`sections`** is `SectionGroup[]`. Each `Section` (id, label, icon, `rootId`, optional own `adapter`, optional `showFolders`, optional `importFrom`) is an independent root, with no connection to other sections even when they share an adapter. A single `section` can be passed instead, and its folders then fill the sidebar (see `file-manager.md`).
- **`actions`** is `ActionGroup[]` for the context menu.

## Conventions

- Code in `src/` and `playground/` uses 4-space indentation, double quotes, and semicolons. The template-generated config files use 2 spaces and single quotes. Match the file you're editing.
- `tsconfig.app.json` is strict about a few things that commonly trip up edits:
  - `verbatimModuleSyntax`: type-only imports must use `import type`.
  - `erasableSyntaxOnly`: no `enum`, `namespace`, or constructor parameter properties.
  - `noUnusedLocals` and `noUnusedParameters` are errors in `bun run build`.
- Oxlint runs the `react`, `typescript` and `oxc` plugins with `react/rules-of-hooks` as an error. Type-aware linting is off.

## Where the details are

Each file in `.claude/rules/` loads when Claude reads a file matching its `paths`. Read one directly when you need it before touching those files.

| Rule | Covers | Loads for |
|---|---|---|
| `material-ui.md` | `sx` objects, per-component and per-icon imports | `src/`, `playground/` |
| `types.md` | where types live | `src/` |
| `component-styling.md` | container queries, palette tokens, CSS custom properties | `src/` |
| `file-manager.md` | data store, navigation, context menu, sorting, the parts | `src/components/file-manager/`, `hooks/`, `store/`, `utils/` |
| `uploads.md` | the upload queue and panel, dropping files from the desktop, what's shared with the media manager | upload store, hook, panel, dialog and types, `use-drop-target.ts`, `types/adapter.ts` |
| `selection.md` | content and sidebar selection, marquee, touch selection mode | selection components, hooks and utils |
| `keyboard.md` | keyboard navigation, focus, ARIA roles of the content and the tree | the frame, content, sidebar, context menu, transfer dialog, keyboard utils |
| `virtualization.md` | rendering only the entries in or near view, and what stays rendered | the content, `use-virtual-lines.ts`, `use-marquee.ts`, `utils/dom.ts`, view types |
| `icons.md` | icon packs, variants, `IconProvider`, adding an icon | `components/icons/`, `icon-sets/`, icon types |

When a feature is added or changed, document it in the matching rule (or a new one), not here. This file stays for things every session needs.

## Repo settings

`.claude/settings.json` denies `git push` and requires confirmation for `git commit` and `rm`. Commits are made with the `/commit` skill (`.claude/skills/commit/`), which holds the commit message style.
