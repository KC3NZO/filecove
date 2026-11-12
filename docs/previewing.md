# Opening and previewing

## Opening a file

A file is opened by double-clicking it, pressing Enter on it, tapping it on a touch screen, or calling `context.open()`. Folders always open in the file manager. A file goes to your `onOpenFile`, or, without one, to the built-in preview:

```tsx
<FileManager
    onOpenFile={(entry, context) => {
        if (!entry.name.endsWith(".md")) {
            return false; // leave it to the preview
        }
        openMarkdownEditor(entry);
    }}
    /* ... */
/>
```

Return `false` to leave a file to the preview, e.g. one of a type you have no editor for. filecove has no editor of its own, by design: editing needs a way to save, and editors are heavy and differ from app to app.

Without `onOpenFile`, `context.open` is missing for files, since opening would only do what `context.preview` does, so a menu doesn't offer both.

## The preview

The preview needs the adapter's `content`, which says where a file's contents are:

```ts
content?(entry: FileEntry, options: {
    signal: AbortSignal;
    purpose: "preview" | "download" | "copy";
    onProgress: (loaded: number, total: number) => void;
}): Promise<{ url: string } | { blob: Blob }>;
```

Resolve with a URL or the bytes:

```ts
async content(entry, { purpose }) {
    const disposition = purpose === "download" ? "attachment" : "inline";
    return { url: `/api/files/${encodeURIComponent(entry.id)}/content?disposition=${disposition}` };
}
```

- **A URL** is used as it is, as the `src` of an `<img>`, `<video>`, `<audio>` or `<iframe>`, so it streams and caches as any URL does. Text and fonts are fetched from it, which needs CORS if it's on another origin. A signed URL that expires is fine: Try again calls `content` afresh.
- **A blob** is shown through an object URL, revoked once the preview moves on.
- **`purpose`** says what it's for. For `"download"`, hand over a URL the server sends with `Content-Disposition: attachment` (see [Uploads and downloads](uploads-and-downloads.md#downloads)). For `"copy"`, copying the file to another backend, the page fetches the URL itself, so it needs CORS.

What the preview shows by itself:

| Kind | How |
|---|---|
| Images the browser draws | fitted, zoomed (Ctrl+wheel, pinch, +, -, double click), panned, turned (R), full screen (F) |
| Video and audio | the browser's own players |
| PDF | the browser's own viewer, in a frame |
| Text and code | the first 256 kB, with Show more; UTF-8, UTF-16 and Windows-1252 |
| Fonts (TTF, OTF, WOFF, WOFF2) | a specimen at several sizes |
| Anything else | its thumbnail, larger, or its type icon |

The kind comes from `mimeType`, or else from the name's extension. Files are never run: an HTML page shows as its source.

The preview steps through the folder's files with the arrow keys, Home and End, the buttons, or a swipe, loading the next file ahead. Escape or Space closes it. It follows changes: a file renamed, changed or deleted while it's shown updates or goes.

## Previewers of your own

For the kinds the preview doesn't show, or to show one another way, pass `previewers`. Each says which files it takes, what it needs loaded, and draws them:

```tsx
import { lazy } from "react";
import type { FilePreviewer } from "filecove";

const Markdown = lazy(() => import("./markdown-view")); // your own component and library

const markdownPreviewer: FilePreviewer = {
    id: "markdown",
    accepts: (entry) => entry.name.endsWith(".md"),
    reads: "text",
    render: ({ text }) => <Markdown source={text ?? ""} />,
};

const previewers = [markdownPreviewer];

<FileManager previewers={previewers} /* ... */ />;
```

- **`accepts(entry)`** decides. Previewers are asked in order, before the built-in previews, so one can take over a kind the preview shows too.
- **`reads`** is what's loaded and handed over:
  - `"content"` (the default): the adapter's `content`, as `content: { url, blob? }`.
  - `"text"`: the start of the file as text, as `text`, with `truncated` when there's more; the preview shows Show more under it, which hands you the longer text.
  - `"none"`: nothing, for a previewer that fetches what it needs itself, e.g. through a method of your own on `props.adapter`. These work even without `content`.
- **`render(props)`** gets `entry`, `adapter`, `content`, `text`, `truncated` and `onError`. It's rendered as a component of its own, so hooks work; inside `Suspense`, so a `lazy` previewer shows the preview's spinner while its library loads; and inside an error boundary, so one that throws shows the file as failed rather than taking the page down. Call `onError(error)` to show it failed, with Try again.

filecove builds no previewer in beyond the browser's formats, so your app carries only the libraries you choose: a syntax highlighter, a Markdown renderer, an office viewer.

The preview's keys and swipe still work over a previewer. Call `preventDefault` on a key you handle yourself, and mark a part that pans sideways itself (a wide table) with `data-no-swipe`.

## Thumbnails

The adapter's `thumbnail` gives a small picture of a file, shown in place of its icon in the list and the grid, and larger in the properties panel and the preview while a file loads:

```ts
thumbnail?(entry: FileEntry, options: {
    signal: AbortSignal;
    view: "list" | "grid";
    size: number;        // the square's side in device pixels
}): Promise<{ url: string } | { blob: Blob } | null>;
```

```ts
async thumbnail(entry, { size }) {
    if (!entry.mimeType?.startsWith("image/")) {
        return null; // answer at once for files that can't have one
    }
    return { url: `/api/files/${encodeURIComponent(entry.id)}/thumbnail?size=${size}` };
}
```

- It's called for every file as it comes into view, a few at a time (6 by default, `limits.thumbnails`). **Return `null` at once** for files that can't have one, by type, rather than asking the server: those calls share the queue with the ones that matter.
- **`size`** follows the view's zoom and the screen's pixel ratio, for a backend making thumbnails to order. One keeping a few fixed sizes picks the nearest larger one.
- Thumbnails are kept while the file manager is mounted (1,000 by default, `limits.keptThumbnails`) and asked for again when a file's size or date modified changes.
- A rejection, or a picture the browser can't draw, leaves the icon, saying nothing to the user. Folders never have one in the file manager.

## The file type icons

Without a thumbnail, files and folders show coloured icons chosen by name (a PDF's, a `src` folder's), from `@react-symbols/icons`. They load as a separate chunk after the component mounts, plain icons standing in until then. To keep the plain icons and never load them, see [Customizing](customizing.md#icons).
