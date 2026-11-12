# The adapter

The adapter is the contract between filecove and your backend: an object of async functions, written once per backend (a REST API, S3, WebDAV, a database) and passed as `adapter`. The type is `FileAdapter`.

Only `list` is required. Every other member is optional, and each one switches a feature on: without `rename` there's no way to rename, without `upload` no way to upload, and nothing is shown that would only fail. So an adapter can start with `list` and grow.

The same adapter type serves `FileManager`, `MediaManager` and `MediaPicker`.

## Entries

Everything the adapter lists is a `FileEntry`:

```ts
interface FileEntry {
    id: string;                  // opaque, unique within this adapter
    name: string;
    kind: "file" | "folder";
    size?: number;               // files: bytes
    modifiedAt?: Date;
    createdAt?: Date;
    mimeType?: string;
    childCount?: number;         // folders: how many entries they hold, shown in the size column
    hasSubfolders?: boolean;     // folders: lets the tree drop the expand arrow without listing them
    hidden?: boolean;            // overrides "hidden if the name starts with a dot"
    permissions?: EntryPermissions;
    media?: MediaInfo;           // width, height, duration
    trashed?: TrashInfo;         // entries in a trash: where they came from and when
    processing?: AssetProcessing; // media manager: work the backend is doing on it
    meta?: Record<string, unknown>; // anything of yours, carried along and never read
}
```

**Ids are opaque.** The file manager never parses an id, joins two into a path, or makes one up. It only hands back ids it was given, so a full path like `"/projects/site/src"` works, and so does a database id like `"f_8a2c"`. An id must be unique within its adapter; two adapters may use the same ids.

**Dates are `Date` objects.** Convert the strings your API sends.

**Fill in what's cheap.** Everything but `id`, `name` and `kind` is optional. Leave out what your backend can't tell without extra work: the properties panel can ask for it later through `properties` (see [Properties](properties.md)).

**`meta`** is yours. The file manager carries it along and compares it to tell whether an entry changed, but never reads it. The media manager hands it back with what's chosen, so it's where an asset's delivery data goes (a CDN URL, an HLS manifest, a `srcset`).

## `list`

```ts
list(folderId: string, options: { signal: AbortSignal; cursor?: string }): Promise<ListResult>;

interface ListResult {
    entries: FileEntry[];
    nextCursor?: string;           // more pages to come
    permissions?: EntryPermissions; // the listed folder's own
}
```

`list` returns the direct children of one folder. It's called lazily: when a folder is opened in the content, expanded in the sidebar, or browsed in the "Move to…" picker.

- **Listings are saved.** A folder opened again shows at once from its saved listing, and is listed again in the background, so changes made elsewhere show without a refresh. `relistAfter` (milliseconds, default 0) sets how old a listing may be before that; `Infinity` never lists again on its own, for a backend where listing costs, leaving it to `apiRef.refresh()`. Changes made through the file manager always show.
- **Unchanged entries cost nothing.** An entry that comes back with the same fields keeps its object, so nothing showing it renders again.
- **Paging.** Return a `nextCursor` and `list` is called again with it as `cursor`, until a page comes without one. Every page is fetched, so sorting, Select all and name clash checks see the whole folder; paging lets the backend cap its responses and the first entries show sooner. The cursor is opaque: a continuation token, an offset, anything.
- **The signal** aborts when the listing is no longer wanted. Pass it to `fetch`.
- **Rejecting** shows the folder as failed, with your error's message and a Try again button.

## Errors

Every call that can fail should reject with an `Error` whose `message` the user can read, in their language. The file manager shows it where it belongs: under the name field for a rename, in the upload panel's row for an upload, over the folder for a listing. An error without a message gets a generic one.

## Cancelling

Every call takes a `signal`. Calls that change the backend (`rename`, `copy`, `delete`...) get theirs aborted when the user cancels. The change may have been made by then, so the affected folders are listed again either way.

## What each optional member switches on

