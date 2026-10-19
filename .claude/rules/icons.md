---
paths:
  - "src/components/icons/**"
  - "src/icon-sets/**"
  - "src/types/icon.ts"
  - "src/contexts/icon-context.ts"
  - "src/hooks/use-icon-config.ts"
  - "src/components/file-manager/icon-slot.tsx"
---

# Icons

Two packs are used, for different jobs:

- **`@mui/icons-material`** for UI and action icons (upload, delete, sort, view toggles...), rendered through `<Icon>`. When the component becomes a package this should be a `peerDependency` next to `@mui/material`.
- **`@react-symbols/icons`** for colored file and folder type icons, chosen by file or folder name. Import from the `@react-symbols/icons/utils` subpath. Its SVGs have no intrinsic width or height, so `FileTypeIcon` and `FolderTypeIcon` in `components/icons/file-icon.tsx` apply a default `size` of `1.5rem`. Render them through those wrappers rather than directly.

## Variants

The icon variant (`filled`, `outlined`, `rounded`, `sharp`, `twoTone`) is chosen by the consumer, not fixed.

- `types/icon.ts` defines:
  - `IconName`, the semantic names.
  - `IconSet = Record<IconName, IconComponent>`.
  - `IconSource`, either a name or any element, which is what sections and actions take.
- `icon-sets/<variant>.ts` maps every semantic name to that variant's MUI icon. `icon-sets/registry.ts` collects the sets into `iconSets`.
- `<IconProvider variant overrides>` sets the variant and per-icon replacements for a subtree, inheriting from a parent provider. It is exported from the package entry.
- `<Icon name variant?>` renders from that context, and its `variant` prop overrides the provider for that icon only.
- The context and its default variant, `outlined` (`DEFAULT_ICON_VARIANT`), are in `contexts/icon-context.ts`. Components read it with `useIconConfig` (`hooks/use-icon-config.ts`).

## Adding an icon

Add the name to `IconName`, then map it in **all five** `icon-sets/` variant files (`filled`, `outlined`, `rounded`, `sharp`, `two-tone`). The `IconSet` type makes the compiler reject a variant that is missing a name.
