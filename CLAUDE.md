# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A client-side file manager React component built with React 19, TypeScript, Vite 8 and Material UI (`@mui/material` 9.x). It will later be extracted and published as a package, so write components with that in mind: self-contained, with no app-specific assumptions baked in. The Vite app in `src/` is the development host for the component.

**Pigment CSS is not used, and will not be.** The repo name mentions it, but styling runs on MUI's default Emotion runtime (`@emotion/react`, `@emotion/styled`). Do not add `@mui/material-pigment-css` or its Vite plugin, and do not write Pigment-style (`css`, `styled` from Pigment) code.

The project began from the Vite React-TS template and the default scaffolding has been removed.

## Commands

The package manager is **Bun** (`bun.lock`). Use `bun` / `bunx` for everything, including installs and registry lookups such as `bun info <pkg>`. **Never use `npm` or `npx`**; they are broken on the maintainer's machine.

- `bun run dev` starts the Vite dev server.
- `bun run build` runs `tsc -b && vite build`. This is the only type-check; Vite itself does not type-check.
- `bun run lint` runs `oxlint` (not ESLint).
- `bun run preview` serves the production build.

There is no test runner configured.

## Architecture

- `index.html` loads `src/main.tsx`, which mounts `<App />` from `src/components/main/app.tsx` inside the `Theme` wrapper and `StrictMode`.
- `src/components/main/theme.tsx` is the `Theme` wrapper: `ThemeProvider` plus `CssBaseline` around `children`.
- `src/components/styles/theme.ts` is the host app's MUI theme: CSS variables on, light and dark color schemes following the OS, GNOME-like colors, ripples off. It styles the dev host only.
- `App` renders `<FileManager>` full-viewport. Its data comes from `src/components/main/mock-adapter.ts` (an in-memory adapter with simulated latency, keyed by full paths) and `mock-data.tsx` (the fake backends, section groups and demo actions). A folder named `restricted` deliberately fails to load, to show the error state.

Components live under `src/components/<area>/` (`main/` for the app shell, `styles/` for the theme, `file-manager/` for the component being built, `icons/`). File names are lowercase.

### File manager

`src/components/file-manager/` is the component headed for the package; `index.ts` is its public entry. It is a file manager for the web, so it has no built-in locations (no Home, Trash or Network): the consumer supplies everything through three props.

- **`adapter`** (`adapter.ts`) is the backend contract. It is lazy: `list(folderId, { signal })` returns `{ entries }` for one folder, called only when a folder is first opened or expanded. `FileEntry.id` is opaque to the component (a full path or a database id) and is only ever handed back to the adapter; the component never parses or joins paths. Grow the contract by adding optional members, never by changing `list`, so existing adapters keep working.
- **`sections`** is `SectionGroup[]`. Each `Section` (id, label, icon, `rootId`, optional own `adapter`) is an independent root, and sections have no connection to each other even when they share an adapter (e.g. `/server/project/a` and `/server/project/b`). The path bar starts with the section label, followed by the folders below its root.
- **`actions`** is `ActionGroup[]` for the context menu. An `ActionContext` says whether `entries` ("selection") or a folder's empty space ("folder") was targeted, and offers `refresh()` and `openFolder()`. The menu opens on right-click (items, content background, sidebar rows) and from the ⋮ buttons (list rows, path bar). When no action applies, the browser's own menu is left alone.

Internals:

- `data/folder-store.ts` caches listings per `folderKey(sectionId, folderId)`, shared by the sidebar tree and the content view, with request de-duplication and abort-on-unmount. Components read it through `useFolder` in `data/data-context.ts` (`useSyncExternalStore`, per-folder snapshots).
- `navigation.ts` holds the current `Place` (section plus a trail of `FolderRef`s) and back/forward history. Breadcrumbs come from the trail, not from parsing ids. Navigating expands every folder along the trail in the sidebar.
- `file-manager.tsx` is the frame (sidebar, header bar, inset content panel) and owns navigation, tree expansion, selection and the context menu state.
- `sidebar/location-item.tsx` renders a section row and its lazily loaded folder tree (`TreeRow` is the shared row). `header-bar/` holds back/forward, the path bar and view buttons. `content/folder-view.tsx` loads the open folder and shows the loading, empty and error states around the list view (`--columns` grid template) or the grid view. `context-menu/` renders the grouped action menu.
- `format.ts` formats sizes, dates and type labels. These are English-only for now.

