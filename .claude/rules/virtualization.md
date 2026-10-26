---
paths:
  - "src/hooks/use-scroll-measure.ts"
  - "src/hooks/use-virtual-lines.ts"
  - "src/hooks/use-virtual-rows.ts"
  - "src/hooks/use-found.ts"
  - "src/components/file-manager/find-layer.tsx"
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

All three build on `hooks/use-scroll-measure.ts`, which measures a list against the panel it scrolls in: after every render, on the panel's `scroll`, and on resizing (a `ResizeObserver` on the list and the panel). A scroll or resize that changes the measure is rendered under `flushSync`, so what scrolls in appears in the same frame. Each measure is handed a `ScrollView` (`types/view.ts`) of the panel, in px of the whole list: its `place(height)` lays the list out for its whole height, squeezing one too tall for the browser (see "Lists too tall for the browser"), and gives the part the panel shows, widened by `OVERSCAN` (400px); without a scrolling ancestor it's null, and everything is rendered. The list's ref is a callback ref that tears down when called with null, rather than returning a cleanup, which React 18 would ignore.

All three put the names of their rows in a find layer too, so the browser's find in page finds every one, rendered or not (see "Find in page").

## The content

`hooks/use-virtual-lines.ts` does it for the list and the grid alike. `content/folder-view.tsx` calls it and hands the view its `VirtualLines` (`types/view.ts`) as `lines`.

### Lines

Entries go in lines of equal height: one row per line in the list, as many tiles as fit in the grid. The listbox is a CSS grid, so CSS still lays out what the container queries decide, and the hook reads it:

- The column tracks give the entries per line (`repeat(auto-fill, …)` in the grid, a single `minmax(0, 1fr)` track in the list), and the row gap gives the space between lines.
- The first entry rendered gives every line's height, so all rows, and all tiles, must be the same height. A list row's height never depends on its entry, only on the zoom's icon size, and a tile's name always takes two lines (`minHeight: "2.7em"`), as does the location a search everywhere's result adds under it.
- Lines that change size, or the number a line holds, as zooming, switching views or the panel resizing does, keep the entry at the panel's top where it was, and how far down its line the top was (`Anchor`): `measure` notes it against the measure before, and scrolls back to it on the measure after, once the listbox has been rendered as tall as the new lines make it, so the panel can scroll that far. Both happen in layout effects, before anything is painted.
- Each rendered entry is absolutely positioned, with `top` from its line, less the lines' `offset` (0 but in a squeezed list), and, in the grid, `gridColumn: "<n> / span 1"`. An absolutely positioned child of a grid takes the grid area it's placed in as its containing block, so the tile fills its column. The span matters: with only a start line, the box runs to the listbox's far edge.
- The listbox's `height` covers every line, so the panel scrolls as far as it would with every entry rendered, or is the squeeze's `MAX_LIST_HEIGHT`.
- The hook renders the lines the panel shows, as its `place` gives them.
- Rows (`FileRow`) and tiles (`FileTile`) are memoized, so scrolling only renders the ones coming into view.
- Only rendered entries ask for their thumbnails, and one scrolled away before its thumbnail came drops the request (see `thumbnails.md`).
- The zebra stripe follows the entry's index (`data-striped`), not `:nth-of-type`, since the rendered rows aren't consecutive.

### What stays rendered

`keep` lists entries that are rendered wherever they are:

- The focused entry (`focusId`), so it keeps the focus and the view's Tab stop however far the panel scrolls.
- The entry a drag started from, while it's dragged. `dragend` is dispatched to its element, and from a removed element it would never reach the root. A drag resting on a folder opens it and takes the whole view away, which `useEntryDrag` handles (see "Drag and drop" in `file-manager.md`); a touch drag has no `dragend`.

### Finding entries by layout, not in the page

Anything that used to look entries up in the page now works from where the layout puts them:

