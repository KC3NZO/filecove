# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A client-side file manager React component built with React 19, TypeScript, Vite 8 and Material UI (`@mui/material` 9.x). It will later be extracted and published as a package, so write components with that in mind: self-contained, with no app-specific assumptions baked in. `src/` is the component and nothing else, laid out as it will be published. The Vite app in `playground/` is its development host and is never published.

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

### Playground

- `index.html` loads `playground/main.tsx`, which mounts `<App />` from `playground/app.tsx` inside the `Theme` wrapper and `StrictMode`.
- `playground/theme.tsx` is the `Theme` wrapper: `ThemeProvider` plus `CssBaseline` around `children`.
- `playground/styles/theme.ts` is the host app's MUI theme: CSS variables on, light and dark color schemes following the OS, GNOME-like colors, ripples off. It styles the dev host only.
- `App` renders `<FileManager>` full-viewport, imported from `src/index.ts` as a consumer of the package would. Its data comes from `playground/mocks/mock-adapter.ts` (an in-memory adapter with simulated latency, keyed by full paths) and `mock-data.tsx` (the fake backends, section groups and demo actions). A folder named `restricted` deliberately fails to load, to show the error state.

### Source layout

`src/` is organised by kind of code, and `src/components/` holds only components. File names are lowercase.

- `index.ts` is the package's public entry. It exports `FileManager`, `IconProvider` and the public types, and nothing else is public.
- `components/` has `file-manager/` (the frame and its parts) and `icons/` (`Icon`, `IconProvider`, the file-type icons).
- `types/` holds the shared and exported types, one file per domain (`adapter`, `section`, `action`, `navigation`, `menu`, `view`, `folder`, `icon`), all re-exported from `types/index.ts`. Files marked internal stay out of `src/index.ts`. A component's or context's own props and state types stay in its own file.
- `hooks/`, `contexts/` and `store/` hold the React hooks, the contexts and the folder listing store.
- `utils/` holds plain functions: formatting, menu positions, action filtering, `folderOf`.
- `styles/` holds the container-query constants (`layout.ts`) and shared style helpers (`mixins.ts`).
- `icon-sets/` holds the per-variant icon maps and their registry.

Imports are relative, with no path alias. The only barrels are `src/index.ts` and `src/types/index.ts`; everything else is imported by file, e.g. `components/icons/icon`.

### File manager

`src/components/file-manager/file-manager.tsx` is the component headed for the package. It is a file manager for the web, so it has no built-in locations (no Home, Trash or Network): the consumer supplies everything through three props.

- **`adapter`** (`types/adapter.ts`) is the backend contract. It is lazy: `list(folderId, { signal })` returns `{ entries }` for one folder, called only when a folder is first opened or expanded. `FileEntry.id` is opaque to the component (a full path or a database id) and is only ever handed back to the adapter; the component never parses or joins paths. Grow the contract by adding optional members, never by changing `list`, so existing adapters keep working.
- **`sections`** is `SectionGroup[]`. Each `Section` (id, label, icon, `rootId`, optional own `adapter`) is an independent root, and sections have no connection to each other even when they share an adapter (e.g. `/server/project/a` and `/server/project/b`). The path bar starts with the section label, followed by the folders below its root.
- **`actions`** is `ActionGroup[]` for the context menu. An `ActionContext` says whether `entries` ("selection") or a folder's empty space ("folder") was targeted, and offers `refresh()` and `openFolder()`.
  - Actions apply to any number of selected entries (copy, move, delete, compress...). Only actions marked `single: true`, such as rename, hide while several entries are selected.
  - The menu opens on right-click (items, content background, sidebar rows) and from the ⋮ buttons (list rows, path bar).
  - When no action applies, the browser's own menu is left alone.

Internals:

