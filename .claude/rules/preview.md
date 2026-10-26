---
paths:
  - "src/components/file-manager/dialogs/preview-dialog.tsx"
  - "src/components/file-manager/dialogs/image-viewer.tsx"
  - "src/components/buttons/toolbar-actions.tsx"
  - "src/hooks/use-preview-contents.ts"
  - "src/hooks/use-swipe.ts"
  - "src/hooks/use-announcer.ts"
  - "src/utils/preview.ts"
  - "src/utils/action-groups.ts"
  - "src/types/preview.ts"
  - "src/types/previewer.ts"
  - "src/types/adapter.ts"
  - "src/types/action.ts"
  - "src/types/menu.ts"
  - "playground/mocks/mock-content.ts"
  - "playground/mocks/mock-previewers.tsx"
---

# Opening files and the preview

## Opening a file

A file is opened by double-clicking it, Enter or Alt+Down on it, a touch tap outside selection mode, or `ActionContext.open()`. A folder opens in the file manager, as it always has. A file goes to `FileManager`'s optional `onOpenFile(entry, context)`, so a consumer can open it in an editor of their own, and without it to the preview. `onOpenFile` can return `false` to decline a file, e.g. one of a type the consumer has no editor for, and the file goes to the preview instead. When nothing can open a file, a double-click does nothing, Enter and Alt+Down aren't taken (so an action can bind them), and a tap selects it.

There's no editor in the component, by choice: editing needs a way to save through the adapter, designed on paper first, and an editor is heavy and differs from app to app, so it's the consumer's, through `onOpenFile`.

- `contextFor` in `file-manager.tsx` builds `open` (exactly one entry) and `preview`. For a file, `open` is there only when `onOpenFile` is, since without it opening a file is only previewing it, so a menu doesn't offer Open and Preview doing the same thing. `open` previews a file `onOpenFile` declines.
- `preview` is there when the entries hold a file the preview can show anything of (`previewable` in `utils/preview.ts`): any file when the adapter has `content`, and otherwise one a previewer reading nothing takes (see "Previewers of the app's own"). A single file steps through those of its siblings.
- `FolderView` opens a file through its `onOpenFile` prop (`openFile`), which tries `onOpenFile`, then the preview, and says whether anything opened the file.
- With `onOpenFile`, Open shows for every file, including those it would decline, since whether it declines one is only known by calling it.
- The playground passes no `onOpenFile`, so its "Open" action (`context.open`) shows for folders only, and "Preview" calls `context.preview`, with Space as its shortcut, as in GNOME Files. Ctrl+Space then toggles the focused entry in the selection. A space typed mid-name in type-ahead never runs a shortcut.

## The adapter's `content`

`content(entry, { signal, purpose })` resolves with a `FileContent`: `{ url }` or `{ blob }`. The preview asks with `purpose: "preview"`, only for files it shows something of, so describing a zip downloads nothing, and the signal aborts as the preview steps on or closes. Downloading a single file asks with `purpose: "download"` (see `download.md`). The list's and the grid's thumbnails come from the adapter's separate `thumbnail`, never from `content` (see `thumbnails.md`).

- A URL is used as it is, as the `src` of an `<img>`, `<video>`, `<audio>` or `<iframe>`, so it streams and caches as any URL does. Text and fonts are fetched from it, which needs CORS on another origin, and for text only as much as is shown is read before the download is cancelled.
- A blob is shown through an object URL, read in part for text, or handed to `FontFace` as bytes. The URL is revoked, and the font taken off the page, once the file is more than a step away from the one shown, or the preview has gone.

## How a file is shown