- The marquee asks for the entries a box covers through `useMarquee`'s `entriesIn`, which the folder view answers with the hook's `indexesIn(box)`. That works from the lines and the column tracks (mirrored in RTL), so it finds entries whether they're rendered or not. Through a squeezed list it's handed the hook's `drift` too, so where it started stays on the entry it started on as the drift grows.
- The arrow keys take the grid's columns from `lines.columns`.
- Moving the focus (`focusEntry`) or revealing an entry sets `pendingScroll`. The entry is rendered once it has the focus. Once `settled()` says the rendered entries are where the latest measure puts them, an effect focuses it and scrolls to it, through the hook's `reveal(index, element)` (see "Scrolling to an item"). The focus effect waits for `settled()` too. A listbox that has just mounted, or a switch between list and grid, renders once more with the new measure, and only then is anything scrolled to.
- Each option carries `aria-setsize` and `aria-posinset`, so screen readers know where it is among all the entries.
- `FolderView` finds entries by id in `indexById`, a map, rather than by searching the listing.

A search everywhere's results (`content/search-results.tsx`) use the same hook and views, keyed by result, with the focused result and the one a drag started from kept rendered.

The playground's `archive` folder, in the API service section, holds 10,000 files for trying this out.

## The sidebar tree

The tree is flattened into the rows it shows (`hooks/use-tree-rows.ts`, `FlatTree` in `types/tree.ts`): the dividers and captions of the section groups, the sections, the folders below expanded rows, a folder's "Couldn't load" row, and a single section's loading and empty rows, top to bottom. Each row knows its `top` and `height`, and `hooks/use-virtual-rows.ts` renders those within what the panel shows, found by binary search, as the rows differ in height.

- Heights are constants in `styles/layout.ts` (`TREE_SECTION_HEIGHT`, `TREE_FOLDER_HEIGHT`, `TREE_CAPTION_HEIGHT`, `TREE_DIVIDER_HEIGHT`), not measured, since nothing in the sidebar changes with container queries. The 2px between a group's sections and around an expanded row's folders are kept in the offsets.
- Every row is absolutely positioned in the `tree`, which is as tall as all of them, or squeezed: `useVirtualRows` hands the tree each row it shows placed `offset` higher then, made once per row while the offset stays, so memoized rows stay the same objects, and the tree places the guide lines as high. The section groups' `ul`s (`role="group"`) and a single section's `ul` hold their rows without taking room, so a group is still a `group` of the tree, but the folders below a row are no longer nested in it. Each `treeitem` says where it is with `aria-level`, `aria-setsize` and `aria-posinset`.
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

A row's place is known from the rows alone, so the tree scrolls to one that isn't rendered: a folder just created (`reveal` of `Sidebar`; see "Creating and renaming" in `file-manager.md`) is found among the rows by its key once the refreshed listing has it, and `useVirtualRows`' `reveal(row)` moves the tree's scroll panel by the least that shows its `top` and `height` (see "Scrolling to an item"). The row is rendered by the scroll that follows. It doesn't take the focus, unlike `focusRow`, which also scrolls, through `reveal(row, element)`.

The playground's `datasets` folder, in the API service section, holds 5,000 folders for trying this out.

## The transfer picker

The "Move to…" and "Copy to…" folder list (`dialogs/transfer-dialog.tsx`) uses `useVirtualLines` as the content's list view does: the `List` is a grid of one track, as tall as all its rows, inside a box that scrolls, and each rendered `ListItem` is placed at `index * pitch`.

- Its items are the sections, on the list of sections, or the folders, the entries being moved among them (disabled), as `PickerItem`s. Names are kept to one line (`noWrap`), since every row must be as tall. Each `ListItem` is placed less the lines' `offset`, and a row is scrolled to through `reveal`, by its `data-index`.
- The row with the Tab stop stays rendered (`keep`). The keyboard side is in `keyboard.md`.
- The scrolling box is keyed by the folder, so each opens scrolled to the top and measured afresh.
- A folder made with the New folder button is opened. Going back up from it, it takes the Tab stop as the folder left through, which renders it wherever it sorts, and `settleFocus` scrolls to it once the rows are in their places.

