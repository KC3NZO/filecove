---
paths:
  - "src/components/file-manager/dialogs/preview-dialog.tsx"
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

- **`view`** is the view the thumbnail is for: `"list"` (a square beside the name, 1.75rem at the list's start) or `"grid"` (3.5rem at its start). The two are asked for and kept separately, so a backend keeping a few sizes picks one by it.
- **`size`** is the side of that square in device pixels (`devicePixels` in `utils/dom.ts`: rem times the root's font size times `devicePixelRatio`, rounded up), for a backend making thumbnails to order. It follows the view's zoom (see "Zoom" in `file-manager.md`), from 1.3125rem in the list up to 10.5rem in the grid, so a backend keeping a few sizes picks the nearest larger one by it. The browser's own zoom isn't followed: it's read as a thumbnail is asked for.
- **`signal`** aborts when the entry stops being rendered before its thumbnail came.

`thumbnail` is called for every file rendered, so an adapter should answer null at once for files it knows have none, by type say, rather than make a round trip: those calls share the queue with the ones that matter.

## The cache

`store/thumbnail-cache.ts` holds one cache per `FileManager` (`thumbnails` in `DataContext`, cleared on unmount), keyed by adapter, view and entry id, so sections sharing an adapter share thumbnails.

- `want` asks for a thumbnail unless it's kept or on its way, at the size wanted or larger. `MAX_ACTIVE` (6) calls run at once, and the rest wait in the order they were wanted. Each comes through an `Image` before it's shown (`loadImage`), so a broken one stays an icon and a loaded one shows at once.
- Only rendered entries want theirs (see `virtualization.md`), so a folder of 10,000 files asks only for those in or near view. An entry that stops being rendered before its thumbnail came drops the request. That's checked in a microtask once the commit is over, so an entry rendered again straight away, as it is when the listing is refreshed or under StrictMode, keeps it going.
- What came is kept while nothing shows it, up to `MAX_KEPT` (1,000), dropping those wanted longest ago, and a blob's object URL is revoked as its thumbnail goes. A null is kept too, so a file with none isn't asked again.
- A larger size wanted than the one kept, as a view zooms in, or the properties ask of a grid only ever zoomed out, asks for it again at that size, keeping the smaller picture showing until the larger has loaded, and keeping it if the larger fails. A smaller size wanted is served by the larger one kept, so zooming out asks for nothing. A file with none isn't asked again at any size. A request under way when a larger size is wanted is aborted and queued again at the larger size; the slot's `size` is the largest wanted, and a request that comes back after another has taken its place (`slot.controller` changed) is dropped, its object URL revoked. One a view stopped showing before it came is dropped, smaller picture and all.
- A file whose size or date modified has changed (`versionOf`) is asked for again. A renamed file whose id is its path has a new id, and so a new thumbnail.

## How it's shown

`content/item-icon.tsx` calls `useThumbnail(entry, adapter, view, rem)`, which subscribes to its one key. The type icon shows until the thumbnail has loaded. The picture is fitted into the icon's square, shrunk but never stretched, with slightly rounded corners, and the touch selection badge stays at the square's corner. Rows and tiles stay as tall as before, so the equal heights the virtualization needs still hold.

- The `img` has `pointer-events: none` and `draggable={false}`, so a press, right-click or drag reaches the row or tile rather than the picture: no "Save image as", and no picture dragged in place of the entry.
- `alt=""`, since the name is beside it.
- The views pass the folder's adapter down (`FileViewProps.adapter`). The drag preview passes no `view`, so it keeps the icon; a picture not yet decoded wouldn't make it into the drag image.
- The properties panel shows a large picture across its width: the grid's view at the smallest of `PICTURE_SIZES` (18rem, 28rem, 40rem) as wide as its body, 18rem docked at first or as the overlay, larger than any grid zoom (10.5rem at most), so it asks the adapter again at that size, the smaller thumbnail showing until it has loaded and staying if it fails, and again a step larger as the docked panel is made wider. The cache then serves the grid, and a narrower panel, from the larger one (see `properties.md`).
- The preview shows the grid's thumbnail the same way: in the file's place while it loads, under the spinner, sized as the image will be when the listing says its size (`FileEntry.media`); as a video's poster; and, larger, for a file it has no preview of, such as a TIFF, in place of the type icon (see "While a file loads" in `preview.md`). Text, fonts and audio don't ask for one.

## The playground

The mock adapter's `thumbnail` makes thumbnails from the same made-up pictures as its contents (`thumbnailSource` in `mock-content.ts`): the landscapes without the name, for pictures the browser can't draw too (TIFF, HEIC, PSD, as Design assets' `print-proof.tiff`), the logos, and a page drawn for PDFs. Uploaded pictures use their own bytes. Each is shrunk to `size` as a PNG on a canvas (`shrink`), as a backend making them to order would. Files with none answer null at once, and the rest take the simulated latency. `archive` mixes PNGs, SVGs and PDFs among its 10,000 files, for scrolling through many, and `docs/contract.pdf` fails and keeps its icon.
