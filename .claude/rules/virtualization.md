---
paths:
  - "src/hooks/use-scroll-measure.ts"
  - "src/hooks/use-virtual-lines.ts"
  - "src/hooks/use-virtual-rows.ts"
  - "src/hooks/use-tree-rows.ts"
  - "src/hooks/use-marquee.ts"
  - "src/components/file-manager/content/**"
  - "src/components/file-manager/sidebar/**"
  - "src/components/file-manager/dialogs/transfer-dialog.tsx"
  - "src/utils/dom.ts"
  - "src/types/view.ts"
  - "src/types/tree.ts"
---

# Virtualization

The content, the sidebar tree and the transfer picker's folder list render only what's in or near their scroll panel, so a folder of thousands of entries, or of thousands of folders in the tree or the picker, lists, scrolls and selects as fast as a small one.

All three build on `hooks/use-scroll-measure.ts`, which measures a list against the panel it scrolls in: after every render, on the panel's `scroll`, and on resizing (a `ResizeObserver` on the list and the panel). A scroll or resize that changes the measure is rendered under `flushSync`, so what scrolls in appears in the same frame. `shownSpan` gives the part of the list the panel shows, widened by `OVERSCAN` (400px); without a scrolling ancestor it's null, and everything is rendered. The list's ref is a callback ref that tears down when called with null, rather than returning a cleanup, which React 18 would ignore.

## The content

`hooks/use-virtual-lines.ts` does it for the list and the grid alike. `content/folder-view.tsx` calls it and hands the view its `VirtualLines` (`types/view.ts`) as `lines`.

### Lines

Entries go in lines of equal height: one row per line in the list, as many tiles as fit in the grid. The listbox is a CSS grid, so CSS still lays out what the container queries decide, and the hook reads it:

- The column tracks give the entries per line (`repeat(auto-fill, …)` in the grid, a single `minmax(0, 1fr)` track in the list), and the row gap gives the space between lines.
- The first entry rendered gives every line's height, so all rows, and all tiles, must be the same height. A list row's height never depends on its entry, only on the zoom's icon size, and a tile's name always takes two lines (`minHeight: "2.7em"`).
- Lines that change size, or the number a line holds, as zooming, switching views or the panel resizing does, keep the entry at the panel's top where it was, and how far down its line the top was (`Anchor`): `measure` notes it against the measure before, and scrolls back to it on the measure after, once the listbox has been rendered as tall as the new lines make it, so the panel can scroll that far. Both happen in layout effects, before anything is painted.
- Each rendered entry is absolutely positioned, with `top` from its line and, in the grid, `gridColumn: "<n> / span 1"`. An absolutely positioned child of a grid takes the grid area it's placed in as its containing block, so the tile fills its column. The span matters: with only a start line, the box runs to the listbox's far edge.
- The listbox's `height` covers every line, so the panel scrolls as far as it would with every entry rendered.
- The hook renders the lines `shownSpan` covers.
- Rows (`FileRow`) and tiles (`FileTile`) are memoized, so scrolling only renders the ones coming into view.
- Only rendered entries ask for their thumbnails, and one scrolled away before its thumbnail came drops the request (see `thumbnails.md`).
- The zebra stripe follows the entry's index (`data-striped`), not `:nth-of-type`, since the rendered rows aren't consecutive.

### What stays rendered

`keep` lists entries that are rendered wherever they are:

- The focused entry (`focusId`), so it keeps the focus and the view's Tab stop however far the panel scrolls.
- The entry a drag started from, while it's dragged. `dragend` is dispatched to its element, and from a removed element it would never reach the root. A drag resting on a folder opens it and takes the whole view away, which `useEntryDrag` handles (see "Drag and drop" in `file-manager.md`); a touch drag has no `dragend`.

### Finding entries by layout, not in the page

Anything that used to look entries up in the page now works from where the layout puts them:

- The marquee asks for the entries a box covers through `useMarquee`'s `entriesIn`, which the folder view answers with the hook's `indexesIn(box)`. That works from the lines and the column tracks (mirrored in RTL), so it finds entries whether they're rendered or not.
- The arrow keys take the grid's columns from `lines.columns`.
- Moving the focus (`focusEntry`) or revealing an entry sets `pendingScroll`. The entry is rendered once it has the focus. Once `settled()` says the rendered entries are where the latest measure puts them, an effect focuses it and scrolls to it. The focus effect waits for `settled()` too. A listbox that has just mounted, or a switch between list and grid, renders once more with the new measure, and only then is anything scrolled to.
- Each option carries `aria-setsize` and `aria-posinset`, so screen readers know where it is among all the entries.
- `FolderView` finds entries by id in `indexById`, a map, rather than by searching the listing.

A search everywhere's results (`content/search-results.tsx`) use the same hook and views, keyed by result, with the focused result and the one a drag started from kept rendered.

