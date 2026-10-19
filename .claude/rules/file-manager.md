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

- `load(..., force)` lists a folder again even while a request is in flight, replacing it, since that request's result could predate a change just made.
- `forget(key)` drops a listing. Only use it on keys no enabled `useFolder` is showing, since nothing reloads them on its own.
- In the sidebar, a folder's listing, once there is one, overrides the adapter's `hasSubfolders` hint for its chevron.

## Navigation

`hooks/use-place-history.ts` holds the current `Place` (a section plus a trail of `FolderRef`s) and the back/forward history. `utils/navigation.ts` has `folderOf`, which returns the folder a place points at.

- Breadcrumbs come from the trail, not from parsing ids. The path bar starts with the section label, followed by the folders below its root.
- Navigating never expands or collapses the sidebar tree; only its chevrons do, and the path bar shows where you are. Only the first section shown starts expanded.

## Context menu and actions

An `ActionContext` says whether `entries` ("selection") or a folder's empty space ("folder") was targeted, and offers `refresh()` and `openFolder()`. It also offers `createFolder()`, `rename()`, `copyTo()`, `moveTo()`, `cut()`, `copy()`, `paste()` and `pasteInto()`, which are left out when the section's adapter lacks the matching method (`rename` also when there isn't exactly one entry, `copyTo`, `moveTo`, `cut` and `copy` when there are none, `paste` and `pasteInto` when there's nothing to paste there, `pasteInto` also unless the entries are a single folder), so actions hide with `visible: (context) => !!context.rename`, or grey out with `disabled`. The consumer still places, labels and gates these actions; the file manager adds nothing to the menu itself.

- Actions apply to any number of selected entries (copy, move, delete, compress...). Only actions marked `single: true`, such as rename, hide while several entries are selected.
- The menu opens on right-click (items, content background, sidebar rows) and from the ⋮ buttons (list rows, path bar).
- When no action applies, the browser's own menu is left alone.
- `context-menu/` renders the grouped menu from the groups that `utils/action-groups.ts` leaves visible.
- An action's `shortcut` is also a key binding (`utils/shortcut.ts`; Ctrl matches ⌘ too). `folder-view.tsx` takes focus on any press (`tabIndex={-1}`) and hands key presses to `runShortcut` in `file-manager.tsx`, which tries the selection first and then the open folder, through the same `contextFor` and visibility rules as the menu. Shortcuts only work in the content for now, not the sidebar. Browsers keep some keys for themselves: Chrome never passes Shift+Ctrl+N (or Ctrl+N, Ctrl+T, Ctrl+W) to a page.

## Creating and renaming

Both use one small modal, `dialogs/name-dialog.tsx`, rather than editing names inline, because the listing only holds what the adapter returned, and an inline edit has nowhere to keep a failed name. The adapter's optional `createFolder(parentId, name, { signal })` and `rename(entry, name, { signal })` resolve with the entry as it now is.