| Member | Switches on |
|---|---|
| `createFolder(parentId, name, { signal })` | New folder; uploading folders; copying folders in from another adapter |
| `rename(entry, name, { signal })` | Rename |
| `checkName(name, { kind, parentId, entry })` | your backend's naming rules, checked as the user types |
| `copy(entries, targetId, options)` | Copy to…, copy and paste, dragging with Ctrl, within this adapter |
| `move(entries, targetId, options)` | Move to…, cut and paste, dragging, within this adapter |
| `delete(entries, { signal })` | Delete, emptying the trash, moving entries out to another adapter |
| `trash(entries, { signal })` | Move to trash, undoable |
| `restore(entries, { signal, conflict })` | Restore from the trash |
| `upload(file, folderId, options)` | uploading files and folders; taking entries in from another adapter |
| `content(entry, { signal, purpose, onProgress })` | the preview; downloading single files; copying files out to another adapter |
| `download(entries, options)` | downloading folders and several entries as one file (a zip) |
| `downloadAcross(groups, options)` | downloading a search's results from several folders as one file |
| `thumbnail(entry, { signal, view, size })` | thumbnails in the list, the grid, the properties and the preview |
| `search(rootId, query, options)` | search everywhere (the open folder's own search needs nothing) |
| `properties(entry, { signal })` | the backend's own fields in the properties panel |
| `updateProperties(entry, values, { signal })` | editing those fields |
| `measure(folders, options)` | folder totals (files, folders, size, counted all the way down) |
| `processing`, `watchProcessing`, `process` | media manager: following and asking for processing |
| `createGroup`, `updateGroup` | media manager: groups made and edited from a form |

Each is covered in its feature's page. The ones every adapter wants are below.

### `createFolder` and `rename`

```ts
createFolder?(parentId: string, name: string, options: { signal: AbortSignal }): Promise<FileEntry>;
rename?(entry: FileEntry, name: string, options: { signal: AbortSignal }): Promise<FileEntry>;
```

Both resolve with the entry as it now is. A rename's id may change, as it does when ids are paths; the file manager follows it. Reject with an `Error` to show its message under the name field, with what the user typed kept, e.g. "That name is taken."

The file manager trims names and refuses empty names, `.`, `..` and names with `/` itself, and checks the folder's listing for clashes. For your backend's own rules, add `checkName`:

```ts
checkName(name, { kind, parentId, entry }) {
    if (/[\\:*?"<>|]/.test(name)) return 'A name can\'t contain \\ : * ? " < > |';
    if (name.length > 255) return "That name is too long.";
    return null;
}
```

It runs on every keystroke, so it must be synchronous and quick. Return the message, or nothing when the name is fine. It's asked for New folder, Rename and uploads (files with names it refuses are left out, saying why).

### `delete`

```ts
delete?(entries: FileEntry[], options: { signal: AbortSignal }): Promise<void>;
```

Deletes for good, folders with everything in them. The entries always share a parent, and the user has already confirmed. For a trash the user can restore from, see [Copy, move, trash and undo](copy-move-trash-undo.md#the-trash).

## Permissions

A backend says what it refuses, so the file manager doesn't offer what would only fail:

```ts
interface EntryPermissions {
    write?: boolean;   // folders: whether anything can go in or change in them
    rename?: boolean;
    move?: boolean;
    delete?: boolean;
}
```

Each is allowed unless it's `false`, so set only what's refused. A read-only entry sets them all to `false`. Put them on an entry (`FileEntry.permissions`), or on a folder's listing (`ListResult.permissions`), which is how a section's root, which no listing holds, says what it allows.

- A folder with `write: false` takes nothing: no new folder, upload, paste, drop, move or copy, and none of its entries can be renamed, moved out or deleted, whatever their own permissions say. It shows a lock on its icon.
- A file with `write: false` is never replaced by something copied or uploaded over it; the new one is kept beside it.
- Copying out, downloading and previewing are only reading, and are never refused.

Your adapter still has the final say: a call it rejects anyway shows its error as usual. To make a whole section read-only regardless of the backend, use `Section.readOnly` (see [Sections](sections.md)).

## Name clashes

Copies, moves, uploads and restores take a `conflict` option, saying what to do with an entry whose name the destination already has:

- `"keepBoth"`: keep the new one under a free name ("report (2).pdf"). The default, so a clash the file manager didn't see coming never overwrites anything.
- `"replace"`: a file takes the place of the file there, and a folder is **merged** into the folder there, all the way down, so only files with the same names are replaced. A file never replaces a folder, nor the other way round, and nothing replaces what its permissions protect; those are kept both.
- `"skip"`: leave it out.

The file manager checks the destination's listing first and asks the user when it sees a clash. What it can't see (deeper in a merged folder, or made meanwhile) is your adapter's to settle by the same rule.

## Several adapters

Each section may bring its own adapter (see [Sections](sections.md#several-backends)). Sections served by **the same adapter object** share what's listed, so a change made in one shows in the others; sections served by different adapters are independent, and the file manager copies between them itself.

## Changing the adapter after mounting

`adapter` may change, but a new object means a new backend to the file manager: every section it serves goes back to its root, and its saved listings are dropped. Keep it the same object across renders, at module scope or in `useMemo`, and change it only when the backend really changes, such as after signing in as someone else.

```tsx
const adapter = useMemo(() => createAdapter(token), [token]);
```

## Growing the contract

New features add new optional members, and existing ones never change shape, so an adapter written today keeps working. Results are objects (`{ entries }`, not an array) for the same reason.