**Responsiveness uses CSS container queries, not media queries,** so the component adapts to the box it is placed in rather than the viewport. `layout.ts` defines two named containers and their breakpoints: the root (`rootMedium`, `rootWide`: the sidebar docks at 900px or wider, otherwise it is an in-component overlay) and the content view (`viewMedium`, `viewWide`: which list columns show). Use these constants as `sx` keys; don't use `theme.breakpoints` or `useMediaQuery` inside the component. Dynamic geometry (tree depth) goes through CSS custom properties set in `style`, so the `sx` objects stay static at module scope.

Colors come only from palette tokens: `background.default` for window and sidebar, `background.paper` for the content panel, and `primary` with `action.selectedOpacity` for selection. Shared color helpers are in `styles.ts`, and read `theme.vars` when present so they work with or without CSS variables.

Because the code is headed for a package, the theme is the part to watch. A published component shouldn't force a global `CssBaseline` or its own `ThemeProvider` on consumers, so keep those in the host app wrapper and keep the component itself theme-agnostic.

## Icons

Icons live in `src/components/icons/`. Two packs are used, for different jobs:

- **`@mui/icons-material`** for UI/action icons (upload, delete, sort, view toggles...). Import each icon by path (`@mui/icons-material/FolderOutlined`), never from the package barrel. When the component becomes a package this should be a `peerDependency` next to `@mui/material`.
- **`@react-symbols/icons`** for colored file and folder type icons, chosen by file or folder name. Import from the `@react-symbols/icons/utils` subpath. Its SVGs have no intrinsic width/height, so `FileTypeIcon` and `FolderTypeIcon` in `file-icon.tsx` apply a default `size` of `1.5rem`; render them through those wrappers rather than directly.

The icon variant (`filled`, `outlined`, `rounded`, `sharp`, `twoTone`) is chosen by the consumer, not fixed. The pieces:

- `types.ts` defines `IconName` (the semantic names) and `IconSet = Record<IconName, IconComponent>`.
- `sets/<variant>.ts` maps every semantic name to that variant's MUI icon. The `IconSet` type makes the compiler reject a variant that is missing a name, so **adding an icon means adding the name to `IconName` and to all five `sets/` files**.
- `registry.ts` collects the sets into `iconSets`.
- `<IconProvider variant overrides>` sets the variant and per-icon replacements for a subtree, inheriting from a parent provider. `<Icon name variant?>` renders from that context, and its `variant` prop overrides the provider for that icon only. The default variant is `outlined` (`DEFAULT_ICON_VARIANT` in `context.ts`).

## Conventions

- **MUI styling rules** are in `.claude/rules/material-ui.md` and load automatically for `src/**/*.{ts,tsx}`. They cover module-scope `sx` objects typed with `SxProps<Theme>`, memoizing `sx` that depends on render-time values, and per-component imports like `@mui/material/Box` instead of the barrel import.
- Code in `src/` uses 4-space indentation, double quotes, and semicolons. The template-generated config files use 2 spaces and single quotes. Match the file you're editing.
- `tsconfig.app.json` is strict about a few things that commonly trip up edits:
  - `verbatimModuleSyntax`: type-only imports must use `import type`.
  - `erasableSyntaxOnly`: no `enum`, `namespace`, or constructor parameter properties.
  - `noUnusedLocals` and `noUnusedParameters` are errors in `bun run build`.
- Oxlint runs the `react`, `typescript` and `oxc` plugins with `react/rules-of-hooks` as an error and `react/only-export-components` as a warning. Type-aware linting is off.

## Repo settings

`.claude/settings.json` denies `git push` and requires confirmation for `git commit` and `rm`.
