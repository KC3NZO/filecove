# Roadmap

What's left in the features already built, what packaging needs before a release, and the features still to build. Items marked **new** came from a source audit on 2026-10-23 and aren't in the rules' "Not yet" lists. Tick an item off once it's done, and add new ones here, so this list stays the one place to look.

## Order

1. ~~Re-list a folder in the background when it opens, showing the cached listing meanwhile, with a prop to turn it off (A, "Folder data and cache").~~ Done 2026-10-23.
2. ~~Tooltips on icon-only buttons, selection that shows in Windows High Contrast mode, and screen-reader announcements when operations finish (A, "Interface polish" and "Operations").~~ Done 2026-10-23.
3. ~~Properties, then folder upload (C).~~ Folder upload and properties done 2026-10-24.
4. The media manager (C.4), its contract designed on paper first.
5. Packaging, in one pass before a release (B), as the last step.

## A. Gaps in features already built

### Folder data and cache
- [x] **new:** Once a folder is listed, opening it again shows the saved copy and never asks the adapter again. Changes made elsewhere (another user, another tab) only show after a refresh. There's no re-check when a folder opens, no expiry, and no adapter `watch`. *Done 2026-10-23: a folder opened again (content, tree, picker) is listed again in the background, `relistAfter` (default 0, `Infinity` for never) sets how old a listing may be first, and unchanged entries keep their objects. An adapter `watch` stays under "Optional ideas".*
- [x] **new:** Saved listings are never dropped while the component is open. Thumbnails stop at 1,000; folder listings have no limit. *Done 2026-10-23: listings nothing shows are dropped beyond 20,000 entries, longest unseen first, never one with a kept listing below it.*
- [x] **new:** With an empty `sections` (say, while the app is still loading them) the content area is blank, with no message. *Done 2026-10-23: "No sections to show", folder-only buttons disabled, and the first section to come starts expanded.*
- [x] A section rooted further below a changed folder only updates if that folder happens to be loaded (known limit). *Done 2026-10-23: after a folder is deleted, moved or renamed, a section that doesn't list it lists what it shows again at once, and every listing of the adapter's sections is checked again as it opens.*
- [x] **new:** A folder that a paste or move with Replace put another in the place of kept its old listing, so an expanded tree row showed the old contents. *Done 2026-10-23: replaced folders go through `dropFolders`.*

