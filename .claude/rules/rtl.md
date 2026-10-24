---
paths:
  - "src/utils/dom.ts"
  - "src/utils/bidi.ts"
  - "src/utils/menu-position.ts"
  - "src/types/menu.ts"
  - "src/styles/direction.ts"
  - "src/hooks/use-text-direction.ts"
  - "src/contexts/direction-context.ts"
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
  - "src/hooks/use-transfer.ts"
  - "src/hooks/use-entry-drag.ts"
  - "src/hooks/use-marquee.ts"
  - "playground/options.ts"
  - "playground/theme.tsx"
  - "playground/mocks/mock-data.tsx"
---

# Right to left

The file manager runs right to left when the page, or an element above it, has `dir="rtl"`, and **that is all a consumer has to do**. It asks for no theme `direction`, no Emotion cache and no `stylis-plugin-rtl`: its styles follow the element's direction, and its code reads it with `isRtl` (`utils/dom.ts`, the computed `direction`). A consumer whose app already has MUI's full right-to-left setup gets the same result, with nothing flipped twice.

That takes more than logical properties in our own styles, because MUI's components inside the file manager still use physical left and right and rely on the plugin to flip them. Where we use such a component, we override the physical style (see "MUI's own left and right").

A `dir` on an element around the file manager alone is enough too, in either direction. What it portals to `<body>`, the menus, the dialogs, the tooltips and the drag image, takes the file manager's direction as its own `dir`: `useTextDirection` (`hooks/use-text-direction.ts`) reads it from the root before it's painted, and again whenever a `dir` anywhere in the page changes (a `MutationObserver`), and `DirectionContext` hands it to them. Outside a `FileManager` the context is undefined, and they follow the page.

## Styles