`planPreview(entry, adapter, previewers)` (`utils/preview.ts`) gives a `PreviewPlan` (`types/preview.ts`, internal): the `kind` and what to load for it (`reads`: nothing, the adapter's `content` for its URL, the start of the file as text, or a font). The app's previewers are asked first, in order; the first that takes the file shows it ("custom"). Otherwise the kind comes from the entry's MIME type, or else its name: the extension, a dotfile (text), or a name such as `Dockerfile` or `go.mod`. Without `content`, only a previewer reading nothing shows anything.

- **image**: the formats browsers draw, shrunk to fit, never stretched, and zoomable and turnable (see "Images"). TIFF, HEIC, PSD and the like show the file's thumbnail, when the adapter has one, or go to a previewer of the app's own.
- **video** and **audio**: the browser's own players, `preload="metadata"`, not autoplaying, a video with the thumbnail as its poster until it plays.
- **pdf**: an `<iframe>`, so the browser's PDF viewer. A browser that says it has none (`navigator.pdfViewerEnabled` false, as some phones' browsers say) gets the thumbnail, "This browser can't show PDF files here." (`previewPdfUnavailable`) and "Open in a new tab" (`previewOpenInTab`), which leaves the file to the browser, which hands it to the system's viewer or saves it.
- **text**: the first 256 kB (`TEXT_LIMIT`), with "Showing the first 256 kB" and **Show more** under it when there's more, which reads as much again each time (`more` in `usePreviewContents`, from the start, a blob sliced and a URL fetched afresh), keeping what's shown and its scroll meanwhile, with a small spinner. Decoded as UTF-16 when it starts with its byte order mark, else UTF-8, or Windows-1252, as editors fall back to, when it isn't valid UTF-8 (`decodeText`); a NUL byte in the first 8,000 (UTF-16 aside) means it isn't text after all, and it's described instead. Long lines wrap, so Left and Right stay free for stepping, and each line runs the way its own letters do (`unicode-bidi: plaintext`), so code reads left to right on a right-to-left page. The `pre` is tabbable, to scroll from the keyboard.
- **font**: TrueType, OpenType, WOFF and WOFF2 (by MIME type, `font/…` and the older `application/…` names, or extension; not collections or EOT, which `FontFace` doesn't load), loaded with `FontFace` under a family of its own (`file-manager-preview-N`) and added to `document.fonts` while kept. The specimen shows `previewFontCharacters` (letters, digits and punctuation, a line each) and `previewFontSample` at 12, 18, 24, 36, 48 and 72 px (`previewFontSize`), each line running the way its letters do, in a tabbable, scrolling box. A translation gives its own script's letters and sentence. A font that fails to load or decode shows the error, with Try again.
- **custom**: the app's previewer, rendered in the body (see "Previewers of the app's own").
- **none**: the thumbnail, larger, or else the type icon, "No preview available" and the date modified.

Files are never run. A web page shows as its source, and a blob going into the PDF frame is retyped `application/pdf` first, since a blob URL shares the page's origin and a page in it would run there. A URL's type is the consumer's server's to get right.

What's loaded is kept by `previewKey` (the id, size and date modified), so a file replaced under the same id, as an upload with Replace does, is loaded afresh, and its viewer, player or frame starts afresh.

## Previewers of the app's own

`FileManager`'s optional `previewers` (`FilePreviewer[]`, `types/previewer.ts`, public) show the kinds of files the preview doesn't show by itself, or shows otherwise: highlighted code, rendered Markdown, office documents, what's in an archive, formats the browser can't draw. The component builds none of these in, by choice, so an app carries only the libraries it picks. Each has an `id`, `accepts(entry)`, `reads` and `render(props)`:

- **`reads`** is what the preview loads and hands over, and loads ahead for the next file as it does its own: `"content"` (the default), the adapter's `content` as `{ url, blob? }`, the URL made for a blob and revoked as the preview moves on; `"text"`, the start of the file read as the text preview reads it, with `truncated`, and the same note and Show more under it, which hands the previewer the longer text; or `"none"`, nothing, for a previewer getting what it needs itself, e.g. through a method of its own on the adapter (`props.adapter`).
- **`render(props)`** (`PreviewerProps`: `entry`, `adapter`, `content`, `text`, `truncated`, `onError`) is rendered in a component of its own (`PreviewerOutput`), so hooks inside it are its own, keyed by the file and the try, inside `Suspense` with the preview's spinner, so a previewer lazy-loading its library (`React.lazy`) waits there, and inside an error boundary (`PreviewerBoundary`), so one that throws shows the file as failed rather than taking the file manager down. `onError(error)` shows the file as failed too, with the error's message and Try again, which loads it afresh and renders the previewer again. The props are the same objects while they're the same, so a previewer loading more as they change doesn't load again per render.
- The body is the previewer's to fill, scrolling as it needs. The preview's keys and swipe still work over it: a key it handles itself it calls `preventDefault` on, keys typed in its fields are left to them, and a part that pans sideways itself, such as a wide table, takes `data-no-swipe`, which the swipe leaves alone (so does a scroll the browser takes over, which cancels the swipe).
- `previewers` may change after mounting, and take effect at once.

## The header

`dialogs/preview-dialog.tsx`, a large modal like the other dialogs (portalled, `dialogPaperSx`), sized `min(72rem, 100% - 2rem)` by `min(54rem, 100% - 2rem)`. The header has the file's type icon, its name, a line with its type, size and, once loaded, an image's or video's dimensions, the stepper, the app's actions, Download, Full screen and Close. It's a container of its own (`PREVIEW_HEADER_CONTAINER`, `styles/layout.ts`), as the preview portals out of the root's: the stepper's "3 / 12" shows from 480px (`previewHeaderMedium`), and the actions as buttons from 640px (`previewHeaderWide`). The file sits on `background.paper` inside, as the folder view does in the window.

### The app's actions

`FileManager`'s optional `previewActions` (`ActionGroup[]`) are actions for the file shown, built as the context menu's are: `previewActionsFor` in `file-manager.tsx` asks `contextFor` for the one file shown in its own folder (`target` "selection", with `inResults` for a search's results), and `toolbarGroups` (`utils/action-groups.ts`) binds the visible ones to it as `ToolbarGroup`s (`types/menu.ts`, internal). In that context:

- `preview` is missing, since it's previewing already, and `closePreview` is there, for an action taking the user elsewhere, such as an editor of the app's own, which the preview, a modal with its focus trap, would otherwise stay over.
- `open` calls `onOpenFile` and closes the preview unless it returned false; `openLocation` closes it first; `properties` closes it handing the focus over (`handedOff`, so `handlePreviewClosed` doesn't take it to the content), and the panel takes it.
- Rename, Delete, Move to and Copy to open their dialogs over the preview, which follows what they did (see "Following changes").

`components/buttons/toolbar-actions.tsx` (`ToolbarActions`, shared with the properties panel, and free of file manager imports) shows them: those with an icon as `TooltipIconButton`s, four at most (`inline`), the header's own (`keep`) besides, and the rest, with every action without an icon, in a "More actions" ⋮ menu (`moreActions`), built as the context menu is (dense, a rule between groups, labels inset when others have icons, shortcuts beside them, destructive ones in `error`). Below `previewHeaderWide` no buttons show and the ⋮ holds them all, Download and Full screen included, as read when it opens (the buttons' computed `display`). The menu hangs from the button's end edge by its element direction, and its key presses, which bubble through the dialog's React tree, are left alone by the preview's keys (the DOM doesn't hold them).

An action's `shortcut` works while the preview is open, after the preview's own keys (`runToolbarShortcut`), shown in the menu and as `aria-keyshortcuts`, and listed in the keyboard shortcuts window's Actions. A disabled one still takes the key.

### Download and full screen

Download saves the file shown (see `download.md`), when the adapter can hand it over (`canDownload`). Full screen (F, `fullScreen` / `exitFullScreen`, `fullScreen` / `fullScreenExit` icons) fills the window with the preview (`data-maximized`: the paper 100% by 100%, no margin, edge or corners) and, where the browser has the Fullscreen API (`fullscreenEnabled` in `utils/dom.ts`, the WebKit-prefixed one too), the screen with the page: the whole document rather than the dialog, so the menus, tooltips and dialogs opened over the preview, which portal to `<body>`, still show. Where it hasn't, as on an iPhone, the preview still fills the window.

- Leaving it the browser's way (Escape, its own controls) leaves it here too (`fullscreenchange`). Escape while maximized leaves full screen first, a second one closes (`handleClose`).
- The preview only takes the screen while nothing else has it (`ownsScreen`), and gives it back as it closes or goes, and if it was left before the browser had filled the screen.

## Loading ahead

`hooks/use-preview-contents.ts` loads what the preview shows, and the file one step further on before it's stepped to, so it shows at once.

- The file ahead is the next one the way the last step went, on to start with. It loads once the one shown has come, so the two don't share the bandwidth: a picture or a video once the browser has it (`pending` until it's measured), anything else once `content` has answered, and at once beside a file there's nothing to load for.
- Its `content` is called, and text or a font read, as for the file shown. A picture is also fetched and decoded through an `Image`, held until it's dropped. A video, audio or a PDF isn't downloaded ahead, since its player or frame loads it.
- What was loaded is kept for the files one step either side of the one shown, so stepping back is as quick. The rest is dropped: its load aborted, its picture's download stopped, its object URL revoked and its font taken off the page, so coming back to one loads it afresh.
- A file ahead that fails shows its error when it's stepped to, with Try again. A picture that fails to decode ahead is left to fail again when shown.
- Nothing more is loaded while the preview fades out, and everything goes with it.

