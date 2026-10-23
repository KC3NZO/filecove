---
paths:
  - "src/components/downloads/**"
  - "src/components/file-manager/dialogs/preview-dialog.tsx"
  - "src/store/download-queue.ts"
  - "src/hooks/use-download-queue.ts"
  - "src/utils/download.ts"
  - "src/types/download.ts"
  - "src/types/adapter.ts"
  - "src/types/action.ts"
  - "src/styles/panel.ts"
  - "playground/mocks/mock-adapter.ts"
  - "playground/mocks/mock-zip.ts"
---

# Downloading

`ActionContext.download()` saves the context's entries on the user's device, or with none, the context's folder itself, so a folder's empty space, the path bar's menu and a section row's download the open folder or the section's root. The preview's Download button saves the file shown, and `FileManagerApi.download(entries?, location?)` does the same from outside, e.g. a consumer's own toolbar (see "From outside"). The consumer places and labels the action, as with every other one (the playground's "Download", for both targets, with no shortcut).

Downloads are prepared in the background while the user browses, never in a modal. Once the browser has the file, its own downloads show the progress.

## What the adapter hands over

Two optional members, and a single file prefers the first:

- **`content(entry, { signal, purpose: "download", onProgress })`**, the preview's member (see `preview.md`), for a single file. `purpose` is "preview" or "download", so a backend whose preview URLs aren't sent as attachments, such as signed links to a bucket, hands over one that is.
- **`download(entries, { signal, showHidden, onProgress })`** for anything else: folders with everything in them, several entries, or a single file when there's no `content`. It resolves with one `DownloadContent`, a `FileContent` (`{ url }` or `{ blob }`) with an optional `name`, such as a zip the server builds. The entries share a parent. Without it, only single files can be downloaded, through `content`.
- A folder downloaded from its own menu is only known as a `FolderRef`, so it's handed over as an entry with only `id`, `name` and `kind` (`downloaded` in `contextFor`), a section's root named after the section. The adapter's comment says so.
- `showHidden` is whether hidden files showed when the download was asked for, so a backend can leave them out of a folder's download while the user isn't seeing them. The entries themselves are always meant.
- `onProgress(loaded, total)`, in both, reports how far the adapter has got before handing the file over, as `upload`'s does: fetching a blob (from `XMLHttpRequest`'s `onprogress`, or counting a `fetch` body's bytes as they're read), or a server packing a zip, if it says how far it has got. Calling it is optional, and pointless for a URL, which the browser fetches itself and shows the progress of. A total of 0 or less, meaning not known, is ignored. The preview passes one that does nothing (`ignoreProgress` in `use-preview-contents.ts`), since its spinner shows no figure.

`canDownload` (`utils/download.ts`) says whether the adapter can hand entries over, and `ActionContext.download` is missing when it can't. `prepareDownload` makes the call and names the file (`PreparedDownload`, `types/download.ts`, internal): a file from `content` by its entry's name; what `download` hands over by its `name`, or a blob without one by its own name when it's a `File`, else the entry's name, or for several entries, the name of the folder they're in; a URL without one is left to its server's `Content-Disposition` (`name` "").

## Saving it

`saveFile` (`utils/download.ts`) hands the file to the browser:

- **A blob** goes through an object URL and a link with `download` set to the name, clicked in the page. The URL is revoked a minute later (`REVOKE_AFTER`), as the browser may still be reading it.
- **A URL the browser saves under a link's name**, one on the page's origin, a blob URL or a data URL (`savesUnderName`), goes through the same link.
- **A URL on another origin** is saved only as its server says, since browsers ignore `download` across origins. So it opens in a new tab (`window.open`, with `opener` cut), which the browser closes as soon as it sees a download, when the server answers with `Content-Disposition: attachment`. Without it, the file shows in that tab, and so does an error answer, such as an expired signed link's, rather than replacing the page, uploads and all, as following the link in place would. The adapter's comments tell the consumer to send it.
- That tab only opens while the click that asked for the download is recent (Chrome and Firefox allow about five seconds, Safari less), and a download that waited its turn or took a while is past that. A blocked tab makes `saveFile` return false, and the download waits as "ready" for a click on its own button, which opens the tab.
- Chrome asks once per site to allow several downloads started without a click, so a second download finishing soon after the first, as several prepared together do, brings up its prompt. That's the browser's own setting, and a site the user has blocked saves nothing more without telling the page, so it can't be shown in the panel.

## The queue

