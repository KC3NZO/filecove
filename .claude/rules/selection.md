---
paths:
  - "src/components/file-manager/file-manager.tsx"
  - "src/components/file-manager/content/**"
  - "src/components/file-manager/sidebar/**"
  - "src/components/file-manager/header-bar/header-bar.tsx"
  - "src/hooks/use-selection.ts"
  - "src/hooks/use-tree-selection.ts"
  - "src/hooks/use-marquee.ts"
  - "src/hooks/use-long-press.ts"
  - "src/utils/selection.ts"
  - "src/types/selection.ts"
---

# Selection

**The content and the sidebar tree each have their own selection, and the two are never merged.** Both follow `nextSelection` (`utils/selection.ts`):

- a click selects one entry;
- Ctrl or ⌘ toggles one;
- Shift selects a range from the anchor;
- Ctrl+Shift adds the range to the selection.

In both panes, right-clicking a selected item (or using its ⋮) acts on that pane's whole selection, and any other item is selected alone first.

## Content

`content/folder-view.tsx` holds the selection through `hooks/use-selection.ts`. The view remounts per folder, so every folder opens with nothing selected.

## Marquee (rubber band)

`hooks/use-marquee.ts`. Content only, mouse only (on touch a drag scrolls). A press on blank space that moves 4px draws a rectangle, and every entry it touches is selected (`marqueeSelection`): plain replaces, Shift adds, Ctrl or ⌘ flips.

- Entries are found by `data-entry-id`. Presses on `data-no-marquee` parts (a whole list row or grid tile) or on buttons stay clicks, and those parts are what an entry is dragged by (see "Drag and drop" in `file-manager.md`). So a marquee only starts from empty space: below the entries, between them, and the view's padding.
- Dragging near the panel's top or bottom edge scrolls it.
- The rectangle is moved through CSS custom properties without re-rendering. The view only re-renders when the covered entries change.
- The click that ends a drag is swallowed so it doesn't clear the new selection.

## Touch selection mode

There are no modifier keys on touch, so the content has a selection mode instead. It is on while `file-manager.tsx`'s `selectingKey` equals the open folder's key, so opening another folder ends it.

- Two ways in:
  - Long-pressing an entry (`hooks/use-long-press.ts`, 500 ms on its own timer, since iOS never fires `contextmenu` for a long-press), which selects it.
  - The header's Select button, shown only under `@media (hover: none)`.
- In the mode every tap toggles, and a tap on empty space does nothing. `content/selection-bar.tsx` (sticky at the panel's bottom) offers ✕, the count, Select all or none, and ⋮ for the selection's menu. Leaving the mode clears the selection.
- Rows and tiles show check badges (`content/item-icon.tsx`, keyed off `data-selecting` and `data-selected`).
- Outside the mode, a touch tap opens a folder rather than selecting it.
- `folder-view.tsx` reads each press's `pointerType` rather than the device, so hybrid devices get both behaviours. A touch press's `contextmenu` is swallowed, since a long-press means select.
- The sidebar tree has no touch selection.

## Sidebar

`sidebar/sidebar.tsx` holds the selection through `hooks/use-tree-selection.ts`, keyed by `folderKey`.

- A plain click opens a folder; only Ctrl and Shift select without opening.
- Until then, and again after any navigation, the open folder alone counts as selected.
- Selected folders are always siblings, so a menu's `ActionContext` has one parent `folder`. A modifier click under another parent starts a new selection.
- Section rows are roots and never join a folder selection.
- Rows show the selection as a background and the open folder as accent text, since the two can differ.