- The name is trimmed and checked as it's typed (`utils/names.ts`): not ".", "..", or containing "/", and no clash with the folder's cached listing. An empty name only disables the button. The adapter has the final say, and the message of an `Error` it rejects with shows under the field, with the name kept.
- The field is focused with the name selected once the dialog has faded in (the transition's `onEntered`), not with `autoFocus`, which the closing context menu steals focus back from. Rename selects a file's name up to its extension. New folder starts with an unused "New folder" (`newFolderName`). An unchanged name just closes.
- While the adapter works, the button shows a spinner and the field is read-only. Cancelling aborts the `signal`, but the folder is listed again anyway, since the change may already have been made.
- Afterwards the folder is listed again, and so is its parent's listing when cached, for the item count. If the folder is open, `file-manager.tsx` asks `FolderView` (`revealId`) to select the entry and scroll to it once the refreshed listing has it.
- A renamed folder keeps its place: `renameInPlace` (`utils/navigation.ts`) rewrites every place in the history, and its expanded state carries over. When its id changed, as path ids do, the ids below it can't be worked out, so trails into it end at the renamed folder. Listings cached under the old id and the new one are dropped, since with path ids either could hold another folder's contents.

## Copying and moving

"Copy to…" and "Move to…" ask for a destination in `dialogs/transfer-dialog.tsx`, then call the adapter's optional `copy(entries, targetId, { signal, conflict })` or `move(...)`. The call itself, with cancelling, the error and the refresh afterwards, is `hooks/use-transfer.ts`, shared with pasting; the Replace / Keep both / Skip step is `dialogs/conflict-step.tsx`.

- The picker browses folders only, starting in the entries' own folder, with the path bar and a back arrow to the folder above. Only sections served by the same adapter object are offered (ids mean nothing to another adapter); with more than one, going back from a root reaches a list of them.
- The entries being copied or moved can't be opened, so a folder can never go into itself or below itself, without the component parsing ids. Moving into the entries' own folder is disabled.
- Before running, the destination's cached listing is checked for names the entries share. Clashes get a second step with Replace, Keep both and Skip, passed as `conflict`; otherwise `conflict` is "keepBoth", so a clash the cache missed never overwrites anything. Copying into the entries' own folder keeps both without asking, as a duplicate.
- Progress, cancelling and errors work as in the name dialog. Afterwards the destination is listed again, and for a move the source too.
- After a move, listings cached under moved folders' ids are dropped, and a place inside a moved folder goes to the destination instead.
- Not yet: a New folder button in the picker, drag and drop, an operations panel for long transfers, and copying between adapters.

## Cut, copy and paste

`ActionContext.cut()` and `copy()` put the entries on a clipboard held in `file-manager.tsx` (`Clipboard`, `types/clipboard.ts`), not the system clipboard, since ids mean nothing outside their adapter. `paste()` moves (cut) or copies them into the context's `folder`, and `pasteInto()` into the one folder in `entries`, so a folder's menu can offer "Paste into folder", in the content and the sidebar tree alike. Both go through the same adapter methods as "Move to…" and "Copy to…". The consumer's actions bind Ctrl+X, Ctrl+C and Ctrl+V like any other shortcut.

- `paste` is offered (`utils/clipboard.ts`, `canPaste`) only through the adapter the entries came from, never into one of them or below one (the target's trail holds every folder above it, so no id is parsed), not into cut entries' own folder, and not while another paste runs. Copying into the entries' own folder duplicates them, as "keep both".
- `dialogs/paste-dialog.tsx` runs the paste unseen, with the open folder's progress bar showing (`busy`), and only shows to ask about clashing names, found in the target's cached listing, or to report the adapter's error. Afterwards the target is listed again, so is its parent when cached (for its item count), and the source after a cut.
- A cut is pasted once and leaves the clipboard; a copy can be pasted again. Entries moved by either route leave the clipboard (their ids may have changed), and a renamed entry is replaced by its new self. Entries below a renamed folder keep their stale ids, and pasting them reports the adapter's error.
- Cut entries are marked wherever they're listed: `CutContext` (`contexts/cut-context.ts`) carries their ids and adapter, `hooks/use-cut-ids.ts` gives a section the ids it could be showing, and list rows, grid tiles and sidebar tree rows set `data-cut` for `cutMarker` (see `component-styling.md`).
- Ctrl+V pastes into the open folder even with a folder selected, as in GNOME; the playground's "Paste into folder" has no shortcut.
- Not yet: the shortcuts in the sidebar.

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

- `sidebar/location-item.tsx` renders a section row and its lazily loaded folder tree (`TreeRow` is the shared row). A section with `showFolders: false` is a plain GNOME-style place: no chevron, no tree, and it never starts expanded. The default is `true`.

## Single section

`FileManager` takes either `sections` (groups) or a single `section`, never both; `FileManagerProps` is a union that enforces it, and `defaultSectionId` only exists with `sections`. Inside, a single section becomes one group of one, so navigation, the store and the path bar don't tell the modes apart. Only the sidebar does:

- `SectionTree` (in `location-item.tsx`) lists the root's folders as the sidebar's top level, with no section row and nothing to collapse. The root loads straight away and shows loading, empty ("No folders") and error rows in place of the tree.
- The root itself is reached through the path bar's first crumb, since there is no row for it. There is no sidebar menu for the root either; the content background's menu covers it.
- With `showFolders: false`, the single section falls back to its plain row, so the sidebar isn't empty.

The playground shows this mode with `?single` in the URL.
- `header-bar/` holds back/forward, the path bar and the view buttons. Below `rootMedium` the path bar gets a full-width row under the buttons; from `rootMedium` up, it sits centred between them.
- `content/folder-view.tsx` loads the open folder and shows the loading, empty and error states around the list view (`file-list.tsx`, a `--columns` grid template) or the grid view (`file-grid.tsx`).
- `dialogs/` holds the modals, which portal to `<body>` like the context menu: `name-dialog.tsx`, `transfer-dialog.tsx` and `paste-dialog.tsx`, with `conflict-step.tsx` shared by the last two.
- `icon-slot.tsx` fits consumer-supplied icons to the same 1.25rem box as the built-in ones.
- `utils/format.ts` formats sizes, dates and type labels. These are English-only for now.
