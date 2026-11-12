---
paths:
  - "src/**/*.{ts,tsx,css}"
---

# Component styling

These apply to the component in `src/`, not to the playground. How styles are written (CSS Modules, the kit, the stylesheets' order) is in `ui-kit.md`.

## Responsiveness: container queries, not media queries

The component adapts to the box it is placed in, not the viewport. Each root is a named container, and the stylesheets query it as written, `@container file-manager (min-width: 900px)`, since CSS can't read a name from JS. `src/styles/layout.ts` and `src/styles/media-layout.ts` hold the names and breakpoints, and the names the docs and comments use for them:

| Container | Breakpoint | Name | What changes |
|---|---|---|---|
| `file-manager` (the root) | 600px | `rootMedium` | the path bar moves between the header's buttons |
| | 900px | `rootWide` | the sidebar docks, as wide as the user made it, unless it's hidden (`data-hidden`, with the frame's `data-sidebar-hidden` giving the panels back their margin on its side), and the content keeps 540px beside it; below it, the sidebar is an overlay |
| | 1100px | `rootExtraWide` | the properties dock on the content's other side while shown (`data-shown`), the content keeping its 540px, the properties then the sidebar giving way first (see "Resizing the docked panels" in `file-manager.md`); below it, they're an overlay too (see `properties.md`) |
| `file-manager-view` (the content view) | 540px | `viewMedium` | the list's size and date columns |
| | 760px | `viewWide` | every column |
| `file-manager-preview-header` | 480px, 640px | `previewHeaderMedium`, `previewHeaderWide` | the preview's counter, then its actions as buttons |
| `file-manager-preview-image` | 360px | `previewImageWide` | the zoom's percentage between its buttons |
| `media-manager` | 720px, 1040px | `mediaMedium`, `mediaWide` | the libraries dock, then the selected column |
| `media-asset` | 680px | `assetWide` | the asset view's details beside its picture |

The preview portals out of the root, where its queries don't reach, so its header and its image are containers of their own (see `preview.md`). A breakpoint changed in one stylesheet is changed in every stylesheet querying it, and in this table.

Don't use media queries for sizes, nor read the viewport in JS. The one exception is `@media (hover: none)`, which detects a touch device rather than a size (it shows the header's Select button). What JS needs to know of a container's decision it reads from the computed style, as `overlays()` reads the sidebar's `position`.

## Right to left: logical properties

Styles use logical properties (`inset-inline`, `padding-inline-start`, `margin-inline-start`, `text-align: end`), never `left`, `right`, `margin-left` or `text-align: right`, so they follow the page's `dir` and a consumer needs only `dir`. Nothing flips our stylesheets: they're static files, which no RTL plugin of a consumer's sees. What differs right to left goes under `:dir(rtl)`, and geometry measured on the screen stays physical in `style`. See `rtl.md`.

## Dynamic geometry

Dynamic geometry (tree depth, list column templates, the docked sidebar's and properties' widths, the zoom's sizes, a media library's tile width and shape) goes through CSS custom properties set in `style` (`--depth`, `--icon-size`, `--column`, `--sidebar-width`, `--properties-width`, `--tile-min`, `--ratio`), which the stylesheet reads, so the stylesheet stays static. Geometry worked out in JS from measurements, such as where a virtualized entry sits (`top`, `gridColumn`) or how tall its listbox is, goes in `style` as plain properties.

## Theming

The component brings its own look and asks for no theme provider: an app changes it with CSS custom properties. `styles/theme.module.css` is where they're defined.

