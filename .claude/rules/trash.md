---
paths:
  - "src/utils/trash.ts"
  - "src/utils/transfer.ts"
  - "src/utils/undo.ts"
  - "src/components/file-manager/notice-bar.tsx"
  - "src/components/file-manager/properties-pane.tsx"
  - "src/components/properties/properties-panel.tsx"
  - "src/types/properties.ts"
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

Entries can go to a trash and come back from it, as on a desktop: moved there at once, without asking, as GNOME Files, Finder and Windows do it, restored to where they were, deleted for good there, or all of it emptied. The file manager still has no built-in locations, so the trash is the backend's and the consumer's: the adapter moves entries there and back, and a section shows it. The user asked for it on 2026-10-25, with restoring undone and undone restoring (see `undo.md`), and chose that a restore asks about names its folders have now, as a paste does, and on 2026-10-26 that a restore's notice offers Show beside Undo.

## What the adapter does

Two optional members (`types/adapter.ts`, public), and a field of the entries the trash lists:

- **`trash(entries, { signal })`** moves entries of one folder to the backend's trash, folders with everything in them, and may resolve with a `TrashResult`: the entries as they now are in the trash, one for each given, in their order. That's what lets the move be undone. Without `trash`, entries are only deleted, for good.
- **`restore(entries, { signal, conflict })`** (`RestoreOptions`) puts entries of the trash's root back in the folders they came from, which may be several, settling names those folders have now by `conflict` as `move` does, and making a folder that has gone again, or refusing with a message, as the backend likes. It may resolve with a `TrashResult` of the entries back in place, which lets the restore be undone.
- **`FileEntry.trashed`** (`TrashInfo`) is on each entry right in the trash's root: `trail`, the folders it was in, outermost first, from a section's root or above it, such as the top of the backend, down to its folder, and `trashedAt`. Ids are never parsed, so the trail is how the file manager knows where an entry came from. The store compares it all the way down (`ENTRY_DEPTHS` in `store/folder-store.ts`), so a trash listed again unchanged keeps its entry objects.
- **Emptying** goes through `delete`, with every entry the trash's root lists, read afresh.

## The section

`Section.trash` makes a section its adapter's trash, rooted where `trash` puts entries (`types/section.ts`, public). `utils/trash.ts` has what goes with it: `inTrashRoot`, `trashesOf` (an adapter's trash sections), `trashOrigin` (the folder an entry came from as a section's folder: the first section in the sidebar's order, served by the adapter and not a trash, whose root is in its trail, one that isn't `readOnly` first, the trail below that root), `trashedLocation` (where it came from written out, the section's label and the folders below its root, joined as a search's results are, or the whole trail when no section shows it) and `trashedDate`.

- **Nothing changes in it** but restoring and deleting for good: `sectionLocked` (`utils/sections.ts`) counts it as `readOnly` is counted, in `folderWritable` and `takesUploads`, so nothing is created, uploaded, pasted, dropped, renamed or moved there, and what's inside its folders stays as it is. Its entries aren't copied out either (`copyTo` and `copy` are missing, `inTrash` in `contextFor`), nor dragged (`heldUp`; the folder view's rows aren't `draggable`), as a trashed entry's id may only mean something to `restore` and `delete`. They're still opened, previewed, downloaded and shown in the properties, which is reading. The picker never offers it as a destination.
- **Its root's entries** are deleted for good (`delete`, by their own `delete` permission, `trashPermits`) and restored (`restore`, by their own `move`, when each has `trashed`), into folders that can take them: the folder each goes back to, as a section shows it, isn't refused by its permissions as cached, nor being moved or held by the trash's work (`restorable` in `contextFor`, `folderPermits`, `folderMoving`), whichever section shows it, its `readOnly` aside, as a restore is the trash's, not that section's. A folder no section shows is the adapter's to refuse. One alone opens the folder it came from (`openOrigin`, "Open original location", when a section shows it, by `trashOrigin`), as GNOME's trash offers, closing the preview first from its header. Folders below the root open and list as any do, read only.
- **A search everywhere leaves it out** (`searchTargets`), so trashed files don't turn up among the rest. A folder search filters it as any folder.
- **The list** in its root has the search's Location column, headed "Original location" (`trashLocation`), from `FolderView`'s `trashLocation` (`locateTrashed` in `file-manager.tsx`), handed to the views as `origins` with each entry itself, and its date column headed "Trashed" (`sortTrashed`), showing `trashedAt` (`Locale.describeListDate`) and ordered by it (the `modified` comparator goes by `trashedDate`, which is the date modified for any entry without `trashed`). It's ordered by the original location too, as a search's results are by theirs, from its column's header or the view menu (the `sort` key "location", `folderSort`'s `located`, the folder view's `locationOf` from `trashLocation`; see "Sorting" in `file-manager.md`), as GNOME's and Windows' trashes are. The view menu names the orders "Original location" and "Trashed" there too (`trashShown`). The grid shows the location under the name, as a search's results do. An empty root reads "Trash is empty" (`trashEmpty`) with the trash icon.
- **The properties** of an entry right in its root, the selection's or a trashed folder opened, show where it came from in place of its location, as GNOME's do: "Original location" (`propertiesOriginalLocation`), written out as the list's column is (`locateIn` in `file-manager.tsx`, the pane's `locateTrashed`, into `PropertiesItem.trashed`), "Several folders" for several from different ones, then "Trashed" (`propertiesTrashed`), when it was moved there, for one; and "Open original location" (`propertiesOpenOriginalLocation`) under the name, from `openOrigin`. The panel knows nothing of trashes, only of an item's `trashed` place and date (see `properties.md`).
- **The trash bar** (`content/trash-bar.tsx`) sits above its root's listing in the content panel, out of the scrolling view, as Finder's and GNOME's do: the trash icon, `trashHint`, and "Empty trash…" (`trashEmptyButton`, in `error`), disabled while its listing is empty, missing when the adapter has no `delete`. It isn't shown over a search everywhere's results.

