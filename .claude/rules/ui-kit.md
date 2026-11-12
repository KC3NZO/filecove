---
paths:
  - "src/**/*.{ts,tsx,css}"
  - "playground/**/*.{ts,tsx,css}"
---

# The UI kit and its styles

The component has no styling runtime and no design-system dependency. Its only UI library is **Base UI** (`@base-ui/react`), unstyled and accessible, used behind a small kit of our own, and every style is a **CSS Module**. Material UI and Emotion were removed on 2026-11-11, as the user chose: don't add `@mui/*`, `@emotion/*`, `styled-components`, Tailwind or any other styling library or CSS-in-JS, and don't bring back `sx`, `ThemeProvider` or `CssBaseline`.

## The kit

`src/components/ui/` holds the building blocks every part uses. Parts import from it, never from `@base-ui/react` directly, so the behaviour Base UI gives (focus, keys, ARIA, placement) and the look we add stay in one place. Base UI is imported by its subpath (`@base-ui/react/menu`), never from the package root.

| Kit file | What it is | Built on |
|---|---|---|
| `menu.tsx` | `Menu` (under an `anchor` element or at a `position`, `align` start or end, `side` top or bottom, `rtl`, `onClose`, `onExited`), `MenuItem` (closes nothing itself; `role` `menuitemcheckbox` or `menuitemradio` with `checked`), `MenuIcon`, `MenuText` (`inset`, `secondary`, `noWrap`), `MenuShortcut`, `MenuDivider`, `MenuLabel` | Base UI `Menu` |
| `dialog.tsx` | `Dialog` (`open`, `dir`, `maxWidth`, `fullWidth`, `onClose(reason)` with `"escapeKeyDown"`, `"backdropClick"` or `"other"`, `onEntered`, `onExited`, `disableRestoreFocus`), `DialogTitle`, `DialogContent`, `DialogActions` | Base UI `Dialog` |
| `tooltip.tsx` | `Tooltip` and `TooltipProvider` (one group per root, so the next tooltip shows at once along a row of buttons) | Base UI `Tooltip` |
| `checkbox.tsx` | `Checkbox` (a real one, `onCheckedChange`), and `CheckMark` and `RadioMark`, drawn only, for menu items, which carry the role and the state | Base UI `Checkbox` |
| `root-providers.tsx` | `RootProviders`, what each root (`FileManager`, `MediaManager`, `MediaPicker`) wraps its parts in: `DirectionContext`, Base UI's `DirectionProvider` and a `TooltipProvider` | Base UI `DirectionProvider` |
| `button.tsx`, `button-base.tsx`, `icon-button.tsx` | `Button` (`variant` text, outlined or contained, `color`, `size`, `startIcon`), `ButtonBase` (a `button` with none of the browser's look, `type="button"` unless told), `IconButton` | plain elements |
| `text.tsx` | `Text` (`variant` body1, body2 or caption, `color` secondary, error or disabled, `noWrap`, `component`) | plain elements |
| `text-field.tsx` | `TextField`, outlined with its label on the edge (`label`, `helperText`, `error`, `multiline`, `select`, `inputProps`, `inputRef`) | plain elements |
| `circular-progress.tsx`, `linear-progress.tsx` | spinners and bars, `determinate` or not, the bar mirrored right to left and `Highlight` under forced colors | plain elements |
| `chip.tsx`, `link.tsx`, `divider.tsx`, `collapse.tsx`, `backdrop.tsx` | a pill (with `onRemove` it's a button), a link, a rule, a fold, the overlays' dim layer | plain elements |

- The kit's props are named after what parts need, not after MUI's, though several kept MUI's names where they fit (`variant`, `noWrap`, `onEntered`).
- Each kit piece carries its stable class name first (`fmClasses.button`, `fm-button`; see "Stable class names" in `component-styling.md`), so an app can restyle every button, menu item or field at once.
- What a menu, dialog or tooltip portals to `<body>` takes the theme's class (`theme.theme`) and the root's `dir` itself, so a part needs to pass nothing for them (see "Theming" in `component-styling.md` and `rtl.md`).
- Base UI marks state with data attributes, which the kit's stylesheets key off: `data-highlighted` on a menu item, `data-disabled`, `data-starting-style` and `data-ending-style` for the fade in and out. Parts mark their own state the same way (`data-selected`, `data-cut`, `data-open`...), not by swapping classes.
- To add a component Base UI has (a select, tabs, a slider...), wrap it in a kit file first, as the playground's own kit wraps Base UI's `Slider` and `Dialog` for itself.
- An icon-only button in `src/` is a `TooltipIconButton` (`components/buttons/tooltip-icon-button.tsx`), never a bare `IconButton`. Its `label` is both its `aria-label` and its tooltip, with an arrow, shown on hover or keyboard focus after 500 ms (at once while moving along a row of them), kept 8px from the viewport's edges (`collisionPadding`), in the file manager's direction (`DirectionContext`), and not while the button is disabled. It takes every other `IconButton` prop (`ref`, `className`, `aria-pressed`...). The one exception is the list rows' ⋮, which is `aria-hidden` and out of the tab order (see `keyboard.md`), so it doesn't put a tooltip on every row.

## CSS Modules

- Each component's styles are in a `.module.css` file beside it, named after it (`file-list.tsx`, `file-list.module.css`), imported as `styles`. Class names are camelCase (`styles.sizeCell`). A file's small parts share its stylesheet.
- Shared stylesheets are imported under a name of their own: `theme` (`styles/theme.module.css`, the theme's class and the root's type), `marks` (`styles/entry.module.css`, the rows' markers), `panel` (`styles/panel.module.css`, the upload, download and transfer panels), `headerField` (`styles/header-field.module.css`, the search and path fields' pill), `mediaLayout` (`styles/media-layout.module.css`) and `util` (`styles/util.module.css`, `visuallyHidden`).
- Class names are joined with `cx` (`utils/cx.ts`), which leaves out false, null and undefined. A kit component puts its own `className` prop last, so a part's class can change what the kit sets.
- Styles are static, in the stylesheet. A value known only while rendering goes in `style` as a custom property the stylesheet reads (`--depth`, `--icon-size`, `--tile-min`, `--ratio`, `--sidebar-width`), cast `as CSSProperties` where TypeScript wants it. Geometry measured on the screen goes in `style` as plain properties (see "Dynamic geometry" in `component-styling.md`).
- **Order decides between equal selectors.** A part's class and a kit class on one element are both one class strong, so whichever stylesheet loads later wins. Vite orders stylesheets by when their modules are first imported, so `src/index.ts` imports `styles/order.ts` before anything else, which imports the theme, the kit's stylesheets and the shared ones, so every part's own stylesheet comes after them. **A stylesheet other parts style over goes in `order.ts`.** A rule that must win over a part's own (the drop target over a row's hover) repeats its class to outweigh it (`.drag.drag.drag`).
- Native CSS nesting (`&`), container queries, `:dir()`, `:has()`, `light-dark()` and `color-mix()` are used as written; no preprocessor or PostCSS plugin is set up, and none is needed.
- Comments in a stylesheet say why, as in code.

## The playground

The playground styles itself the same way, with CSS Modules beside its files and `playground/styles/theme.css` for its page (see "Theming" in `component-styling.md`). It imports nothing from `src/` but the public entry, as an app would, so it has its own small kit in `playground/ui.tsx` (`Text`, `ButtonBase`, `Button`, `Chip`, `Link`, `TextField`, `Spinner`, `Dialog`, `Slider`, `Snackbar`, `cx`) and its own icons in `playground/icons.tsx`.
