---
paths:
  - "src/utils/trash.ts"
  - "src/types/adapter.ts"
  - "src/types/section.ts"
  - "src/types/action.ts"
  - "src/types/undo.ts"
  - "src/components/file-manager/file-manager.tsx"
  - "src/components/file-manager/content/trash-bar.tsx"
  - "src/components/file-manager/content/folder-view.tsx"
  - "src/components/file-manager/content/file-list.tsx"
  - "src/components/file-manager/dialogs/restore-dialog.tsx"
  - "src/components/file-manager/dialogs/delete-dialog.tsx"
  - "src/components/file-manager/dialogs/conflict-step.tsx"
  - "src/utils/permissions.ts"
  - "src/utils/sections.ts"
  - "src/store/folder-store.ts"
  - "playground/mocks/mock-adapter.ts"
  - "playground/mocks/mock-data.tsx"
---

# The trash

Entries can go to a trash and come back from it, as on a desktop: moved there at once, without asking, as GNOME Files, Finder and Windows do it, restored to where they were, deleted for good there, or all of it emptied. The file manager still has no built-in locations, so the trash is the backend's and the consumer's: the adapter moves entries there and back, and a section shows it. The user asked for it on 2026-10-25, with restoring undone and undone restoring (see `undo.md`), and chose that a restore asks about names its folders have now, as a paste does.

## What the adapter does

Two optional members (`types/adapter.ts`, public), and a field of the entries the trash lists:

- **`trash(entries, { signal })`** moves entries of one folder to the backend's trash, folders with everything in them, and may resolve with a `TrashResult`: the entries as they now are in the trash, one for each given, in their order. That's what lets the move be undone. Without `trash`, entries are only deleted, for good.
- **`restore(entries, { signal, conflict })`** (`RestoreOptions`) puts entries of the trash's root back in the folders they came from, which may be several, settling names those folders have now by `conflict` as `move` does, and making a folder that has gone again, or refusing with a message, as the backend likes. It may resolve with a `TrashResult` of the entries back in place, which lets the restore be undone.
- **`FileEntry.trashed`** (`TrashInfo`) is on each entry right in the trash's root: `trail`, the folders it was in, outermost first, from a section's root or above it, such as the top of the backend, down to its folder, and `trashedAt`. Ids are never parsed, so the trail is how the file manager knows where an entry came from. The store compares it all the way down (`ENTRY_DEPTHS` in `store/folder-store.ts`), so a trash listed again unchanged keeps its entry objects.
- **Emptying** goes through `delete`, with every entry the trash's root lists, read afresh.

## The section

