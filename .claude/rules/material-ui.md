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
