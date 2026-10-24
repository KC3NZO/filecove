---
paths:
  - "src/components/file-manager/content/item-icon.tsx"
  - "src/components/file-manager/content/file-list.tsx"
  - "src/components/file-manager/content/file-grid.tsx"
  - "src/hooks/use-thumbnail.ts"
  - "src/store/thumbnail-cache.ts"
  - "src/contexts/data-context.ts"
  - "src/types/adapter.ts"
  - "src/types/view.ts"
  - "playground/mocks/mock-adapter.ts"
  - "playground/mocks/mock-content.ts"
---

# Thumbnails

The list and the grid show a file's thumbnail in place of its type icon when the adapter has the optional `thumbnail(entry, { signal, view, size })`. It resolves with a `FileContent` (`{ url }` or `{ blob }`, as `content` does) or null for a file with none. A rejection, or a picture the browser can't draw, leaves the icon, and nothing is said to the user. Folders never have one, and without `thumbnail` every entry keeps its icon.

## What the adapter is told

- **`view`** is the view the thumbnail is for: `"list"` (a 1.75rem square beside the name) or `"grid"` (3.5rem). The two are asked for and kept separately, so a backend keeping a few sizes picks one by it.
- **`size`** is the side of that square in device pixels (`devicePixels` in `utils/dom.ts`: rem times the root's font size times `devicePixelRatio`, rounded up), for a backend making thumbnails to order. It's read when a thumbnail is first asked for, so zooming afterwards doesn't ask again.
- **`signal`** aborts when the entry stops being rendered before its thumbnail came.

`thumbnail` is called for every file rendered, so an adapter should answer null at once for files it knows have none, by type say, rather than make a round trip: those calls share the queue with the ones that matter.

## The cache

`store/thumbnail-cache.ts` holds one cache per `FileManager` (`thumbnails` in `DataContext`, cleared on unmount), keyed by adapter, view and entry id, so sections sharing an adapter share thumbnails.

- `want` asks for a thumbnail unless it's kept or on its way. `MAX_ACTIVE` (6) calls run at once, and the rest wait in the order they were wanted. Each comes through an `Image` before it's shown (`loadImage`), so a broken one stays an icon and a loaded one shows at once.
- Only rendered entries want theirs (see `virtualization.md`), so a folder of 10,000 files asks only for those in or near view. An entry that stops being rendered before its thumbnail came drops the request. That's checked in a microtask once the commit is over, so an entry rendered again straight away, as it is when the listing is refreshed or under StrictMode, keeps it going.
- What came is kept while nothing shows it, up to `MAX_KEPT` (1,000), dropping those wanted longest ago, and a blob's object URL is revoked as its thumbnail goes. A null is kept too, so a file with none isn't asked again.
- A file whose size or date modified has changed (`versionOf`) is asked for again. A renamed file whose id is its path has a new id, and so a new thumbnail.

## How it's shown

`content/item-icon.tsx` calls `useThumbnail(entry, adapter, view, rem)`, which subscribes to its one key. The type icon shows until the thumbnail has loaded. The picture is fitted into the icon's square, shrunk but never stretched, with slightly rounded corners, and the touch selection badge stays at the square's corner. Rows and tiles stay as tall as before, so the equal heights the virtualization needs still hold.

- The `img` has `pointer-events: none` and `draggable={false}`, so a press, right-click or drag reaches the row or tile rather than the picture: no "Save image as", and no picture dragged in place of the entry.
- `alt=""`, since the name is beside it.
- The views pass the folder's adapter down (`FileViewProps.adapter`). The drag preview passes no `view`, so it keeps the icon; a picture not yet decoded wouldn't make it into the drag image.
- The properties panel shows the grid's thumbnail (`useThumbnail` with the grid's view and size), grown to fill a slightly larger box, so it asks the adapter for nothing more and may look slightly soft (see `properties.md`).

## The playground

The mock adapter's `thumbnail` makes thumbnails from the same made-up pictures as its contents (`thumbnailSource` in `mock-content.ts`): the landscapes without the name, the logos, and a page drawn for PDFs. Uploaded pictures use their own bytes. Each is shrunk to `size` as a PNG on a canvas (`shrink`), as a backend making them to order would. Files with none answer null at once, and the rest take the simulated latency. `archive` mixes PNGs, SVGs and PDFs among its 10,000 files, for scrolling through many, and `docs/contract.pdf` fails and keeps its icon.

## Not yet

A thumbnail in the preview as a placeholder while the file loads, a bigger icon size for a grid of pictures (grid zoom levels, an optional idea in the roadmap), cropping to a square, and a frame around pictures, which would need telling transparent ones, such as logos, apart.