## While a file loads

A spinner, over the file's thumbnail when the adapter has one (`useThumbnail` with the grid's view and size, as the properties panel shows it, so it's usually asked for nothing more), for every kind but text, fonts and audio. The thumbnail stands where the file will be: fitted as the image will be, at its own size when the listing says it (`FileEntry.media`), with `object-fit: contain` in a box of that size, so the picture lands where the image does; without it, as large as the view allows. An image keeps it, and the spinner, until the browser has drawn it (`ImageViewer`'s `placeholder` and `expected`).

## Images

`dialogs/image-viewer.tsx` shows an image, fitted to the view, and zooms, pans and turns it. Its state is a `Zoom` (scale, and the image's top left corner in the view) or null while it fits, and its quarter turns clockwise (`turns`, counted on rather than wrapped, so each turn animates the short way). Every sum works on the image's size as it's shown turned (`turned`).

### Zooming

- Ctrl+wheel and a touchpad pinch, which Chrome and Firefox send as Ctrl+wheel, zoom at the pointer, a mouse's notch by a step at most and a pinch smoothly. The listener isn't passive, so the page doesn't zoom instead. Safari sends a touchpad's pinch as gesture events (`gesturestart`, `gesturechange` with `scale`, `gestureend`, `GestureLike`), which zoom the same way, from where the pinch began, and a Ctrl+wheel meanwhile is ignored; on a touch screen it sends them alongside the pointers', which zoom already, so they're left alone while a pointer is down. A pinch on a touch screen zooms between the fingers, and moving them pans; the viewer's `touch-action` is `none`, so the browser's own gestures don't get in the way.
- A double click, or a double tap (caught from pointer events, as not every browser sends `dblclick` for one), toggles between fitting and the image's own size, or twice the fit when that's larger, at the point clicked.
- The buttons in the corner (Zoom out and Zoom in either side of the percentage, then Best fit) and the keys +, -, 0 (fit) and 1 (the image's own size) zoom around the view's centre. A step is √2, so two double or halve it, and stops at 100% on the way past. Ctrl with them is left to the browser's own zoom.
- It never zooms out past the fit, and in up to 16×, or further for a small image, to fill the view. From 4× the pixels show as squares (`image-rendering: pixelated`).

### Panning

- Zoomed in, it pans by dragging, with the wheel (Shift+wheel sideways), and with the arrow keys, which then pan rather than step to another file; 0 or Best fit gets them back. It's centred along an axis it fits and otherwise always covers the view. A step to another file starts it fitted and unturned again (the viewer is keyed by the file).
- After a flick on touch it glides on (`glideOn`), from the finger's speed over its last 100 ms, at least 0.2 px/ms, slowing by e every 325 ms (`FRICTION`), until it's below 0.02 px/ms, stopping along an axis as it meets that edge. Any press, wheel or key stops it.
- Fitted, a sideways swipe steps to another file, and the image moves with it. Zoomed in, the finger pans it up to its edge, and the swipe takes the rest of the way (`ImageViewerHandle.room`, how far it can still pan left and right), so a finger going on past the edge pulls the next file in, as a photo viewer's does. Going up or down first keeps it a pan. The swipe puts the view back at rest before a second finger's pinch is measured, points are taken from where the view was as the pointers last changed (`origin`), so the image pans the whole way while the swipe moves the view, and taps are told apart on the screen.

### Turning

R turns it a quarter clockwise and Shift+R counterclockwise (`rotateClockwise`, `rotateCounterclockwise`), as do the two buttons after a rule in the corner (`rotateRight`, `rotateLeft`, not mirrored right to left, since a turn is the same either way). Fitted, it fits again; zoomed, it keeps its scale as far as the view allows, with the part of the image at the view's centre still there. It's for viewing: the file isn't changed, and a download is the file as it is.

### Animation

A step made by a key, a button, a double click or a double tap animates over 200 ms (`DURATION`), easing out, as does panning with the arrows: `moveTo` sets the zoom and the turns where they're going at once, so a key pressed meanwhile steps on from there, and draws the frames meanwhile (`frame`, a `Placement`: the image's centre, scale and angle), the scale by equal ratios, the point at the zoom's anchor staying put, and what keeping the image over the view moves it by made up along the way (`between`). A press, the wheel, a pinch or the view resizing ends it where it was going (`finish`). Wheel, pinch and drag zoom and pan directly. With reduced motion nothing animates or glides.

### Layout

Fitted and unturned, it's laid out by CSS alone, so it follows the dialog's size without a measure; otherwise it's placed from its own size (`naturalWidth`) and the view's, kept by a `ResizeObserver`, through `style`: sized, translated so its centre is where it goes, and rotated about it. Its width and height scale rather than a `transform: scale`, so an SVG redraws sharp at any size. The viewer is a container of its own (`PREVIEW_IMAGE_CONTAINER`), and the percentage only shows from 360px (`previewImageWide`), so the buttons fit on a phone.

The dialog hands key presses to the viewer first, through its `ref` (`ImageViewerHandle.keyDown`), since the focus is on the dialog rather than the image.

## Failing

Loading shows a spinner (see "While a file loads"). An adapter's rejection, the browser failing to load or show the file, a font that doesn't load, or a previewer of the app's own failing or throwing shows "Couldn't preview this file" with the message and Try again, which calls `content` afresh, in case a signed URL had run out, and renders a previewer again. The content keeps the error as it came (`PreviewContent`), and the dialog words it (`errorMessage`): a text file's URL answering with an error status throws a `ResponseError` (`utils/preview.ts`), worded by `serverError`, the browser failing is `previewMediaFailed`, and an error without a message is `previewLoadFailed` (see `locale.md`).

## Stepping through files

A single file steps through the files of the view it's listed in, in the content's order, starting at it: the content passes its sorted entries as `MenuRequest.listing`, and only the content has one. Hidden files are not among them while they're not shown. Several entries step through the files among them, from one folder or, for a search's results, several, of one section or more. Folders are skipped.

- The request is its `files`, each a `PreviewFile` (`dialogs/preview-dialog.tsx`: the entry, its section, its adapter and its folder's trail), so each is loaded through its own adapter (`usePreviewContents`' `adapterOf`), planned by it, follows its own folder's listing, and binds the header's actions and Download to its own place (`actionsFor`, `onStep`, `onDownload` take the file).
- Stepping through the folder, the content's selection follows the file shown (`follow`, `handlePreviewStep`, through `reveal`), as in GNOME's and macOS's previewers. Stepping through a selection leaves it as it was.
- The arrow buttons, or Left and Right (swapped in RTL) except in a player, which seeks with them, and on a zoomed image, which pans with them. Home and End go to the first and last, except in the text and a font's specimen, which they scroll. There's no wrapping round.
- A step by a button or a key slides the file in from the side it lies on, 48px and fading in over 200 ms, as a swipe's does (`useSwipe`'s `slide`).
- Swiping sideways on touch (`hooks/use-swipe.ts`), left for the next file (swapped in RTL). The file follows the finger, and once it has crossed a quarter of the width, or was flicked, the next file slides in; otherwise it springs back. Towards an end it follows only part of the way, and springs back. With reduced motion nothing slides in or springs back. The body's `touch-action` is `pan-y pinch-zoom`, and the text's too, so sideways moves come as pointer events while text still scrolls and the page still zooms.
- A swipe isn't taken on a player, a button, a link, a field, a part marked `data-no-swipe`, or over a PDF, whose frame keeps the touches; on a zoomed image it waits for the image's edge. Going up or down first makes it a scroll, and a second finger cancels it, leaving the pinch to the image.
- A visually hidden `status` says "name, 2 of 12" on each step.

