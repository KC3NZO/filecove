---
paths:
  - "src/hooks/use-virtual-lines.ts"
  - "src/hooks/use-marquee.ts"
  - "src/components/file-manager/content/**"
  - "src/utils/dom.ts"
  - "src/types/view.ts"
---

# Virtualization

The content renders only the entries in or near the scroll panel, so a folder of thousands of entries lists, scrolls and selects as fast as a small one. `hooks/use-virtual-lines.ts` does it for the list and the grid alike. `content/folder-view.tsx` calls it and hands the view its `VirtualLines` (`types/view.ts`) as `lines`. The sidebar tree and the transfer picker's folder list still render every folder.

## Lines

Entries go in lines of equal height: one row per line in the list, as many tiles as fit in the grid. The listbox is a CSS grid, so CSS still lays out what the container queries decide, and the hook reads it:

- The column tracks give the entries per line (`repeat(auto-fill, …)` in the grid, a single `minmax(0, 1fr)` track in the list), and the row gap gives the space between lines.
- The first entry rendered gives every line's height, so all rows, and all tiles, must be the same height. A list row's height never depends on its entry, and a tile's name always takes two lines (`minHeight: "2.7em"`).
- Each rendered entry is absolutely positioned, with `top` from its line and, in the grid, `gridColumn: "<n> / span 1"`. An absolutely positioned child of a grid takes the grid area it's placed in as its containing block, so the tile fills its column. The span matters: with only a start line, the box runs to the listbox's far edge.
- The listbox's `height` covers every line, so the panel scrolls as far as it would with every entry rendered.
- The hook renders the lines within `OVERSCAN` (400px) of the panel's edges. It measures again after every render, on the panel's `scroll`, and on resizing (a `ResizeObserver` on the listbox and the panel). A scroll or resize that changes the measure is rendered under `flushSync`, so entries scrolling in appear in the same frame. Without a scrolling ancestor, every line is rendered.
- Rows (`FileRow`) and tiles (`FileTile`) are memoized, so scrolling only renders the ones coming into view.
- The zebra stripe follows the entry's index (`data-striped`), not `:nth-of-type`, since the rendered rows aren't consecutive.

## What stays rendered

`keep` lists entries that are rendered wherever they are:

- The focused entry (`focusId`), so it keeps the focus and the view's Tab stop however far the panel scrolls.
- The entry a drag started from, while it's dragged. `dragend` is dispatched to its element, and from a removed element it would never reach the root.

## Finding entries by layout, not in the page

Anything that used to look entries up in the page now works from where the layout puts them:

- The marquee asks for the entries a box covers through `useMarquee`'s `entriesIn`, which the folder view answers with the hook's `indexesIn(box)`. That works from the lines and the column tracks (mirrored in RTL), so it finds entries whether they're rendered or not.
- The arrow keys take the grid's columns from `lines.columns`.
- Moving the focus (`focusEntry`) or revealing an entry sets `pendingScroll`. The entry is rendered once it has the focus. Once `settled()` says the rendered entries are where the latest measure puts them, an effect focuses it and scrolls to it. The focus effect waits for `settled()` too. A listbox that has just mounted, or a switch between list and grid, renders once more with the new measure, and only then is anything scrolled to.
- Each option carries `aria-setsize` and `aria-posinset`, so screen readers know where it is among all the entries.
- `FolderView` finds entries by id in `indexById`, a map, rather than by searching the listing.

The playground's `archive` folder, in the API service section, holds 10,000 files for trying this out.

## Limits

- Find in page (Ctrl+F) and a screen reader's browse mode only see the rendered entries.
- Browsers cap an element's height (about 17.9 million px in Firefox), so a folder of a few hundred thousand entries is cut short.