- **Public** custom properties, `--fm-*` (`--fm-primary`, `--fm-background`, `--fm-surface`, `--fm-text`, `--fm-divider`, `--fm-radius`, `--fm-font-family`, `--fm-z-popup`...), are the app's to set, on the component or anything above it, `:root` included. Every one it leaves out takes the default.
- **Private** ones, `--_fm-*`, are what styles read. The `.theme` class works each out from its public one or its default (`--_fm-primary: var(--fm-primary, light-dark(#1976d2, #90caf9))`). A default declared on the component itself would hide an app's value set above it, which is why styles never read `--fm-*`.
- **`.theme` goes on each root** (`FileManager`, `MediaManager`, `MediaPicker`, with `.root`, the root's own type and colour) **and on whatever portals out of one**: the menus, the dialogs and the tooltips (the kit adds it), and the drag image. So an app's values set on `:root` or `<body>` reach them all, and values set on the component reach what's inside it.
- **Light and dark** follow the element's `color-scheme`, through `light-dark()`: a page with `color-scheme: light dark` follows the system, one with `dark` on an element gets a dark component inside it, and without either it's light.
- **Parts read only `--_fm-*` tokens**, never a colour written out, so an app's theme reaches everything. A new colour is a new pair in `theme.module.css` (the public one and the private one, with light and dark defaults), and a new public one is described there.
- The theme sets `box-sizing: border-box` inside the component, weightless (`:where`), whatever the page's reset does.
- The tokens:
  - `--_fm-background` for the window, the sidebar and dialogs, `--_fm-surface` for the content panel and a view inside a dialog, `--_fm-menu` for menus, a step lighter than the surface in the dark, where a shadow doesn't show.
  - `--_fm-primary` for selection, focus and the main button, `--_fm-error` and `--_fm-success`, each with `-contrast` for what's drawn on it, the first two with `-hover`.
  - `--_fm-text`, `--_fm-text-secondary`, `--_fm-text-disabled`, `--_fm-icon`, `--_fm-divider`, `--_fm-field-border`, `--_fm-chip`.
  - `--_fm-hover`, `--_fm-pressed`, `--_fm-disabled`, `--_fm-disabled-background` for buttons, menu items and fields.
  - `--_fm-row-stripe`, `--_fm-row-hover`, `--_fm-row-selected`, `--_fm-row-selected-hover`, `--_fm-row-arrived` for rows, tiles and tree rows (see "Colors").
  - `--_fm-backdrop`, `--_fm-tooltip` and `--_fm-tooltip-text`, `--_fm-notice` and `--_fm-notice-text`, `--_fm-radius` (one step; parts take a few), `--_fm-shadow-1` to `--_fm-shadow-24`, `--_fm-font-family` (the page's own unless the app names one), `--_fm-z-popup` and `--_fm-z-tooltip`.
- The playground sets its GNOME-like colours as `--app-*` on `:root`, and the public `--fm-*` from them (`playground/styles/theme.css`), as an app would.

## Stable class names

The stylesheets' class names are hashed and change from build to build, so an app can't aim at a part by them. Each part an app would point at carries a stable class name too, `fm-…`, from `fmClasses` (`styles/classes.ts`, public, exported from `src/index.ts`, as MUI exports `buttonClasses`), which carry no style of their own. Added 2026-11-12, the user's choice, as the first of three ways to customise (the cascade layer built as `styles.layer.css`, `slots` waiting for an app to ask).

- **What's named**: the roots (`fm-file-manager`, `fm-media-manager`, `fm-media-picker`, `fm-media-picture`), the regions (sidebar, tree, header, path bar, content, list, grid, panels, properties, preview, the media manager's libraries, grid, asset view and chosen column), the rows and tiles (`fm-list-row`, `fm-grid-tile`, `fm-tree-row`, `fm-media-option`, `fm-task-row`...), entries' names and icons, the states in a view's place (`fm-state`), each dialog by its own name beside `fm-dialog`, and the kit's pieces (`fm-button`, `fm-menu-item`, `fm-text-field`, `fm-icon`...), wherever they're used. The list is `classes.ts`, each name with a comment saying what it is and the attributes it carries.
- **Not named**: the boxes that lay a part out, so the layout can still change; a part's look keeps being changed through the `--fm-*` custom properties first.
- **States are attributes, not classes**, as the kit's are (see `ui-kit.md`): `[data-selected="true"]`, `[data-highlighted]`, `[aria-selected="true"]`. For the names, a few attributes were added: `data-variant` and `data-color` on `Button`, `data-error` on `TextField`, `data-kind` (`section` or `folder`) on a tree row, and `data-column` on the list's cells and headers (`name`, `location`, `size`, `type`, `modified`).
- **In code**: a part takes its name from `fmClasses`, never written out, beside its own class: `cx(styles.row, fmClasses.listRow)`; the kit puts its name first, the part's `className` last. A part taking an app's `className` (the roots, `MediaTile`, `MediaRow`) puts its name before the app's.
- **They're public API**: a name isn't renamed or taken away, nor moved to another part, without a major version. A new part an app would point at gets one, added to `classes.ts` with its comment.
- **How strong they are**: an app's `.fm-list-row` is one class, as strong as the row's own, so it wins only when its stylesheet loads after the component's, or with one more class or attribute (`.fm-file-manager .fm-list-row`). The package also ships its stylesheet in a layer (`styles.layer.css`, in `@layer fm`), for an app using layers, whose rules then win with any selector; the default stays unlayered, as an app's unlayered reset or element rules would beat a layered one (see "The stylesheets" in `packaging.md`).

## Colors

- Rows, tiles and tree rows take their hover and selection from the row tokens, never from `--_fm-hover`, which is tuned for buttons and menus: over a striped list a hovered row looked like a stripe. The row tokens mix the text colour or the accent in at fixed strengths (`color-mix()`), stronger in the dark, so an app's colours still move them. A selected item under the pointer gets a step stronger.
- The markers rows share are classes of `styles/entry.module.css` (imported as `marks`), each keyed off a `data-` attribute the element sets, put on the element beside its own class:
  - `marks.cut`, keyed off `data-cut`: the contents fade to 0.45 and a dashed `--_fm-text-secondary` outline traces it. Only the children fade, so hover and selection backgrounds stay as strong.
  - `marks.moving`, keyed off `data-moving`, for entries a move under way is moving or the trash's work holds: their contents fade to 0.45 as cut ones do, without the outline, and the pointer over them is `progress`, until the move ends (see "While a move runs" in `transfers.md`). Opacity survives forced colors, so it needs no rule there.
  - `marks.arrived`, keyed off `data-arrived` and `data-found`, set for `ARRIVED_FOR` (2.5 s, `styles/arrived.ts`, which the animation lasts): a `--_fm-row-arrived` tint, held and then faded out by a keyframes animation, drawn as an inset box shadow, so it lies over the row's own stripe, hover or selection and under its contents (see "Showing what arrived" in `uploads.md` and "Find in page" in `virtualization.md`).
  - `marks.focusRing`: keyboard focus is a 2px `--_fm-primary` outline inside the edge, on `:focus-visible`, on list rows and grid tiles, and on a tree row while its `treeitem` is focused. It wins over the cut outline, and a drop target wins over it. `ButtonBase` and the kit's buttons draw the same ring themselves.
  - `marks.drag`, keyed off `data-dragged` and `data-drop-target`: dragged entries fade as cut ones do, and the drop target folder gets `--_fm-row-selected-hover` inside a 2px `--_fm-primary` outline. Its selector repeats the class, so it wins over hover, selection and the cut outline.
  - `marks.forcedSelected`, the selection under forced colors (see below).
- A folder nothing can be put in shows a lock on a `--_fm-surface` disc at its icon's bottom end corner (`LockedIcon`, `components/icons/locked-icon.tsx`), in `--_fm-text-secondary`, hidden while the content's or the tree's touch selection mode puts its check badge (`CheckBadge`) there (see "Permissions" in `file-manager.md`).
- The open folder taking a drop on its empty space is shown by the content panel in `file-manager.tsx`, not by the folder view: the panel doesn't scroll, the view inside it does, and while the folder view has `data-drop-target` (found with `:has()`), the panel's `::after` lays a 2px `--_fm-primary` border over it. So the outline stays put as the folder scrolls, and the sticky column header doesn't cover it.
- Dialogs (the kit's `Dialog`) take the window's `--_fm-background` with a `--_fm-divider` outline, so their edge shows against a dark backdrop where a shadow doesn't. A view inside a dialog, like the transfer picker's folder list, sits on `--_fm-surface`, so a dialog is laid out like the window: chrome on the background, view on the surface.
- Dialog buttons other than the main action are `color="inherit"`, so only the one that does the work is accented.
- Menus take `--_fm-menu` with a shadow.
- The notice over the content (`notice-bar.tsx`, see `undo.md`) takes `--_fm-notice` and `--_fm-notice-text`, dark in the light and light in the dark, its buttons `inherit`.
- Text only screen readers read takes `util.visuallyHidden` (`styles/util.module.css`).

## Stacking

What overlays the frame stacks with small `z-index`es inside the root: the overlays' backdrop at 1, the overlay sidebar and the properties' overlay at 2. The content column is its own stacking context (`isolation: isolate`), so what stacks inside it (the list's sticky column header, the progress and selection bars, the notice) stays under the backdrop. What portals out takes `--_fm-z-popup` (dialogs and menus, 1300) and `--_fm-z-tooltip` (1500), and a touch drag's image one more than that, which an app can change to fit its own layers.

## Forced colors (Windows High Contrast)

Windows' High Contrast themes, and any forced colors mode, drop background colours and box shadows and put the user's colours in place of text, border and outline colours, but keep system colours an author sets. So outlines and borders still show (focus rings, the cut and drop outlines, the marquee's border, dialogs' edges), but anything a background or shadow alone shows would vanish. Those take system colours under `@media (forced-colors: active)`, nested in the rule they override or after it:

- Selected list rows, grid tiles and tree rows take `Highlight` with `HighlightText` (`marks.forcedSelected`), as a native list shows a selection; the text inside inherits it. The tree's open folder takes `Highlight` text, under the selection.
- Pressed toggle buttons, the search buttons and Select, take `Highlight`, and so does the open search tab's underline. The highlighted menu item takes `Highlight` with `HighlightText`.
- Rows and tiles just uploaded or found, whose tint is a shadow, take a 2px `Highlight` outline while they're highlighted (`marks.arrived`).
- Progress bars fill with `Highlight` (the kit's `LinearProgress`).
- Menus, tooltips and the notice over the content get a 1px `CanvasText` outline, where their shadow and background set them apart.
- Hover shows nothing for now. Chrome's DevTools emulate it (Rendering, "Emulate CSS media feature forced-colors").

A new state shown by a background or a shadow alone needs its own rule under forced colors.

## Browsers

The stylesheets use native nesting, container queries, `:has()`, `:dir()`, `color-mix()` and `light-dark()`, the last setting the floor: Chrome 123, Safari 17.5, Firefox 120.
