# State and the API

## Controlled or not

Most of what the user changes can be left to the file manager, or kept by your app, as MUI's components do it. Each piece of state has three props:

- **`x`**: the value, which makes it controlled. The user's changes are only asked for through the callback, and happen once you pass the new value back.
- **`defaultX`**: where it starts, when the file manager keeps it.
- **`onXChange`**: told every change, controlled or not.

Which one is decided on mounting; switching later, or changing a `default…` prop after mounting, warns in development.

| State | Props | Default |
|---|---|---|
| Location | `location`, `defaultLocation`, `onLocationChange(location, reason)` | the first section's root |
| View | `view`, `defaultView`, `onViewChange` | `"list"` |
| Zoom | `zoom`, `defaultZoom`, `onZoomChange` | `{ list: 0, grid: 0 }` |
| Order | `sort`, `defaultSort`, `onSortChange` | relevance (name, A to Z, in folders) |
| Hidden files shown | `showHidden`, `defaultShowHidden`, `onShowHiddenChange` | `false` |
| Docked sidebar hidden | `sidebarHidden`, `defaultSidebarHidden`, `onSidebarHiddenChange` | `false` |
| Docked sidebar's width | `sidebarWidth`, `defaultSidebarWidth`, `onSidebarWidthChange` | 248 (200 to 360) |
| Docked properties shown | `propertiesOpen`, `defaultPropertiesOpen`, `onPropertiesOpenChange` | `false` |
| Docked properties' width | `propertiesWidth`, `defaultPropertiesWidth`, `onPropertiesWidthChange` | 300 (240 to 480) |
| Tree folders expanded | `expandedFolders`, `defaultExpandedFolders`, `onExpandedFoldersChange` | the section opened in |
| Search | `search`, `defaultSearch`, `onSearchChange` | `null` (closed) |
| Sections a search everywhere leaves out | `searchExcludedSections`, `defaultSearchExcludedSections`, `onSearchExcludedSectionsChange` | none |
| Selection | `selectedIds`, `defaultSelectedIds`, `onSelectionChange(ids, details)` | none |

### Keeping view settings across visits

The file manager writes nothing to storage itself. Keep what you want kept:

```tsx
const [view, setView] = useLocalStorage<ViewMode>("files.view", "list");
const [showHidden, setShowHidden] = useLocalStorage("files.hidden", false);

<FileManager
    view={view}
    onViewChange={setView}
    showHidden={showHidden}
    onShowHiddenChange={setShowHidden}
    /* ... */
/>;
```

Or, to start from what was saved and let the file manager keep it from there, pass the `default…` props and save in the callbacks.

## The location

```ts
interface FileManagerLocation {
    sectionId: string;
    trail: FolderRef[]; // the folders below the section's root, outermost first; [] for the root
}

type LocationChangeReason = "navigate" | "back" | "forward" | "replace";
```

The trail is built from `FolderRef`s (`{ id, name }`), not from parsing ids. When you pass one, it isn't checked against listings; a folder that isn't there shows as failed to open.

`reason` says why it changed: the user went somewhere (`"navigate"`), back or forward, or the place was rewritten in place (`"replace"`), as when a folder it was in was renamed or deleted. A URL kept in step replaces its entry for `"replace"` and pushes one otherwise.

### Keeping it in the URL

```tsx
import { useEffect, useState } from "react";
import type { FileManagerLocation, LocationChangeReason } from "filecove";

const read = (): FileManagerLocation | undefined => {
    try {
        return JSON.parse(decodeURIComponent(location.hash.slice(1)));
    } catch {
        return undefined;
    }
};

export function useHashLocation(fallback: FileManagerLocation) {
    const [place, setPlace] = useState(() => read() ?? fallback);

    useEffect(() => {
        const onPop = () => setPlace(read() ?? fallback);
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, [fallback]);

    const change = (next: FileManagerLocation, reason: LocationChangeReason) => {
        const url = `#${encodeURIComponent(JSON.stringify(next))}`;
        if (reason === "replace") history.replaceState(null, "", url);
        else history.pushState(null, "", url);
        setPlace(next);
    };

    return [place, change] as const;
}

