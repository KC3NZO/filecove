---
paths:
  - "src/components/file-manager/dialogs/preview-dialog.tsx"
  - "src/components/file-manager/dialogs/image-viewer.tsx"
  - "src/utils/preview.ts"
  - "src/types/preview.ts"
  - "src/types/adapter.ts"
  - "src/types/action.ts"
  - "playground/mocks/mock-content.ts"
---

# Opening files and the preview

## Opening a file

A file is opened by double-clicking it, Enter or Alt+Down on it, a touch tap outside selection mode, or `ActionContext.open()`. A folder opens in the file manager, as it always has. A file goes to `FileManager`'s optional `onOpenFile(entry, context)`, so a consumer can open it in an editor of their own, and without it to the preview. `onOpenFile` can return `false` to decline a file, e.g. one of a type the consumer has no editor for, and the file goes to the preview instead. When nothing can open a file, a double-click does nothing, Enter and Alt+Down aren't taken (so an action can bind them), and a tap selects it.

There's no editor in the component, by choice: editing needs a way to save through the adapter, designed on paper first, and an editor is heavy and differs from app to app, so it's the consumer's, through `onOpenFile`.

- `contextFor` in `file-manager.tsx` builds `open` (exactly one entry) and `preview`. For a file, `open` is there only when `onOpenFile` is, since without it opening a file is only previewing it, so a menu doesn't offer Open and Preview doing the same thing. `open` previews a file `onOpenFile` declines.
- `FolderView` opens a file through its `onOpenFile` prop (`openFile`), which tries `onOpenFile`, then the preview, and says whether anything opened the file.
- With `onOpenFile`, Open shows for every file, including those it would decline, since whether it declines one is only known by calling it.
- The playground passes no `onOpenFile`, so its "Open" action (`context.open`) shows for folders only, and "Preview" calls `context.preview`, with Space as its shortcut, as in GNOME Files. Ctrl+Space then toggles the focused entry in the selection. A space typed mid-name in type-ahead never runs a shortcut.

## The adapter's `content`

`content(entry, { signal })` resolves with a `FileContent`: `{ url }` or `{ blob }`. It's called only for files the preview can show, so describing a zip downloads nothing, and the signal aborts as the preview steps on or closes. Downloading, when it comes, is meant to use it too. The list's and the grid's thumbnails come from the adapter's separate `thumbnail`, never from `content` (see `thumbnails.md`).

- A URL is used as it is, as the `src` of an `<img>`, `<video>`, `<audio>` or `<iframe>`, so it streams and caches as any URL does. Text is fetched from it, which needs CORS on another origin, and only the first `TEXT_LIMIT` bytes are read before the download is cancelled.
- A blob is shown through an object URL, revoked once the preview moves on or closes, or read in part for text. What was loaded goes with it, so coming back to a file loads it afresh.

## What the preview shows

`dialogs/preview-dialog.tsx`, a large modal like the other dialogs (portalled, `dialogPaperSx`), sized `min(72rem, 100% - 2rem)` by `min(54rem, 100% - 2rem)`. The header has the file's type icon, its name, a line with its type, size and, once loaded, an image's or video's dimensions, the stepper and a close button. The file sits on `background.paper` inside, as the folder view does in the window.

`previewKind` (`utils/preview.ts`) decides how from the entry's MIME type, or else its name: the extension, a dotfile (text), or a name such as `Dockerfile` or `go.mod`.

- **image**: only the formats browsers draw (no TIFF, HEIC or PSD), shrunk to fit, never stretched, and zoomable (see "Zooming images").
- **video** and **audio**: the browser's own players, `preload="metadata"`, not autoplaying.
- **pdf**: an `<iframe>`, so the browser's PDF viewer. Mobile browsers may not have one.
- **text**: the first 256 kB (`TEXT_LIMIT`), decoded as UTF-8, with a note when there's more. A NUL byte in the first 8,000 means it isn't text after all, and it's described instead. Long lines wrap, so Left and Right stay free for stepping. The `pre` is tabbable, to scroll from the keyboard.
- **none**: the type icon, "No preview available" and the date modified.

Files are never run. A web page shows as its source, and a blob going into the PDF frame is retyped `application/pdf` first, since a blob URL shares the page's origin and a page in it would run there. A URL's type is the consumer's server's to get right.

