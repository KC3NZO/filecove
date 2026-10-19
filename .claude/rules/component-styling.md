---
paths:
  - "src/**/*.{ts,tsx}"
---

# Component styling

These apply to the component in `src/`, not to the playground.

## Responsiveness: container queries, not media queries

The component adapts to the box it is placed in, not the viewport. `src/styles/layout.ts` defines two named containers and their breakpoints:

- The root (`rootMedium`, `rootWide`). At `rootWide` (900px or wider) the sidebar docks; below it, the sidebar is an in-component overlay.
- The content view (`viewMedium`, `viewWide`), which decides which list columns show.

Use these constants as `sx` keys. Don't use `theme.breakpoints` or `useMediaQuery` inside the component. The one exception is `@media (hover: none)`, which detects a touch device rather than a size (it shows the header's Select button).

Dynamic geometry (tree depth, list column templates) goes through CSS custom properties set in `style`, so the `sx` objects stay static at module scope.

## Colors

Colors come only from palette tokens:

- `background.default` for the window and the sidebar.
- `background.paper` for the content panel.
- `primary` for selection, `text.primary` for hover and the zebra stripe, at strengths built on the `action` opacities.

Shared color helpers are in `src/styles/mixins.ts`: `hoverBackground`, `selectedBackground`, `selectedHoverBackground`, `stripeBackground`, `focusRing` and `dialogPaperSx`. They read `theme.vars` when present, so they work with or without CSS variables. Write new helpers the same way.

- Rows, tiles and tree rows take their hover and selection from these helpers, never from `action.hover` or `action.selected`. MUI's opacities (hover 0.04 and selected 0.08 in light mode) are tuned for menus, and over a striped white list a hovered row looked like a stripe. The helpers add a fixed boost to the theme's opacities (written as `"a + b"`, which `theme.alpha` sums with or without CSS variables), so a theme that changes them still moves them. A selected item under the pointer gets a step stronger.
- Dialogs use `dialogPaperSx`: the window's `background.default` with a `divider` outline, and no `backgroundImage`. MUI's elevated Paper lays a white overlay over it in dark mode that turns any dark background grey. A view inside a dialog, like the transfer picker's folder list, sits on `background.paper`, so a dialog is laid out like the window: chrome on default, view on paper.
- Dialog buttons other than the main action are `color="inherit"`, so only the one that does the work is accented.
- Menus still use MUI's Paper as it comes, overlay included.