- Logical properties only: `insetInline`, `insetInlineStart` and `End`, `paddingInlineStart`, `marginInlineStart`, `textAlign: "start"` and `"end"`, and flex and grid, which follow the direction. No `left`, `right`, `ml`, `pr` or `textAlign: "right"` in an `sx`, except to reset one of MUI's. MUI's spacing scale applies to the logical margins and paddings as it does to `ml` and `pl`. Symmetric `mx` and `px` are fine.
- Emotion's RTL plugin (cssjanus underneath), when a consumer has it, flips physical properties and values in every rule but those inside `@container`: left and right, `margin-left`, `translateX` and `translate()` in a `transform`, `direction`, `text-align: left`, four-value `margin` and `padding`, and a `box-shadow`'s x. It also swaps a `left` or `right` written as the value of a custom property, and flips the rules under `:dir(rtl)`. It leaves logical properties alone, lengths, percentages and degrees in custom properties, and the separate `translate`, `rotate` and `scale` properties. So our styles use only those where they differ right to left, and nothing is flipped twice.
- What differs right to left goes under `&:dir(rtl)`, as custom properties of lengths, percentages or degrees (the overlay sidebar's and the properties' overlay's `--closed-shift`, the tree chevrons' `--chevron-turn`, the name field's `--label-shift` and `--label-origin`), or `scale`, `rotate` and `translate`. `:dir()` follows the `dir` attribute, not a `direction` set in CSS.
- Geometry measured on the screen stays physical, in the inline `style`, which the plugin never sees: the marquee's box (`useMarquee`), the zoomed or turned image's place (`image-viewer.tsx`), the swipe's and the slide's `translateX` (`use-swipe.ts`), and a touch drag's image (`useEntryDrag`).

## MUI's own left and right

A MUI component's physical style is overridden where we use it, by resetting the physical property and then setting the logical one after it. That order works with and without the plugin: the plugin turns the reset into its mirror image, and the logical property is not flipped. `styles/direction.ts` holds the overrides several parts share; the rest sit with the one part that needs them.

- `DialogActions` spaces its buttons with a `margin-left` (`dialogActionsSx`, in every dialog with buttons at the bottom).
- A menu's labels without an icon are inset by a `padding-left` of `MenuItem`'s on `ListItemText` (`insetLabelSx`, in the context menu's `itemSx` and on the view menu's "Show properties" while it opens the overlay, which has to match MUI's descendant selector to win).
- `ListItem` and `ListItemButton` align their text with `text-align: left`; the picker's rows set `start` (`itemSx` and `rowSx` in `transfer-dialog.tsx`).
- The name field's outlined label is placed by `left`, a pixel shift and `transform-origin: top left`, and the border's notch and the error text are aligned with `text-align: left`. `fieldSx` in `name-dialog.tsx` places the label by `inset-inline-start` and two custom properties, and aligns the other two to the start.
- `LinearProgress` fills by the theme's `direction`, not the page's, so the upload and download rows' bars (`panelBarSx`) and the refresh bar over the content are mirrored with `scale` under `:dir(rtl)` (`mirroredBarSx`), unless the theme already says right to left. `CircularProgress` isn't mirrored, as a clock isn't.
- `Menu` and its `Popover` default to the theme's `direction` for the side they open towards, so both menus pass their own origins (see "What mirrors").

To use a MUI component not used yet, read its source in `node_modules/@mui/material` for `left`, `right`, `margin-left`, `padding-left`, `text-align`, `translateX`, `transform-origin` and `useRtl`, and override what shows with a prop or content we use. A prop we don't use (`startIcon`, `edge`, `inset` dividers, a `Button`'s start or end `loadingPosition`) needs nothing until it is.

## What mirrors

- The sidebar docks on the right, and its overlay slides in from the right. The tree indents from the right, with its chevrons and guide lines on the right and the section toggles on the left.
- The properties dock on the left, and their overlay slides in from the left (`--closed-shift`, as the sidebar's).
- Icons that point the way the text runs are mirrored in `Icon` (`MIRRORED`): back and forward, the chevrons, `move` and `selectMode`, as Material mirrors them (it has `DriveFileMoveRtl` and `ChecklistRtl`). A consumer's overrides of those names are mirrored too. Mirroring is `scale: -1 1` under `:dir(rtl)`, so the tree's chevrons still turn with `rotate`, the other way round (`--chevron-turn`), to point down.
- The path bar reads from the root on the right. Its scroller is a reversed flex row, which lines the track up with its end and starts scrolled there, so a long path shows its last folders either way, with no `direction` trick, which would have turned the path round.
- The list's dates and its Modified header align to the end, and the grid's columns fill from the right (`useVirtualLines` reads them mirrored for the marquee).
- The tabs over a search everywhere's results run from the right, as a flex row does, with Left and Right swapped (`isRtl` on the strip). They're built of `ButtonBase`s rather than MUI's `Tabs`, whose indicator and scroll buttons go by the theme's direction.
- Menus open from their anchor's start side and grow leftwards (`MenuPosition.rtl`, set in `menu-position.ts`), and the view menu, the sidebar's main menu, the search field's sections menu and the "More actions" menus of the preview's and the properties' headers (`ToolbarActions`) hang from their button's end edge.
- The keyboard shortcuts window swaps the keys for back and forward, and for expanding and collapsing, as the keys themselves swap. Its keys' cells are `dir="auto"`, so Latin key names run left to right on a right-to-left page, as "Ctrl+F" is written there, and a translation's own key names run its way. They go by the element's direction rather than the theme's, which MUI's `Menu` follows by default.
- The drag image is held by its top right corner (`useEntryDrag`), and its stack of cards fans out down and to the left. A touch drag's sits above the finger on its left, placed physically through its inline `transform` from the viewport's left (`TOUCH_STYLE` in `drag-preview.tsx`), as measured geometry is.
- Left and Right swap in the content, the tree and the preview, and so do Alt+Left and Alt+Right for back and forward, as the arrows on the buttons are mirrored. A swipe to the right steps to the next file, and a file stepped to by a button or a key slides in from the left (see `keyboard.md` and `preview.md`). An image zoomed in the preview pans the way the arrow points, either way, since it's a picture, not text, and a swipe takes over at whichever edge it reaches.
- What doesn't mirror, by design: the preview's turn buttons and R and Shift+R, since clockwise is the same either way, and its players' controls, the browser's own, whose timeline runs left to right on a right-to-left page too, as Material's guidance on bidirectionality has playback controls. A font's specimen and the text preview run each line the way its own letters do.

## Text running both ways

Text that comes from outside the sentence or line around it can be in any script, whatever the page's language: names, an adapter's or a server's message, a consumer's shortcut, and sizes, dates and numbers formatted in the `locale`. So it's isolated from what's around it and takes its own direction from its first strong letter. Otherwise ".bashrc" shows as "bashrc." right to left, a name ending in brackets loses them to the wrong end, an English "Permission denied." puts its full stop first, and Latin-digit pieces joined on a right-to-left page read in the wrong order.

- On their own, in `<bdi>`: names in the list, the grid, tree rows, path bar segments, the preview's title, the picker's rows, upload and download rows, the properties' name and the drag image; the message of a folder that couldn't be listed; the shortcuts in the context menu; and in the properties, the values the panel formats (dates, lengths, the backend's numbers and sizes), the backend's own values, tags and links, and the adapter's messages. The block around keeps the page's direction, so a Latin name still lines up on the right right to left, and a long one is cut short at its start, keeping its extension.
- In a string, between FSI and PDI (`isolate`, `utils/bidi.ts`): every name, message or formatted value the component hands a text of `FileManagerLocaleText` (sizes and dates included, and the server's status text), and an adapter's message shown as a failure (`useTransfer`, the name and delete dialogs, the picker, the preview, the upload and download rows). Translations don't have to isolate them.
- Joins written in code isolate each piece (`joinIsolated`), so they're laid out the way the page runs: the list's size and date, the preview's details, its dimensions and its "3 / 12", the upload rows' status and folder, and the properties' dimensions and location.
- The name field (`name-dialog.tsx`) is `dir="auto"`, and the text preview is `unicode-bidi: plaintext`, so each line runs and lines up as its own letters do, as in a text editor.

## The playground

`?rtl` sets only `dir="rtl"` on `<html>`, which is all the file manager asks of a page, so it shows how it looks without the theme's `direction` or the plugin. `?rtl=mui` also sets up the page as MUI's guide does, with the theme's `direction` and an Emotion cache with `stylis-plugin-rtl` (`playground/theme.tsx`), to check that a consumer with those gets the same result and nothing is flipped twice. `?locale=ar-EG` sets the `locale` prop, for Arabic digits and dates, with or without `?rtl` (`?rtl&locale=he`). The text stays English (see `locale.md`). The switches are read in `playground/options.ts`. Website's `مستندات` ("Documents") folder holds names in Arabic and Hebrew, mixed with Latin, and starting or ending with brackets, to see the isolation in the tree, the path bar, the views, the dialogs and the preview, both ways.

## Limits

- `:dir()` needs Chrome 120, Safari 16.4 or Firefox 49. It follows the `dir` attribute, so a page that sets `direction: rtl` in CSS without `dir` gets keys and menus right but not the mirrored styles.
- A menu taller than the window, which scrolls: MUI's `MenuList` pads the side of its scrollbar by the theme's `direction`, so without it the padding goes on the wrong side. Fixing it would mean depending on `@mui/system` directly for its `RtlProvider`.
- No right-to-left translation is shipped; a consumer gives one as `localeText` (see `locale.md`).