## Scrolling to an item

What the hooks render is where the measure puts it, so scrolling to an item goes through them: `show(top, bottom, element?)` of `useScrollMeasure`, which `useVirtualLines` gives as `reveal(index, element?)` and `useVirtualRows` as `reveal(row, element?)`. It scrolls the panel by the least that shows the item, from its place in px of the whole list.

- With the item's element rendered and the list laid out whole, it's the element's own `scrollIntoView({ block: "nearest" })`, as it always was, which keeps clear of the list's sticky header by the rows' `scroll-margin-top` and scrolls the page around too.
- Through a squeezed list, where an element moves as the panel scrolls, the panel's `scrollTop` is worked out from the squeeze, the element's scroll margins kept, and set, and the list is moved by the drift there at once (`apply`), so the element is where the scroll puts it before the browser's `scrollIntoView` then scrolls the page around to it, which leaves the panel as it is.
- Without an element, as for a folder just made in the tree, it's worked out from the place alone.

## Lists too tall for the browser

Browsers cap an element's height (Firefox at about 17.9 million px, Chrome and Safari at about 33.5 million) and place things less precisely long before, so a list taller than `MAX_LIST_HEIGHT` (6 million px, about 115,000 list rows at the size they start at) is laid out that tall and squeezed into it, as AG Grid and react-virtualized do it. `useScrollMeasure` does it for the content, the tree and the picker alike, so a folder of hundreds of thousands of entries lists, scrolls and selects to its end.

