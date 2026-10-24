# Roadmap

What's left in the features already built, what packaging needs before a release, and the features still to build. Items marked **new** came from a source audit on 2026-10-23 and aren't in the rules' "Not yet" lists. Tick an item off once it's done, and add new ones here, so this list stays the one place to look.

## Order

1. ~~Re-list a folder in the background when it opens, showing the cached listing meanwhile, with a prop to turn it off (A, "Folder data and cache").~~ Done 2026-10-23.
2. ~~Tooltips on icon-only buttons, selection that shows in Windows High Contrast mode, and screen-reader announcements when operations finish (A, "Interface polish" and "Operations").~~ Done 2026-10-23.
3. Properties, then folder upload (C).
4. Packaging, in one pass before a release (B).

## A. Gaps in features already built

### Folder data and cache
- [x] **new:** Once a folder is listed, opening it again shows the saved copy and never asks the adapter again. Changes made elsewhere (another user, another tab) only show after a refresh. There's no re-check when a folder opens, no expiry, and no adapter `watch`. *Done 2026-10-23: a folder opened again (content, tree, picker) is listed again in the background, `relistAfter` (default 0, `Infinity` for never) sets how old a listing may be first, and unchanged entries keep their objects. An adapter `watch` stays under "Optional ideas".*
- [x] **new:** Saved listings are never dropped while the component is open. Thumbnails stop at 1,000; folder listings have no limit. *Done 2026-10-23: listings nothing shows are dropped beyond 20,000 entries, longest unseen first, never one with a kept listing below it.*
- [x] **new:** With an empty `sections` (say, while the app is still loading them) the content area is blank, with no message. *Done 2026-10-23: "No sections to show", folder-only buttons disabled, and the first section to come starts expanded.*
- [x] A section rooted further below a changed folder only updates if that folder happens to be loaded (known limit). *Done 2026-10-23: after a folder is deleted, moved or renamed, a section that doesn't list it lists what it shows again at once, and every listing of the adapter's sections is checked again as it opens.*
- [x] **new:** A folder that a paste or move with Replace put another in the place of kept its old listing, so an expanded tree row showed the old contents. *Done 2026-10-23: replaced folders go through `dropFolders`.*

### Operations (create, rename, copy, move, delete, paste)
- [ ] A non-modal panel for long copies and moves.
- [ ] Copying between different adapters.
- [ ] **new:** There are no per-entry permissions. `FileEntry` has no read-only field, so a read-only folder still accepts drops and pastes. An app can hide its actions with `visible`, but it can't refuse drop or paste targets, nor stop entries from being moved out of a read-only folder or section (`importFrom` only controls what comes in; copying out is only reading).
- [ ] Name-clash dialog: Merge for a folder clashing with a folder, no Replace when a file clashes with a folder, and Replace no longer the highlighted main button.
- [x] **new:** Screen readers hear nothing when an operation finishes (deleted, moved, pasted, created). Only the upload and download panels announce anything. *Done 2026-10-23: deletes, copies, moves, pastes, drops, cut and copy, and creating and renaming are announced from one polite live region, a created or renamed entry only when it doesn't take the focus, and the checklist in `props.md` asks it of every new feature.*
- [ ] **new (minor):** Names are only checked for ".", ".." and "/". There's no hook for a backend's own rules (for example Windows' `\:*?"<>|`), so the user only finds out after pressing the button.
- [ ] Copied entries inside a folder that was then renamed keep their old ids, so pasting them fails with the adapter's error.

### Drag and drop
- [ ] The path bar as a drop target.
- [ ] Opening a folder in the content by holding a drag over it.
- [ ] Opening the collapsed sidebar during a drag.
- [ ] Touch dragging.

### Uploads
- [ ] Uploading folders (planned, C.2).
- [x] Pasting files from the system clipboard. *Done 2026-10-23: Ctrl+V, ⌘V or Shift+Insert in the content or on a tree row uploads them there, unless the file manager's own cut or copied entries can be pasted there, which come first. The menu's Paste can't (reading the clipboard from a click needs permission), and what a browser hands over from the desktop differs by browser and system.*
- [x] A way for a section to refuse uploads. *Done 2026-10-23: `Section.acceptUploads: false` takes no uploads, by the picker or by dropping, in any of the section's folders. It goes by the section, as `importFrom` does.*
- [ ] Showing which files just arrived: "Show in folder" on a finished upload in the panel, and a brief highlight in the open folder, never a change to the selection.
- [x] **new:** The file picker has no `accept` setting, so an app can't limit file types. *Done 2026-10-24: `Section.acceptUploads` takes a string in `accept`'s syntax, offered by the picker, checked for picked, dropped and pasted files, which the upload check leaves out saying which types the section takes, and refused while dragging when the files' types surely don't match. Folders have no rule of their own, by choice (see `uploads.md`).*

### Preview
- [ ] The app's own actions in the preview's header.
- [ ] Sliding animation when stepping with the buttons or keys.
- [ ] Swiping on past the edge of a zoomed image.
- [ ] Safari's touchpad pinch (it sends `gesturechange`).
- [ ] Momentum when panning by touch, and animated zoom steps.
- [ ] Rotating images and full screen.
- [ ] Fonts.
- [ ] A way for the app to plug in its own previewer per file type (highlighted code, rendered Markdown, office documents, archive contents), rather than building those in, which would add heavy dependencies to the package.

### Thumbnails
- [ ] A thumbnail in the preview while the file loads. (The sidebar tree and the Move/Copy picker show only folders, so they have no thumbnails to show.)
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
1. [ ] Properties, designed together with the media manager's details panel.
2. [ ] Folder upload.
3. [ ] A pick mode (filter by type, a Choose button).
4. [ ] The media manager, after its contract is designed on paper.
5. [ ] List columns from `FileEntry.meta`.
6. [ ] Undo.

### Optional ideas
- [ ] Live updates: an adapter `watch`, or re-checking the open folder when the page is shown again (re-checking a folder as it opens is done, `relistAfter`).
- [ ] Grid zoom levels (Ctrl+plus and Ctrl+minus, as in GNOME), which also give a grid of pictures larger thumbnails.
- [ ] Choosing and resizing list columns.
- [ ] Progress and errors for the app's own long actions (compress, extract) through the planned job panel.
- [ ] "New file" with the name dialog.
- [ ] Renaming several files at once.
- [ ] Going to a location by typing a path (would need an adapter `resolve`, since ids are never parsed).
- [ ] "Folders first" as a setting.
- [ ] Invert selection.

## Left out by choice

Not gaps: tests, a built-in editor, keyboard drag and drop, renaming in place, a built-in trash (an app builds one from `move` and a section of its own), modal dialogs for background work, resuming an upload after a reload (the browser no longer has the files, and resuming partway is the backend's upload protocol), upload types per folder (a section rooted there, or the adapter's `upload`, covers it), and `onClipboardChange` until a consumer needs it (see "Internal by choice" in `props.md`).
