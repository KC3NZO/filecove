---
paths:
  - "src/components/icons/**"
  - "src/icon-sets/**"
  - "src/types/icon.ts"
  - "src/contexts/icon-context.ts"
  - "src/hooks/use-icon-config.ts"
---

# Icons

Two kinds, for different jobs:

- **UI and action icons** (upload, delete, sort, view toggles...) are Material Icons drawn by our own code, rendered through `<Icon>`. There's no icon package: each icon's shapes are copied from Material Icons, as Google publishes them under the Apache License 2.0, into `icon-sets/`, and drawn by `createIcon` (`components/icons/create-icon.tsx`) as an `svg` on a 24 by 24 grid. Material Icons and Emotion came out with MUI on 2026-11-11, the user choosing to keep the same icons as our own SVGs. `THIRD_PARTY_NOTICES.md` at the root names the source and holds the Apache License's text, and each variant file's header points to it; it has to ship in the package (see the roadmap's packaging).
- **`@react-symbols/icons`** for colored file and folder type icons, chosen by file or folder name. Import from the `@react-symbols/icons/utils` subpath. Its SVGs have no intrinsic width or height, so `FileTypeIcon` and `FolderTypeIcon` in `components/icons/file-icon.tsx` apply a default `size` of `1.5rem`. Render them through those wrappers rather than directly.

## Variants

The icon variant (`filled`, `outlined`, `rounded`, `sharp`, `twoTone`) is chosen by the consumer, not fixed.

- `types/icon.ts` defines:
  - `IconName`, the semantic names.
  - `IconComponent`, any component taking an `svg`'s props (`ComponentType<SVGProps<SVGSVGElement>>`), which is what a consumer's override is: an icon of any library that takes `className`, or an `svg` of their own.
  - `IconSet = Record<IconName, IconComponent>`.
  - `IconSource`, either a name or any element, which is what sections and actions take.
- `icon-sets/<variant>.ts` maps every semantic name to that variant's shapes, each `createIcon(...shapes)`: a path's `d`, or a path or a circle with a fainter `opacity` (the two-tone variant's second tone) or holes cut by the even-odd rule (`IconShape`). `icon-sets/registry.ts` collects the sets into `iconSets`.
- `<IconProvider variant overrides>` sets the variant and per-icon replacements for a subtree, inheriting from a parent provider. It is exported from the package entry.
- `<Icon name variant? fontSize? label?>` renders from that context, and its `variant` prop overrides the provider for that icon only. `fontSize` is `medium` (1.5rem), `small` (1.25rem) or `inherit` (the text around it). It's drawn only (`aria-hidden`) unless it has a `label`, which makes it an `img` named by it, with a `<title>`. Its size and its mirroring are classes (`icon.module.css`), its own `className` after them, so a consumer's icon needs nothing but an `svg`'s props.
- The context and its default variant, `outlined` (`DEFAULT_ICON_VARIANT`), are in `contexts/icon-context.ts`. Components read it with `useIconConfig` (`hooks/use-icon-config.ts`).

`IconSlot` (`components/icons/icon-slot.tsx`) renders an `IconSource` in a 1.25rem box: a name through `Icon`, or the consumer's element fitted to it, for sections, actions and main menu items wherever they show.

The kit's checkbox and radio marks (`components/ui/checkbox.tsx`) are drawn from Material's shapes the same way, and the playground has the few icons it needs of its own (`playground/icons.tsx`).

## Mirrored right to left

`Icon` mirrors the names in `MIRRORED` on a right-to-left page (`scale: -1 1` under `:dir(rtl)`): back and forward, the chevrons, `move` and `selectMode`, the icons that point the way the text runs, and a consumer's overrides of them too. A new icon with a direction to it goes in that set; `rotateLeft` and `rotateRight` (counterclockwise and clockwise) don't, as a turn is the same either way. See `rtl.md`.

## Adding an icon

Add the name to `IconName`, then add its shapes to **all five** `icon-sets/` variant files (`filled`, `outlined`, `rounded`, `sharp`, `two-tone`), each from that variant of the Material icon (Google's `material-design-icons` repository has every one's SVG, and `@mui/icons-material`'s source the same paths, which can be read without installing it). The `IconSet` type makes the compiler reject a variant that is missing a name. Copy the shapes as they are, opacity and fill rule included, and keep the set's alphabetical order.
