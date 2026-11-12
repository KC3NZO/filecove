---
paths:
  - "src/types/slots.ts"
  - "src/utils/slots.ts"
  - "src/components/file-manager/header-bar/header-bar.tsx"
  - "src/components/file-manager/sidebar/sidebar.tsx"
  - "src/components/file-manager/content/folder-view.tsx"
  - "src/components/file-manager/content/search-results.tsx"
  - "src/components/file-manager/content/no-sections.tsx"
  - "src/components/file-manager/content/file-list.tsx"
  - "src/components/file-manager/content/file-grid.tsx"
  - "src/components/media-manager/media-grid.tsx"
  - "src/components/media-manager/asset-option.tsx"
  - "playground/slots.tsx"
---

# Slots, attributes and the header's actions

The third of the three ways to customise beyond the `--fm-*` custom properties (see "Theming" in `component-styling.md`), after the stable class names and the layered stylesheet. Built 2026-11-12, when the user asked for it ("step 3"), to use the package in a project of theirs. MUI-like, as the other props are: `slots` for parts of the app's own, `slotProps` for attributes on the component's parts, and `headerActions` for buttons in the file manager's header. The types are `types/slots.ts` (public, every one exported from `src/index.ts`), their comments being the consumer's documentation.

## `slots`: the app's own parts

Each is a component (`ComponentType`), drawn where the component's own would be, or where it keeps room for one, handed what it needs as props.

| Slot | `FileManager` | `MediaManager` | `MediaPicker` | Handed |
|---|---|---|---|---|
| `empty` | the open folder lists nothing shown, or the trash's root is empty | the library or group lists nothing | as the manager | the file manager's place (`section`, `location`, `folder`), `trash`, and `context`, the folder's `ActionContext` (`actionContextAt`, as `apiRef.actionContext()`), so an Upload button calls `context.upload`; the media's place (`section`, `group`) and `upload`, the header's Upload, missing where it takes no files |
| `noResults` | a folder search, once all of the folder came, and a search everywhere, once every section answered | the search matched nothing | as the manager | `query` (as typed in a folder search, trimmed for a search everywhere) and `scope`; the media's place and `query` |
| `error` | the open folder couldn't be listed | the library couldn't be listed or searched | as the manager | the place, `error` (what `list` rejected with) and `retry`; the media's place, `message` and `retry` |
| `loading` | nothing to show yet, a folder or a search everywhere | nothing to show yet | as the manager | `label`, the text's `loading`, to name a spinner by |
| `noSections` | no section | no library | (none) | nothing |
| `sidebarFooter` | under the sidebar's tree | (none) | (none) | `section` and `location`, or null with no section |

- **The states are drawn inside the component's box**, not in place of it: the box keeps its place in the panel, its `fm-state` class, its `id` the folder view's empty space is described by (`aria-describedby`), and its `role`, `alert` for an error, `status` for the media grid's empty state. So an app's state needs nothing for screen readers, and can't break the content's keys: the folder view's own keys only act on an entry or the view itself, and a marquee doesn't start from a button. A button in it calls `event.stopPropagation()` on click, as the file manager's own Try again does, or the folder's empty space takes the click as one clearing the selection.
- **The search everywhere's failures**, "Couldn't search ‹section›" and "Some sections couldn't be searched", aren't slots yet: they retry some sections and not others (see "Not yet").
- **`sidebarFooter`** goes in `.footer` (`fm-sidebar-footer`), after the tree's `nav`, which scrolls above it, before the touch selection bar, in the docked sidebar and the overlay alike. It's drawn by the frame (`SidebarFooter`) and handed to `Sidebar` as an element.
- **Components, kept outside the app's own.** A component made while rendering is a new type every render, so React mounts it afresh each time, losing its state. The props' comments say so.
- Each is read where it's drawn, from the props: the frame hands `slots` to `FolderView`, `SearchResults` and `NoSections`, and the media frames to `MediaGrid`, no context.

## `slotProps`: attributes on the component's parts

