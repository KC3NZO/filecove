---
paths:
  - "src/components/file-manager/**"
  - "src/hooks/**"
  - "src/store/**"
  - "src/contexts/data-context.ts"
  - "src/utils/**"
---

# File manager internals

`src/components/file-manager/file-manager.tsx` is the frame (sidebar, header bar, inset content panel). It owns navigation, tree expansion, the sort order, touch selection mode and the context menu state. Selection has its own rule, `selection.md`, and the public props that control or drive these (the location, the view settings, the selection, `apiRef`, the root element, props changing after mounting) have `props.md`.

## Data

`store/folder-store.ts` caches listings per `folderKey(sectionId, folderId)`. The cache is shared by the sidebar tree and the content view, with request de-duplication and abort-on-unmount. `file-manager.tsx` provides the store through `DataContext` (`contexts/data-context.ts`), and components read it with `useFolder` (`hooks/use-folder.ts`), which uses `useSyncExternalStore` with per-folder snapshots.

- `load(..., force)` lists a folder again even while a request is in flight, replacing it, since that request's result could predate a change just made.
- `relist(sectionId, adapter, folderIds)` lists again the section's cached listings of those folders, and every cached listing holding one of them, for its item count. It looks through all of the section's listings, found by the section's part of their key, so none is missed and no folder id is parsed.
- `cachedTree(sectionId, folderId)` gives the ids of a folder and of every folder below it whose listing the section has cached, found by walking the cached listings, so the folders below one are known without parsing ids.
- `forget(sectionId, folderIds)` drops the listings of those folders and of everything cached below them (`cachedTree`). Only use it on folders no enabled `useFolder` is showing, since nothing reloads them on its own.
- `relist` without folder ids lists again every listing the section has cached, for `FileManagerApi.refresh()`. `forgetSection(sectionId)` drops all of a section's listings, for a section another adapter now serves; `useFolder` and the tree list what they show again, since they follow the adapter (see "Props changing after mounting" in `props.md`).
- In the sidebar, a folder's listing, once there is one, overrides the adapter's `hasSubfolders` hint for its chevron.

### Paging

An adapter may list a large folder in pages: `list` resolves with a `nextCursor`, and the store calls it again with that as `cursor`, page after page, until one comes without it. Every page is fetched, so a listing in the cache is always the whole folder, and sorting, clash checks, Select all and type-ahead stay right. Paging lets a backend cap its responses and shows the first entries sooner; it doesn't load less.

- Listed for the first time, a folder shows what has come so far as `{ status: "loading", partial: true }` (`FolderState`), never with no entries, at most every `PAGE_INTERVAL` (500 ms) after the first page, since every showing sorts it again in the content and the tree. Listed again, it keeps its listing until the new one is complete, as it always has.
- Whatever needs the whole folder waits until `partial` is gone: the paste and upload dialogs before looking for clashes, and the transfer picker's "Copy here" / "Move here" button. "Folder is empty" and the tree's "No folders" only show once the folder is `ready`, and a tree row keeps its spinner while pages come.
- An entry a later page repeats, as offset paging can while the folder changes, is listed once. A page handing back the cursor it was given is an error, rather than a request loop.
- `abortAll` keeps a complete listing being refreshed, but drops a partial one, so it's listed again. React's development double mount runs it.
- The playground's mock adapter lists 2,500 entries a page, with the next offset as the cursor, so `archive` comes in four.

### Changes show in every section sharing the adapter

Sections served by the same adapter object can show the same folders, under the same ids (ids are unique within an adapter), so whatever a dialog changes is handled in all of them, through two helpers in `file-manager.tsx`:

