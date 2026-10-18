---
paths: 
	- "src/**/*.{ts,tsx}"
	- "playground/**/*.{ts,tsx}"
---

# Material UL Styling

- Define static MUI `sx` style objects at module scope, outside React component functions.

- Define `sx` object with type safes, like `SxProps` and `Theme`.

- When an `sx` object depends on props, state, or other render-time values, consider the performance too, for instance `useMemo` or any other way that suits best.

- Consider the performance in importing components, for 		instance use `import Box from "@mui/material/Box";` style and don't import them directly from `@mui/material` if it's possible.

