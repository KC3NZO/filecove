---
paths:
  - "src/store/upload-queue.ts"
  - "src/hooks/use-upload-queue.ts"
  - "src/hooks/use-drop-target.ts"
  - "src/utils/files.ts"
  - "src/components/uploads/**"
  - "src/components/file-manager/dialogs/upload-dialog.tsx"
  - "src/types/upload.ts"
  - "src/types/adapter.ts"
---

# Uploads

The adapter's optional `upload(file, folderId, { signal, conflict, onProgress })` switches uploading on. It takes **one file per call**, so each file has its own progress, error and cancel, and the component decides how many run at once. The adapter reports progress with `onProgress(loaded, total)` (e.g. from `XMLHttpRequest`'s `upload.onprogress`), or never, and the file then shows as uploading with no figure. How the bytes travel (XHR, S3 multipart, tus, chunks) is the adapter's business.

## Shared with the media manager

A media manager will be built later as a sibling of `FileManager`, and it will upload too. So the upload code is split into what it can reuse and what belongs to the file manager:

- **Reusable**, and never importing from `components/file-manager/`: the queue (`store/upload-queue.ts`), its hook (`hooks/use-upload-queue.ts`), the panel (`components/uploads/upload-panel.tsx`, whose look, `styles/panel.ts`, the download panel shares), the types (`types/upload.ts`, `UploadOptions` in `types/adapter.ts`), and the panel's text, the keys of `UploadLocaleText` (`types/locale.ts`), which it reads with `useLocale()` and which is English outside a `FileManager` (see `locale.md`).
- **The file manager's own**: the conflict check (`dialogs/upload-dialog.tsx`, which reads the folder store), the drop targets and the file picker in `file-manager.tsx`.

Keep it that way: `FileManager` imports the shared parts, never the other way round. Server-side processing (resizing, converting, HLS) is planned as a separate optional adapter surface, not as part of `upload`.

## The queue

`createUploadQueue(onChanged)` holds every file added, in order, as `UploadItem`s (`queued`, `uploading`, `done`, `failed`, `cancelled`). The item list is replaced, never mutated, for `useSyncExternalStore`.

- At most `MAX_ACTIVE` (3) files upload at once; the rest wait, and start in the order they were added.
- `cancel(id)` and `cancelAll()` abort the `signal`. `retry(id)` queues a failed or cancelled file again from the start. `clear()` forgets the ended ones. `abortAll()` runs on unmount.
- `onChanged(adapter, folderIds)` is told the folders that uploads reaching the adapter ended in, whether done, failed or cancelled, since a cancelled upload may have made the file anyway. It's throttled to once a second (`REPORT_INTERVAL`, first one at once), so a folder taking many small files isn't listed again for each. In `FileManager` it is `relist`, so the folder updates in every section sharing the adapter.
- `useUploadQueue(onChanged)` owns a queue for the life of the component and reads `onChanged` through a ref, so it may change every render.

## Starting an upload

Every route ends in `askUpload` in `file-manager.tsx`, with a `DroppedFiles` (`files`, plus the names of dropped `folders`):