- **Scrolling** goes through the squeezed list proportionally: `ratio` px of the list go by for each px the panel scrolls (`Squeeze`), the same at either end, so the scrollbar still spans all of it and dragging it reaches any entry. A wheel notch or a key's scroll then moves `ratio` times as far. The ratio is worked out from the panel's height and what follows the list in it when scrolled to its end (the list's padding, the selection bar), so the last entry sits at the panel's bottom there. A list that fits is laid out whole, with a ratio of 1, and nothing changes for it.
- **Keeping its place.** The ratio changes as the list's height does (pages coming in, entries added or gone, folders expanded in the tree) and as the panel's does, so `place` keeps the panel where it was in px of the whole list, as over a list laid out whole, scrolling it to where the new ratio puts that, rather than letting the same `scrollTop` jump elsewhere. Not on a measure that scrolled to a place of its own (`scrollTo`, the lines' anchor), which knows better.
- **Placing.** The items in or near the panel are moved up the list by the squeeze's `drift`, which grows as the panel scrolls, so they're where they'd be with the list laid out whole and scrolled that far. Rendering each anew as the drift grows would render every row on every scroll, so the drift is in two parts: the items' `top` is their place in the whole list less `offset`, the drift in whole steps of 1 million px (`OFFSET_STEP`), which renders them again only once a step, and the rest moves the whole list through its `translate`, set on the element directly by `apply` as it scrolls, without rendering anything. So no `top` goes above 7 million px, and nothing is laid out beyond what browsers place exactly.
- **Clipped.** Rows kept rendered far from view (see "What stays rendered") are placed in px of the whole list too, which in a squeezed list can be millions of px below its laid-out end, and the overscan's last rows can go a little past it; what's below a box counts toward what its panel scrolls, which would stretch the scroll and the squeeze with it. So the views' roots (`listSx`, `gridSx`), and boxes around the tree (`treeClipSx`) and the picker's list (`listClipSx`), are `overflow-y: clip`, which cuts that off without being a scroll container, so the list's column header still sticks, and the translate is worked out from the offset the items were rendered with (`rendered`), so they're where they should be even before a render with a new offset.
- **Measuring** reads the list's place with its `translate` taken back out (`scrolledPast`, `moved`), and gives the measures every place in px of the whole list (`ScrollView`): what the panel shows (`place`), where its top is (`top`), and a place to scroll to (`scrollTo`), which the lines' anchor goes by as they change size.
- **Finding entries by layout** (`indexesIn`) adds the offset to the box, as the listbox's rect already has the `translate`; the marquee keeps where it started by the `drift`, so the entries under it stay right as it scrolls the panel, and draws its box within the surface while the start has drifted off it.
- The playground's `?huge` (`options.ts`) adds `huge` to API service, 200,000 files, about 10.4 million px of list rows, to try it, with the server listing 50,000 entries a page meanwhile.

## Find in page

The browser's find in page (Ctrl+F from outside the file manager, or the browser's menu; inside it Ctrl+F is the folder search, see "Search" in `file-manager.md`) only looks in what's in the page, which a virtualized list mostly isn't. So each of them puts every row's name in a find layer (`components/file-manager/find-layer.tsx`, `FindLayer`), `hidden="until-found"`, which browsers' find looks in, telling the page what it came to before showing it (`beforematch`), as all current browsers do (Baseline 2025). Where a browser doesn't, the layer isn't rendered and the rows' names are written in them as before (`FINDS_HIDDEN`).

- **The layer** holds a `div` per name in blocks of 256 (`BLOCK`), each name and each block hidden until found, so the browser lays out a block rather than a name, and its `beforematch` comes to the name's own `div`, whose `data-index` says which row it is. It's built outside React, which writes `hidden` as true or false only, in goes of 8 ms (`SLICE`), so a folder of thousands doesn't hold the page up, and only the blocks whose names changed are built again (`held`). Names come by the row's index: the folder view's and the search results' entries (`names`), the picker's items, the tree's rows, sections and folders by their labels and the others empty.
- **Where it is.** First in the view's scrolling surface, `position: sticky` at the panel's top, a pixel tall with a pixel's negative margin, so it takes no room, its names a pixel high, clipped and see-through. What the browser finds there is in view already, so it doesn't scroll the panel or the page to it, and nothing of it shows. It's `aria-hidden`; screen readers hear the rows. A page's reset hiding every `[hidden]` with `display: none !important` would take the names from the browser's find, so the layer sets its own back to `block`, which leaves them hidden until found.
- **What a find does.** The layer hides the name found, and its block, again once the browser has shown it (a timeout after `beforematch`), so the next match is found the same way, and hands the view its index (`onFound`): the folder view and the search results give the entry the view's Tab stop and scroll to it (`setFocus`, `pendingScroll`), the tree gives the row its Tab stop (`focusKey`) and scrolls to it (`revealRow`), and the picker the row it can open (one being moved is only scrolled to). The focus stays in the browser's find bar, so Enter there goes on to the next match; closing the find bar leaves the focus where the browser puts it, and Tab or an arrow in the view starts from the entry found.
- **The highlight.** The browser's own highlight is on the name in the layer, where it doesn't show, so the row is highlighted for a moment instead (`useFound`, `data-found`, for `ARRIVED_FOR`), with the tint an upload's arrival has (`arrivedMarker`, and `forcedArrived` under forced colors), in the list, the grid, the tree and the picker. Found again while highlighted, it starts over.
- **Once each, in order.** The rows draw their names with `DrawnName`, from `::before { content: attr(data-name) }`, which no browser's find looks in, so a name on screen isn't found twice, and the matches go in the rows' order, the layer's. Screen readers read drawn text as written. It runs and lines up as its own letters do (`unicode-bidi: plaintext`), as the `<bdi>` it replaces did (see `rtl.md`). Text in the rows but the name, the list's sizes, dates, types and locations, is only found on the rows rendered.

## By choice

- A screen reader's browse mode reads the rows rendered and no others. The web has no way to give screen readers items as they're reached, so every entry would have to be an element in the page, and screen readers build their browse buffer from all of it, which slows them on a large folder more than it helps. The content and the picker's list are a `listbox` and the tree a `tree`, widgets screen readers go into focus mode on, where the arrow keys read every entry and row with where it is among all of them (`aria-setsize`, `aria-posinset`, `aria-level`), as the ARIA practices have virtualized lists do it.
