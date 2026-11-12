---
paths:
  - "src/utils/dom.ts"
  - "src/utils/bidi.ts"
  - "src/utils/menu-position.ts"
  - "src/types/menu.ts"
  - "src/hooks/use-text-direction.ts"
  - "src/contexts/direction-context.ts"
  - "src/components/ui/**"
  - "src/components/file-manager/file-manager.tsx"
  - "src/components/icons/icon.tsx"
  - "src/components/file-manager/header-bar/**"
  - "src/components/file-manager/context-menu/**"
  - "src/components/file-manager/sidebar/**"
  - "src/components/file-manager/drag-preview.tsx"
  - "src/components/file-manager/dialogs/**"
  - "src/components/file-manager/content/folder-view.tsx"
  - "src/components/file-manager/content/file-list.tsx"
  - "src/components/uploads/upload-panel.tsx"
  - "src/components/transfers/transfer-panel.tsx"
  - "src/hooks/use-entry-drag.ts"
  - "src/hooks/use-marquee.ts"
  - "playground/options.ts"
  - "playground/theme.ts"
  - "playground/mocks/mock-data.tsx"
---

# Right to left

The file manager runs right to left when the page, or an element above it, has `dir="rtl"`, and **that is all a consumer has to do**. It asks for no provider, no theme `direction` and no RTL plugin: its styles follow the element's direction, and its code reads it with `isRtl` (`utils/dom.ts`, the computed `direction`). Its stylesheets are static files, so a consumer's own RTL plugin, such as Emotion's `stylis-plugin-rtl` in an app on MUI, never sees them, and nothing is flipped twice.

A `dir` on an element around the file manager alone is enough too, in either direction. What it portals to `<body>`, the menus, the dialogs, the tooltips and the drag image, takes the file manager's direction as its own `dir`: `useTextDirection` (`hooks/use-text-direction.ts`) reads it from the root before it's painted, and again whenever a `dir` anywhere in the page changes (a `MutationObserver`), and `RootProviders` hands it on, through `DirectionContext` to our parts and through Base UI's `DirectionProvider` to Base UI's, whose keys and sides follow it. Outside a root the context is undefined, and they follow the page.

## Styles

