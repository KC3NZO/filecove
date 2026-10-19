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
- `primary` with `action.selectedOpacity` for selection.

Shared color helpers are in `src/styles/mixins.ts` (`selectedBackground`, `stripeBackground`, `focusRing`). They read `theme.vars` when present, so they work with or without CSS variables. Write new helpers the same way.