### Operations (create, rename, copy, move, delete, paste)
- [x] A non-modal panel for long copies and moves. *Done 2026-10-25: the picker, pastes and drops hand the copy or move to a transfer queue once its names are settled and close, three running at once; one taking over 500 ms shows in a panel above the download panel, with its bytes when the adapter reports them (`TransferOptions.onProgress`), and cancelling; one that's done leaves it, announced; one that fails stays with the adapter's error and Try again, which checks the destination's names again for what its folder still lists. A cut leaves the clipboard as its paste starts, and a paste no longer waits for the one before (see `transfers.md`).*
- [ ] **new:** A failed copy or move can't say which of its entries went through, since it's one adapter call; Try again goes by the source's listing.
- [x] **new (minor):** Entries being moved aren't marked while the move runs, and can be acted on meanwhile. *Done 2026-10-25: entries a move is moving, waiting or under way, and everything in a folder being moved, fade with a busy pointer wherever they're listed (the list, the grid, search results, the tree, a section rooted in one) and read "Being moved", until it ends. Meanwhile they aren't renamed, moved, cut, copied, deleted, dragged or pasted from the clipboard, nothing goes into a folder being moved (the picker disables them, "This folder is being moved"), a failed transfer isn't tried again while its entries or destination are, and `ActionContext.moving` lets an app's own actions hide; opening, previewing, downloading and the properties stay (see "While a move runs" in `transfers.md`).*
- [ ] Copying between different adapters.
- [x] **new:** There are no per-entry permissions. `FileEntry` has no read-only field, so a read-only folder still accepts drops and pastes. An app can hide its actions with `visible`, but it can't refuse drop or paste targets, nor stop entries from being moved out of a read-only folder or section (`importFrom` only controls what comes in; copying out is only reading). *Done 2026-10-25: `FileEntry.permissions` and a listing's own `ListResult.permissions` (`write`, `rename`, `move`, `delete`, each allowed unless false), and `Section.readOnly`. A folder that can't be written takes no new folder, upload, paste, drop, copy or move, and its entries aren't renamed, moved out or deleted; the context's operations go missing, drop targets show the no-drop cursor, entries that can't be moved are dragged as copies, the picker can't choose such a folder ("This folder is read-only"), and `ActionContext.readOnly` lets an app's own actions hide (see "Permissions" in `file-manager.md`).*
- [x] **new (minor):** Nothing marks a read-only entry or folder, as GNOME's lock emblem does, so a refused drop shows only the no-drop cursor. *Done 2026-10-25: a folder whose entry has `write: false` shows a lock at its icon's corner in the list, the grid, search results, the tree and the picker, and screen readers hear "Read-only" after its name.*
- [ ] **new (minor):** A Replace or Merge into an entry the destination has that can't be changed (a file that can't be written, a folder that can't change) is left to the adapter; the clash step doesn't know.
- [x] Name-clash dialog: Merge for a folder clashing with a folder, no Replace when a file clashes with a folder, and Replace no longer the highlighted main button. *Done 2026-10-24: in the transfer, paste and upload dialogs alike, Replace merges a folder into a folder all the way down and reads Merge when only folders clash, a file and a folder are kept both rather than replacing each other, with no Replace when every clash is such a pair, and Keep both is the main button. A folder an upload merges into is listed whenever anything goes in it, so a file there beside a folder of its name goes with "keepBoth", and a folder beside a file of its name is made under a free name. `ConflictPolicy`'s "replace" says so for the adapter (see "Name clashes" in `file-manager.md`).*
- [x] **new:** Screen readers hear nothing when an operation finishes (deleted, moved, pasted, created). Only the upload and download panels announce anything. *Done 2026-10-23: deletes, copies, moves, pastes, drops, cut and copy, and creating and renaming are announced from one polite live region, a created or renamed entry only when it doesn't take the focus, and the checklist in `props.md` asks it of every new feature.*
- [x] **new (minor):** Names are only checked for ".", ".." and "/". There's no hook for a backend's own rules (for example Windows' `\:*?"<>|`), so the user only finds out after pressing the button. *Done 2026-10-25: the adapter's optional `checkName(name, { kind, parentId, entry })` returns the backend's message for a name it won't take, shown under New folder's and Rename's field as it's typed, with the button disabled; the playground's server adapter holds names to Windows' rules (see "Creating and renaming" in `file-manager.md`).*
- [x] **new (minor):** Uploaded files' and folders' names aren't put through `checkName` before they're queued, so one the backend refuses only fails in the panel. *Done 2026-10-25: the upload check leaves out the files and folders given whose names `checkName` refuses, saying why (`uploadNamesRefused`), and the queue checks what's inside uploaded folders before each folder is made or file sent, failing a refused name with the adapter's message, without the call, listed under the folder's row (see `uploads.md`).*
- [x] Copied entries inside a folder that was then renamed keep their old ids, so pasting them fails with the adapter's error. *Done 2026-10-24: the clipboard follows a folder above its entries renamed to a new id, finding the folders below it and the entries again by name, and after a change names can't be trusted for (a folder they may be below moved, deleted, or renamed outside their trail, a section rooted below another's changed folder included), lists their folder again and keeps those still there by id, with nothing pasted meanwhile (see "Cut, copy and paste" in `file-manager.md`).*

### Drag and drop
- [x] The path bar as a drop target. *Done 2026-10-24: each segment takes entries and files from outside into its folder, by the paste rules, and a drag resting on one opens its folder.*
- [x] Opening a folder in the content by holding a drag over it. *Done 2026-10-24: in the list, the grid and a search everywhere's results, after 700 ms, but for a folder being dragged, and the drag goes on there. A drag whose source row went with the view still ends.*
- [x] Opening the collapsed sidebar during a drag. *Done 2026-10-24: resting a drag of entries or files on "Show sidebar" opens the overlay, or shows the hidden docked sidebar over the content, until the drag ends, leaving the hidden setting as it was.*
- [x] Touch dragging. *Done 2026-10-24: a long-press then moving on drags, in the content, the tree and the results, through the same drop targets and holds as a mouse, with the image by the finger and scrolling near edges. It moves, or copies where only that can be done or with Ctrl or Option held on a keyboard. Lifting after a long-press on a tree row or a result opens its menu, on iOS too.*

### Uploads
- [x] Uploading folders (planned, C.2). *Done 2026-10-24: dropped, pasted or picked (`ActionContext.uploadFolder`) folders are uploaded with everything in them, through the adapter's `createFolder` and `upload`, one row each in the panel, and a folder whose name is taken is merged into the one there, kept both under a free name, or skipped.*
- [x] **new:** A folder's row in the upload panel doesn't list its files, nor which of them failed and why beyond the first error. *Done 2026-10-24: a chevron on the row unfolds what failed, each by its path with the adapter's error, the first 100 listed and the rest counted.*
- [x] **new (minor):** Cancelling while a folder of an upload is being made can leave it made without the queue knowing, and Retry then fails, as its name is taken. *Done 2026-10-24: a folder tried before is looked for first and taken as made, and a file tried before in a folder the upload made replaces its own earlier try.*
- [x] Pasting files from the system clipboard. *Done 2026-10-23: Ctrl+V, ⌘V or Shift+Insert in the content or on a tree row uploads them there, unless the file manager's own cut or copied entries can be pasted there, which come first. The menu's Paste can't (reading the clipboard from a click needs permission), and what a browser hands over from the desktop differs by browser and system.*
- [x] A way for a section to refuse uploads. *Done 2026-10-23: `Section.acceptUploads: false` takes no uploads, by the picker or by dropping, in any of the section's folders. It goes by the section, as `importFrom` does.*
- [x] Showing which files just arrived: "Show in folder" on a finished upload in the panel, and a brief highlight in the open folder, never a change to the selection. *Done 2026-10-24: what an upload put in a folder is highlighted for a moment in any view showing that folder, and "Show in folder" on a finished row opens the folder and scrolls to it, with the Tab stop but not the focus. The adapter's `upload` may resolve with the file's entry, to find a file kept under another name.*
- [x] **new:** The file picker has no `accept` setting, so an app can't limit file types. *Done 2026-10-24: `Section.acceptUploads` takes a string in `accept`'s syntax, offered by the picker, checked for picked, dropped and pasted files, which the upload check leaves out saying which types the section takes, and refused while dragging when the files' types surely don't match. Folders have no rule of their own, by choice (see `uploads.md`).*

### Preview
- [x] The app's own actions in the preview's header. *Done 2026-10-24: `previewActions`, as an `ActionContext` for the file shown with `closePreview`, as buttons (four with icons) and a "More actions" menu, all in the menu on a narrow screen, their shortcuts working in the preview; Rename, Delete and Move open over the preview, which follows what they did, and what they announce is said from inside it.*
- [x] Sliding animation when stepping with the buttons or keys. *Done 2026-10-24: the file slides in from its side as a swipe's does, and Home and End go to the first and last file.*
- [x] Swiping on past the edge of a zoomed image. *Done 2026-10-24: the finger pans the image to its edge, and the swipe takes the rest of the way.*
- [x] Safari's touchpad pinch (it sends `gesturechange`). *Done 2026-10-24: gesture events zoom as Ctrl+wheel does elsewhere, and are left alone on a touch screen, whose pointers zoom already.*
- [x] Momentum when panning by touch, and animated zoom steps. *Done 2026-10-24: a flicked image glides on, slowing, until an edge; zoom steps, turns and arrow pans animate over 200 ms, unless motion is reduced.*
- [x] Rotating images and full screen. *Done 2026-10-24: R and Shift+R, and two buttons, turn an image a quarter, keeping its zoom; F and a header button fill the window and, through the Fullscreen API, the screen, with the page so menus and dialogs over the preview still show.*
- [x] Fonts. *Done 2026-10-24: TTF, OTF, WOFF and WOFF2, loaded with `FontFace`, shown as a specimen of characters and a sample at six sizes, in the language's own script from the text.*
- [x] A way for the app to plug in its own previewer per file type (highlighted code, rendered Markdown, office documents, archive contents), rather than building those in, which would add heavy dependencies to the package. *Done 2026-10-24: `previewers`, each with `accepts`, `reads` ("content", "text" or "none", loaded ahead like the preview's own) and `render`, inside `Suspense` and an error boundary; the playground renders Markdown, CSV and zips.*
- [x] **new:** The text preview stops at 256 kB, reads only UTF-8, and PDFs show nothing on a browser without a PDF viewer. *Done 2026-10-24: Show more reads as much again each time; UTF-16 with its byte order mark and Windows-1252 are decoded; a browser without a viewer gets "Open in a new tab".*
- [x] **new:** A file renamed, deleted or moved while it's previewed, or replaced under the same id, kept showing as it was. *Done 2026-10-24: the preview follows its folder's listing and the file manager's changes, showing the next file in the place of one that went, and closing with none left; contents are kept by id, size and date.*

### Properties
- [ ] Editing fields (an adapter `updateProperties`, for the media manager's alt text and caption; fields already carry an `id` for it), designed with the media manager's contract.
- [x] The app's own actions in the panel's header, designed together with the preview's. *Done 2026-10-24: `propertiesActions`, for its entries or the folder it shows, through the same `ToolbarActions` as the preview's, two as buttons, their shortcuts working in the panel.*
- [ ] Tabs (activity, versions, sharing), a picture larger than the grid's thumbnail, and resizing the docked panel.

### Thumbnails
- [x] A thumbnail in the preview while the file loads. (The sidebar tree and the Move/Copy picker show only folders, so they have no thumbnails to show.) *Done 2026-10-24: the grid's thumbnail stands where the file will be, under the spinner, sized as the image will be when the listing says; it's a video's poster, and the picture of a file with no preview, such as a TIFF.*
- [ ] Square cropping, and a frame around pictures.

### Search
- [ ] Acting on a selection that spans several folders.
- [ ] Locations in the grid view.
- [ ] Ordering results by relevance.

### Selection
- [ ] The sidebar tree has no touch selection mode.

### Keyboard
- [ ] Two layout cases miss: a non-Latin layout on a non-US keyboard, and Option+letter on a non-QWERTY Mac. Fixing them needs `getLayoutMap()`, which only Chromium has.

### Virtualization limits
- [ ] The browser's find in page and a screen reader's browse mode only see the rows on screen.
- [ ] Browsers cap an element's height, so a folder of a few hundred thousand entries gets cut off.

### Right to left limits
- [ ] A menu tall enough to scroll puts its scrollbar padding on the wrong side.
- [ ] `:dir()` needs recent browsers.
- [ ] A page that sets `direction: rtl` in CSS without the `dir` attribute doesn't get the mirrored styles.

### Locale
- [ ] No translations ship with the package.
- [ ] The playground has no page in another language.

### Interface polish
- [x] **new:** No tooltips anywhere. Icon-only buttons (back, search, view, menus, zoom) only have screen-reader labels. *Done 2026-10-23: every icon-only button is a `TooltipIconButton` showing its label, but the list rows' ⋮, which is hidden from screen readers.*
- [x] **new:** Nothing handles Windows High Contrast mode (`forced-colors`). Selection, hover, cut and drop markers are background colours, which that mode removes, so selected files look like all the others. *Done 2026-10-23: selections show in the system's `Highlight`, as do pressed buttons, the open search tab and progress bars, menus and tooltips get an edge, and the cut and drop markers already had outlines. Hover shows nothing for now.*
- [ ] **new:** Back and forward have no history list (GNOME shows one on right-click).

## B. Packaging (before any release)
- [ ] `package.json` is private and uses the repo's name. React, MUI and Emotion are dependencies when they should be peer dependencies.
- [ ] There's no library build, no `.d.ts` files, no `exports` and no `sideEffects`.
- [ ] **new:** `icon-sets/registry.ts` imports all five icon styles, so every app ships five copies of every icon, whichever style it uses.
- [ ] The size of `@react-symbols/icons` hasn't been checked.
- [ ] **new:** There's no `"use client"` directive, which Next.js App Router needs.
- [ ] The README is still Vite's template, there's no LICENSE or CHANGELOG, `index.html` still has the repo name as its title, and the repo name mentions Pigment.
- [ ] **new:** The MUI-style ways to customise are missing: stable class names, theme `defaultProps` (`localeText` included, as MUI's own components take it) and `styleOverrides`, and `slots`/`slotProps` (for example to replace the empty state or add header buttons).
- [ ] **new:** Fixed numbers an app can't change: 3 uploads and 3 downloads at once, 6 thumbnails at once, the search delay, and the 20,000 entries of listings kept that nothing shows.

## C. New features

### Planned, in order
1. [x] Properties, designed together with the media manager's details panel. *Done 2026-10-24: a panel docked beside the content from 1100px wide, over it below, following the selection or showing the open folder, from Alt+Enter, the view menu or `ActionContext.properties()`, with `propertiesOpen` to control it; the adapter adds `properties` (fuller fields and its own) and `measure` (what's in folders), and `FileEntry` takes `createdAt` and `media`. The panel is shared, for the media manager (see `properties.md`).*
2. [x] Folder upload. *Done 2026-10-24 (see A, "Uploads").*
3. [ ] A pick mode (filter by type, a Choose button).
4. [ ] The media manager, after its contract is designed on paper.
5. [ ] List columns from `FileEntry.meta`.
6. [ ] Undo.

### Optional ideas
- [ ] Live updates: an adapter `watch`, or re-checking the open folder when the page is shown again (re-checking a folder as it opens is done, `relistAfter`).
- [x] Zoom levels for the list and the grid (Ctrl+plus and Ctrl+minus, as in GNOME), which also give pictures larger thumbnails. *Done 2026-10-25: each view zooms by its own steps (the list four sizes, the grid five), its icons, thumbnails, rows or columns growing and the text staying, with Ctrl+plus, Ctrl+minus, Ctrl+0, Ctrl+wheel and a touchpad pinch in the content only, so the browser's page zoom works everywhere else, and from the view menu; `zoom` / `defaultZoom` / `onZoomChange` control it. The entry at the top stays there as the lines change size, larger thumbnails are asked for as a view zooms in, and the level is announced.*
- [ ] Zooming the content with a pinch on a touch screen, which zooms the page for now, since the content takes the touch to scroll.
- [ ] Choosing and resizing list columns.
- [ ] Progress and errors for the app's own long actions (compress, extract) through the planned job panel, which could grow from the transfer queue and panel.
- [ ] "New file" with the name dialog.
- [ ] Renaming several files at once.
- [ ] Going to a location by typing a path (would need an adapter `resolve`, since ids are never parsed).
- [ ] "Folders first" as a setting.
- [ ] Invert selection.

## Left out by choice

Not gaps: tests, a built-in editor, previewers for other kinds built into the package (an app plugs them in through `previewers`), saving an image turned in the preview, keyboard drag and drop, renaming in place, a built-in trash (an app builds one from `move` and a section of its own), modal dialogs for background work, resuming an upload after a reload (the browser no longer has the files, and resuming partway is the backend's upload protocol), upload types per folder (a section rooted there, or the adapter's `upload`, covers it), and `onClipboardChange` until a consumer needs it (see "Internal by choice" in `props.md`).