`Section.trash` makes a section its adapter's trash, rooted where `trash` puts entries (`types/section.ts`, public). `utils/trash.ts` has what goes with it: `inTrashRoot`, `trashesOf` (an adapter's trash sections), `trashOrigin` (the folder an entry came from as a section's folder: the first section in the sidebar's order, served by the adapter and not a trash, whose root is in its trail, one that isn't `readOnly` first, the trail below that root), `trashedLocation` (where it came from written out, the section's label and the folders below its root, joined as a search's results are, or the whole trail when no section shows it) and `trashedDate`.

- **Nothing changes in it** but restoring and deleting for good: `sectionLocked` (`utils/sections.ts`) counts it as `readOnly` is counted, in `folderWritable` and `takesUploads`, so nothing is created, uploaded, pasted, dropped, renamed or moved there, and what's inside its folders stays as it is. Its entries aren't copied out either (`copyTo` and `copy` are missing, `inTrash` in `contextFor`), nor dragged (`heldUp`; the folder view's rows aren't `draggable`), as a trashed entry's id may only mean something to `restore` and `delete`. They're still opened, previewed, downloaded and shown in the properties, which is reading. The picker never offers it as a destination.
- **Its root's entries** are deleted for good (`delete`, by their own `delete` permission, `trashPermits`) and restored (`restore`, by their own `move`, when each has `trashed`). Folders below the root open and list as any do, read only.
- **A search everywhere leaves it out** (`searchTargets`), so trashed files don't turn up among the rest. A folder search filters it as any folder.
- **The list** in its root has the search's Location column, headed "Original location" (`trashLocation`), from `FolderView`'s `trashLocation` (`locateTrashed` in `file-manager.tsx`), handed to the views as `origins` with each entry itself, and its date column headed "Trashed" (`sortTrashed`), showing `trashedAt` (`Locale.describeListDate`) and ordered by it (the `modified` comparator goes by `trashedDate`, which is the date modified for any entry without `trashed`). The view menu names the order "Trashed" there too (`trashShown`). The grid shows the location under the name, as a search's results do. An empty root reads "Trash is empty" (`trashEmpty`) with the trash icon.
- **The trash bar** (`content/trash-bar.tsx`) sits above its root's listing in the content panel, out of the scrolling view, as Finder's and GNOME's do: the trash icon, `trashHint`, and "Empty trash…" (`trashEmptyButton`, in `error`), disabled while its listing is empty, missing when the adapter has no `delete`. It isn't shown over a search everywhere's results.

## Moving to the trash

`ActionContext.trash()` (`trashEntries` in `file-manager.tsx`) moves the entries at once, a folder's at a time, each through its own section's adapter, offered by `delete`'s rules (`permits("delete")`), when every one of their adapters has `trash` and they aren't in the trash already.

- While the adapter works, their folders and the trash show the progress bar over the content (`trashWork`, `TrashWork`, in `busy`). There's no panel, as moving to a trash is quick on any backend.
- Each folder's entries, once in the trash, go as deleted ones do (`applyTrashed`, which runs `applyGone`, shared with `applyDeleted`: out of the cache, the clipboard, the preview, and places inside a folder in the history ending at the folder that held it), and their folder and the trash are listed again.
- Done, it's announced (`trashDone`, "Moved 3 items to the trash"), and goes in the undo history (`recordChange("trash", …)`, with the notice's Undo) when one adapter served it all, it has `restore`, and it said what it put in the trash for every folder; otherwise it ends the history.
- One that fails stops there: the notice says so (`trashFailed`, with the adapter's message under it), it's announced, the folder and the trash are listed again, and it ends the history, as part of it may have gone.
- **Dropping** entries on the trash's root, its row in the sidebar or its open folder's empty space, moves them to the trash (`offerTrash`, through `dropInto`), Ctrl held or not, when they could be deleted, through the trash's adapter, by the same `trashEntries`. Files from the desktop are refused, as nothing is uploaded there.

## Restoring

`ActionContext.restore()` opens `dialogs/restore-dialog.tsx` (`RestoreRequest`: the trash, its adapter, the entries and where each goes back to, `trashOrigin`), which works as the paste dialog does: it lists each folder the entries go back to, when a section shows it, looks for names they have now with `entryClashes` (two trashed under one name going back to one folder clash with each other), and only shows to ask, with the shared clash step (`conflict-step.tsx`), titled `restoreTitle`. Clashes in one folder are named by it; in several, `ConflictMessage` takes `folderName` null and says `restoreConflictMessage` or `restoreSharedMessage`. A folder no section shows, or one that can't be listed, as it's gone, is the adapter's to settle.

- With the names settled, `restoreEntries` calls `restore` with the choice, the trash and those folders showing the progress bar. Skip passes "skip", leaving the skipped in the trash, and they aren't counted.
- Done, the entries that went leave the trash as deleted ones go (`applyRestored`), what came back may take ids that named other folders (`dropFolders` with none gone, as a new folder), and the trash and the folders are listed again, after a Replace or Merge the folders merged into all the way down (`relistTransferred`).
- It's announced (`restoreDone`), and goes in the history (`recordChange("restore", …)`) to be moved to the trash again, a folder's at a time, when the adapter said what it put back (`madePairs`), a section shows every folder it went to, nothing was replaced, and the adapter has `trash`; otherwise it ends the history.
- One that fails says so in the notice (`restoreFailed`), lists the trash and the folders again, and ends the history.

## Emptying

`ActionContext.emptyTrash()`, for a context whose folder is the trash's root (its empty space, its row, the path bar), and the trash bar's button, open the delete dialog with `emptiesTrash` (`emptyTrashOf`): "Empty the trash?" (`emptyTrashTitle`), `emptyTrashWarning` and "Empty trash" (`emptyTrash`). As the user confirms, it lists the trash afresh (`listTrash`, through `listingOf`), so nothing moved there meanwhile is left and nothing restored meanwhile is deleted, and deletes all of it, hidden entries too, with one `delete`. Done, it's announced (`emptyTrashDone`) and ends the history, as it takes away what an older move to the trash would restore. It's missing when the trash's listing is empty, or the adapter has no `delete`.

## The playground

The server adapter keeps a trash (`trash: "/trash"` in `createMockAdapter`), shown as the Trash section in a group of its own at the end of the sidebar, a plain place (`showFolders: false`), as GNOME Files has it. The mock keeps each trashed entry under an id of its own there (`Trashed`), so two of one name can be in it, its name, and the folder it came from, listed with `trashed` (the trail from its root, `trailOf`); a trashed folder is indexed under its id there, so it opens. Its `restore` makes a folder that has gone again (`folderMadeAt`), settles names as a move does, and leaves skipped entries in the trash. The media bucket's adapter has none, so it deletes for good.

The demo actions: Delete moves to the trash where there's one ("Move to trash"), with "Delete permanently…" on Shift+Delete, and deletes for good in the trash and in the media bucket; the trash's menu has Restore and, on its empty space or row, "Empty trash…"; Share hides in the trash. The preview's header has "Move to trash" in place of Delete where there's a trash.

## Not yet

- Showing a restored entry: nothing is selected or scrolled to, as GNOME Files does nothing either, and there's no "Open original location".
- The properties of an entry in the trash show where it is, the trash, rather than where it came from.
- An entry being moved to the trash or restored isn't held meanwhile, as a move's are (see "While a move runs" in `transfers.md`), since it's quick; acting on it meanwhile is left to the adapter.
- A trash through several adapters at once, as a search's results of several sections may be, is done, but can't be undone as one change, so it ends the history.
- Moving to the trash between adapters, or a trash an app's other adapter keeps: entries only go to their own adapter's trash.