## Moving to the trash

`ActionContext.trash()` (`trashEntries` in `file-manager.tsx`) moves the entries at once, a folder's at a time, each through its own section's adapter, offered by `delete`'s rules (`permits("delete")`), when every one of their adapters has `trash` and they aren't in the trash already.

- While the adapter works, their folders and the trash show the progress bar over the content (`trashWork`, `TrashWork`, in `busy`). There's no panel, as moving to a trash is quick on any backend.
- **They're held meanwhile**, as a move's entries are (see "While a move runs" in `transfers.md`): `TrashWork.entries` go into `moving` with the moves' (`movingIds`' `held`), each with what holds it (`TrashWork.kind`, a `MovingKind`), so they're marked (`data-moving`), and so is everything in a folder among them (`heldBy`), read "Being moved to the trash" or "Being restored" in place of the moves' "Being moved" (`entryTrashing`, `entryRestoring`, by `heldText`; in the picker, `pickerTrashing` and `pickerRestoring` by `pickerHeldText`). They aren't renamed, moved, copied, deleted, dragged or moved to the trash again, and a folder among them takes nothing in. So are the entries a restore puts back, in the trash, and those an undo or redo moves to the trash or restores (`carryOut` calls `startTrashWork` with no folders, its run showing the bar).
- Each folder's entries, once in the trash, go as deleted ones do (`applyTrashed`, which runs `applyGone`, shared with `applyDeleted`: out of the cache, the clipboard, the preview, and places inside a folder in the history ending at the folder that held it), and their folder and the trash are listed again.
- Done, it's announced (`trashDone`, "Moved 3 items to the trash"), and goes in the undo history (`recordChange("trash", …)`, with the notice's Undo) when every folder's adapter has `restore` and said what it put in the trash; otherwise it ends the history. A search's results of several sections on different adapters go in as one step, each part with its own adapter (`UndoRestore.adapter`; see "Several adapters" in `undo.md`).
- One that fails stops there: the notice says so (`trashFailed`, with the adapter's message under it), it's announced, the folder and the trash are listed again, and it ends the history, as part of it may have gone. The folders that went before it go in as a change of their own, to be restored by Ctrl+Z or the main menu, when they'd have gone in had it all gone.
- **Dropping** entries on the trash's root, its row in the sidebar or its open folder's empty space, moves them to the trash (`offerTrash`, through `dropInto`), Ctrl held or not, when they could be deleted, through the trash's adapter, by the same `trashEntries`. Files from the desktop are refused, as nothing is uploaded there.

## Restoring

`ActionContext.restore()` opens `dialogs/restore-dialog.tsx` (`RestoreRequest`: the trash, its adapter, the entries and where each goes back to, `trashOrigin`), which works as the paste dialog does: it lists each folder the entries go back to, when a section shows it, looks for names they have now with `entryClashes` (two trashed under one name going back to one folder clash with each other), and only shows to ask, with the shared clash step (`conflict-step.tsx`), titled `restoreTitle`. Clashes in one folder are named by it; in several, `ConflictMessage` takes `folderName` null and says `restoreConflictMessage` or `restoreSharedMessage`. A folder no section shows, or one that can't be listed, as it's gone, is the adapter's to settle.

- With the names settled, `restoreEntries` calls `restore` with the choice, the trash and those folders showing the progress bar. Skip passes "skip", leaving the skipped in the trash, and they aren't counted.
- Done, the entries that went leave the trash as deleted ones go (`applyRestored`), what came back may take ids that named other folders (`dropFolders` with none gone, as a new folder), and the trash and the folders are listed again, after a Replace or Merge the folders merged into all the way down (`relistTransferred`).
- It's announced (`restoreDone`), and goes in the history (`recordChange("restore", …)`) to be moved to the trash again, a folder's at a time, when the adapter said what it put back (`madePairs`), a section shows every folder it went to, nothing was replaced, and the adapter has `trash`; otherwise it ends the history.
- **What came back is shown** (`revealRestored`): where the folder it went back to is open, in whichever section shows it, as after undoing a move to the trash there, it's selected and scrolled to, all of it together (`Reveal.with`, `FolderView`'s `revealWith`, as the user chose on 2026-10-26). The folders that aren't open (`UndoNotice.show`) the notice's **Show** beside Undo opens (`showRestored`, `NoticeBar`'s `showLabel`), shown even when the restore can't be undone: one folder, with what went into it selected, ending a search, and taking the focus into it (`handleNoticeShow`), as "Open item location" does; several are listed under it, each by its name with where it is under it, as the back and forward lists name places (`showPlaces`, `placeName`), and the one picked opens so, the notice staying while the list is open and after, for the next. Without what the adapter put back, Show only opens a folder, and with no section showing the folder, it isn't listed. An undo or redo's restore does the same, through `undoTools`.
- One that fails says so in the notice (`restoreFailed`), lists the trash and the folders again, and ends the history.

## Emptying

`ActionContext.emptyTrash()`, for a context whose folder is the trash's root (its empty space, its row, the path bar), and the trash bar's button, open the delete dialog with `emptiesTrash` (`emptyTrashOf`): "Empty the trash?" (`emptyTrashTitle`), `emptyTrashWarning` and "Empty trash" (`emptyTrash`). As the user confirms, it lists the trash afresh (`listTrash`, through `listingOf`), so nothing moved there meanwhile is left and nothing restored meanwhile is deleted, and deletes all of it, hidden entries too, with one `delete`, but what's being restored as the user confirms (held, `movingThrough`), which stays in the trash should the restore fail. Done, it's announced (`emptyTrashDone`) and ends the history, as it takes away what an older move to the trash would restore. It's missing when the trash's listing is empty, or the adapter has no `delete`.

## The playground

The server adapter keeps a trash (`trash: "/trash"` in `createMockAdapter`), shown as the Trash section in a group of its own at the end of the sidebar, a plain place (`showFolders: false`), as GNOME Files has it. The mock keeps each trashed entry under an id of its own there (`Trashed`), so two of one name can be in it, its name, and the folder it came from, listed with `trashed` (the trail from its root, `trailOf`); a trashed folder is indexed under its id there, so it opens. Its `restore` makes a folder that has gone again (`folderMadeAt`), settles names as a move does, and leaves skipped entries in the trash. The media bucket's adapter has none, so it deletes for good.

The demo actions: Delete moves to the trash where there's one ("Move to trash"), with "Delete permanently…" on Shift+Delete, and deletes for good in the trash and in the media bucket; the trash's menu has Restore, "Open original location" for one entry, and, on its empty space or row, "Empty trash…"; Share hides in the trash. The preview's header has "Move to trash" in place of Delete where there's a trash.

## By choice

Not gaps:

- Each entry goes to its own adapter's trash, and a drop of another adapter's entries on a trash is refused (`offerTrash`), though entries are copied and moved between adapters elsewhere (see "Between adapters" in `transfers.md`): a backend's trash holds its own, as Drive's, Dropbox's and OneDrive's do, and each disk's on a desktop, and what's in it is only restored where it came from. An app wanting one trash over several backends serves them through one adapter.
- Entries leave the trash by being restored or deleted for good, not moved, copied or dragged elsewhere, as a trashed entry's id may only mean something to `restore` and `delete`, as in Drive and Dropbox; restoring and then moving does it. Entries inside a trashed folder aren't restored by themselves, as on the desktops.
- Emptying the trash and deleting for good aren't undone (see `undo.md`).
