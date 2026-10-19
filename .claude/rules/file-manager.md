---
paths:
  - "src/components/file-manager/**"
  - "src/hooks/**"
  - "src/store/**"
  - "src/contexts/data-context.ts"
  - "src/utils/**"
---

# File manager internals

`src/components/file-manager/file-manager.tsx` is the frame (sidebar, header bar, inset content panel). It owns navigation, tree expansion, the sort order, touch selection mode and the context menu state. Selection has its own rule, `selection.md`.

## Data

`store/folder-store.ts` caches listings per `folderKey(sectionId, folderId)`. The cache is shared by the sidebar tree and the content view, with request de-duplication and abort-on-unmount. `file-manager.tsx` provides the store through `DataContext` (`contexts/data-context.ts`), and components read it with `useFolder` (`hooks/use-folder.ts`), which uses `useSyncExternalStore` with per-folder snapshots.

## Navigation

`hooks/use-place-history.ts` holds the current `Place` (a section plus a trail of `FolderRef`s) and the back/forward history. `utils/navigation.ts` has `folderOf`, which returns the folder a place points at.

- Breadcrumbs come from the trail, not from parsing ids. The path bar starts with the section label, followed by the folders below its root.
- Navigating never expands or collapses the sidebar tree; only its chevrons do, and the path bar shows where you are. Only the first section shown starts expanded.

## Context menu and actions

An `ActionContext` says whether `entries` ("selection") or a folder's empty space ("folder") was targeted, and offers `refresh()` and `openFolder()`.

- Actions apply to any number of selected entries (copy, move, delete, compress...). Only actions marked `single: true`, such as rename, hide while several entries are selected.
- The menu opens on right-click (items, content background, sidebar rows) and from the ⋮ buttons (list rows, path bar).
- When no action applies, the browser's own menu is left alone.
- `context-menu/` renders the grouped menu from the groups that `utils/action-groups.ts` leaves visible.

## Sorting

Sorting is client-side, in `utils/sort.ts`. `file-manager.tsx` owns the `SortOrder` (a key of name, size, type or modified, plus a direction), which persists across folders, and `folder-view.tsx` sorts the listing with `entryComparator`.

- Folders always come first. Ties fall back to the name, A to Z.
- Picking a key starts it in its own direction: names and types A to Z, sizes and dates largest and newest first.
- Two controls share the order:
  - The header's chevron menu (`header-bar/view-menu.tsx`), with radios for the key and the direction.
  - The list view's column headers, where a click on the active column reverses it.

  The menu is the only control in the grid view, and in a list too narrow for its header row.
- The sidebar tree ignores it and stays by name (`compareEntries`). Section order is the consumer's.
- The same menu has a "Show hidden files" checkbox whose state isn't applied to listings yet.

## The parts

- `sidebar/location-item.tsx` renders a section row and its lazily loaded folder tree (`TreeRow` is the shared row).
- `header-bar/` holds back/forward, the path bar and the view buttons. Below `rootMedium` the path bar gets a full-width row under the buttons; from `rootMedium` up, it sits centred between them.
- `content/folder-view.tsx` loads the open folder and shows the loading, empty and error states around the list view (`file-list.tsx`, a `--columns` grid template) or the grid view (`file-grid.tsx`).
- `icon-slot.tsx` fits consumer-supplied icons to the same 1.25rem box as the built-in ones.
- `utils/format.ts` formats sizes, dates and type labels. These are English-only for now.