// const [place, setPlace] = useHashLocation({ sectionId: "home", trail: [] });
// <FileManager location={place} onLocationChange={setPlace} /* ... */ />
```

The file manager keeps its own back and forward history. A location you pass that's where its back or forward leads counts as going there, so the browser's back button and the file manager's stay in step.

A location in a section the file manager doesn't have shows the first section's root, asked for as `"replace"`.

## The selection

```ts
onSelectionChange?: (ids: string[], details: { entries: FileEntry[]; location: FileManagerLocation }) => void;
```

`ids` is what to pass back as `selectedIds`. `details.entries` are the selected entries the content lists, in its order, which is what to act on (a selected entry hidden by "Show hidden files" is in `ids` but not in `entries`).

- Every folder opens with nothing selected. Going somewhere from inside the file manager asks for an empty selection, but a `location` you change leaves the selection to you, so you can open a folder with an entry selected.
- Ids set from outside are revealed once the folder is listed: the first is scrolled to, and takes the focus if the content has it.
- Ids the folder doesn't list drop out once all of it has come.
- A search everywhere's results have their own selection, which isn't told.

## The API

`apiRef` takes a `FileManagerApi`, for a toolbar or code of your own:

```tsx
import { useRef } from "react";
import type { FileManagerApi } from "filecove";

const apiRef = useRef<FileManagerApi>(null);

<FileManager apiRef={apiRef} /* ... */ />;
<button onClick={() => apiRef.current?.refresh()}>Reload</button>;
```

| Method | Does |
|---|---|
| `navigate(location)`, `back()`, `forward()` | goes somewhere, as the user would |
| `refresh(folderIds?, { adapter }?)` | lists folders again, or every saved listing; after changes made outside the file manager |
| `reveal(entryId, location?)` | selects an entry and scrolls to it, going to `location` first |
| `actionContext(entries?, location?)` | the context menu's `ActionContext`, for any operation (see [Actions](actions.md)) |
| `download(entries?, location?)` | downloads entries, or the folder itself; `false` if nothing could be |
| `search(scope, query?)`, `closeSearch()` | opens or closes the search |
| `editPath()` | opens the path field, as Ctrl+L does |
| `goToPath(path)` | goes where a typed path leads; resolves `{ ok: true, location, entryId? }` or `{ ok: false, message }` |
| `focus()` | moves the focus into the content |
| `showShortcuts()` | opens the keyboard shortcuts window |
| `undo()`, `redo()` | as Ctrl+Z and Shift+Ctrl+Z; `false` with nothing to do |

The object stays the same while the file manager is mounted. `actionContext` is built as of the call, so ask again after the selection or location changes.

```ts
// A "New folder" button outside the file manager.
const context = apiRef.current?.actionContext();
<button disabled={!context?.createFolder} onClick={() => context?.createFolder?.()}>New folder</button>;
```

```ts
// After your own code adds a file behind the file manager's back.
await api.importFrom(url, folderId);
apiRef.current?.refresh([folderId]);
```

## Limits

`limits` sets how much runs at once and how much is kept, for a backend that takes more or less than the defaults:

| Field | Default | Sets |
|---|---|---|
| `uploads` | 3 | upload calls at once |
| `downloads` | 3 | downloads prepared at once |
| `transfers` | 3 | copies and moves at once |
| `thumbnails` | 6 | `thumbnail` calls at once |
| `keptThumbnails` | 1,000 | thumbnails kept while nothing shows them |
| `keptEntries` | 20,000 | entries kept in listings nothing shows |
| `undoSteps` | 20 | changes kept to undo (0 for none) |
| `searchDelay` | 300 | ms after typing stops before a search everywhere |

```tsx
<FileManager limits={{ uploads: 6, thumbnails: 12 }} /* ... */ />
```

Changes take effect at once. `Infinity` is no limit.

## `relistAfter`

How old, in ms, a folder's listing may be before opening the folder lists it again in the background. 0 (the default) lists it every time it opens; `Infinity` never does, leaving changes made elsewhere to `apiRef.current.refresh()`.

## The root element

`FileManager` takes the root `div`'s own attributes (`id`, `className`, `style`, `aria-*`, `data-*`, handlers) and a `ref`. Your handlers run before the file manager's own; calling `preventDefault` in an `onKeyDown` keeps the file manager from acting on that key. `title` is the sidebar's heading, "Files" by default.

## Props changing after mounting

Everything may change after mounting, `sections` and `adapter` included. Actions, previewers, slots, text and limits take effect at once. A `default…` prop changing does nothing (and warns in development).