## Zooming images

`dialogs/image-viewer.tsx` shows an image, fitted to the view, and zooms and pans it. Its state is a `Zoom` (scale, and the image's top left corner in the view) or null while it fits.

- Ctrl+wheel and a touchpad pinch, which browsers send as Ctrl+wheel, zoom at the pointer, a mouse's notch by a step at most and a pinch smoothly. The listener isn't passive, so the page doesn't zoom instead. A pinch on a touch screen zooms between the fingers, and moving them pans; the viewer's `touch-action` is `none`, so the browser's own gestures don't get in the way.
- A double click, or a double tap (caught from pointer events, as not every browser sends `dblclick` for one), toggles between fitting and the image's own size, or twice the fit when that's larger, at the point clicked.
- The buttons in the corner (Zoom out and Zoom in either side of the percentage, then Best fit) and the keys +, -, 0 (fit) and 1 (the image's own size) zoom around the view's centre. A step is √2, so two double or halve it, and stops at 100% on the way past. Ctrl with them is left to the browser's own zoom.
- It never zooms out past the fit, and in up to 16×, or further for a small image, to fill the view. From 4× the pixels show as squares (`image-rendering: pixelated`).
- Zoomed in, it pans by dragging, with the wheel (Shift+wheel sideways), and with the arrow keys, which then pan rather than step to another file; 0 or Best fit gets them back. It's centred along an axis it fits and otherwise always covers the view. A step to another file starts it fitted again (the viewer is keyed by the entry).
- Fitted, it's laid out by CSS alone, so it follows the dialog's size without a measure; zoomed, it's placed from its own size (`naturalWidth`) and the view's, kept by a `ResizeObserver`, through `style`. Its width and height scale rather than a `transform: scale`, so an SVG redraws sharp at any size.
- The dialog hands key presses to the viewer first, through its `ref` (`ImageViewerHandle.keyDown`), since the focus is on the dialog rather than the image.

Loading shows a spinner. An adapter's rejection, or the browser failing to load or show the file, shows "Couldn't preview this file" with the message and Try again, which calls `content` afresh, in case a signed URL had run out.

## Stepping through files

A single file steps through the files of the view it's listed in, in the content's order, starting at it: the content passes its sorted entries as `MenuRequest.listing`, and only the content has one. Several entries step through the files among them. Folders are skipped.

- Stepping through the folder, the content's selection follows the file shown (`follow`, `handlePreviewStep`, through `reveal`), as in GNOME's and macOS's previewers. Stepping through a selection leaves it as it was.
- The arrow buttons, or Left and Right (swapped in RTL) except in a player, which seeks with them, and on a zoomed image, which pans with them. There's no wrapping round.
- A visually hidden `status` says "name, 2 of 12" on each step.

## Keys and focus

- +, -, 0 and 1 zoom an image, and the arrows pan it while it's zoomed in (see "Zooming images").
- Escape closes, and so does Space, as in GNOME's and macOS's previewers, except on a button, link or player, and not when it's a key held down from opening the preview (`event.repeat`).
- Opened from the content (`focusInContent`, shared with `arrive`, which counts the context menu opened from the content), the dialog doesn't hand the focus back itself (`disableRestoreFocus`). Once it has faded out (`onExited`), `focusContent` gives it to the content's focused entry, which is the file shown last when the selection followed. Opened from anywhere else, MUI hands it back.

## The playground

`playground/mocks/mock-content.ts` makes contents up from each file's name: pictures as SVG landscapes, `.svg` files as logos, one-page PDFs, a WAV chime for audio, and text in the file's own kind (Markdown, JSON, CSV, logs, code), as long as the file says it is up to 1 MB, so the 256 kB cut shows on the large files in `archive`. A few files have real contents (`package.json`, `Dockerfile`...). Videos come from MDN's public samples as a URL, so they need the network. Uploaded files keep their bytes and preview as themselves. `docs/contract.pdf` in Website fails, to show the error state.

## Not yet

Downloading, the consumer's actions in the preview's header, loading the next file ahead, swiping on touch, Safari's touchpad pinch (it sends `gesturechange`, not Ctrl+wheel), momentum when panning by touch, animating zoom steps, rotating images, full screen, highlighted code or rendered Markdown, and fonts, office documents or archives' contents.