### Following changes

The files follow their folders' listings (`useLiveFiles`): once a listing of a file's folder newer than the one it was taken from has come (`Baseline`, the listings by folder key, reset whenever the request's files change), the file is that listing's entry of its id, and a file no longer there is dropped. So a file renamed keeping its id, changed, or deleted or moved meanwhile, by an action in the header or elsewhere, shows as it is or goes, while a file a listing hasn't caught up with, as a search everywhere may find, isn't dropped for it. A rename to a new id, a delete and a move made through the file manager change the request's files at once too (`changePreview`, from `handleNamed`, `handleDeleted` and `handleMoved`, changing the files of the adapter that changed).

The file shown is kept by its id, its adapter and its place (`Shown`): when it goes, the file now in its place shows, or the one before it at the end, the selection following it as a step does; with none left, the preview closes, showing the last files as it fades out.

## Keys and focus

- +, -, 0 and 1 zoom an image, R and Shift+R turn it, and the arrows pan it while it's zoomed in (see "Images"). 0, 1 and R are the keys printed with them on any layout, so AZERTY's digit row works without Shift (see "Keyboard layouts" in `keyboard.md`).
- Left and Right, Home and End step (see "Stepping through files"), F fills the screen, and Escape closes, and so does Space, as in GNOME's and macOS's previewers, except on a button, link or player, and not when it's a key held down from opening the preview (`event.repeat`). The app's actions' shortcuts come after these. None of them is taken from a field a previewer types in (`typesInField`), and a key a previewer prevents is left alone.
- Opened from the content (`focusInContent`, shared with `leaveFor`, which counts the context menu opened from the content), the dialog doesn't hand the focus back itself (`disableRestoreFocus`). Once it has faded out (`onExited`), `focusContent` gives it to the content's focused entry, which is the file shown last when the selection followed, unless it closed for the properties, which take it. Opened from anywhere else, MUI hands it back.
- While the preview is open, what the file manager announces (a cut, a copy, a delete or rename made from its header) is said from a live region inside it (`AnnouncerRegion` "preview", in `use-announcer.ts`, read as each message is announced), since the modal hides the root's from screen readers (see "Announcements" in `keyboard.md`).

## The playground

`playground/mocks/mock-content.ts` makes contents up from each file's name: pictures as SVG landscapes, `.svg` files as logos, one-page PDFs, a WAV chime for audio, zips as real archives of a small project (`archive`, through `mock-zip.ts`), and text in the file's own kind (Markdown, JSON, CSV, logs, code), as long as the file says it is up to 1 MB, so the 256 kB cut and Show more show on the large files in `archive`. A few files have real contents (`package.json`, `Dockerfile`...). Videos come from MDN's public samples, and fonts (Design assets' `fonts`: Inter as WOFF2 and WOFF, Lobster as TTF, Noto Naskh Arabic) from jsDelivr, as URLs, so both need the network. `mockups/print-proof.tiff` has a thumbnail but no preview, to see it shown in its place. Uploaded files keep their bytes and preview as themselves. `docs/contract.pdf` in Website fails, to show the error state.

- `playground/mocks/mock-previewers.tsx` has three previewers of its own, as an app would write them, with no library: Markdown rendered (`reads: "text"`, headings, paragraphs, lists, quotes, code blocks, inline code, bold, italics and links, built as elements, never as HTML), CSV as a table (`reads: "text"`, its scrolling box `data-no-swipe`, the first 1,000 rows), and what's in a zip, read from its central directory (`reads: "content"`, a blob or a URL fetched, failing with a message for a file that isn't one).
- `createPreviewActions` (`mock-data.tsx`) puts Share, Rename… (F2) and "Move to trash" (Delete), or Delete… where there's no trash, in the header as buttons, and "Open in editor" (which closes the preview and reports that it ran), Copy to…, Move to… and Properties (Alt+Enter) in its menu.

## By choice

Not gaps: a built-in editor (see "Opening a file"), previewers built into the package (an app plugs them in), and saving a turned image (turning is for viewing). The players are the browser's own, with their captions, picture-in-picture and keys, and their controls run left to right on a right-to-left page too, as Material's guidance has playback controls (see `rtl.md`).
