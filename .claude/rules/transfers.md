---
paths:
  - "src/components/transfers/**"
  - "src/store/transfer-queue.ts"
  - "src/hooks/use-transfer-queue.ts"
  - "src/types/transfer.ts"
  - "src/utils/transfer.ts"
  - "src/contexts/moving-context.ts"
  - "src/hooks/use-moving-ids.ts"
  - "src/components/file-manager/dialogs/transfer-dialog.tsx"
  - "src/components/file-manager/dialogs/paste-dialog.tsx"
  - "src/types/adapter.ts"
  - "src/styles/panel.ts"
  - "playground/mocks/mock-adapter.ts"
---

# Copies and moves in the background

Every copy and move, from "Copy to…" and "Move to…", a paste or a drop, runs in the background while the user browses, never in a modal, as uploads and downloads do. The dialogs only ask what needs an answer (a destination, names the destination has), then hand it to a queue and close. One that takes a moment shows in a panel under the content, and one that's done leaves it.

## What the adapter does

The same `copy(entries, targetId, options)` and `move(...)` as ever: one call per transfer, with `TransferOptions` (`signal`, `conflict`, and `onProgress(loaded, total)`, in bytes). Calling `onProgress` is optional, as `upload`'s is: without it the row's bar sweeps, as for a move that only renames on the backend. A total of 0 or less is ignored. Several may run at once, which the adapter's comments say.

## Handing off