- **`ActionContext.upload(files?)`** uploads into the context's `folder`. Without `files` it opens the browser's file picker, a hidden `<input type="file" multiple>` in the root, which only opens from a click or key press (an action's `onSelect` runs in one). It's missing when the adapter has no `upload`, the section refuses uploads (see "Sections refusing uploads"), or while another upload is being checked. The consumer places and labels the action, as with every other one.
- **Dropping files from the desktop** onto the same targets that take dragged entries: a folder in the content, the open folder's empty space or a file in it, a tree folder, or a section row. `use-drop-target.ts` handles both kinds of drag. Dragged files show only as `"Files"` in `dataTransfer.types` until the drop, so they're offered by adapter alone (`DragContext.uploadInto`) and read on drop (`droppedFiles`). The highlight, the panel outline and the 700 ms hold to expand all work as they do for entries. A drag from outside never says how it ended, so a target unmarks itself on `dragleave` and `drop`.
- **Pasting files from the system clipboard** (files copied in the desktop's file manager, a copied picture or screenshot) with the browser's paste key, Ctrl+V, ⌘V or Shift+Insert, into the folder Ctrl+V pastes into: the open folder from the content, or a tree row's folder (a section row's root). `folder-view.tsx` and the tree rows (`TreeItem`, on the item itself) hand their `paste` event to `pasteFiles` (`PasteFiles`, `types/menu.ts`) in `file-manager.tsx`, which uploads what `filesIn` (`utils/files.ts`, shared with drops) reads from `clipboardData`, through `offerUpload`, so a section refusing uploads and one upload being checked count as for a drop.
  - **The file manager's own entries come first**: while the clipboard of cut or copied entries can be pasted into that folder (`canPaste`, a paste running or not), nothing is uploaded, since the page can't tell which was copied last without asking for permission. Ctrl+V reaches the browser only when no action took it: the consumer's paste action runs and prevents it, and a disabled action lets the paste key through (`pastes` in `utils/shortcut.ts`, `runShortcut`), so the playground's Paste, greyed out with nothing to paste, still lets files be pasted. Shift+Insert always reaches the browser, which is why `pasteFiles` checks the clipboard itself.
  - Only the key pastes files. The menu's Paste can't, since a click reads the system clipboard only through `navigator.clipboard.read()`, which asks for permission and gives images alone.
  - What reaches the page is the browser's: some browsers and systems hand over files copied in a file manager, some only their paths as text, which can't be read, and some nothing at all (a paste with no types, seen copying from GNOME Files). A copied picture comes through either way. A picture comes as "image.png" every time, so a second one clashes and is asked about. Copied folders come as names, left out as dropped ones are.
  - Text fields are left alone, as the paste goes only to the content and the tree.
- Files dropped anywhere the views don't take them are refused on the root (`refuseFiles`, dropEffect "none"), or the browser would open them in place of the page.

## Sections refusing uploads

A section's optional `acceptUploads` (`types/section.ts`, public, default `true`) set to `false` takes no uploads into any of its folders, though its adapter has `upload`, for a section the user may browse but not add files to. Unlike `importFrom`, it's about files from the desktop, not entries from other sections, and the two are independent.

- `offerUpload` in `file-manager.tsx` checks it, the one place every route asks: so `ActionContext.upload` is missing in its folders (the playground's "Upload files…" hides), and its drop targets don't take files dragged from the desktop, showing the no-drop cursor, with the root refusing the drop so the browser doesn't open them.
- It goes by the section, not the folder, so the same folder shown in another section that takes uploads takes them there, as with `importFrom`, since sections are independent.
- The playground's Design assets refuses uploads, as it refuses entries from other sections.

## The check before queueing

`dialogs/upload-dialog.tsx` works like the paste dialog: it runs unseen, listing the folder first if it isn't cached, and only shows when it has something to ask or say.

- Names the folder's listing already has get Replace, Keep both and Skip (`conflict-step.tsx`); otherwise `conflict` is "keepBoth", so a clash the cache missed never overwrites anything.
- **Skip leaves the clashing files out of the queue** instead of sending them for the adapter to skip, since sending a large file for nothing could take minutes. "skip" still goes to the adapter for clashes the cache missed.
- Dropped folders can't be uploaded yet. They're named as left out, with Cancel and Upload for the rest, or, when only folders were dropped, a "Couldn't upload" notice.

## The panel

`components/uploads/upload-panel.tsx` takes the items and the queue's callbacks, and knows nothing of where it's shown. `FileManager` shows it as an inset panel under the content (`taskPanelSx`), below the download panel when both show, only while the queue has items, so it never covers files or the touch selection bar.

- The summary has a status icon (a progress ring while active, a check, or an error), a title ("Uploading 3 files", "Couldn't upload 1 file", "Uploaded 4 files") and the bytes sent, or the counts the title leaves out.
- The chevron folds the list away. The ✕ cancels everything still uploading, which stays listed to retry; once nothing is, ✕ forgets the list and the panel goes.
- Each row has the file's type icon, its name, a progress bar while uploading, and its status with the destination folder's name, or the adapter's error. An error without a message is kept as undefined in the queue, and the panel says `uploadFailed` in its place. Active rows can be cancelled, failed and cancelled ones retried, and done ones show a check.

## Not yet

Uploading folders (would need `createFolder` and walking `webkitGetAsEntry`), and showing which files just arrived ("Show in folder" on a finished row, and a brief highlight in the open folder, never changing the selection, since an upload can finish while the user is acting on other files). Resuming an upload after a reload is left out by choice: the browser no longer has the files, and resuming partway is the adapter's upload protocol.