The playground's `archive` folder, in the API service section, holds 10,000 files for trying this out.

## The sidebar tree

The tree is flattened into the rows it shows (`hooks/use-tree-rows.ts`, `FlatTree` in `types/tree.ts`): the dividers and captions of the section groups, the sections, the folders below expanded rows, a folder's "Couldn't load" row, and a single section's loading and empty rows, top to bottom. Each row knows its `top` and `height`, and `hooks/use-virtual-rows.ts` renders those within `shownSpan`, found by binary search, as the rows differ in height.

- Heights are constants in `styles/layout.ts` (`TREE_SECTION_HEIGHT`, `TREE_FOLDER_HEIGHT`, `TREE_CAPTION_HEIGHT`, `TREE_DIVIDER_HEIGHT`), not measured, since nothing in the sidebar changes with container queries. The 2px between a group's sections and around an expanded row's folders are kept in the offsets.
- Every row is absolutely positioned in the `tree`, which is as tall as all of them. The section groups' `ul`s (`role="group"`) and a single section's `ul` hold their rows without taking room, so a group is still a `group` of the tree, but the folders below a row are no longer nested in it. Each `treeitem` says where it is with `aria-level`, `aria-setsize` and `aria-posinset`.
- The guide lines along an expanded row's folders are elements of their own (`GuideLine`), one per expanded row, rendered where they cross the rows rendered, ahead of the rows so they're drawn behind them.
- Folder and section rows are memoized, so scrolling only renders the rows coming into view.
- Expanding and collapsing is instant, since there's no nested list left to animate.

### Listings

`useTreeRows` reads every listing it shows from the store, and is flattened again whenever any listing changes, by the store's `version`. Each listing's folders are sorted once, kept in a `WeakMap` by the listing, which is replaced rather than changed.

- A folder is listed once the tree comes to show its folders: when it's expanded along with every row above it, and its `hasSubfolders` hint isn't false. A section's root is listed when the section is expanded, and a single section's root at once. Coming to show a folder listed before opens it (`store.open`), which lists it again in the background once its listing is `relistAfter` old (see "Listing again as a folder opens" in `file-manager.md`).
- Only folders the tree has just come to show are opened, so a listing that failed isn't tried again on every change, only from its Retry or once it's shown again. So is a folder shown already whose section another adapter now serves, since `requested` remembers which adapter each was listed with, and that section's listings are dropped (see `props.md`). A folder shown whose listing is gone, dropped as its id may name another folder now (`forget`), is listed afresh.
- The tree tells the store which listings it shows (`store.show`), so they're never dropped to make room (see "Keeping listings" in `file-manager.md`).

### What stays rendered

`keep` names the rows rendered wherever they are:

- The focused row (`focusKey`), so it keeps the focus.
- A row the focus is going to that isn't rendered yet (`focusRequest`).
- The row a drag started from, while it's dragged (`grabbedKey`), for `dragend`, as in the content.

Keyboard navigation, the hand-off of the focus when the focused row goes, and finding the row to focus as the tree is tabbed to all go by the rows, not the page (see `keyboard.md`).

### Scrolling to a row

A row's place is known from the rows alone, so the tree scrolls to one that isn't rendered: a folder just created (`reveal` of `Sidebar`; see "Creating and renaming" in `file-manager.md`) is found among the rows by its key once the refreshed listing has it, and the tree's scroll panel (`scrollParent`) is moved by the least that shows its `top` and `height`, from where the panel's edges are on the list. The row is rendered by the scroll that follows. It doesn't take the focus, unlike `focusRow`, which also scrolls.

The playground's `datasets` folder, in the API service section, holds 5,000 folders for trying this out.

## The transfer picker

The "Move to…" and "Copy to…" folder list (`dialogs/transfer-dialog.tsx`) uses `useVirtualLines` as the content's list view does: the `List` is a grid of one track, as tall as all its rows, inside a box that scrolls, and each rendered `ListItem` is placed at `index * pitch`.

- Its items are the sections, on the list of sections, or the folders, the entries being moved among them (disabled), as `PickerItem`s. Names are kept to one line (`noWrap`), since every row must be as tall.
- The row with the Tab stop stays rendered (`keep`). The keyboard side is in `keyboard.md`.
- The scrolling box is keyed by the folder, so each opens scrolled to the top and measured afresh.
- A folder made with the New folder button is opened. Going back up from it, it takes the Tab stop as the folder left through, which renders it wherever it sorts, and `settleFocus` scrolls to it once the rows are in their places.

## Limits

- Find in page (Ctrl+F) and a screen reader's browse mode only see the rendered entries and rows.
- Browsers cap an element's height (about 17.9 million px in Firefox), so a folder of a few hundred thousand entries is cut short.
