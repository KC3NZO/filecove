# Getting started

## Install

```sh
npm install filecove
# or: bun add filecove / pnpm add filecove / yarn add filecove
```

filecove needs **React 19** and React DOM 19, as peer dependencies. It brings `@base-ui/react` and `@react-symbols/icons` with it.

It's published as ES modules only. Its type declarations resolve with TypeScript's `moduleResolution` set to `"bundler"`, which Vite and Next.js use; `"node16"` and `"nodenext"` aren't supported yet.

## Import the stylesheet

The components don't put their CSS in the page themselves. Import one of the two stylesheets once, at your app's entry:

```ts
import "filecove/styles.css";
```

Or, if your app orders its styles with cascade layers, import the layered copy and place the `fm` layer where you want it:

```css
@layer reset, fm, app;
@import "filecove/styles.layer.css";
```

Without either, the component renders unstyled. See [Customizing](customizing.md#the-two-stylesheets) for the difference.

## A first file manager

A file manager needs three things: an **adapter** (how to reach the backend), **sections** (the roots shown in the sidebar) and **actions** (what the context menu offers). Here's the smallest one that works, over a few folders kept in memory:

```tsx
import { FileManager } from "filecove";
import type { FileAdapter, FileEntry, SectionGroup } from "filecove";
import "filecove/styles.css";

// The files, by the id of the folder holding them. Ids are yours: paths here, but they could be
// database ids. The file manager never reads them, only hands them back.
const tree: Record<string, FileEntry[]> = {
    "/": [
        { id: "/docs", name: "docs", kind: "folder" },
        { id: "/readme.md", name: "readme.md", kind: "file", size: 1200, modifiedAt: new Date("2026-01-04") },
    ],
    "/docs": [
        { id: "/docs/guide.pdf", name: "guide.pdf", kind: "file", size: 480_000, mimeType: "application/pdf" },
    ],
};

// Defined outside the component, so it's the same object on every render.
const adapter: FileAdapter = {
    async list(folderId) {
        return { entries: tree[folderId] ?? [] };
    },
};

const sections: SectionGroup[] = [
    {
        id: "places",
        sections: [{ id: "files", label: "My files", icon: "home", rootId: "/" }],
    },
];

export function Files() {
    return (
        <div style={{ height: "100vh" }}>
            <FileManager adapter={adapter} sections={sections} />
        </div>
    );
}
```

That's a working, read-only file manager: browsing, the tree, list and grid views, sorting, hidden files, the folder search and the keyboard all work with `list` alone. Every other feature switches on as the adapter grows a matching method (see [The adapter](adapter.md#what-each-optional-member-switches-on)).

**Give it a height.** The root fills the box it's placed in, 100% wide and 100% high, and lays itself out by its own width rather than the viewport's. In a container with no height it collapses to nothing.

## Add the context menu

The file manager puts nothing in the context menu by itself: it hands each action an `ActionContext` saying what the user can do here, and you decide what to show and what to call it. So with no `actions`, right-clicking does nothing.

The usual set is in [Actions](actions.md#a-complete-set-to-start-from), ready to copy. A small one looks like this:

```tsx
import type { ActionGroup } from "filecove";

const actions: ActionGroup[] = [
    {
        id: "edit",
        actions: [
            {
                id: "rename",
                label: "Rename…",
                icon: "rename",
                shortcut: "F2",
                target: "selection",
                single: true,
                visible: (context) => !!context.rename,
                onSelect: (context) => context.rename?.(),
            },
            {
                id: "delete",
                label: "Delete…",
                icon: "delete",
                shortcut: "Delete",
                target: "selection",
                destructive: true,
                visible: (context) => !!context.delete,
                onSelect: (context) => context.delete?.(),
            },
        ],
    },
];

<FileManager adapter={adapter} sections={sections} actions={actions} />;
```

`context.rename` and `context.delete` are only there when the adapter has `rename` and `delete`, and the entries' permissions allow them, so `visible` hides the item otherwise.

## Grow the adapter

Each optional method on the adapter switches a feature on. Add them as your backend supports them:

```ts
const adapter: FileAdapter = {
    list: (folderId, { signal, cursor }) => api.list(folderId, cursor, signal),
    createFolder: (parentId, name, { signal }) => api.createFolder(parentId, name, signal),
    rename: (entry, name, { signal }) => api.rename(entry.id, name, signal),
    delete: (entries, { signal }) => api.delete(entries.map((e) => e.id), signal),
    upload: (file, folderId, { signal, onProgress, conflict }) => api.upload(file, folderId, conflict, onProgress, signal),
    content: async (entry) => ({ url: `/api/files/${encodeURIComponent(entry.id)}/content` }),
};
```

A complete adapter over a REST API is in [recipes/rest-adapter.md](recipes/rest-adapter.md).

## Things that cost the most time

- **Keep `adapter` stable.** Define it at module scope, or in `useMemo`. When the `adapter` prop changes to another object, every section it serves goes back to its root and its saved listings are dropped, as another adapter's ids may mean something else. A new adapter each render resets the file manager on every render.
- **Dates are `Date` objects.** `modifiedAt`, `createdAt` and `trashedAt` are `Date`s, not strings. Convert what your API sends.
- **Ids are opaque and unique within an adapter.** The file manager never parses an id, joins paths or builds one; it only hands back ids it was given. Paths work as ids, and so do database ids.
- **Reject with an `Error`.** When a call fails, reject with an `Error` whose `message` the user can read. The file manager shows it where the action happened (under a field, in a panel row, in the folder).
- **Pass the `signal` on.** Every call gets an `AbortSignal`. Hand it to `fetch` so a folder the user has left stops loading.
- **Functions and components in props.** `slots` take components, so define them outside your component, or React mounts them afresh each render. `localeText` functions, `slotProps.entry` functions and `renderAsset` written inline are new each render and redraw every row; define them outside or memoize them.

## Server rendering and Next.js

The package is marked `"use client"`, so in Next.js's App Router you can import `FileManager` in a server component's tree directly; it renders on the server and hydrates in the browser. Nothing reads `window` or `document` while rendering. The coloured file type icons load after the component mounts, so the server's render shows plain icons, which swap in the browser.

Import the stylesheet in your root layout:

```tsx
// app/layout.tsx
import "filecove/styles.css";
```

## Browser support

The stylesheets use CSS nesting, container queries, `:has()`, `:dir()`, `color-mix()` and `light-dark()`. The floor is **Chrome 123, Safari 17.5 and Firefox 120**.

## Next

- [The adapter](adapter.md), the contract in full.
- [Sections](sections.md), for several roots or several backends.
- [Customizing](customizing.md), for colours, fonts and dark mode.
