# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A client-side file manager React component built with React 19, TypeScript, Vite 8 and Material UI (`@mui/material` 9.x). It will later be extracted and published as a package, so write components with that in mind: self-contained, with no app-specific assumptions baked in. The Vite app in `src/` is the development host for the component.

**Pigment CSS is not used, and will not be.** The repo name mentions it, but styling runs on MUI's default Emotion runtime (`@emotion/react`, `@emotion/styled`). Do not add `@mui/material-pigment-css` or its Vite plugin, and do not write Pigment-style (`css`, `styled` from Pigment) code.

The project began from the Vite React-TS template and the default scaffolding has been removed.

## Commands

The package manager is **Bun** (`bun.lock`).

- `bun run dev` starts the Vite dev server.
- `bun run build` runs `tsc -b && vite build`. This is the only type-check; Vite itself does not type-check.
- `bun run lint` runs `oxlint` (not ESLint).
- `bun run preview` serves the production build.

There is no test runner configured.

## Architecture

- `index.html` loads `src/main.tsx`, which mounts `<App />` from `src/components/main/app.tsx` inside `StrictMode`.
- `src/components/styles/theme.ts` is where the MUI theme lives. It is currently an empty `createTheme({})`.
- `src/components/main/theme.tsx` is a `Theme` wrapper component: `ThemeProvider` plus `CssBaseline` around `children`.
- **The `Theme` wrapper is not mounted anywhere yet.** `main.tsx` renders `<App />` directly and `App` is an empty `<div>`. To get the theme applied, wrap the tree in `Theme`.

Components live under `src/components/<area>/` (`main/` for the app shell, `styles/` for the theme). File names are lowercase.

Because the code is headed for a package, the theme is the part to watch. A published component shouldn't force a global `CssBaseline` or its own `ThemeProvider` on consumers, so keep those in the host app wrapper and keep the component itself theme-agnostic.

## Conventions

- **MUI styling rules** are in `.claude/rules/material-ui.md` and load automatically for `src/**/*.{ts,tsx}`. They cover module-scope `sx` objects typed with `SxProps<Theme>`, memoizing `sx` that depends on render-time values, and per-component imports like `@mui/material/Box` instead of the barrel import. `src/components/main/theme.tsx` currently imports `CssBaseline` from the barrel, which goes against that rule.
- Code in `src/` uses 4-space indentation, double quotes, and semicolons. The template-generated config files use 2 spaces and single quotes. Match the file you're editing.
- `tsconfig.app.json` is strict about a few things that commonly trip up edits:
  - `verbatimModuleSyntax`: type-only imports must use `import type`.
  - `erasableSyntaxOnly`: no `enum`, `namespace`, or constructor parameter properties.
  - `noUnusedLocals` and `noUnusedParameters` are errors in `bun run build`.
- Oxlint runs the `react`, `typescript` and `oxc` plugins with `react/rules-of-hooks` as an error and `react/only-export-components` as a warning. Type-aware linting is off.

## Repo settings

`.claude/settings.json` denies `git push` and requires confirmation for `git commit` and `rm`.