- `relist(adapter, folderIds)` is every dialog's `onChanged`, called done, failed or cancelled with the folders the adapter may have changed: the one created or renamed in, the one deleted from, a copy's or move's destination and, for a move, its source. The upload queue calls it too, for the folders uploads ended in, at most once a second (see `uploads.md`). It runs the store's `relist` in each section.
- `dropFolders(adapter, folderIds)` is for folders whose ids may now name other folders, as path ids do: deleted and moved folders, a renamed folder's old and new id, and a new folder's id. Their cached listings, and those of every folder any section has cached below them, are dropped in each section (`forget`). A section rooted in one of them can't follow it, since its root is the consumer's: its places, in the history too, go back to its root, which is listed again to show what the adapter has there now, as nothing lists a dropped listing on its own.
- Places in the history, the sidebar's expanded folders, selecting a new entry and a paste's progress bar go by folder id in every such section too.
- A section rooted further below a changed folder is only caught when some section has its root cached under that folder; otherwise nothing ties the two together without parsing ids.
- The playground's Website source bookmark is rooted in Website's `src`, to try these out.

## Navigation

`hooks/use-location-history.ts` holds the current place, a `FileManagerLocation` (a section plus a trail of `FolderRef`s), and the back/forward history, and lets the consumer control it (see `props.md`). `utils/navigation.ts` has `folderOf`, which returns the folder a place points at, and `samePlace` and `equalPlace`, which compare places by id, and by name too.

- Breadcrumbs come from the trail, not from parsing ids. The path bar starts with the section label, followed by the folders below its root.
- Navigating never expands or collapses the sidebar tree; only its chevrons, Right and Left on a row, and a drag resting on a row do (see "Drag and drop"), and the path bar shows where you are. Only the first section shown starts expanded, unless the consumer says otherwise: the expanded folders can be controlled too (`expandedFolders`; see `props.md`).
- Going up to a folder the open one is in, by any route, the consumer's included, selects the folder left through, worked out during rendering as the place changes (`shownPlace`), and opening a folder from the content takes the focus into it (`leaveFor`; see `keyboard.md`). The header's back and forward go through `goBack` and `goForward` for this, which read where they lead from `useLocationHistory`'s `previous` and `next`.
- Places in the history are rewritten with `revise` after a rename, a delete or a section changing, told as "replace", and the current one is the first section's root whenever its section is missing (see `props.md`).

## Hiding the docked sidebar

Below `rootWide` the sidebar is an overlay, opened and closed with `sidebarOpen`. Docked, it can be hidden instead, with `sidebarHidden` in `file-manager.tsx`, as in GNOME Files. The consumer can control it, or set where it starts (`sidebarHidden`, `defaultSidebarHidden`, `onSidebarHiddenChange`; see `props.md`):