`store/download-queue.ts`, with `hooks/use-download-queue.ts` holding one for the life of `FileManager` (unmounting cancels what's being prepared). It's shaped like the upload queue, and like it imports nothing from `components/file-manager/`, so the media manager can use it too.

- An item (`DownloadItem`, `types/download.ts`) is `queued`, `preparing`, `ready` (the browser blocked its tab) or `failed`. One the browser has taken, or that was cancelled, leaves the queue, so there's no "done" state.
- At most `MAX_ACTIVE` (3) are prepared at once, as each may have the server pack a zip; the rest wait in the order asked for.
- `progress` keeps the last `loaded` and `total` reported while preparing, kept within the total, and is cleared when a download starts or is tried again. Progress reaches the listeners at most every `PROGRESS_INTERVAL` (100 ms), since an adapter counting a body's bytes may report every few kilobytes.
- `shown` is set once a download has taken `SHOW_AFTER` (500 ms), waiting included, or at once when it's ready or failed, so a quick one starts with nothing shown. Tried again, a download stays shown.
- The same entries through the same adapter asked for again while they're waiting or being prepared are left to that download, so a double click or the menu and the preview together start one. A ready or failed one for them is replaced.
- `cancel` aborts the signal and drops the download, `retry` asks again for a failed one, `save` starts a ready one from its button's click, `clear` forgets the ready and failed ones, and `cancelAll` the waiting and preparing ones.

## The panel

`components/downloads/download-panel.tsx` shows the queue's shown items, and knows nothing of where it's shown. `FileManager` places it as an inset panel under the content, above the upload panel when both show (`taskPanelSx`), only while it has items. Its look is the upload panel's, from `styles/panel.ts`, which both use.

- The summary has a status icon (a ring while any is waiting or being prepared, filling with the bytes come of those totals once every one of them has reported progress, and spinning until then, the download icon while some are ready, an error otherwise), a title ("Preparing 2 downloads", "A download is ready", "A download failed", announced politely), and the counts the title leaves out ("1 ready · 1 failed").
- The chevron folds the list away. The ✕ cancels everything waiting or being prepared; once nothing is, it forgets the rest and the panel goes.
- Each row has the entry's type icon (a folder's or a file's, or the copy icon for several), its name or "3 items", a progress bar while it's being prepared (filling once the adapter reports progress, sweeping until then, and from the start side, `panelBarSx`), and its status ("Waiting", "Preparing…" or "1.5 MB of 4 MB" once it reports, "Ready to download", or the adapter's error, `downloadFailed` without one). Waiting and preparing rows can be cancelled, failed ones tried again, and ready ones started with a download button in the primary color.
- Its text is `DownloadLocaleText` (`types/locale.ts`), kept apart as the upload panel's is (see `locale.md`).

## From outside

`apiRef`'s `download(entries?, location?)` (`downloadFrom` in `file-manager.tsx`) asks the same queue, so the panel shows it as any other. The entries are in the open folder, or in the one at `location`, which isn't gone to; with none, that folder itself is downloaded (`downloadedEntries`, shared with `contextFor`). It returns false when nothing was asked for: `location`'s section is missing, or its adapter can't hand the entries over (`canDownload`). Hidden files go along as `showHidden` is at that moment.

## The playground

The mock adapter's `download` packs the entries into a real zip (`mock-zip.ts`: stored, no compression, UTF-8 names, folders as their own entries, dates in MS-DOS time) after a wait of 40 ms an entry, from 1.5 to 6 s (`PACK_TIME`), so the panel shows, reporting the files' sizes as packed over that wait. It's named after the one entry, or the folder they're in, so Website's root is `Website.zip`. A section's root is found by its id. An entry marked `fails` fails it (`restricted`), and so does packing more than 500 files and folders (`DOWNLOAD_LIMIT`), as `archive`, `datasets` or API service's root would. What can't be read inside a folder is left out (`docs`' `contract.pdf`, Website's `restricted`), and so are dotfiles (`.github`, `.gitignore`) while hidden files aren't shown. Its `content` hands a single file over as bytes for a download, after a simulated fetch at 2 MB/s, from 0.3 to 8 s (`DOWNLOAD_SPEED`, `DOWNLOAD_TIME`), reporting progress, so a large file such as `walkthrough.mp4` or `release-1.0.0.zip` shows its bar and a small one starts with nothing shown; the upload mock's simulated send is the same `transfer`. It hands a video's MDN URL over for the preview, but fetches it into bytes for a download, since MDN doesn't send it as an attachment and the browser would play it in a tab; packing videos fetches them too, so both need the network. Packing gathers the files' bytes first, videos fetched, and then reports them over the wait, so the figures are what goes in, and the bar doesn't sit full while videos come.

- The footer's "Download selection", or "Download folder" with nothing selected, calls `apiRef.download` with the selection and the location it's in, or with nothing, and says so in the snackbar when it returns false.
- `?downloadUrls` (`options.ts`) has the media bucket hand some files over as URLs on another origin (the mock's `downloadUrls`, by id, with a `delay`), to see those saved: `release-1.0.0.zip` is GitHub's `octocat/Hello-World` archive, sent as an attachment, so a tab opens and closes as the browser saves it under the server's name; `intro.webm` is MDN's sample, which isn't, so it plays in that tab; and `walkthrough.mp4` comes after 7 s, past the browser's allowance for opening a tab, so it waits as ready in the panel until its button is clicked. They need the network.
