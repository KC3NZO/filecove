---
paths:
  - "src/index.ts"
  - "src/components/file-manager/file-manager.tsx"
  - "src/types/api.ts"
  - "src/types/limits.ts"
  - "src/utils/limits.ts"
  - "src/types/navigation.ts"
  - "src/types/selection.ts"
  - "src/types/section.ts"
  - "src/hooks/use-setting.ts"
  - "src/hooks/use-stable-set.ts"
  - "src/hooks/use-location-history.ts"
  - "src/hooks/use-selection.ts"
  - "src/styles/sx.ts"
  - "playground/app.tsx"
  - "playground/options.ts"
  - "playground/hooks/**"
---

# Public props

Besides `adapter`, `sections` / `section` and `actions` (CLAUDE.md), `mainMenu` and `relistAfter` (`file-manager.md`), `limits` (see "Limits"), `onOpenFile`, `previewers` and `previewActions` (`preview.md`), `propertiesActions` (`properties.md`) and `localeText` / `locale` (`locale.md`), `FileManager` takes the props below. Their comments in `file-manager.tsx` are the consumer's documentation, so they say what each does from the outside.

## Checklist for a new feature

Every feature added or changed is checked against this before it's called done. Search shipped without it and its public props came a day later.

- **State the user changes** (a mode, a query, a filter, a panel shown or hidden, a choice kept across uses): is it one of the thirteen below? If not, give it the trio `x` / `defaultX` / `onXChange` through `useSetting`, with the user's ways of changing it in the table. Leaving it internal is allowed only for a passing state, with the reason added to "Internal by choice".
- **Anything a consumer's own toolbar or code could ask for** (open, close, go to, start, refresh): an `apiRef` method in `types/api.ts`, listed under "The API", and a button for it in the playground's footer when it's visible there.
- **Anything done as the user acts** (an open, a pick, a result): a callback or an addition to one (`SelectionDetails`), told from the event handler that made it, never while rendering.
- **Controlled**: a change the user makes is only asked for, so nothing in a render or an effect may assume it happened; derive what's shown from the prop instead.
- **The playground** controls it by default and passes `default…` for `?uncontrolled`.
- **Keys**: a key added or changed is listed in the keyboard shortcuts window (see `keyboard.md`).
- **Announcements**: an action that finishes with nothing spoken about it (focus doesn't move to the result, no dialog opens, nothing changes where the user is) is announced politely (`announce`; see "Announcements" in `keyboard.md`), in text from a `FileManagerLocaleText` key. One already spoken isn't announced again: opening a folder, or a rename that leaves focus on the renamed entry. A panel with its own live region (uploads, downloads) already counts.
- **Docs**: the prop's comment in `file-manager.tsx` says what it does from the outside, and the rule of the feature says what isn't public yet, under "Not yet".

## Controlled or not

Thirteen pieces of state can each be controlled, as MUI's are: pass the value and change it in its callback, or leave it to the file manager, starting from its `default…` prop.

| State | Controlled | Uncontrolled start | Told through | The user changes it with |
|---|---|---|---|---|
| Location | `location` | `defaultLocation`, else the first section's root | `onLocationChange(location, reason)` | the sidebar, the path bar, opening folders, back and forward |
| View | `view` | `defaultView`, "list" | `onViewChange` | the header's view button |
| Zoom | `zoom` | `defaultZoom`, `{ list: 0, grid: 0 }` | `onZoomChange` | Ctrl+plus, Ctrl+minus, Ctrl+0 and Ctrl+wheel in the content, the view menu |
| Order | `sort` | `defaultSort`, relevance (name A to Z in folders) | `onSortChange` | the view menu, the list's column headers |
| Hidden files | `showHidden` | `defaultShowHidden`, false | `onShowHiddenChange` | Ctrl+H, the view menu |
| Docked sidebar hidden | `sidebarHidden` | `defaultSidebarHidden`, false | `onSidebarHiddenChange` | F9, the view menu, the header's "Show sidebar" |
| Docked sidebar's width | `sidebarWidth` | `defaultSidebarWidth`, 248 | `onSidebarWidthChange` | dragging the sidebar's edge (told as the drag ends), the arrow keys, Home and End on it, a double click on it |
| Docked properties shown | `propertiesOpen` | `defaultPropertiesOpen`, false | `onPropertiesOpenChange` | Alt+Enter, the view menu, the panel's ✕, `ActionContext.properties` |
| Docked properties' width | `propertiesWidth` | `defaultPropertiesWidth`, 300 | `onPropertiesWidthChange` | dragging the panel's edge (told as the drag ends), Left, Right, Home and End on it, a double click on it |
| Tree folders expanded | `expandedFolders` | `defaultExpandedFolders`, else the section opened in | `onExpandedFoldersChange` | the chevrons, Right and Left on a row, a drag resting on a row |
| Search | `search` (null is closed) | `defaultSearch`, closed | `onSearchChange(search \| null)` | Ctrl+F, Ctrl+Shift+F, the search buttons, typing, the scope buttons, Escape, ✕, opening another folder |
| Sections a search everywhere leaves out | `searchExcludedSections` | `defaultSearchExcludedSections`, none | `onSearchExcludedSectionsChange` | the field's sections menu |
| Content selection | `selectedIds` | `defaultSelectedIds`, none | `onSelectionChange(ids, { entries, location })` | clicks, keys, the marquee, touch selection mode |

- Which one is decided on mounting. MUI's `useControlled` warns in development about switching later, and about a `default…` changing after mounting. The view settings and the expanded folders go through `useSetting` (`hooks/use-setting.ts`), which is `useControlled` plus the callback, set to a value or with a function of the value as of the latest render; the location and the selection have hooks of their own, so `useControlled` is called for them for its warnings alone.
- The expanded folders are `SectionFolder`s (`types/section.ts`, public), a section id and a folder id, a section's row being its root folder. Inside they're `folderKey`s, turned back with `keyFolder`. A folder the tree doesn't show stays expanded, to show so again, and so does one of a section that's gone.
- The zoom is a `ViewZoom` (`types/view.ts`, public): each view's steps from the size it starts at, so switching views keeps each one's, as in GNOME Files. A step beyond a view's sizes shows as its nearest end, and zooming from there steps from what shows. Only the view shown zooms (see "Zoom" in `file-manager.md`).
- The consumer's arrays of ids, `selectedIds` and `expandedFolders`, are turned into sets that stay the same while they hold the same ids (`useStableSet`), so a new array each render doesn't count as a change.
- Controlled, a change the user makes is only asked for: the callback is told, and nothing changes until the prop comes back with it. A change the consumer refuses never happens. The callbacks are called from the event handler that made the change, so a consumer's `setState` there renders together with the file manager's own.
- Setting a value to what it is tells nothing (`sameSort` compares orders by key and direction).
- The search is a `FileManagerSearch` (`types/search.ts`, public): `scope` ("folder" or "everywhere") and `query`, as typed. Closed, it's null, so a closed search has no query; the sections left out are their own state, kept while closed. Opening it, switching scope, each keystroke and closing are each told. Another folder ending it is a layout effect over the place (`searchedPlace`), not part of the render, so a controlled search is asked for null, the consumer's `location` changes included; a consumer opening a folder with a search must pass it back. A `"everywhere"` scope with no section to search is shown as "folder" (`searchScope` is derived, never written), and shows "everywhere" again if the sections come back. The excluded ids are a set (`useStableSet`) like the expanded folders.
- The widths of the docked sidebar and the docked properties are in px, from 200 to 360 and from 240 to 480, and show narrower while the content beside them needs the room, without being changed: the properties narrow first, then the sidebar (see "Resizing the docked panels" in `file-manager.md`). A drag is told once, as it ends, rather than for every pixel, and a double click puts back the `default…` width. A width out of its limits is taken as the nearest one.
- The overlay sidebar's open state isn't a prop: it's a passing state of a narrow file manager, closed by most things done in it. Nor is the properties' overlay's, for the same reason (see `properties.md`).

## Location

The location is a `FileManagerLocation` (`types/navigation.ts`, public): a section id and a trail of `FolderRef`s below its root, as `Place` was. `hooks/use-location-history.ts` holds it with the back and forward history.

- **Uncontrolled**, every change is made at once and told to `onLocationChange`. **Controlled**, a change is kept as `asked` and told, and made once the consumer passes its place back. The history stays the file manager's either way.
- A location the consumer passes of their own (`passedOn`) is the change asked for, once it's that change's place; back or forward, when it's where those lead, so the file manager's history keeps in step with a browser's whose buttons set it; a rename, when it's the same folders by other names; or else a new place, pushed.
- The reason (`LocationChangeReason`) says why: "navigate" (`navigate`, `goTo`), "back", "forward", or "replace" for `revise`, which rewrites places in the history (a rename, a delete, a section losing its root, a section removed, rooted elsewhere or served by another adapter). `revise` can drop places (null), and places that end up next to the same place become one, so back never leads to where the file manager is.
- A place in a section the file manager doesn't have, from a section removed or a location passed for one it never had (`defaultLocation` included), shows the first section's root at once, in the same render. A layout effect then revises the history: places in missing sections go, and the current one goes to that root, which a controlled location is asked for as "replace". It runs once per such location, so a consumer who keeps passing it isn't asked again and again.
- Going up to a folder the open one is in, however it's reached, the user's way or the consumer's, reveals the folder left through. That's worked out as the place changes, during rendering (`shownPlace`), not by the code that navigates, and a "replace" doesn't count. Taking the focus into the folder opened only happens for changes made inside the file manager (`leaveFor`, see `keyboard.md`).
- The trail is the consumer's to build when they pass one; it isn't checked against listings, since ids are never parsed. A folder that isn't there shows the open-folder error.
- Navigation never expands the sidebar tree, the consumer's included.
- The playground's `useHashLocation` keeps it in the URL's hash: "navigate", "back" and "forward" push an entry, "replace" replaces one, and `popstate` passes the location from the hash back, where the browser's back lands on the file manager's previous place or next place. A hash with no location, as the entry the page opened on may have, or one the playground doesn't know, is the first section's root, and is rewritten to it as the page opens and whenever the browser goes back to such an entry, so going back to the first entry leaves the folder it was in.

## Selection

The content's selection is the folder view's (`selection.md`), and is what `selectedIds`, `defaultSelectedIds` and `onSelectionChange` cover. The sidebar tree's selection is a passing one for acting on folders there, and isn't public.

- `file-manager.tsx` keeps the consumer's ids as a set (`selectedIdSet`, by `useStableSet`), so a new array of the same ids each render doesn't count as selecting them anew, and hands it to `FolderView` only when controlled.
- `useSelection` takes the ids when controlled and keeps only the anchor itself. Each change (`commit`) builds on the latest selection, kept in a ref, so changes made one after another in one event add up, and is reported as it's made, with the entries it selects.
- `FolderView` also reports the selection as it is in an effect, so a change of the listing under it (a selected entry deleted, hidden files turned off, a refreshed listing's new entry objects) and a folder opening are told too. `tellSelection` in `file-manager.tsx` tells `onSelectionChange` only what changed: the ids as a set, the entries by identity. `ids` is what to pass back; `entries` are the selected entries the content lists, in its order, which is what to act on, so a hidden selected entry is in `ids` but not `entries`.
- Every folder opens with nothing selected. Going somewhere from inside the file manager (`leaveFor`) asks a controlled selection to empty, told before the location, while a `location` changed by the consumer leaves the selection to them, so they can open a folder with an entry selected.
- `defaultSelectedIds` are for the folder the file manager opens in, while it stays open (`initialSelection`).
- A selection set from outside, `defaultSelectedIds` or `selectedIds` other than what the view last asked for (`requestedIds`), is revealed once the folder's listing is complete (`revealSelected`): the first of its entries the view lists takes the focus, if the view has it, or the Tab stop, and is scrolled to.
- Ids the folder doesn't list drop out once all of it has come (`retain`, by `listedIds`), not while it's coming, so a selection passed with a location isn't cut short. Hidden entries are listed, so they stay selected.
- Leaving touch selection mode clears the selection in an effect rather than while rendering, since a controlled one is changed through the consumer.
- A search everywhere's results have a selection of their own, which isn't told: `SelectionDetails` has one location, and results come from many. The open folder's stays as it was under them, and is what `onSelectionChange` last heard.

## The API

`apiRef` takes a `FileManagerApi` (`types/api.ts`, public), given with `useImperativeHandle`. It's the same object while the file manager is mounted, and its methods call what's current through a ref (`api`), so a consumer can keep it.

- `navigate(location)`, `back()` and `forward()` do what the user going there does (`goTo`, `goBack`, `goForward`), asked for when the location is controlled. A section the file manager doesn't have is ignored.
- `refresh(folderIds?, { adapter }?)` lists folders again, in every section or only those `adapter` serves: those with the ids and every listing holding one of them, as `relist` does, or every listing a section has cached without ids (`store.relist` with no ids). Folders not listed yet need nothing.
- `reveal(entryId, location?)` selects one entry alone and scrolls to it, through the same `Reveal` that selects a created or renamed entry, keyed by the folder it's meant for. With a location it navigates there, and the reveal waits for that folder to open: a reveal is only dropped when another folder opens. `FolderView` only gets `revealId` while its folder is the reveal's, and gives one up (`revealLost`) once its whole listing has come without the entry, or while it's hidden. One a folder search leaves out ends the search instead, and is revealed in the whole folder.
- `actionContext(entries?, location?)` returns what the context menu's actions get (`contextFor`), for entries of the open folder or the one at `location`, or with none, the folder itself (`target` "folder"), so a toolbar of the consumer's own can make a folder, upload, paste, rename, delete, move to the trash, restore, open a trashed entry's original location, empty the trash, preview or show properties as the menu does. The preview steps through the folder's cached listing, hidden entries left out unless shown, in the content's order; the open folder's search filter isn't applied. It's built as of the call, so the consumer asks again as their toolbar renders, after the selection or the location changes. Null when the section is missing.
- `search(scope, query?)` opens the search field as Ctrl+F or Ctrl+Shift+F does (`openSearch`), putting `query` in it when given, and returns false when no section is shown or `"everywhere"` has no section to search. The field takes the focus: at once when it's there, or in the layout effect after the render that opens it (`focusSearchAsked`), so a controlled search the consumer applies later is still focused, and one they refuse isn't. `closeSearch()` does what Escape does (`closeSearch`, focus handed back).
- `focus()` asks the content to take the focus, as F6 does (`focusContent`).
- `download(entries?, location?)` downloads entries as the context menu's `download` does, through the same queue and panel, or with none, the folder itself, and returns whether it asked for anything (see "From outside" in `download.md`).
- `showShortcuts()` opens the keyboard shortcuts window as Ctrl+? does (`showShortcuts`), which gives the focus back to what had it when it closes (see "The keyboard shortcuts window" in `keyboard.md`).
- `undo()` and `redo()` do what Ctrl+Z and Shift+Ctrl+Z do (`runUndo`), returning whether there was anything to, with no undo or redo under way. A toolbar tells whether there is from `actionContext()`'s `undo` and `redo` (see `undo.md`).

## Internal by choice

What the checklist leaves internal, and why. Anything not listed here or above is a gap.

- **The overlay sidebar's and the properties' overlay's open states, the context menu, every dialog (name, delete, transfer, paste, upload check, preview, keyboard shortcuts), the view menu and the main menu**, and what's passing inside them, such as the preview's zoom, turn and full screen: passing states, opened and closed within one task. Their operations are reached from outside through `actionContext`, the shortcuts through `showShortcuts`, and the main menu's items are the consumer's own.
- **Touch selection mode**, the content's and the tree's: tied to the open folder and to touch, and ends as another folder opens. `ActionContext.select`, which starts the tree's, is only in a menu a long-press on a tree folder opened, never in `actionContext()`, as it starts from that press.
- **What `ActionContext.properties` asked the properties to show** in place of the selection: passing, it ends as the selection or the location changes, and a consumer gives the panel something else to show through `actionContext(entries, location).properties()`.
- **The sidebar tree's selection**: a passing selection for acting on folders there (see "Selection").
- **A search everywhere's selection and open tab**: the results come from many folders, and `SelectionDetails` has one location (see "Selection").
- **The undo history**: kept while mounted, as the clipboard is, and passing, as a change elsewhere can leave its steps meaning nothing. A toolbar learns of it as it asks `actionContext()` again, whose `undo` and `redo` say whether there's anything to; the main menu names the change. A callback can be added when a consumer needs one.
- **The cut or copied entries**: kept while mounted, and `actionContext`'s `paste` says whether there's anything to paste. A toolbar learns of a change only as it asks again; a callback for it can be added when a consumer needs one.
- **The upload, download and transfer queues and their panels' collapsed state**: the queues report what the adapter is doing, which the consumer's adapter already knows.
- **Focus, scroll and the entry grabbed for a drag**: `focus()` and `reveal` move the first two from outside.

## Limits

`limits` (`FileManagerLimits`, `types/limits.ts`, public) sets how much the file manager does at once and keeps, for a backend that takes more, or less, than the defaults. Each field is left to its default when omitted:

| Field | Default | Least | What it sets |
|---|---|---|---|
| `uploads` | 3 | 1 | calls an upload runs at once, files sent and folders made, across every upload (`store/upload-queue.ts`) |
| `downloads` | 3 | 1 | downloads the adapter prepares at once (`store/download-queue.ts`) |
| `transfers` | 3 | 1 | copies and moves at once (`store/transfer-queue.ts`) |
| `thumbnails` | 6 | 1 | `thumbnail` calls at once (`store/thumbnail-cache.ts`) |
| `keptThumbnails` | 1,000 | 0 | thumbnails kept while nothing shows them |
| `keptEntries` | 20,000 | 0 | entries kept in listings nothing shows (`store/folder-store.ts`) |
| `undoSteps` | 20 | 0 | changes kept to undo, and undone to redo (`UNDO_STEPS`, `utils/undo.ts`; see `undo.md`) |
| `searchDelay` | 300 ms | 0 | how long the typing stops before a search everywhere (`hooks/use-search.ts`) |

- Counts are made whole and raised to their least, with `Infinity` as no limit (`countLimit`, `utils/limits.ts`); a delay must be finite (`delayLimit`). Anything else, NaN included, is the default.
- Each store keeps its default as its constant and takes the limit through a setter (`setMaxActive`, `setLimits`, `setMaxKept`), so the queues the media manager will share have the same defaults without the prop. `file-manager.tsx` reads the fields into numbers, so a new object of the same limits every render changes nothing, and sets them in layout effects, before the parts' own effects ask for anything on mounting. The undo history is the file manager's own, and trims itself to `undoSteps` in a layout effect.
- A change takes effect at once: more at once starts what's waiting, less lets what's under way finish, and fewer kept drops what's beyond them (listings and thumbnails nothing shows). A new search delay applies from the next keystroke, and to one waiting.
- Fixed by choice, as interface timing rather than capacity: the long-press, the drag hold, type-ahead's pause, when the panels show a task (`SHOW_AFTER`), and how often progress and pages are shown.

## The root element

`FileManagerProps` takes the root `div`'s own attributes (`RootAttributes`), spread on it as a MUI component's root takes them, so `id`, `className`, `style`, `aria-*`, `data-*` and handlers go there. `title` is the sidebar's.

- The handlers the root uses itself, `onKeyDown`, `onDragEnter`, `onDragOver`, `onDrop`, `onDragEnd` and `onPointerDownCapture`, run the consumer's first, then the file manager's: a key press the consumer called `preventDefault` on is left alone (F6, F9, Ctrl+H, Alt+arrows), and so are files dragged in that they took, but a drag still ends.
- `ref` is forked with the file manager's own (`useForkRef`), and `sx` goes over the root's own styles (`withSx`, `styles/sx.ts`, shared with `Icon`). The root fills its container by default (100% wide and high), and lays itself out by its own width.

## Props changing after mounting

- A section removed takes its places out of the history, and the open one goes to the first section's root ("replace", above).
- A section rooted elsewhere, or served by another adapter (its own `adapter`, or the file manager's when it has none), goes back to its root, in the history too, since its trails lead nowhere now. Another adapter's ids mean something else, so its listings are dropped (`store.forgetSection`), and what shows them lists them again: `useFolder` by its `adapter` dependency, the sidebar tree because it remembers which adapter each shown folder was listed with (`useTreeRows`' `requested`). A rerooted section stays expanded or collapsed as it was. A clipboard of entries no section's adapter serves any more is dropped. These run in a layout effect over what each section had before (`servedBefore`).
- A `default…` prop changing does nothing, as with MUI's, which warn.
- `actions`, `previewActions`, `propertiesActions`, `previewers`, `title`, `onOpenFile`, the callbacks, `localeText`, `locale` and `limits` take effect at once, and `relistAfter` from the next folder opened. A dialog open during a change finishes with the section and adapter it was opened for.
- `sections` may be empty, as while an app is still getting them: the content says there's nothing to show (`content/no-sections.tsx`), and the location passed waits for its section to come (see "The parts" in `file-manager.md`).

## The playground

By default the playground controls everything, as an app would: the location in the URL's hash (`hooks/use-hash-location.ts`), so a reload, a link or the browser's back button follows it, the view settings (the view, the zoom, the order, hidden files, the hidden sidebar) and the expanded folders in local storage (`hooks/use-stored-state.ts`), and the selection in its own state, shown in a footer. The docked sidebar's width, the docked properties, shown or not, and their width are kept in local storage too. The file manager shares the page with the footer through `sx`. The footer's Undo and Redo call `undo` and `redo`, saying so when there's nothing to, "Show a file" calls `reveal` for a file far down `archive`'s 10,000 (in a single section, one in Website's `src/components`), "Change elsewhere" adds a file to the open folder behind the file manager's back (the mock's `addElsewhere`, found through `actionContext()`), which shows once the folder opens again, "Reload all" calls `refresh()`, and "Download selection" ("Download folder" with nothing selected) calls `download`, "New folder" calls `actionContext().createFolder`, or says the folder is read-only (`readOnly`), "Properties" calls `actionContext(...)?.properties()` for the selection, or the open folder with nothing selected, "Search "record"" calls `search` (everywhere, the open folder in a single section), and "Shortcuts" calls `showShortcuts`. Its `mainMenu` has Preferences (Ctrl+,) and About Files, its `previewActions` and `propertiesActions` the headers' demo actions (`createPreviewActions`, `createPropertiesActions` in `mock-data.tsx`), and its `previewers` Markdown, CSV and zips (`mock-previewers.tsx`). The search is the playground's state, not kept across reloads; the sections left out are in local storage. `?uncontrolled` (`options.ts`) passes what it keeps as the `default…` props instead, so the file manager keeps everything itself, and only the footer's selection is told. `?relistAfter=` passes `relistAfter` (`Infinity` for never), `?limits=uploads:1,thumbnails:2` passes `limits` (each `key:number`), `?lateSections` hands the sections over 3 s after the page opens, and `?huge` adds a folder of 200,000 files to API service, to see a list squeezed into the height browsers allow (see `virtualization.md`).