- **The picker** (`dialogs/transfer-dialog.tsx`): "Copy here" / "Move here", or a choice in its clash step, calls `onStart(request, destination, conflict, skipped, mergedIds)` and the file manager closes it. A folder that can't change isn't chosen (see "Permissions" in `file-manager.md`). There's no spinner and no error in it any more. Its `onChanged` is only for the New folder button's name dialog.
- **Pasting and dropping** (`dialogs/paste-dialog.tsx`): it lists the target if it isn't cached, looks for clashes, and only shows to ask about them, then calls `onStart(request, conflict, skipped, mergedIds)`. Cancel just closes. A drop is a paste of the dragged entries (see "Drag and drop" in `file-manager.md`).
- `skipped` are the entries the user chose to skip, those whose names clash (`EntryClash`), for the announcement, and `mergedIds` the folders a Replace or Merge merges others into (`mergedFolders`, `utils/transfer.ts`, with `findClashes`), read from the listing as the choice is made, to list them again all the way down once it ends.
- One paste is checked at a time (`offerPaste`'s `!pasting?.open`), as one upload is, but a paste or drop no longer waits for the copies and moves under way.

## The queue

`store/transfer-queue.ts`, with `hooks/use-transfer-queue.ts` holding one for the life of `FileManager` (unmounting cancels what's under way, telling nothing). It's shaped like the download queue, and like it imports nothing from `components/file-manager/`, so the media manager can use it too.

- An item (`TransferItem`, `types/transfer.ts`, internal) is `queued`, `running` or `failed`, with its `kind`, `adapter`, `entries`, `source` and `target` folders (`FolderRef`s) and `conflict`. One that's done, or cancelled, leaves the queue, so there are no "done" or "cancelled" states.
- At most `MAX_ACTIVE` (3) run at once, as uploads' calls do; the rest wait in the order asked for. `add` returns the id, for the host's own record.
- One added with `after`, another's id (`TransferItem.after`), waits until that one has ended, done, failed or cancelled (`waits` in `pump`). `startTransfer` chains a batch's transfers that way when entries of its folders share names (`sharesNames`), so each lands before the next is settled against it by its `conflict` (see "Acting on several folders" in `file-manager.md`).
- `progress` keeps the last `loaded` and `total` reported, within the total, told at most every `PROGRESS_INTERVAL` (100 ms).
- `shown` is set once it has taken `SHOW_AFTER` (500 ms), waiting included, or at once when it fails, so a quick one is never shown.
- `onEnded(item, outcome, items)` is told as each ends: "done", "failed", or "cancelled", with the item's status saying whether it had reached the adapter ("running") or was still waiting ("queued"), and the items as they are now. `cancel`, `cancelAll`, `forget` (a failed one, as it's tried again), `clear` (every failed one) and `abortAll` are the rest.

## The panel

`components/transfers/transfer-panel.tsx` shows the shown items, and knows nothing of where it's shown. `FileManager` places it as an inset panel under the content, above the download and upload panels (`taskPanelSx`), only while it has items. Its look is theirs, from `styles/panel.ts`.

- The summary has a status icon (a ring while any wait or run, filling with the bytes done of their totals once every one of them has reported, spinning until then, an error otherwise), a title counting entries, not transfers ("Copying 3 items", "Moving 1 item", "Copying 3 items and moving 2 items", "Couldn't copy 3 items"; `transfersActive` and `transfersFailed` take both counts, as one sentence), announced politely, and under it the bytes done of the total and how many failed (`transfersFailedCount`).
- The chevron folds the list away. The ✕ cancels everything waiting or under way; once nothing is, it forgets the failed ones and the panel goes.
- Each row has the entry's type icon (or the copy or move icon for several), its name or "3 items", a bar while it runs (filling once the adapter reports, sweeping until then, from the start side, `panelBarSx`), and its status: "Waiting to copy to “Photos”", "Copying to “Photos”" with "1.5 MB of 4 MB" once it reports, or the adapter's error (`transferCopyFailed` without one). Waiting and running rows can be cancelled, and failed ones tried again, when the host's `canRetry` takes them.
- Its text is `TransferLocaleText` (`types/locale.ts`), kept apart as the other panels' is (see `locale.md`).

## In the file manager

`FileManager` keeps what each transfer is of (`transferPlaces`, a `TransferPlace` per id, set by `startTransfer`): the request as a `PasteRequest` (the entries as a clipboard, cut for a move, and where they go), the names skipped, the folders merged into, and whether it can be tried again.

- **Starting.** `startTransfer` adds it to the queue, one transfer per folder the entries are in, as the adapter takes entries sharing a folder (a search's results from several, of one section or more, see "Acting on several folders" in `file-manager.md`), each with a `TransferPlace` of its own folder's entries, so it's shown, fails and is tried again by itself, one after another when their names are shared (`after`). Entries already in the destination are left out of a move and kept both by a copy. A cut leaves the clipboard as its paste starts (when the clipboard is still the one pasted), so it isn't pasted twice while it runs; a copy can be pasted again.
- **Ending** (`handleTransferEnded`). Whatever reached the adapter, done, failed or cancelled, has what it may have changed listed again (`relistTransferred`: the target, the source after a move, and after a "replace", the folders merged into, all the way down). Once done, a move goes through `handleMoved` (moved folders out of the cache, the open place following a moved folder it's in, moved entries out of the clipboard and the preview), and it's announced (`copyDone`, `moveDone`, leaving the skipped out): once for those it was started with, as the last of them ends (`TransferBatch`), counting the entries of those done. A failure is announced (`copyFailedNotice`, `moveFailedNotice`) only when no other transfer was shown, since a panel just shown isn't read out, while its live title is once it shows.
- **Trying again** (`retryTransfer`) is a paste of what's still to go, through `offerPaste`, so the destination's names are checked again, as part of it may have gone through, and the user chooses afresh: only the entries their folder's listing still has, when it's listed, so a move doesn't ask again for what it moved; with none left, it's forgotten. It's offered (`canRetryTransfer`) while its sections are there, served by the same adapter, and no trail has been cut short: `revise` rewrites both trails with the history's, as it does uploads' places, and a folder gone from either marks it not `retriable`.
- **The progress bar** over the content (`busy`) shows while a copy or move waits or runs that changes the open folder, in whichever section: its target, the folder listing the target (dropped onto, or pasted into from its menu), or for a move its source; and while a paste is checked (`pasteIds`).
- Clearing the panel forgets the places of what it cleared (`clearTransfers`).

## While a move runs

Entries a move is moving, waiting its turn or under way, are marked and left alone until it ends, done, failed or cancelled, since their ids may soon name nothing, and acting on them meanwhile would race the move. A copy's entries are only read, and aren't held.

- **What's moving** is `moving` in `file-manager.tsx`, a `MovingIds` (`types/transfer.ts`: the ids by the adapter serving them), made by `movingIds` (`utils/transfer.ts`) from the queue's moves that haven't failed (`isMoving`), and made afresh only as moves start and end (`movesKey`, the moves' ids), not with every bit of progress. So the queue is made early in the frame (`useTransferQueue`, handed `handleTransferEnded` through a ref once that's made), before the paste, drag and context code that reads it. `movingThrough(moving, adapter)` gives one adapter's ids.
- **Everything in a folder being moved goes with it**: `folderMoving` (`utils/permissions.ts`) is the folder or one in its trail, its section's root included, being moved, and `entriesMoving` that, or any of the entries. They go by the trail, so a section rooted further below a folder being moved, which nothing ties to it, isn't known to be; the adapter has the final say there.
- **What's refused** (see "Permissions" in `file-manager.md`): a folder being moved can't change (`folderWritable`, given the ids), so nothing is created, uploaded, pasted or dropped into it, and none of its entries is renamed, moved out or deleted (`entriesAllow`); entries being moved can't be renamed, moved, cut or deleted, nor copied or copied to (`contextFor`), since a copy's ids would name nothing once they've moved, and aren't dragged (`useEntryDrag`'s `held`, `heldUp`); a clipboard holding entries being moved isn't pasted (`canPaste`, given `moving`), however they were cut or copied before; and a failed transfer isn't tried again while its entries or its destination are (`canRetryTransfer`). Opening, previewing, downloading and the properties are only reading, and stay. `ActionContext.moving` says so for an app's own actions, and `readOnly` is true for a folder being moved.
- **The picker** disables folders being moved, as it does the entries it was opened for, read "Being moved" (`entryMoving`), and a place it reaches inside one, such as a section rooted in one, can't be chosen: "This folder is being moved" (`pickerMoving`) in place of `pickerReadOnly`.
- **The mark**: `MovingContext` (`contexts/moving-context.ts`) carries `moving` to every view, and `useMovingIds` (`hooks/use-moving-ids.ts`) gives a section its adapter's ids, as `useCutIds` does for cut ones. List rows, grid tiles and tree rows set `data-moving` for `movingMarker` (see `component-styling.md`): the folder view marks the entries being moved, or every entry while the open folder is being moved itself (`movedHere`), a search's results by their trails (`movingKeys`), and the tree a folder row by its trail and a section row whose root is being moved. Screen readers hear "Being moved" (`entryMoving`) after the name, in place of the lock's "Read-only" (`drawnState`).
- The playground's moves within a root only rename, at once, so to see it, move a large folder between roots, such as `archive` from API service into Website, or several, as three run at once and the rest wait marked.

## The playground

The mock adapter's `copy` goes at 8 MB/s (`COPY_SPEED`), from 0.25 to 10 s in all (`COPY_TIME`), reporting progress (`carry`), so a large folder such as `archive` or `datasets` shows the panel and a small file doesn't. Something below an entry that can't be read (`contract.pdf`, in Website's `docs`) stops it halfway through that entry with "Couldn't read …", the entries before it copied, as a backend failing partway would, to see Try again. A `move` within a root only renames, at once; between roots (Website into API service, say) it goes as a copy does. Copying or moving `restricted` itself, or anything into it, fails at once.

## Not yet

- Copying and moving between adapters.
- Which entries of a failed transfer went through: it's one adapter call, so the panel has its one error, and Try again finds what's left from the source's listing.
- The app's own long actions (compress, extract) in the same panel.