- Logical properties only: `inset-inline`, `inset-inline-start` and `-end`, `padding-inline-start`, `margin-inline-start`, `text-align: start` and `end`, and flex and grid, which follow the direction. No `left`, `right`, `margin-left`, `padding-right` or `text-align: right`. Symmetric `padding-inline` and `margin-inline` are fine. That goes for the kit (`components/ui/`) as for every part, so there's nothing of a library's to override: the outlined field's label and notch, a chip's ✕, a button's start icon and the notice's buttons are all placed logically.
- What differs right to left goes under `:dir(rtl)`, as custom properties (the overlay sidebar's, the properties' overlay's and the media manager's libraries' `--closed-shift`, the tree chevrons' `--chevron-turn`), or the separate `scale`, `rotate` and `translate` properties, so a part's `transform` stays its own. `:dir()` follows the `dir` attribute, not a `direction` set in CSS.
- Geometry measured on the screen stays physical, in the inline `style`: the marquee's box (`useMarquee`), the zoomed or turned image's place (`image-viewer.tsx`), the swipe's and the slide's `translateX` (`use-swipe.ts`), and a touch drag's image (`useEntryDrag`).
- The progress bars fill from the start side: the kit's `LinearProgress` is mirrored with `scale` under `:dir(rtl)`, in the transfer, upload and download rows and over the content. `CircularProgress` isn't mirrored, as a clock isn't.
- Base UI's menus, tooltips and dialogs are placed by Base UI, which reads the direction it's given (`dir` on the menu's positioner, `DirectionProvider`) to tell start from end. A Base UI component added to the kit needs its direction passed the same way.

## What mirrors

- The sidebar docks on the right, and its overlay slides in from the right. Its edge is on its left (`inset-inline-end`), widening it as it's dragged left, and Left and Right on it swap so it moves the way the arrow points, as the properties' do. The tree indents from the right, with its chevrons and guide lines on the right and the section toggles on the left.
- The properties dock on the left, and their overlay slides in from the left (`--closed-shift`, as the sidebar's). Their edge is on their right (`inset-inline-start`), widening them as it's dragged right, and Left and Right on it swap so it moves the way the arrow points; a drag is measured on the screen from the pointer's `clientX`, the way read with `isRtl`.
- Icons that point the way the text runs are mirrored in `Icon` (`MIRRORED`): back and forward, the chevrons, `move` and `selectMode`, as Material mirrors them (it has `DriveFileMoveRtl` and `ChecklistRtl`). A consumer's overrides of those names are mirrored too. Mirroring is `scale: -1 1` under `:dir(rtl)`, so the tree's chevrons still turn with `rotate`, the other way round (`--chevron-turn`), to point down.
- The path bar reads from the root on the right. Its scroller is a reversed flex row, which lines the track up with its end and starts scrolled there, so a long path shows its last folders either way, with no `direction` trick, which would have turned the path round.
- The list's dates and its Modified header align to the end, and the grid's columns fill from the right (`useVirtualLines` reads them mirrored for the marquee).
- The tabs over a search everywhere's results run from the right, as a flex row does, with Left and Right swapped (`isRtl` on the strip).
- Menus open from their anchor's start side and grow leftwards: a menu at a point (a right-click, the Menu key) is told the direction of the part it was opened in (`MenuPosition.rtl`, set in `menu-position.ts`, the kit `Menu`'s `rtl`), and one under a button lines up with the button's start or end edge (`align`). The view menu, the sidebar's main menu, the search field's sections menu and the "More actions" menus of the preview's and the properties' headers (`ToolbarActions`) hang from their button's end edge.
- The keyboard shortcuts window swaps the keys for back and forward, and for expanding and collapsing, as the keys themselves swap. Its keys' cells are `dir="auto"`, so Latin key names run left to right on a right-to-left page, as "Ctrl+F" is written there, and a translation's own key names run its way.
- The drag image is held by its top right corner (`useEntryDrag`), and its stack of cards fans out down and to the left. A touch drag's sits above the finger on its left, placed physically through its inline `transform` from the viewport's left (`TOUCH_STYLE` in `drag-preview.tsx`), as measured geometry is.
- Left and Right swap in the content, the tree and the preview, and so do Alt+Left and Alt+Right for back and forward, as the arrows on the buttons are mirrored. A swipe to the right steps to the next file, and a file stepped to by a button or a key slides in from the left (see `keyboard.md` and `preview.md`). An image zoomed in the preview pans the way the arrow points, either way, since it's a picture, not text, and a swipe takes over at whichever edge it reaches.
- What doesn't mirror, by design: the preview's turn buttons and R and Shift+R, since clockwise is the same either way, and its players' controls, the browser's own, whose timeline runs left to right on a right-to-left page too, as Material's guidance on bidirectionality has playback controls. A font's specimen and the text preview run each line the way its own letters do.

## Text running both ways

Text that comes from outside the sentence or line around it can be in any script, whatever the page's language: names, an adapter's or a server's message, a consumer's shortcut, and sizes, dates and numbers formatted in the `locale`. So it's isolated from what's around it and takes its own direction from its first strong letter. Otherwise ".bashrc" shows as "bashrc." right to left, a name ending in brackets loses them to the wrong end, an English "Permission denied." puts its full stop first, "3 items" reads "items 3", and Latin-digit pieces joined on a right-to-left page read in the wrong order.

- On their own, in `<bdi>`: names in the list, the grid, tree rows and the picker's rows (drawn by `DrawnName` where the browser's find looks in hidden text, its span `unicode-bidi: plaintext`, which isolates it and takes its direction from its first strong letter as `<bdi>` does; see "Find in page" in `virtualization.md`), the list's size and date columns, path bar segments, the preview's title, transfer, upload and download rows, the properties' name and the drag image; the message of a folder that couldn't be listed; the shortcuts in the context menu; and in the properties, the values the panel formats (dates, lengths, the backend's numbers and sizes), the backend's own values, tags and links, and the adapter's messages. The block around keeps the page's direction, so a Latin name still lines up on the right right to left, and a long one is cut short at its start, keeping its extension.
- In a string, between FSI and PDI (`isolate`, `utils/bidi.ts`): every name, message or formatted value the component hands a text of `FileManagerLocaleText` (sizes and dates included, and the server's status text), and an adapter's message shown as a failure (the name and delete dialogs, the picker, the preview, the transfer, upload and download rows). Translations don't have to isolate them.
- Joins written in code isolate each piece (`joinIsolated`), so they're laid out the way the page runs: the list's size and date under the name in a narrow list, the preview's details, its dimensions and its "3 / 12", the upload rows' status and folder, and the properties' dimensions and location.
- A value shown alone in its own cell or line, as the list's size and date columns are, goes in `<bdi>`: an `isolate` inside it, around a number, doesn't set the direction of the whole.
- The name field (`name-dialog.tsx`) is `dir="auto"`, and the text preview is `unicode-bidi: plaintext`, so each line runs and lines up as its own letters do, as in a text editor.
- The path field (`header-bar/path-field.tsx`) runs what's typed as its own letters do, as the search field does (`unicode-bidi: plaintext`, in `styles/header-field.module.css`), so "/Website/مستندات" reads each name its way, and the names in its messages are isolated (`pathProblemText`). Its message hangs under it by `inset-inline`.

## The playground

`?rtl` sets only `dir="rtl"` on `<html>` (`playground/theme.ts`), which is all the file manager asks of a page, so it shows how it looks with nothing else set up. `?locale=ar-EG` sets the `locale` prop, for Arabic digits and dates, with or without `?rtl` (`?rtl&locale=he`). The text stays English (see `locale.md`). The switches are read in `playground/options.ts`. Website's `مستندات` ("Documents") folder holds names in Arabic and Hebrew, mixed with Latin, and starting or ending with brackets, to see the isolation in the tree, the path bar, the views, the dialogs and the preview, both ways.

## Limits

- `:dir()` needs Chrome 120, Safari 16.4 or Firefox 49. It follows the `dir` attribute, so a page that sets `direction: rtl` in CSS without `dir` gets keys and menus right but not the mirrored styles.
- No right-to-left translation is shipped; a consumer gives one as `localeText` (see `locale.md`).
