---
paths:
  - "src/components/icons/**"
  - "src/icon-sets/**"
  - "src/types/icon.ts"
  - "src/contexts/icon-context.ts"
  - "src/hooks/use-icon-config.ts"
  - "src/hooks/use-type-icons.ts"
  - "src/components/ui/root-providers.tsx"
---

# Icons

Two kinds, for different jobs:

- **UI and action icons** (upload, delete, sort, view toggles...) are Material Icons drawn by our own code, rendered through `<Icon>`. There's no icon package: each icon's shapes are copied from Material Icons, as Google publishes them under the Apache License 2.0, into `icon-sets/`, and drawn by `createIcon` (`components/icons/create-icon.tsx`) as an `svg` on a 24 by 24 grid. Material Icons and Emotion came out with MUI on 2026-11-11, the user choosing to keep the same icons as our own SVGs. `THIRD_PARTY_NOTICES.md` at the root names the source and holds the Apache License's text, and each style file's header points to it; it has to ship in the package (see the roadmap's packaging).
- **`@react-symbols/icons`** for colored file and folder type icons, chosen by file or folder name, loaded on its own after the component mounts (see "The coloured file and folder icons"). Render them through `FileTypeIcon` and `FolderTypeIcon` (`components/icons/file-icon.tsx`), never directly.

## The coloured file and folder icons

`@react-symbols/icons/utils` picks an icon from a name while the app runs, so a bundler can't tell which are needed and keeps them all: measured 2026-11-12 at 540 KB minified, about 210 KB gzipped, a third of the playground's bundle. So it's never imported statically: `hooks/use-type-icons.ts` loads it with a dynamic `import()`, once for the page, and an app's bundler makes it a chunk of its own (the library build leaves the `import()` for it, the package being a dependency).

- **When it loads.** Each root starts it as it mounts (`usePreloadTypeIcons` in `RootProviders`, which `FileManager`, `MediaManager` and `MediaPicker` wrap their parts in), so it comes while the first listing does, usually before anything shows an icon. A part drawn outside a root (`MediaTile`, `MediaRow`, `MediaPicture`) starts it by drawing one (`useTypeIcons` calls the preload too).
- **Meanwhile**, and for good with `typeIcons` off, `FileTypeIcon` and `FolderTypeIcon` draw the icon set's own `file`, `folder` or `folderOpen` through `Icon`, in `--_fm-icon` (`.plain` in `icon.module.css`), sized by `style` to the same `size`. Once the module comes, `useSyncExternalStore` swaps every icon to its coloured one at once.
- **A failed load** (offline, a chunk gone with a new deploy) leaves the plain icons, and the next root or icon to mount tries again.
- **Server rendering** draws the plain icons, as does hydration (`getServerSnapshot` returns nothing), the coloured ones coming after it.
- **Turning it off**: `<IconProvider typeIcons={false}>` keeps the plain icons and never loads the module, for an app whose look is monochrome, or that won't fetch more. The playground's `?plainIcons`.
- Its SVGs have no intrinsic width or height, so the wrappers apply a default `size` of `1.5rem`.

## The Material icons' styles

The icons' style (Filled, Outlined, Rounded, Sharp, Two-tone) is the consumer's to choose, by importing it: each is a module of its own, so an app ships only the ones it imports, where a style chosen by name would ship all five, as the bundler can't know which. Outlined is the default, imported by the entry; the others cost nothing unless imported. Decided 2026-11-12, before the first release, as it changed `IconProvider`'s `variant` (a name) to `icons` (a set).

- `types/icon.ts` defines:
  - `IconName`, the semantic names.
  - `IconComponent`, any component taking an `svg`'s props (`ComponentType<SVGProps<SVGSVGElement>>`), which is what a consumer's override is: an icon of any library that takes `className`, or an `svg` of their own.
  - `IconSource`, either a name or any element, which is what sections and actions take.
  - `IconSet = Record<IconName, IconComponent>`, public, which a style is, and what `IconProvider`'s `icons` takes, so an app can give a whole set of its own.
- `icon-sets/<style>.ts` exports `<style>Icons` (`filledIcons`, `outlinedIcons`, `roundedIcons`, `sharpIcons`, `twoToneIcons`), mapping every semantic name to that style's shapes, each `createIcon(...shapes)`: a path's `d`, or a path or a circle with a fainter `opacity` (the two-tone style's second tone) or holes cut by the even-odd rule (`IconShape`). Each is an entry of the library build, `dist/icon-sets/<style>.js`, which `package.json` exports as `icons/<style>` (see `packaging.md`). Nothing gathers them in one module, which would bring them all back into every app.
- `<IconProvider icons overrides typeIcons>` sets the set, per-icon replacements and whether files and folders get the coloured icons, for a subtree, each inheriting from a parent provider when left out. It is exported from the package entry. The playground's `?icons=rounded` gives it a style.
- `<Icon name fontSize? label?>` renders from that context. `fontSize` is `medium` (1.5rem), `small` (1.25rem) or `inherit` (the text around it). It's drawn only (`aria-hidden`) unless it has a `label`, which makes it an `img` named by it, with a `<title>`. Its size and its mirroring are classes (`icon.module.css`), its own `className` after them, so a consumer's icon needs nothing but an `svg`'s props.
- The context and its defaults, `outlinedIcons` and `typeIcons` on, are in `contexts/icon-context.ts`. Components read it with `useIconConfig` (`hooks/use-icon-config.ts`).

`IconSlot` (`components/icons/icon-slot.tsx`) renders an `IconSource` in a 1.25rem box: a name through `Icon`, or the consumer's element fitted to it, for sections, actions and main menu items wherever they show.

The kit's checkbox and radio marks (`components/ui/checkbox.tsx`) are drawn from Material's shapes the same way, and the playground has the few icons it needs of its own (`playground/icons.tsx`).

## Mirrored right to left

`Icon` mirrors the names in `MIRRORED` on a right-to-left page (`scale: -1 1` under `:dir(rtl)`): back and forward, the chevrons, `move` and `selectMode`, the icons that point the way the text runs, and a consumer's overrides of them too. A new icon with a direction to it goes in that set; `rotateLeft` and `rotateRight` (counterclockwise and clockwise) don't, as a turn is the same either way. See `rtl.md`.

## Adding an icon

Add the name to `IconName`, then add its shapes to **all five** `icon-sets/` style files (`filled`, `outlined`, `rounded`, `sharp`, `two-tone`), each from that style of the Material icon (Google's `material-design-icons` repository has every one's SVG, and `@mui/icons-material`'s source the same paths, which can be read without installing it). The `IconSet` type makes the compiler reject a style that is missing a name. Copy the shapes as they are, opacity and fill rule included, and keep the set's alphabetical order.
