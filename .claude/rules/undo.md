---
paths:
  - "src/types/undo.ts"
  - "src/utils/undo.ts"
  - "src/components/file-manager/file-manager.tsx"
  - "src/components/file-manager/notice-bar.tsx"
  - "src/components/file-manager/sidebar/main-menu.tsx"
  - "src/components/file-manager/dialogs/delete-dialog.tsx"
  - "src/store/transfer-queue.ts"
  - "src/types/adapter.ts"
  - "src/utils/shortcut.ts"
  - "playground/mocks/mock-adapter.ts"
  - "playground/app.tsx"
---

# Undo

Changes made through the file manager can be undone, several steps back, and done again once undone, as in Windows and macOS, where GNOME Files keeps only the last. Ctrl+Z undoes, Shift+Ctrl+Z or Ctrl+Y redoes, the main menu has "Undo rename" and "Redo move" as in GNOME 46, and each change shows a notice over the content with Undo, as Drive and Dropbox do. The user chose the notice and the several steps on 2026-10-25.

## What can be undone

| Change | Undone | Redone |
|---|---|---|
| Rename (`rename`) | renamed back | renamed again |
| New folder, from the menu or the picker (`newFolder`) | deleted, only while it's still empty | made again, by its name |
| Copy, by the picker, a paste or a drop (`copy`) | the copies deleted, once the delete dialog confirms | copied again, keeping both |
| Move, by the picker, a paste or a drop (`move`) | moved back, each to the folder it came from, taking back its own name when it was kept both on the way in under another and the name is free | moved again, keeping both |

- **Several steps**: 20 by default, the oldest going first, or as many as `limits.undoSteps` says (0 for none; see "Limits" in `props.md`). Redoing is possible until another change is made, as in any editor.
- **The steps** (`UndoStep`, `types/undo.ts`, internal) each hold the change (`UndoChange`, public, for the text), the adapter, and the `UndoAction` that undoes it on the undo list, or redoes it on the redo list. Carrying one out makes the action that goes back the other way (rename and rename, `remove` and `create`, `removeCopies` and `copy`, `move` and `move`).
- **What ends the history**: a change made through the file manager that can't be undone clears both lists, so undoing never goes back past it to an older change, which would have to undo it first. That's deleting (for good; `handleDeleted`), an upload as it starts (`startUpload`), a new folder when the adapter has no `delete`, and a copy or move that can't be undone: Replace or Merge was chosen, as what it replaced is gone, the adapter said nothing of what it made, or part of it failed or was called off once under way. A copy or move that went nowhere, everything skipped or called off before it started, changed nothing and leaves the history as it is.
- Steps hold the entries and folders as the change left them, and are never rewritten as later changes are made: undoing goes back in order, so by the time a step is undone, every change made through the file manager since has been undone, or has ended the history. A step whose section is gone, rooted elsewhere or served by another adapter leaves the history (`heldHistory`, in a layout effect over the sections).

## Checked before it acts