`SlotAttributes` (public) is what an element takes but `children` and `dangerouslySetInnerHTML`, `data-*` included by an index signature (`data-${string}`), so an app adds utility classes (Tailwind and the like, which can't aim at `fm-…` names without writing CSS), test ids, analytics handlers, a `title`.

| Key | `FileManager` | `MediaManager` | `MediaPicker` |
|---|---|---|---|
| `sidebar` | the sidebar (`fm-sidebar`) | | |
| `header` | the header bar (`fm-header`) | the header (`fm-media-header`) | the same |
| `content` | the content panel (`fm-content`) | | |
| `properties` | the properties panel (`fm-properties`, `PropertiesPanel`'s `attributes`) | | |
| `libraries` | | the list of libraries (`fm-media-libraries`) | |
| `chosen` | | the selected column (`fm-media-chosen`) | the same |
| `entry` / `asset` | each list row and grid tile, of a folder and of a search's results (`FileManagerEntrySlotParams`: `entry`, `view`, `selected`) | each asset's and group's `option` (`MediaAssetSlotParams`: `asset`, `section`, `selected`) | the same |

- **How they go with the part's own** (documented on `SlotAttributes`): the app's are spread first and the part's own attributes after them, so whatever the part sets wins (its `role`, `tabIndex`, `id`, `aria-*`, `data-*` state, a `ref`), and the keys, the focus and screen readers keep working. `className` is joined after the part's own classes, its `fm-…` name among them. `style` goes under the part's own (`{ ...attributes.style, top }`), so a virtualized row's place, a sidebar's width, stay the part's. A handler the part has too goes through `chain` (`utils/slots.ts`): the app's first, then the part's unless the app's called `preventDefault` during it, as the root's handlers go (see "The root element" in `props.md`); an event prevented already, by something inside, still reaches the part's own. Without the app's, the part's handler is passed as it is.
- **One of many** (`entry`, `asset`): `SlotAttributesOf<P>`, the same attributes for each or a function of each (`slotAttributesFor`, which makes the params only when there's a function). The function gets the entry itself among a search's results (`origin.entry`), not the copy keyed by result. It's resolved inside the memoized row, tile or option, so the memo compares the function, not what it returns: an app passing a new function each render draws every one shown again, which the props' comments say.
- **The root** takes its attributes as it always did (see "The root element" in `props.md`), so there's no `root` key.
- In code: `{...attributes}` first on the element, then the part's own, `className={cx(…, attributes?.className)}`, `style={{ ...attributes?.style, … }}`, and `onX={chain(attributes?.onX, ownHandler)}` for each handler the part has. A part taking them gets an `attributes?: SlotAttributes` prop.

## `headerActions`

`FileManager`'s `headerActions` (`ActionGroup[]`) are the app's buttons in the header bar, as `previewActions` and `propertiesActions` are the preview's and the properties', through the shared `ToolbarActions`, bound by `toolbarGroups`. The roadmap's example for slots was "add header buttons"; actions were chosen over a slot drawing anything, so the buttons look, collapse, and take shortcuts as the file manager's own, and the app writes no button.

- **What they act on** (`headerToolbar` in `file-manager.tsx`): the content's selection (`shownSelection`, of the open folder), or with nothing selected the open folder itself (`target` "folder"), through `contextFor`, as the context menu's are, so an action's `target`, `visible` and `disabled` go by it: Upload and New folder for the folder, Share for a selection. While a search everywhere's results show, their selection, grouped by folder (`groupByFolder`, `selectionRequest`, `inResults`), only `acrossFolders` actions for several folders, and nothing with nothing selected, as the results have no folder of their own. No `listing` is passed, as the properties' header passes none, so the folder's listing isn't sorted for every change of the selection.
- **Where**: first in the header's end group, before Select, search everywhere and the view's buttons. Two with an icon as buttons (`INLINE_ACTIONS`), the rest, and those without an icon, in "More actions" (`moreActions`, the preview's key), and all of them there below `rootWide` (900px): the header sets `--toolbar-buttons` and `--toolbar-more` for `ToolbarActions`' `collapses`.
- **Shortcuts** run from the root's handler, right after the main menu's (`runToolbarShortcut`, outside a field, `typesInField`), so after the content's and the tree's own actions, which come first where the focus is, and before the file manager's own keys at the root. The keyboard shortcuts window lists them with the consumer's actions, and counts them, as the main menu's, among the keys the file manager's own give way to (`taken`).

## The playground

`?slots` (`playground/options.ts`, `playground/slots.tsx`, `slots.module.css`): the header's New folder and Upload files for the folder and Share for a selection (`createHeaderActions`); an empty folder saying so with Upload files through `context.upload` (`EmptyFolder`), and the trash's own words; a storage meter under the sidebar's tree for the section open, made-up numbers by section id, a `meter` (`StorageMeter`); dotfiles in italics by a class `slotProps.entry` gives them, and a test id on the content panel. `?media&slots` gives an empty library or group Upload through `upload` (`EmptyLibrary`): Audio's Forests, in Field recordings, is an empty group to see it.

## Not yet

- The search everywhere's failures, a tree row's states (the single section's loading, empty and failed rows), the preview's states, the dialogs, the panels' rows, and the media manager's asset view and selected column rows as slots.
- `slotProps` for the tree's rows, the path bar, the dialogs and the panels; and for the media manager's grid itself and its asset view.
- Replacing whole parts (the sidebar, the header, the content) as MUI's data grid's `toolbar` slot does: each holds behaviour (keys, focus, drops, virtualization) a replacement would have to carry, so each waits for an app's case.