- F9 hides and shows it (see `keyboard.md`), as does "Show sidebar" in the header's view menu, with F9 beside it. The menu portals out of the file manager, where its container queries don't reach, so it reads whether the sidebar docks as it opens (`sidebarDocked`, from the sidebar's computed `position`), and only offers the item then.
- While it's hidden, the header shows the "Show sidebar" button and search, as it does while the sidebar is collapsed.
- The sidebar takes `display: none` through `data-hidden`, only from `rootWide`, so a narrower root still has its overlay. The frame's `data-sidebar-hidden` gives the content and upload panels back their margin on its side (`besideSidebar`).
- The state outlives the root's width changing: hidden, then narrowed and widened again, it's still hidden.

## Search

Only the interface is built so far: nothing is filtered or fetched, and what's typed is kept for the open-folder filter and a later optional `adapter.search`. Searching is a passing state of the open folder, not a dialog, so the results can show in the content view, where selection, the menus, dragging, opening and downloading already work.

- While `searching` (`file-manager.tsx`), the search field (`header-bar/search-field.tsx`) takes the path bar's place, the same pill in the same grid area, so nothing in the header moves: on its own row below the buttons when narrow, centred between them from `rootMedium`. It's a `search` landmark holding a `type="search"` input named "Search", with "Search in ‹folder›" (`searchIn`, the open folder's name, or the section's at its root) as its placeholder, and a ✕ that clears what's typed, or closes the search when nothing is ("Clear search" / "Close search"). The browser's own clear button is hidden.
- The Search buttons, in the sidebar's header and, while the sidebar is collapsed or hidden, in the header bar, are toggles (`aria-pressed`, `primary.main` while pressed). Ctrl+F or ⌘F opens it from anywhere in the file manager, in place of the browser's find, or focuses the field with what's typed selected when it's open already (see `keyboard.md`).
- The field takes the focus as it opens. Escape, the ✕ with nothing typed, or a Search button closes it and gives the focus back to what had it before (`searchOpener`), or to the content when that's gone or hidden, as the header's button is once the sidebar docks. The ✕ and the buttons keep the focus in the field as they're pressed (`preventDefault` on `mousedown`), so a press doesn't first blur it.
- Down or Enter goes on to the content (`focusContent`). The focus leaving the field with nothing typed closes the search and leaves the focus where it went, checked once it's gone so the window losing the focus doesn't count; with something typed, the field stays.
- Opening another folder, by any route, the consumer's included, ends the search and drops what's typed, as in GNOME Files. It's worked out as the place changes during rendering, with the folder left through (`shownPlace`); a place rewritten to the same folders, as after a rename, keeps it.
- Typing in the content is still type-ahead and doesn't start a search.
- The query runs as its own letters do (`unicode-bidi: plaintext`), and the folder's name in the placeholder is isolated (`isolate`).
- The open state and the query are internal. They become props (`search`, `defaultSearch`, `onSearchChange`) with the results, since how the deeper search is scoped decides their shape.

## Context menu and actions

An `ActionContext` says whether `entries` ("selection") or a folder's empty space ("folder") was targeted, and offers `refresh()` and `openFolder()`. It also offers `open()`, `preview()`, `download()`, `createFolder()`, `createFolderInto()`, `rename()`, `copyTo()`, `moveTo()`, `cut()`, `copy()`, `delete()`, `upload()`, `paste()` and `pasteInto()`, which are left out when the section's adapter lacks the matching method (`preview` lacking `content`, also when the entries hold no file; `download` lacking `download`, unless the entries are a single file and there's `content`, and downloading the folder itself when there are no entries; `open` unless there's exactly one entry, and for a file nothing can open; `rename` also when there isn't exactly one entry, `copyTo`, `moveTo`, `cut`, `copy` and `delete` when there are none, `upload` while another upload is being checked, `paste` and `pasteInto` when there's nothing to paste there, `pasteInto` and `createFolderInto` also unless the entries are a single folder), so actions hide with `visible: (context) => !!context.rename`, or grey out with `disabled`. The consumer still places, labels and gates these actions; the file manager adds nothing to the menu itself.

- Actions apply to any number of selected entries (copy, move, delete, compress...). Only actions marked `single: true`, such as rename, hide while several entries are selected.
- The menu opens on right-click (items, content background, sidebar rows), from the ⋮ buttons (list rows, path bar), and with the Menu key or Shift+F10 on a focused entry, tree row or the view (see `keyboard.md`).
- When no action applies, the browser's own menu is left alone.
- `context-menu/` renders the grouped menu from the groups that `utils/action-groups.ts` leaves visible.
- An action's `shortcut` is also a key binding (`utils/shortcut.ts`; Ctrl matches ⌘ too), matched on any keyboard layout (see "Keyboard layouts" in `keyboard.md`). `folder-view.tsx` takes focus on any press and hands key presses to `runShortcut` in `file-manager.tsx`, which tries the selection first and then the open folder, through the same `contextFor` and visibility rules as the menu. Sidebar tree rows do the same with the row (or the tree's selection) and then the row's own folder, and a section row with its root. Shortcuts come before the component's own keys. Browsers keep some keys for themselves: Chrome never passes Shift+Ctrl+N (or Ctrl+N, Ctrl+T, Ctrl+W) to a page.

## Opening files and previewing

Opening a file (double-click, Enter, a tap, `open()`) goes to `FileManager`'s optional `onOpenFile`, or else to the preview, `dialogs/preview-dialog.tsx`, which shows what the adapter's optional `content` hands it. See `preview.md`. Downloading saves a file from `content`, and folders or several entries from the adapter's optional `download`, prepared in the background by a download queue and shown in a panel above the upload panel. See `download.md`.

