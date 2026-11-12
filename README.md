# filecove

A file manager for React apps, and a media manager built on the same parts. It runs in the browser and works with any backend: you write an **adapter**, a few async functions that list folders and, optionally, rename, upload, delete and so on, and filecove does the rest.

- **`FileManager`**: a sidebar of your roots, list and grid views, search, drag and drop, uploads and downloads in the background, a preview, a properties panel, a trash, undo and redo, keyboard navigation, screen reader support and right to left.
- **`MediaManager`**: libraries of pictures, videos, audio and documents to look through and pick from, with groups, your own forms and fields, uploads and processing.
- **`MediaPicker`**: one library to find or upload an asset in, for a field pointing at one.

React 19, no styling runtime, themed with CSS custom properties. MIT licensed.

## Install

```sh
npm install filecove
```

## Use

```tsx
import { FileManager } from "filecove";
import type { FileAdapter, SectionGroup } from "filecove";
import "filecove/styles.css";

const adapter: FileAdapter = {
    async list(folderId, { signal }) {
        const response = await fetch(`/api/folders/${encodeURIComponent(folderId)}/entries`, { signal });
        const body = await response.json();
        return {
            entries: body.entries.map((entry: any) => ({
                id: entry.id,
                name: entry.name,
                kind: entry.type,
                size: entry.size,
                modifiedAt: entry.updated_at ? new Date(entry.updated_at) : undefined,
            })),
        };
    },
};

const sections: SectionGroup[] = [
    { id: "places", sections: [{ id: "home", label: "My files", icon: "home", rootId: "root" }] },
];

export function Files() {
    return (
        <div style={{ height: "100vh" }}>
            <FileManager adapter={adapter} sections={sections} />
        </div>
    );
}
```

Each feature switches on as the adapter grows a matching method: `rename`, `upload`, `delete`, `content` for the preview, `search`, and so on. The context menu is yours to fill with `actions`.

## Documentation

The docs are in [`docs/`](docs/README.md), and ship with the package at `node_modules/filecove/docs/`:

- [Getting started](docs/getting-started.md)
- [The adapter](docs/adapter.md)
- [Actions](docs/actions.md), with a complete set to copy
- [Recipes](docs/README.md#recipes): adapters over a REST API, S3, and memory

## License

MIT. The Material Icons' shapes are under the Apache License 2.0; see `THIRD_PARTY_NOTICES.md`.
