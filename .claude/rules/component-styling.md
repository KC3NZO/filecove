---
paths:
  - "src/**/*.{ts,tsx}"
---

# Component styling

These apply to the component in `src/`, not to the playground.

## Responsiveness: container queries, not media queries

The component adapts to the box it is placed in, not the viewport. `src/styles/layout.ts` defines two named containers and their breakpoints:

- The root (`rootMedium`, `rootWide`). At `rootWide` (900px or wider) the sidebar docks, unless it's hidden (`data-hidden`, with the frame's `data-sidebar-hidden` giving the panels back their margin on its side); below it, the sidebar is an in-component overlay.
- The content view (`viewMedium`, `viewWide`), which decides which list columns show.

Use these constants as `sx` keys. Don't use `theme.breakpoints` or `useMediaQuery` inside the component. The one exception is `@media (hover: none)`, which detects a touch device rather than a size (it shows the header's Select button).

## Right to left: logical properties

Styles use logical properties (`insetInline`, `paddingInlineStart`, `marginInlineStart`, `textAlign: "end"`), never `left`, `right`, `ml`, `pr` or `textAlign: "right"`, so they follow the page's `dir` with Emotion's RTL plugin or without it, and a consumer needs only `dir`. What differs right to left goes under `&:dir(rtl)` as a value the plugin doesn't flip, MUI components' physical left and right are overridden where we use them (`styles/direction.ts`), and geometry measured on the screen stays physical in `style`. See `rtl.md`.

## Dynamic geometry

Dynamic geometry (tree depth, list column templates) goes through CSS custom properties set in `style`, so the `sx` objects stay static at module scope. Geometry worked out in JS from measurements, such as where a virtualized entry sits (`top`, `gridColumn`) or how tall its listbox is, goes in `style` as plain properties.

## Colors

Colors come only from palette tokens:

- `background.default` for the window and the sidebar.
- `background.paper` for the content panel.
- `primary` for selection, `text.primary` for hover and the zebra stripe, at strengths built on the `action` opacities.

Shared color helpers are in `src/styles/mixins.ts`: `hoverBackground`, `selectedBackground`, `selectedHoverBackground`, `stripeBackground`, `focusRing`, `focusVisibleRing`, `focusOutline`, `cutMarker`, `arrivedMarker`, `dragMarkers`, `dialogPaperSx` and `menuPaperSx`, the forced colors helpers below, and `visuallyHiddenSx` for text only screen readers read. They read `theme.vars` when present, so they work with or without CSS variables. Write new helpers the same way.

- Rows, tiles and tree rows take their hover and selection from these helpers, never from `action.hover` or `action.selected`. MUI's opacities (hover 0.04 and selected 0.08 in light mode) are tuned for menus, and over a striped white list a hovered row looked like a stripe. The helpers add a fixed boost to the theme's opacities (written as `"a + b"`, which `theme.alpha` sums with or without CSS variables), so a theme that changes them still moves them. A selected item under the pointer gets a step stronger.
- Cut entries take `cutMarker`, keyed off `data-cut`: their contents fade to 0.45 and a dashed `text.secondary` outline traces them. Only the children fade, so hover and selection backgrounds stay as strong.
- Entries just uploaded take `arrivedMarker`, keyed off `data-arrived`, which the folder view sets for `ARRIVED_FOR` (2.5 s): a `primary` tint, held and then faded out by a keyframes animation, drawn as an inset box shadow, so it lies over the row's own stripe, hover or selection and under its contents, rather than replacing its background. It's spread after `cutMarker` (see "Showing what arrived" in `uploads.md`).
- Keyboard focus is a 2px `primary` outline inside the edge (`focusOutline`): `focusRing` for ButtonBase (`.Mui-focusVisible`), `focusVisibleRing` for list rows and grid tiles (`:focus-visible`), and on a tree row while its `treeitem` is focused. It's spread after `cutMarker` and before `dragMarkers`, so it wins over the cut outline and a drop target wins over it.
- `dragMarkers(theme)` is keyed off `data-dragged` and `data-drop-target`: dragged entries fade as cut ones do, and the drop target folder gets the selected-hover background inside a 2px `primary` outline. It's spread last in the `sx` of a list row, grid tile or tree row, after `cutMarker`, so the drop target wins over hover, selection and the cut outline at equal specificity.
- The open folder taking a drop on its empty space is shown by the content panel in `file-manager.tsx`, not by the folder view: the panel doesn't scroll, the view inside it does, and while the folder view has `data-drop-target` (found with `:has()`), the panel's `::after` lays a 2px `primary` border over it. So the outline stays put as the folder scrolls, and the sticky column header doesn't cover it.
- Dialogs use `dialogPaperSx`: the window's `background.default` with a `divider` outline, and no `backgroundImage`. MUI's elevated Paper lays a white overlay over it in dark mode that turns any dark background grey. A view inside a dialog, like the transfer picker's folder list, sits on `background.paper`, so a dialog is laid out like the window: chrome on default, view on paper.
- Dialog buttons other than the main action are `color="inherit"`, so only the one that does the work is accented.
- Menus still use MUI's Paper as it comes, overlay included.

## Forced colors (Windows High Contrast)

Windows' High Contrast themes, and any forced colors mode, drop background colours and box shadows and put the user's colours in place of text, border and outline colours, but keep system colours an author sets. So outlines and borders still show (focus rings, the cut and drop outlines, the marquee's border, dialogs' edges), but anything a background or shadow alone shows would vanish. Those take system colours under `forcedColors` (`@media (forced-colors: active)`, `styles/mixins.ts`), a key that goes last in an `sx` object, after the rules it overrides:

- Selected list rows, grid tiles and tree rows take `Highlight` with `HighlightText` (`forcedSelected`), as a native list shows a selection; the text inside inherits it. The tree's open folder takes `Highlight` text, under the selection.
- Pressed toggle buttons, the search buttons and Select, take `Highlight` (`forcedPressed`), and so does the open search tab's underline.
- Rows and tiles just uploaded, whose tint is a shadow, take a 2px `Highlight` outline while they're highlighted (`forcedArrived`).
- `LinearProgress` fills take `Highlight` (`forcedBarSx`, in the content's, the search results' and the panels' bars).
- Menus (`menuPaperSx`, shared by the four menus) and tooltips get a 1px `CanvasText` outline (`forcedEdge`), where their shadow and background set them apart.
- Hover shows nothing for now. Chrome's DevTools emulate it (Rendering, "Emulate CSS media feature forced-colors").

A new state shown by a background or a shadow alone needs its own rule under `forcedColors`.