## Creating and renaming

Both use one small modal, `dialogs/name-dialog.tsx`, rather than editing names inline, because the listing only holds what the adapter returned, and an inline edit has nowhere to keep a failed name. The adapter's optional `createFolder(parentId, name, { signal })` and `rename(entry, name, { signal })` resolve with the entry as it now is.

- `createFolder()` makes the folder in the one the menu is for: the open folder (its empty space, or the path bar's ⋮) or a section's root. A menu on a folder itself, in the content or on a sidebar tree row, has the folder as its `entries` and its parent as `folder`, so it offers `createFolderInto()` instead, for a "New folder inside…" action beside "Paste into folder" (the playground's, with no shortcut: Shift+Ctrl+N is for the open folder). It asks for the same dialog with the folder's trail.
- The name is trimmed and checked as it's typed (`utils/names.ts`): not ".", "..", or containing "/", and no clash with the folder's cached listing. An empty name only disables the button. The adapter has the final say, and the message of an `Error` it rejects with shows under the field, with the name kept.
- The field is focused with the name selected once the dialog has faded in (the transition's `onEntered`), not with `autoFocus`, which the closing context menu steals focus back from. Rename selects a file's name up to its extension. New folder starts with the first unused `untitledFolder` name, "New folder" then "New folder (2)" in English (`newFolderName`). Until something is typed, the suggestion follows the folder's listing as it comes (and is selected again if it changes), and Create waits for all of it unless listing failed, since a folder created in from its own menu (`createFolderInto`) may never have been listed. Submitting keeps the name as it is, so it doesn't move on as the folder is listed again during the fade-out. An unchanged name just closes.
- While the adapter works, the button shows a spinner and the field is read-only. Cancelling aborts the `signal`, but the folder is listed again anyway, since the change may already have been made.
- Afterwards the folder is listed again, with every listing holding it, for the item count (`relist`). If the folder is open, in whichever section, `file-manager.tsx` asks `FolderView` (`revealId`) to select the entry and scroll to it once the refreshed listing has it. `FileManagerApi.reveal` goes the same way; a reveal is dropped once another folder opens, or when the folder's whole listing has come without the entry (`revealLost`).
- A new folder is also scrolled to in the sidebar tree (`treeReveal`, a `TreeReveal`, from `revealInTree`, which a folder made in the transfer picker goes through too), in the first section whose tree has its row. It waits for the row, which comes with the refreshed listing, and scrolls the tree just far enough to show it (see `virtualization.md`). Nothing is expanded or selected for it, and the focus stays where it is, so navigation still never opens the tree. It's given up on when the folder it was made in isn't shown expanded in the tree, as when the sidebar has it collapsed, and for a hidden name while hidden files are off. A rename isn't scrolled to.
- A renamed folder keeps its place in every section showing it: `renameInPlace` (`utils/navigation.ts`) rewrites every place in the history, and its expanded state carries over. When its id changed, as path ids do, the ids below it can't be worked out, so trails into it end at the renamed folder, and the old id and the new one go through `dropFolders`, since either could hold another folder's contents. A section rooted in the folder stays where it is, under the old id.

## Copying and moving

"Copy to…" and "Move to…" ask for a destination in `dialogs/transfer-dialog.tsx`, then call the adapter's optional `copy(entries, targetId, { signal, conflict })` or `move(...)`. The call itself, with cancelling, the error and the refresh afterwards, is `hooks/use-transfer.ts`, shared with pasting; the Replace / Keep both / Skip step is `dialogs/conflict-step.tsx`.

- The picker browses folders only, starting in the entries' own folder, with the path bar and a back arrow to the folder above. Its folder list is one tab stop, moved through with the arrows (see `keyboard.md`). Only sections served by the same adapter object are offered (ids mean nothing to another adapter), and of those only the ones whose `importFrom` takes the entries' section (see "Sections taking entries from each other"); with more than one, going back from a root reaches a list of them.
- The entries being copied or moved can't be opened, so a folder can never go into itself or below itself, without the component parsing ids. Moving into the entries' own folder is disabled.
- Before running, the destination's cached listing is checked for names the entries share, so "Copy here" / "Move here" is disabled until all of it has come (see "Paging"). Clashes get a second step with Replace, Keep both and Skip, passed as `conflict`; otherwise `conflict` is "keepBoth", so a clash the cache missed never overwrites anything. Copying into the entries' own folder keeps both without asking, as a duplicate.
- Its folder list renders only the rows in or near view (see `virtualization.md`).
- When the adapter has `createFolder`, a New folder button at the end of the picker's toolbar opens `name-dialog.tsx` over it, for the folder the picker shows, once that folder's listing is complete (so the name starts unused and clashes are caught). The name dialog is rendered beside the picker's `Dialog`, not inside it, so its key presses don't bubble through the picker. Once created, the folder it was made in is listed again as any create is, the new id goes through `dropFolders` (`onFolderCreated`, `handleFolderCreated` in `file-manager.tsx`) before the picker lists it, and the picker opens it, since its destination is the folder it shows and a folder made there is meant to take the entries, as in GTK's file chooser. Going back up lands on it as the folder left through, scrolled to wherever it sorts. It isn't selected in the content, even when its parent is open there.
- Progress, cancelling and errors work as in the name dialog. Afterwards the destination is listed again, and for a move the source too, with the listings holding them (`relist`).
- After a move, moved folders go through `dropFolders`, and the open place, if it's inside one in any section showing it, goes to the destination instead.
- Not yet: an operations panel for long transfers, and copying between adapters.

## Deleting

`ActionContext.delete()` asks to confirm in `dialogs/delete-dialog.tsx`, then calls the adapter's optional `delete(entries, { signal })`, which deletes for good, folders with everything in them. Nothing is deleted without asking, shortcut included; a consumer that wants a trash can build it from `move` and a section of its own.

- The dialog names the entry, or counts them, says folders go with their contents, and that it can't be undone. Delete is focused once the dialog has faded in (`onEntered`, as in the name dialog), so the Delete key then Enter deletes, and Escape cancels.
- Progress, cancelling and errors work as in the name dialog. A rejected call leaves the dialog open to try again, with the folder listed again in case some entries went anyway.
- Done, failed or cancelled, the entries' folder is listed again, with the listings holding it (`relist`).
- Once done, deleted folders go through `dropFolders`, and `outsideDeleted` (`utils/navigation.ts`) ends every trail in the history that goes into one at the folder that held it, in every section showing it, so deleting the open folder from the sidebar opens its parent. Deleted entries leave the clipboard (`withoutEntries`, shared with moving).

## Sections taking entries from each other

Entries only ever move or copy between sections served by the same adapter object. A section's optional `importFrom` (`SectionImports` in `types/section.ts`, public) narrows which of those it takes entries from: `true` (the default) every one, `false` none, `{ allow }` only the sections with those ids, `{ deny }` all but those. The type lets a section give `allow` or `deny`, not both. Moving or copying within a section is always allowed, and unknown ids are ignored.

- `importsFrom(target, source)` in `utils/sections.ts` decides it, by section id. The source is the section the entries were listed in when they were cut, copied, dragged or picked for "Move to…" / "Copy to…", even when the same folders show in other sections too.
- It's checked wherever entries go into a section: in `canPaste`, so pasting and drag and drop, where a refused target shows the no-drop cursor, and in the destinations `contextFor` hands the transfer picker.
- It only covers entries coming in. Nothing yet stops a section's entries from leaving.
- The playground shows each kind on the server sections: Website takes only from API service, API service from anything but Design assets, and Design assets from nothing else.

## Cut, copy and paste

`ActionContext.cut()` and `copy()` put the entries on a clipboard held in `file-manager.tsx` (`Clipboard`, `types/clipboard.ts`), not the system clipboard, since ids mean nothing outside their adapter. `paste()` moves (cut) or copies them into the context's `folder`, and `pasteInto()` into the one folder in `entries`, so a folder's menu can offer "Paste into folder", in the content and the sidebar tree alike. Both go through the same adapter methods as "Move to…" and "Copy to…". The consumer's actions bind Ctrl+X, Ctrl+C and Ctrl+V like any other shortcut.

- `paste` is offered (`utils/clipboard.ts`, `canPaste`) only through the adapter the entries came from, into a section whose `importFrom` takes the entries' section, never into one of them or below one (the target's trail holds every folder above it, so no id is parsed), not into cut entries' own folder, and not while another paste runs. Copying into the entries' own folder duplicates them, as "keep both".
- `dialogs/paste-dialog.tsx` runs the paste unseen and only shows to ask about clashing names or to report the adapter's error. Clashes are looked for in the target's listing, which it loads first when it isn't cached (a folder pasted into from its menu, or dropped onto, may never have been opened). Afterwards the target is listed again, and the source after a cut, with the listings holding them, such as the target's parent (`relist`).
- While a paste runs, the open folder shows its progress bar (`busy`) if the paste changes it, in whichever section: it's the target, the folder listing the target, or the folder a cut leaves.
- A cut is pasted once and leaves the clipboard; a copy can be pasted again. Entries moved by either route leave the clipboard (their ids may have changed), as do deleted ones, and a renamed entry is replaced by its new self. Entries below a renamed folder keep their stale ids, and pasting them reports the adapter's error.
- Cut entries are marked wherever they're listed: `CutContext` (`contexts/cut-context.ts`) carries their ids and adapter, `hooks/use-cut-ids.ts` gives a section the ids it could be showing, and list rows, grid tiles and sidebar tree rows set `data-cut` for `cutMarker` (see `component-styling.md`).
- Ctrl+V pastes into the open folder even with a folder selected, as in GNOME; the playground's "Paste into folder" has no shortcut. On a sidebar tree row, Ctrl+V pastes into that folder.

## Drag and drop

Entries in the content and folders in the sidebar tree can be dragged into a folder in either: a folder in the content, the open folder's empty space, a tree folder, or a section row, for its root. The drop moves them, or copies them while Ctrl or Option (Alt) is held over the target. It's native HTML5 drag and drop. `hooks/use-entry-drag.ts`, used by `file-manager.tsx`, holds the drag under way and hands it to every view through `DragContext` (`contexts/drag-context.ts`), since a `dataTransfer` can't be read before the drop. Views take drops with `hooks/use-drop-target.ts`: `folder-view.tsx` once on its surface, finding entries by `data-entry-id`, and the tree once per row. A drop runs as a paste (`DropInto` in `types/drag.ts`, `dropInto` in `file-manager.tsx`): the dragged entries become a clipboard of their own, offered by the same `canPaste` rules and run by `paste-dialog.tsx`, so clashes, errors, refreshing and leaving the real clipboard work as they do there, and the real clipboard is left alone. There's no consumer action for it; an adapter with neither `move` nor `copy` has nothing draggable.

- A drag carries its pane's selection when it starts on a selected entry or tree folder; otherwise that one is selected and dragged alone, as with the context menu. In the tree, the open folder alone counts as selected until something else is.
- Entries drag by any part of their list row or grid tile, which also take drops for a folder; a marquee starts only from the empty space around them. Tree rows drag by any part too, so their main part is a plain div rather than a button, since Firefox starts no drag from a `<button>`.
- Section rows take drops but are never dragged: a section is the consumer's root, not an entry.
- The open folder's empty space, or a file in it, takes only entries it doesn't list already, so a drag from the content that ends there does nothing, Ctrl or not. Dropping a folder onto its own parent in the tree with Ctrl does duplicate it, as pasting a copy there does.
- A drag resting on a collapsed tree folder or section row for 700 ms expands it (`onHold`, and `expand` in `file-manager.tsx`, which never collapses), whether it takes the entries or not.
- Mouse only, like the marquee. A drag that starts from a touch or pen press is cancelled, since a press there scrolls or, held, selects. The root reads each press's `pointerType` for this.
- Dragged entries fade wherever they're listed (`hooks/use-dragged-ids.ts`, by adapter as cut entries are), and the folder they'd go into is highlighted through `dragMarkers`, or for the open folder by the panel's outline (see `component-styling.md`). A folder that can't take them (one of them, below one, or while another paste runs) isn't highlighted and the browser shows its no-drop cursor.
- While entries are dragged, the overlay sidebar's backdrop lets drops through to the content under it.
- The drag image is `drag-preview.tsx`, rendered by `file-manager.tsx`: the grabbed entry's icon and name on a card, stacked on a card per other entry (5 cards at most, each 4px further down and towards the end, and fainter), with a count of them all when more go along. It's rendered into `<body>` at the top corner for a single frame (`flushSync`), handed to `setDragImage`, and removed in the next animation frame, before it's painted. Safari cancels a drag whose image is wholly off screen, so it isn't placed off screen.
- The drag ends on `drop` as well as `dragend`, both caught on the file manager's root once they've bubbled up, since a move can remove the source row before `dragend` arrives. Every target's highlight clears once no drag is under way. Files dragged in from the desktop go to the same targets and are uploaded (see `uploads.md`); files dropped anywhere else in the file manager are refused, so the browser doesn't open them in place of the page. Other drags from outside, such as text, are left to the browser.
- Not yet: the path bar as a drop target, opening a folder in the content by resting a drag on it, opening the collapsed sidebar while dragging, and touch.

## Sorting

Sorting is client-side, in `utils/sort.ts`. `file-manager.tsx` owns the `SortOrder` (a key of name, size, type or modified, plus a direction), which persists across folders and the consumer can control (`sort`, `defaultSort`, `onSortChange`; see `props.md`), and `folder-view.tsx` sorts the listing with `entryComparator`. So can the view, list or grid (`view`, `defaultView`, `onViewChange`). Names and type labels compare in the `locale` prop's collation (`Locale.compareNames`), and the keys' and directions' labels come from the text (`SORT_LABELS`; see `locale.md`).

- Folders always come first. Ties fall back to the name, A to Z.
- Picking a key starts it in its own direction: names and types A to Z, sizes and dates largest and newest first.
- Two controls share the order:
  - The header's chevron menu (`header-bar/view-menu.tsx`), with radios for the key and the direction.
  - The list view's column headers, where a click on the active column reverses it.

  The menu is the only control in the grid view, and in a list too narrow for its header row.
- The sidebar tree ignores it and stays by name (`nameOrder`), as does the transfer picker. Section order is the consumer's.
- The same menu has a "Show hidden files" checkbox (see "Hidden files"), and, while the sidebar docks, "Show sidebar" (see "Hiding the docked sidebar").

## Hidden files

"Show hidden files" in the header's view menu, off to start with, is `showHidden` in `file-manager.tsx`, which the consumer can control or start on (`showHidden`, `defaultShowHidden`, `onShowHiddenChange`; see `props.md`), e.g. to keep it across reloads. Ctrl+H turns it on and off from anywhere in the file manager, as in GNOME Files, and the menu shows the key beside it (`showHiddenFilesShortcut`, as the language's keyboards name it). It's Ctrl only, not ⌘, since ⌘H hides the browser on macOS before the page sees it (see `keyboard.md`). It persists across folders, as the sort does. Whether an entry is hidden is `isHidden` (`utils/hidden.ts`): the entry's optional `hidden` when the adapter sets it, or else a name starting with a dot. So a backend with its own idea of hidden says so, and `hidden: false` keeps a dotfile always shown.

- Listings are filtered where they're shown, never in the store, so clash checks (the paste, upload and name dialogs) and `relist` still see every entry: a hidden name can clash too.
- The content view (`folder-view.tsx`) leaves hidden entries out before sorting, so selection, Select all, type-ahead, the marquee, the arrow keys, the selection bar's total, the screen reader's count and the preview's stepping (the `listing` of a `MenuRequest`) all go by what's shown. A folder holding only hidden entries reads "Folder is empty", as in GNOME Files.
- The sidebar tree (`use-tree-rows.ts`) leaves out hidden folders, and a folder whose listing holds none that show loses its chevron. `sortedFolders` keeps both the whole sorted list and the unhidden one per listing. Expanded state is kept by folder key, so a hidden folder comes back as it was.
- The "Move to…" and "Copy to…" picker leaves them out too, so a hidden destination is reached by turning the option on first.
- The open folder stays open when it is hidden and the option is turned off, or when it's reached with it off, and the path bar shows it; only what's listed in it is filtered.
- Selected entries that get hidden stay in the selection's id set, since the listing still has them, unlike removed ones, but don't count: `selected` only holds listed entries. Turning the option back on brings them back selected. `onSelectionChange` has them in its ids but not its entries.
- A created or renamed entry to be revealed (`revealId`), or a folder left through that is hidden, is given up on while hidden entries are off, rather than waiting for a listing that will never show it.
- `childCount` and `hasSubfolders` are the adapter's own and count hidden entries as the backend does.
- An entry or tree row that has the focus when it gets hidden hands it on as a removed one does: to the entry now in its place, or the row shown before it.

## The parts

- The sidebar tree is flat: `hooks/use-tree-rows.ts` turns the sections and the listings of the expanded folders into the rows the tree shows, each placed where it goes, and lists a folder once the tree comes to show its folders. `sidebar/location-item.tsx` renders one row each: a section, a folder, a folder that couldn't be listed or a single section's status (`TreeItem` is the shared `treeitem`), and the guide lines along expanded folders. Only the rows in or near view are rendered (see `virtualization.md`). A section with `showFolders: false` is a plain GNOME-style place: no chevron, no tree, and it never starts expanded. The default is `true`.

## Single section

`FileManager` takes either `sections` (groups) or a single `section`, never both; `FileManagerProps` is a union that enforces it. A location (`defaultLocation`, `location`) names the single section by its id too. Inside, a single section becomes one group of one, so navigation, the store and the path bar don't tell the modes apart. Only the sidebar does:

- `useTreeRows`, given the `single` section, lists the root's folders as the sidebar's top level, with no section row and nothing to collapse. The root loads straight away and shows loading, empty ("No folders") and error rows in place of the tree.
- The root itself is reached through the path bar's first crumb, since there is no row for it. There is no sidebar menu for the root either; the content background's menu covers it.
- With `showFolders: false`, the single section falls back to its plain row, so the sidebar isn't empty.

The playground shows this mode with `?single` in the URL.
- `header-bar/` holds back/forward, the path bar, the search field that takes its place while searching (see "Search") and the view buttons. Below `rootMedium` the path bar gets a full-width row under the buttons; from `rootMedium` up, it sits centred between them.
- `content/folder-view.tsx` loads the open folder and shows the loading, empty and error states around the list view (`file-list.tsx`, a `--columns` grid template) or the grid view (`file-grid.tsx`), which render only the entries in or near view (see `virtualization.md`).
- `dialogs/` holds the modals, which portal to `<body>` like the context menu: `name-dialog.tsx`, `transfer-dialog.tsx`, `paste-dialog.tsx`, `delete-dialog.tsx`, `upload-dialog.tsx` and `preview-dialog.tsx`, with `conflict-step.tsx` shared by the transfer, paste and upload dialogs, and `image-viewer.tsx`, the preview's zoomable image.
- The upload and download panels under the content are `components/uploads/upload-panel.tsx` and `components/downloads/download-panel.tsx`, outside `file-manager/` since they're meant to be shared (see `uploads.md` and `download.md`). Their look is `styles/panel.ts`.
- `icon-slot.tsx` fits consumer-supplied icons to the same 1.25rem box as the built-in ones.
- `utils/format.ts` builds the `Locale`: the text, and the formats for sizes, dates and type labels in the `locale` prop's language (see `locale.md`).