Each undo or redo (`carryOut` in `file-manager.tsx`) lists what it acts on afresh first (`listingOf`, `store/folder-store.ts`, shared with the clipboard's lookup), and only acts when every entry is as the change left it (`asLeft`, `utils/undo.ts`): by its id, with the same kind and name, and for copies about to be deleted, the same size, date modified and count of what's in it, where both say. Anything changed elsewhere since refuses it all, saying so (`undoChanged`), and the step goes. So does a new folder that isn't empty any more (`undoNotEmpty`), and anything the permissions or a move under way refuse, as a paste or a rename would be (`canPaste`, `folderWritable`, `entriesMoving`, `allows`).

- Deleting is for good, so undoing a copy asks first in the delete dialog (`DeleteRequest.undoesCopy`: "Undo copying 3 items?", "The 3 copies in “Photos” are deleted for good."), as the adapter's `delete` says the user has confirmed. Cancelling puts the step back.
- The adapter failing puts the step back to try again, as long as no change was made meanwhile, which it would otherwise go back on top of, and the notice offers Try again. A copy or move that fails partway is the transfer panel's, with its own Try again, and its step goes.
- One undo or redo runs at a time (`undoing`); another key press meanwhile does nothing. The folders it changes show the progress bar over the content (`busy`, `changedFolders`), and copies and moves run through the transfer queue and its panel as any do (see `transfers.md`), the batch ending the run (`settleBatch`).
- An undo ending after another change was made leaves nothing to redo, as that change cleared it (`historyEpoch`).
- What it calls once the adapter has answered is as it is by then (`undoTools`, set in a layout effect), as the location or the sections may have changed meanwhile.

## What the adapter says

Copies and moves can only be undone when the adapter says what it made: `copy` and `move` may resolve with a `TransferResult` (`types/adapter.ts`, public), `entries` being the entries as they now are in the target, one for each entry given that went, in their order, under the name each went in by. Without it, they can't be undone, since finding them by name could take a file that was there already for the copy, a name kept both being the adapter's to choose. `madePairs` (`utils/undo.ts`) pairs each entry given with what it became: kept both, every entry went, in order; skipped, those that went kept their names; replaced, never.

The transfer queue hands it on as `onEnded`'s `made` (`TransferEnded`, `store/transfer-queue.ts`), so the media manager's queue gets it too. A batch, one paste, drop or pick, or one undo or redo, goes in the history together once its last transfer has ended (`TransferBatch.ended`, `run`).

## Reaching it

- **Keys**: Ctrl+Z, and Shift+Ctrl+Z or Ctrl+Y, with ⌘ on macOS, anywhere in the file manager but in a field typed in, whose own undo it is (`undoDirection`, `utils/shortcut.ts`), Z and Y the keys printed with them on any layout. With nothing to undo, the key is the browser's. A consumer's action bound to them runs instead in the content and the tree, as any shortcut does. They're in the keyboard shortcuts window's General, when anything can be undone (`canUndo`).
- **The main menu**: "Undo rename" and "Redo move" at its top (`undoChange`, `redoChange`), or "Undo" and "Redo" disabled with nothing to, while any section's adapter can undo something (`canUndoWith`) and `undoSteps` isn't 0 (see "The main menu" in `file-manager.md`).
- **`ActionContext.undo` and `redo`**, whatever the context is for, missing with nothing to or while one runs, for an app's own menu item or toolbar, and **`apiRef.undo()` and `redo()`**, returning whether they did anything (see "The API" in `props.md`).

## The notice

`components/file-manager/notice-bar.tsx` shows one notice at a time, over the bottom of the content panel, in its middle, above the touch selection bar while it shows (`raised`), as a snackbar does: MUI's `SnackbarContent`, its message, a button and ✕.

- After a change, it says what it did ("Renamed “a” to “b”", "Moved 3 items to “Photos”", the announcements' text) with Undo; after an undo, "Rename undone" (`undone`) with Redo; after a redo, the change's own text with Undo again; when one did nothing or failed, "Couldn't undo the move" (`undoFailed`, `redoFailed`) with why under it, the adapter's message or the refusal, and Try again when the step was put back.
- It shows while its button's step is the latest of its list, or under way (`offer`), so it never offers to undo what's no longer next: another change replaces it, and the history ending hides it.
- It goes after 8 s (`SHOW_FOR`), counted while the pointer isn't over it and the focus isn't in it, with its ✕, or with Escape in it. Going with the focus in it, it hands the focus to the content; replaced by one without a button while that had the focus, its ✕ takes it. Pressing Undo leaves the focus on the button, which becomes Redo.
- It isn't a live region: screen readers hear the same text from the file manager's announcer (see "Announcements" in `keyboard.md`), and a failure as one sentence, the reason after ": ".
- `SnackbarContent` spaces its action with a physical `margin-left`, `margin-right` and `padding-left`, overridden with logical ones (see `rtl.md`), and sizes itself by the viewport, overridden too. In forced colors, where its background and shadow go, it takes `forcedEdge`.

## The playground

The mock adapter's `copy` and `move` resolve with what they made (`insert` returns the node there now), so everything can be undone there. The footer's Undo and Redo call `apiRef.undo()` and `redo()`, and say so in its snackbar when there's nothing to.

## Not yet

- An app's own actions that change the backend, such as a "Move to trash" built from `move`, can neither add a step nor end the history.
