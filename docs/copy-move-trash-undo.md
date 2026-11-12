# Copy, move, trash and undo

## Copy and move

```ts
copy?(entries: FileEntry[], targetId: string, options: TransferOptions): Promise<TransferResult | void>;
move?(entries: FileEntry[], targetId: string, options: TransferOptions): Promise<TransferResult | void>;

interface TransferOptions {
    signal: AbortSignal;
    conflict: "replace" | "keepBoth" | "skip";
    onProgress: (loaded: number, total: number) => void;  // bytes
    onEntryDone: (entry: FileEntry, made?: FileEntry) => void;
}

interface TransferResult {
    entries: FileEntry[]; // what each entry given became in the target, in order
}
```

With `copy`, the user copies by Copy to…, Copy and Paste, or dragging with Ctrl held; with `move`, by Move to…, Cut and Paste, or dragging. Each copy or move runs in the background, a few at once (3 by default, `limits.transfers`), shown in a panel once it takes a moment, with Cancel and Try again. The dialogs only ask what needs an answer (a destination, clashing names), then close.

- **The entries share a parent**, and `targetId` is a folder this adapter serves. A move is never into the entries themselves, nor into the folder they're already in.
- **Resolve with what you made** (`TransferResult`): the entries as they now are in the target, one for each entry given that went, in their order, under the names they went in by. That's what lets the user **undo** it. Without it, the copy or move can't be undone, as finding the copies by name could take a file that was there already.
- **Report each entry as it's done** with `onEntryDone(entry, made)`, when your backend goes one by one. Then a copy that fails partway says what went: the panel counts it, Try again leaves it out, and what went can still be undone.
- **`onProgress`** in bytes is optional. Without it, the row's bar sweeps, as for a move that only renames on the backend.
- **`conflict`** is the user's choice for names the target already has (see [The adapter](adapter.md#name-clashes)). Replace merges folders into folders, all the way down.
- **Reject with an `Error`** to show its message in the panel's row.

While a move is waiting or running, its entries are held: marked as being moved, and not renamed, moved, deleted or dragged until it ends, since their ids may soon name nothing.

### Between backends

When the target section is served by another adapter, the file manager copies the entries across itself, as a desktop copies between disks. It reads through the source adapter's `list` and `content` (with `purpose: "copy"`), and writes through the target adapter's `upload` and `createFolder`; a move then deletes each entry from the source with `delete`, once all of it is there. So copying between backends needs no member of its own: it works between any two adapters that have those.

Content handed over as a URL is fetched by the page, so it needs CORS. The target's `upload` has the final say, and can refuse what it won't take.

## The trash

A trash the user can restore from is your backend's. The adapter moves entries there and back, and a section shows it.

```ts
trash?(entries: FileEntry[], options: { signal: AbortSignal }): Promise<TrashResult | void>;
restore?(entries: FileEntry[], options: { signal: AbortSignal; conflict: ConflictPolicy }): Promise<TrashResult | void>;

interface TrashResult {
    entries: FileEntry[]; // what each entry given became, in order
}
```

The entries in the trash's root carry where they came from:

```ts
interface TrashInfo {
    trail: FolderRef[];  // the folders it was in, outermost first, down to its folder
    trashedAt?: Date;
}
// FileEntry.trashed
```

And a section with `trash: true` shows it, rooted where `trash` puts entries:

```ts
const sections: SectionGroup[] = [
    { id: "places", sections: [{ id: "home", label: "Home", icon: "home", rootId: "/home" }] },
    { id: "bin", sections: [{ id: "trash", label: "Trash", icon: "delete", rootId: "/.trash", trash: true, showFolders: false }] },
];
```

- **Moving to the trash** (`context.trash()`, or dropping on the trash section) happens at once, without asking, as on a desktop, since it can be undone. Resolve with what's now in the trash so it can; without it, or without `restore`, it can't.
- **The trash section** lists each entry's original location and when it was trashed, and shows a bar with Empty trash. Nothing in it can be renamed, moved, copied out or changed; its entries can be restored, deleted for good, opened and previewed. A search everywhere leaves it out.
- **Restoring** (`context.restore()`) puts entries back in the folders they came from, which may be several. The file manager first checks those folders for names they have now and asks, as a paste does, then passes the choice as `conflict`. A folder they came from that's gone is your backend's to make again, or to refuse with a message.
- **Emptying the trash** (`context.emptyTrash()`, or the trash bar's button) asks first, then calls `delete` with everything in the trash's root, read afresh.
- Each entry goes to its own adapter's trash; one trash doesn't take another backend's entries.

`trail` is the folders from a section's root or above it (even the top of the backend) down to the entry's folder, as `FolderRef`s. The file manager never parses ids, so the trail is how it knows where an entry came from and which section shows that folder.

Without `trash`, entries are only deleted, for good, after the user confirms.

## Undo and redo

Changes made through the file manager can be undone, several steps back (20 by default, `limits.undoSteps`), and redone, with Ctrl+Z and Shift+Ctrl+Z (or Ctrl+Y), the sidebar's main menu, or the notice each change shows over the content.

| Change | Can be undone when |
|---|---|
| Rename | always |
| New folder | while it's still empty, and the adapter has `delete` |
| Copy | `copy` resolved with a `TransferResult` (or reported each entry with `made`); undoing deletes the copies, after asking |
| Move | `move` resolved with a `TransferResult` (or reported each entry with `made`) |
| Move to the trash | `trash` resolved with a `TrashResult`, and the adapter has `restore` |
| Restore | `restore` resolved with a `TrashResult`, and the adapter has `trash` |

Before undoing, the file manager lists the folders again and checks that every entry is as the change left it; anything changed elsewhere since refuses the undo, saying so.

What can't be undone ends the history, so an undo never reaches past it: deleting for good, emptying the trash, an upload, Replace in a copy or move (what it replaced is gone), and a copy or move whose adapter didn't say what it made.

Changes made by your own actions (a "Compress…") aren't in the history. For a toolbar of your own, `context.undo`, `context.redo`, `apiRef.current.undo()` and `apiRef.current.redo()` do the same as the keys.