- `store/folder-store.ts` caches listings per `folderKey(sectionId, folderId)`, shared by the sidebar tree and the content view, with request de-duplication and abort-on-unmount. `file-manager.tsx` provides the store through `DataContext` (`contexts/data-context.ts`), and components read it with `useFolder` (`hooks/use-folder.ts`), which uses `useSyncExternalStore` with per-folder snapshots.
- `hooks/use-place-history.ts` holds the current `Place` (a section plus a trail of `FolderRef`s) and the back/forward history. `utils/navigation.ts` has `folderOf`, which returns the folder a place points at.
  - Breadcrumbs come from the trail, not from parsing ids.
  - Navigating expands every folder along the trail in the sidebar.
- `file-manager.tsx` is the frame (sidebar, header bar, inset content panel) and owns navigation, tree expansion and the context menu state.
- **The content and the sidebar tree each have their own selection, and the two are never merged.** Both follow `nextSelection` (`utils/selection.ts`):
  - a click selects one entry;
  - Ctrl or ⌘ toggles one;
  - Shift selects a range from the anchor;
  - Ctrl+Shift adds the range to the selection.

  In both panes, right-clicking a selected item (or using its ⋮) acts on that pane's whole selection, and any other item is selected alone first.
  - **Content:** `content/folder-view.tsx` holds the selection through `hooks/use-selection.ts`. The view remounts per folder, so every folder opens with nothing selected.
  - **Marquee (rubber band):** `hooks/use-marquee.ts`, content only, mouse only (on touch a drag scrolls). A press on blank space that moves 4px draws a rectangle, and every entry it touches is selected (`marqueeSelection`): plain replaces, Shift adds, Ctrl or ⌘ flips.
    - Entries are found by `data-entry-id`. Presses on `data-no-marquee` parts (a grid tile, a list row's icon and name) or on buttons stay clicks.
    - Dragging near the panel's top or bottom edge scrolls it.
    - The rectangle is moved through CSS custom properties without re-rendering. The view only re-renders when the covered entries change.
    - The click that ends a drag is swallowed so it doesn't clear the new selection.
  - **Touch:** there are no modifier keys, so the content has a selection mode instead. It is on while `file-manager.tsx`'s `selectingKey` equals the open folder's key, so opening another folder ends it.
    - Two ways in: long-pressing an entry (`hooks/use-long-press.ts`, 500 ms on its own timer, since iOS never fires `contextmenu` for a long-press), which selects it; or the header's Select button, shown only under `@media (hover: none)`.
    - In the mode every tap toggles, a tap on empty space does nothing, and `content/selection-bar.tsx` (sticky at the panel's bottom) offers ✕, the count, Select all or none, and ⋮ for the selection's menu. Leaving the mode clears the selection. Rows and tiles show check badges (`content/item-icon.tsx`, keyed off `data-selecting` and `data-selected`).
    - Outside it, a touch tap opens a folder rather than selecting it.
    - `folder-view.tsx` reads each press's `pointerType` rather than the device, so hybrid devices get both behaviours. A touch press's `contextmenu` is swallowed, since a long-press means select.
    - The sidebar tree has no touch selection.
  - **Sidebar:** `sidebar/sidebar.tsx` holds the selection through `hooks/use-tree-selection.ts`, keyed by `folderKey`.
    - A plain click opens a folder; only Ctrl and Shift select without opening.
    - Until then, and again after any navigation, the open folder alone counts as selected.
    - Selected folders are always siblings, so a menu's `ActionContext` has one parent `folder`. A modifier click under another parent starts a new selection.
    - Section rows are roots and never join a folder selection.
    - Rows show the selection as a background and the open folder as accent text, since the two can differ.
- The parts, in `components/file-manager/`:
  - `sidebar/location-item.tsx` renders a section row and its lazily loaded folder tree (`TreeRow` is the shared row).
  - `header-bar/` holds back/forward, the path bar and view buttons.
  - `content/folder-view.tsx` loads the open folder and shows the loading, empty and error states around the list view (`--columns` grid template) or the grid view.
  - `context-menu/` renders the grouped action menu, from the groups that `utils/action-groups.ts` leaves visible.
- `utils/format.ts` formats sizes, dates and type labels. These are English-only for now.

**Responsiveness uses CSS container queries, not media queries,** so the component adapts to the box it is placed in rather than the viewport. `styles/layout.ts` defines two named containers and their breakpoints: the root (`rootMedium`, `rootWide`: the sidebar docks at 900px or wider, otherwise it is an in-component overlay) and the content view (`viewMedium`, `viewWide`: which list columns show). Use these constants as `sx` keys; don't use `theme.breakpoints` or `useMediaQuery` inside the component. Dynamic geometry (tree depth) goes through CSS custom properties set in `style`, so the `sx` objects stay static at module scope.

Colors come only from palette tokens: `background.default` for window and sidebar, `background.paper` for the content panel, and `primary` with `action.selectedOpacity` for selection. Shared color helpers are in `styles/mixins.ts`, and read `theme.vars` when present so they work with or without CSS variables.

Because the code is headed for a package, the theme is the part to watch. A published component shouldn't force a global `CssBaseline` or its own `ThemeProvider` on consumers, so keep those in the host app wrapper and keep the component itself theme-agnostic.

## Icons

The icon components live in `src/components/icons/`, their types in `src/types/icon.ts`, and the per-variant maps in `src/icon-sets/`. Two packs are used, for different jobs:

- **`@mui/icons-material`** for UI/action icons (upload, delete, sort, view toggles...). Import each icon by path (`@mui/icons-material/FolderOutlined`), never from the package barrel. When the component becomes a package this should be a `peerDependency` next to `@mui/material`.
- **`@react-symbols/icons`** for colored file and folder type icons, chosen by file or folder name. Import from the `@react-symbols/icons/utils` subpath. Its SVGs have no intrinsic width/height, so `FileTypeIcon` and `FolderTypeIcon` in `file-icon.tsx` apply a default `size` of `1.5rem`; render them through those wrappers rather than directly.

The icon variant (`filled`, `outlined`, `rounded`, `sharp`, `twoTone`) is chosen by the consumer, not fixed. The pieces:

- `types/icon.ts` defines:
  - `IconName`, the semantic names.
  - `IconSet = Record<IconName, IconComponent>`.
  - `IconSource`, either a name or any element, which is what sections and actions take.
- `icon-sets/<variant>.ts` maps every semantic name to that variant's MUI icon. The `IconSet` type makes the compiler reject a variant that is missing a name, so **adding an icon means adding the name to `IconName` and to all five `icon-sets/` variant files**.
- `icon-sets/registry.ts` collects the sets into `iconSets`.
- `<IconProvider variant overrides>` sets the variant and per-icon replacements for a subtree, inheriting from a parent provider. It is exported from the package entry.
- `<Icon name variant?>` renders from that context, and its `variant` prop overrides the provider for that icon only.
- The context and its default variant, `outlined` (`DEFAULT_ICON_VARIANT`), are in `contexts/icon-context.ts`. Components read the context with `useIconConfig` (`hooks/use-icon-config.ts`).

## Conventions

- **MUI styling rules** are in `.claude/rules/material-ui.md` and load automatically for `.ts` and `.tsx` files in `src/` and `playground/`. They cover:
  - module-scope `sx` objects typed with `SxProps<Theme>`;
  - memoizing `sx` that depends on render-time values;
  - per-component imports like `@mui/material/Box` instead of the barrel import.
- **Type placement rules** are in `.claude/rules/types.md` and load for `src/`. Shared or exported types go in `src/types/`, and props and state types stay with their component or context.
- Code in `src/` and `playground/` uses 4-space indentation, double quotes, and semicolons. The template-generated config files use 2 spaces and single quotes. Match the file you're editing.
- `tsconfig.app.json` is strict about a few things that commonly trip up edits:
  - `verbatimModuleSyntax`: type-only imports must use `import type`.
  - `erasableSyntaxOnly`: no `enum`, `namespace`, or constructor parameter properties.
  - `noUnusedLocals` and `noUnusedParameters` are errors in `bun run build`.
- Oxlint runs the `react`, `typescript` and `oxc` plugins with `react/rules-of-hooks` as an error and `react/only-export-components` as a warning. Type-aware linting is off.

## Repo settings

`.claude/settings.json` denies `git push` and requires confirmation for `git commit` and `rm`.
