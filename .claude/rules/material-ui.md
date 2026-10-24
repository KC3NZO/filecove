---
paths:
  - "src/**/*.{ts,tsx}"
  - "playground/**/*.{ts,tsx}"
---

# Material UI Styling

- Define static MUI `sx` style objects at module scope, outside React component functions.

- Type `sx` objects with `SxProps<Theme>`.

- When an `sx` object depends on props, state, or other render-time values, consider the performance too, for instance `useMemo` or any other way that suits best.

- Consider the performance in importing components, for instance use `import Box from "@mui/material/Box";` style and don't import them directly from `@mui/material` if it's possible.

- Import each icon by path (`import FolderOutlined from "@mui/icons-material/FolderOutlined";`), never from the `@mui/icons-material` barrel.

- An icon-only button in `src/` is a `TooltipIconButton` (`components/buttons/tooltip-icon-button.tsx`), never a bare `IconButton`. Its `label` is both its `aria-label` and its tooltip, with an arrow, shown on hover or keyboard focus after 500 ms (at once while moving along a row of them), kept 8px from the viewport's edges (Popper's `preventOverflow` padding, so the buttons at the screen's edges get a gap), in the file manager's direction (`DirectionContext`), and not while the button is disabled. It takes every other `IconButton` prop (`ref`, `sx`, `aria-pressed`...). The one exception is the list rows' ⋮, which is `aria-hidden` and out of the tab order (see `keyboard.md`), so it doesn't put a tooltip on every row.
