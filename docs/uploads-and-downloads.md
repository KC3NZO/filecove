# Uploads and downloads

Both run in the background while the user goes on browsing, each shown in a panel under the content once it takes a moment, with its progress, Cancel and Try again.

## Uploads

```ts
upload?(file: File, folderId: string, options: {
    signal: AbortSignal;
    conflict: "replace" | "keepBoth" | "skip";
    onProgress: (loaded: number, total: number) => void;
    values?: Readonly<Record<string, unknown>>; // a media library's upload form; never set by FileManager
}): Promise<FileEntry | void>;
```

**One file per call.** The file manager decides how many run at once (3 by default, `limits.uploads`), so each file has its own progress, error and cancel. How the bytes travel (a form post, S3 multipart, tus, chunks) is your adapter's business.

With `upload`, the user can upload by:

- `context.upload()`, which opens the browser's file picker, from an action of yours (see [Actions](actions.md)), or `context.upload(files)` with files you already have;
- `context.uploadFolder()`, a folder picker, when the adapter also has `createFolder`;
- dropping files and folders from the desktop onto a folder, the open folder's empty space, a tree row or a path segment;
- pasting files copied on the desktop with Ctrl+V, where the browser hands them over (screenshots and copied pictures always come through).

A typical upload over `XMLHttpRequest`, which reports progress where `fetch` can't:

```ts
upload(file, folderId, { signal, conflict, onProgress }) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const body = new FormData();

        body.append("file", file);
        body.append("folder", folderId);
        body.append("conflict", conflict);

        xhr.open("POST", "/api/upload");
        xhr.responseType = "json";
        xhr.upload.onprogress = (event) => onProgress(event.loaded, event.total);
        xhr.onload = () =>
            xhr.status < 300
                ? resolve(toEntry(xhr.response))
                : reject(new Error(xhr.response?.message ?? "Couldn't upload the file."));
        xhr.onerror = () => reject(new Error("The connection was lost."));
        signal.addEventListener("abort", () => {
            xhr.abort();
            reject(new DOMException("Aborted", "AbortError"));
        });
        xhr.send(body);
    });
}
```

- **Resolve with the file's entry** as it now is. That's how the file manager finds and highlights it, even when it was kept under another name beside one of the same name, and how a copy from another backend can be undone. Resolving with nothing works, but then a file kept under another name isn't found.
- **`conflict`**: the file manager checks the folder's listing first and asks the user about clashing names (Keep both, Replace, Skip). Skipped files aren't sent at all. What it passes is what to do with a clash it didn't see.
- **Reject with an `Error`** to show its message in the file's row, e.g. "This file is larger than 2 GB."
- **`onProgress`** is optional to call; without it, the row shows the file as uploading with no figure.

### Folders

Folders are uploaded with the same `upload`, plus `createFolder`: each folder is made first in the one above it, then its files are sent into its id. So the contract has nothing extra for folders, and a backend without real folders (a bucket) makes them in `createFolder` as it does for New folder. A folder that already has the name is merged into, when the user chooses so.

Without `createFolder`, folders are left out of an upload, saying so.

### What's checked first

- Files whose type the section doesn't take (`acceptUploads`, see [Sections](sections.md#limiting-uploads)).
- Names your `checkName` refuses.
- Names the folder already has, asked about.

Uploads can't be undone, so an upload starting ends the undo history.

## Downloads

Three members hand files over to save. A single file prefers the first:

```ts
// One file: the preview's member, called with purpose "download".
content?(entry, { signal, purpose, onProgress }): Promise<FileContent>;

// Folders, several entries, or a single file when there's no `content`: one file to save, e.g. a zip.
download?(entries: FileEntry[], { signal, showHidden, onProgress }): Promise<DownloadContent>;

// Entries from several folders, a search's results: one file to save.
downloadAcross?(groups: EntriesInFolder[], { signal, showHidden, onProgress }): Promise<DownloadContent>;

type DownloadContent = ({ url: string } | { blob: Blob }) & { name?: string };
```

With either, `context.download()` is there, and the preview has a Download button. Without `download`, only single files can be downloaded.

```ts
async download(entries, { signal }) {
    const response = await fetch("/api/zip", {
        method: "POST",
        body: JSON.stringify({ ids: entries.map((entry) => entry.id) }),
        headers: { "content-type": "application/json" },
        signal,
    });

    if (!response.ok) {
        throw new Error((await response.json()).message ?? "Couldn't prepare the download.");
    }

    return { blob: await response.blob(), name: entries.length === 1 ? `${entries[0].name}.zip` : "files.zip" };
}
```

Or, better for large archives, have the server build the zip and hand back a URL for the browser to download itself, so the bytes don't pass through the page:

```ts
async download(entries, { signal }) {
    const { url } = await api.prepareZip(entries.map((entry) => entry.id), signal);
    return { url };
}
```

### How the file is saved

- **A blob** is saved under `name`, or the entry's name, or for several entries the folder's name.
- **A URL on the page's origin** is saved under that name too.
- **A URL on another origin** (a CDN, a signed bucket URL) opens in a new tab, as browsers ignore a link's `download` name across origins. **Have the server send `Content-Disposition: attachment`**, and the browser closes that tab as it saves the file under the server's name. Without it, the file opens in the tab instead.
- Browsers only open that tab soon after a click. A download that took a while to prepare waits in the panel as "ready", with a button that saves it.

Once the browser has the file, its own downloads show the progress. `onProgress` is for what comes before: fetching a blob, or a server packing a zip if it can say how far it has got.

### The arguments

- The entries of one `download` call share a parent. A folder downloaded from its own menu, the open folder or a section's root, comes as an entry with only `id`, `name` and `kind`.
- `showHidden` says whether hidden files were showing, so a backend can leave them out of a folder's zip while the user isn't seeing them.
- `downloadAcross` gets each folder with its entries. Files from different folders may share a name, which the zip has to keep apart, e.g. a folder per folder. Without it, such a selection downloads one file per folder.

Up to 3 downloads are prepared at once (`limits.downloads`). Asking for the same entries again while they're being prepared starts nothing new.

### From your own code

```ts
apiRef.current?.download();                         // the open folder
apiRef.current?.download(selectedEntries);          // entries of the open folder
apiRef.current?.download(entries, otherLocation);   // entries of another folder
```

It returns `false` when there was nothing it could download.
