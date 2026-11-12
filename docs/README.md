# filecove documentation

filecove is a file manager for React apps, and a media manager built on the same parts. It runs entirely in the browser and has no idea what your backend is. You give it an **adapter**, an object of async functions that list folders and, optionally, rename, upload, delete and so on, and it gives you a complete file manager: a sidebar, a list and a grid, search, drag and drop, uploads, downloads, a preview, a properties panel, a trash, undo, keyboard navigation, screen reader support and right-to-left layouts.

It ships as three components:

- **`FileManager`** browses folders, as a desktop file manager does.
- **`MediaManager`** looks through libraries of media (pictures, videos, audio, documents) and picks from them, as a CMS's media library does.
- **`MediaPicker`** is one library to find, or upload, an asset in, for a field pointing at one.

It needs React 19, and has no styling runtime: one stylesheet you import, themed with CSS custom properties.

## Where to start

1. [Getting started](getting-started.md): install, the stylesheet, a first adapter, a first render, and the mistakes that cost the most time.
2. [The adapter](adapter.md): the backend contract. Read this before writing one for real.
3. [Actions](actions.md): the context menu is yours to fill. This page has a complete set to copy.

## Guides

| Page | What's in it |
|---|---|
| [Sections](sections.md) | the sidebar's roots, one or several backends, read-only sections, the trash section |
| [Actions](actions.md) | the context menu, the header's, the preview's and the properties' buttons, shortcuts, the main menu |
| [Opening and previewing](previewing.md) | `onOpenFile`, the built-in preview, previewers of your own, thumbnails |
| [Uploads and downloads](uploads-and-downloads.md) | `upload`, `content`, `download`, limiting what a section takes |
| [Copy, move, trash and undo](copy-move-trash-undo.md) | what the adapter returns so the user can undo, copying between backends, the trash |
| [Search](search.md) | the folder search and search everywhere |
| [Properties](properties.md) | the properties panel, the backend's fields, editing them, folder totals |
| [State and the API](state-and-api.md) | controlled props, keeping the location in the URL, `apiRef` |
| [Customizing](customizing.md) | theming, the two stylesheets, stable class names, slots, `slotProps`, icons |
| [Text, languages and right to left](locale-and-rtl.md) | `localeText`, `locale`, `dir="rtl"` |
| [Media manager](media-manager.md) | libraries, groups, picking, forms, processing, `MediaPicker` |

## Recipes

Complete adapters to start from:

- [An in-memory adapter](recipes/in-memory-adapter.md), for trying things out and for tests.
- [An adapter over a REST API](recipes/rest-adapter.md), the usual case.
- [An adapter over S3 with presigned URLs](recipes/s3-adapter.md), for a bucket your server signs requests to.

## Reference

The type definitions are the reference. Every public prop and type has a doc comment, so your editor shows it on hover, and the `.d.ts` files in `node_modules/filecove/dist/` can be read directly: `components/file-manager/file-manager.d.ts` for `FileManager`'s props, `types/adapter.d.ts` for the adapter, `types/action.d.ts` for actions, and so on. These pages explain how the pieces fit together; the types say exactly what each member takes.

## For AI coding assistants

If you're an agent integrating filecove into an app:

- These docs ship inside the package, at `node_modules/filecove/docs/`, and match the installed version.
- Start from [getting-started.md](getting-started.md) and a recipe in [recipes/](recipes/). Write the adapter first, then the actions.
- The context menu is empty until you pass `actions`. Copy the set in [actions.md](actions.md).
- Check member names against `node_modules/filecove/dist/types/*.d.ts` rather than guessing; the API isn't MUI's or any other library's.
- Keep `adapter` and `sections` stable across renders (module scope or `useMemo`). A new adapter object each render resets the file manager.
