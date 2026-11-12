# Customizing

filecove brings its own look, scoped to its roots and what they open (menus, dialogs, tooltips), and asks for no theme provider or global reset. There are five ways to change it, from lightest to heaviest:

1. **Custom properties** (`--fm-*`): colours, the corner radius, the font, the layers. Covers most needs.
2. **Stable class names** (`fm-…`, `fmClasses`): aim CSS at a part.
3. **`slotProps`**: put your own attributes, such as utility classes or test ids, on a part.
4. **`slots`**: draw a part yourself, such as the empty folder state.
5. **Icons**: another Material style, or your own.

## Custom properties

Set any `--fm-*` property on the component or anything above it, `:root` included. Every one you leave out keeps its default.

```css
:root {
    --fm-primary: #6d28d9;
    --fm-primary-hover: #5b21b6;
    --fm-radius: 10px;
    --fm-font-family: "Inter", sans-serif;
}
```

| Property | What it colours or sets |
|---|---|
| `--fm-primary`, `--fm-primary-hover`, `--fm-primary-contrast` | selection, focus rings, the main button; text drawn on it |
| `--fm-error`, `--fm-error-hover`, `--fm-error-contrast` | errors, destructive actions |
| `--fm-success`, `--fm-success-contrast` | finished tasks |
| `--fm-text`, `--fm-text-secondary`, `--fm-text-disabled` | text |
| `--fm-background` | the window, the sidebar, dialogs |
| `--fm-surface` | the content panel, a view inside a dialog |
| `--fm-menu` | menus |
| `--fm-divider` | rules and outlines |
| `--fm-icon` | icons and icon buttons at rest |
| `--fm-hover`, `--fm-pressed` | buttons, menu items and fields hovered and pressed |
| `--fm-disabled`, `--fm-disabled-background` | disabled controls |
| `--fm-field-border`, `--fm-chip` | text fields' borders, chips |
| `--fm-row-stripe`, `--fm-row-hover`, `--fm-row-selected`, `--fm-row-selected-hover`, `--fm-row-arrived` | rows, tiles and tree rows; `arrived` is the tint on something just uploaded |
| `--fm-backdrop` | behind overlays and dialogs |
| `--fm-tooltip`, `--fm-tooltip-text` | tooltips |
| `--fm-notice`, `--fm-notice-text` | the notice over the content ("Renamed … · Undo") |
| `--fm-radius` | the corner radius, one step that parts take a few of |
| `--fm-font-family` | the font; the page's own when left out |
| `--fm-shadow-1`, `-2`, `-3`, `-6`, `-8`, `-24` | shadows, by elevation |
| `--fm-z-popup`, `--fm-z-tooltip` | the z-index of menus and dialogs (1300) and tooltips (1500), to fit your own layers |

What portals out of the component (menus, dialogs, tooltips) hangs from `<body>`, so it only gets values set on `:root` or `<body>`, not ones set on the component's own element. To theme everything, set them on `:root`.

### Light and dark

The defaults follow the element's `color-scheme`, through CSS `light-dark()`:

```css
:root { color-scheme: light dark; } /* follows the system */
.dark-panel { color-scheme: dark; } /* always dark inside */
```

Without a `color-scheme`, it's light. Your own values can use `light-dark()` too:

```css
:root {
    --fm-surface: light-dark(#ffffff, #1e1e2e);
    --fm-background: light-dark(#f4f4f5, #181825);
}
```

### Sizing the root

The root fills its container, 100% wide and high. Give the container a height. Its layout follows its own width, not the viewport's (container queries): the sidebar docks from 900px wide, the properties panel from 1100px.

## The two stylesheets

- **`filecove/styles.css`**, the default, has no cascade layer, so your app's resets and element rules (`* { margin: 0 }`, `button { ... }`) can't break the component. A rule of yours aimed at a part wins when your stylesheet loads after it, or with one more class.
- **`filecove/styles.layer.css`** is the same inside `@layer fm`, for an app that orders its styles by layers. Declare the order, and any rule of yours in a later layer wins whatever its selector:

```css
@layer reset, fm, app;
@import "filecove/styles.layer.css";
```

Import one, once.

## Stable class names

The component's own class names are hashed and change between versions. Each part you'd aim at also carries a stable name, `fm-…`, exported as `fmClasses` if you'd rather not write strings:

```css
.fm-file-manager .fm-list-row { font-size: 0.9375rem; }
.fm-sidebar { border-inline-end: 1px solid var(--fm-divider); }
.fm-button[data-variant="contained"] { text-transform: uppercase; }
```

```ts
import { fmClasses } from "filecove";
fmClasses.listRow; // "fm-list-row"
```

Named parts include the roots (`fm-file-manager`, `fm-media-manager`, `fm-media-picker`), the regions (`fm-sidebar`, `fm-tree`, `fm-header`, `fm-path-bar`, `fm-content`, `fm-list`, `fm-grid`, `fm-properties`, `fm-preview`), the rows and tiles (`fm-list-row`, `fm-grid-tile`, `fm-tree-row`, `fm-media-option`), entries' names and icons (`fm-entry-name`, `fm-entry-icon`), the empty and error states (`fm-state`), the panels (`fm-upload-panel`, `fm-download-panel`, `fm-transfer-panel`, `fm-task-row`), each dialog (`fm-dialog` plus `fm-name-dialog`, `fm-delete-dialog`...), and the building blocks wherever they're used (`fm-button`, `fm-icon-button`, `fm-menu`, `fm-menu-item`, `fm-text-field`, `fm-chip`, `fm-icon`, `fm-tooltip`). `fmClasses` has them all, each with a doc comment.

**States are attributes, not classes**: `[aria-selected="true"]`, `[data-selected="true"]`, `[data-highlighted]` on a menu item, `[data-disabled]`, `[data-column="size"]` on the list's cells, `[data-kind="folder"]` on a tree row.

The layout boxes between parts have no stable names, on purpose, so the layout can still change. Use custom properties first, and stable names for what they don't cover.

## `slotProps`: attributes on parts

`slotProps` puts attributes of your own on the component's parts: utility classes, `data-testid`, handlers.

```tsx
<FileManager
    slotProps={{
        content: { "data-testid": "file-content" },
        sidebar: { className: "border-e" },
        entry: ({ entry, selected }) => ({
            className: entry.name.startsWith(".") ? "italic" : undefined,
        }),
    }}
    /* ... */
/>
```

| Key | `FileManager` | `MediaManager` | `MediaPicker` |
|---|---|---|---|
| `sidebar`, `content`, `properties` | yes | | |
| `header` | yes | yes | yes |
| `libraries` | | yes | |
| `chosen` | | yes | yes |
| `entry` (each row and tile), `asset` (each asset) | `entry` | `asset` | `asset` |

The part's own attributes win (its `role`, `tabIndex`, `aria-*`), so keyboard and screen reader support keep working. Your `className` is added after the part's own, your `style` goes under its own, and a handler the part has too runs yours first, then its own unless yours called `preventDefault`.

`entry` and `asset` take an object for every row, or a function of each. Keep that function outside your component, or memoized: a new one each render redraws every row.

The root itself takes its attributes directly, as props.

## `slots`: parts of your own

`slots` draws your own component where the file manager's would be:

| Slot | Shown | Props |
|---|---|---|
| `empty` | the open folder shows nothing, or the trash is empty | `section`, `location`, `folder`, `trash`, `context` (the folder's `ActionContext`) |
| `noResults` | a search found nothing | `query`, `scope` |
| `error` | the open folder couldn't be listed | `section`, `location`, `folder`, `error`, `retry` |
| `loading` | nothing to show yet | `label`, to name a spinner by |
| `noSections` | there's no section | none |
| `sidebarFooter` | under the sidebar's tree | `section`, `location` (or `null`) |

```tsx
import type { FileManagerEmptyProps, FileManagerSlots } from "filecove";

// Defined outside your component, so React keeps it mounted.
function EmptyFolder({ context, trash }: FileManagerEmptyProps) {
    if (trash) return <p>Nothing in the trash.</p>;

    return (
        <div className="empty">
            <p>This folder is empty.</p>
            {context?.upload && (
                <button
                    onClick={(event) => {
                        event.stopPropagation(); // or the click reaches the folder and clears the selection
                        context.upload?.();
                    }}
                >
                    Upload files
                </button>
            )}
        </div>
    );
}

const slots: FileManagerSlots = { empty: EmptyFolder };

<FileManager slots={slots} /* ... */ />;
```

- The states are drawn **inside** the component's own box, which keeps its role (`alert` for an error) and what it's described by, so they need nothing extra for screen readers.
- **Define slot components outside your own component.** One made while rendering is a new component every time, which React mounts afresh, losing its state.
- A button in a state should call `event.stopPropagation()` on click, as the folder's empty space takes clicks as clearing the selection.

`MediaManager` and `MediaPicker` take `empty` (with the header's `upload`), `noResults`, `error` and `loading`, and `MediaManager` `noSections` too.

## Icons

The UI's icons are Material Icons, drawn by filecove's own code, in five styles. Outlined is the default; the others are imported separately so your app ships only the one it uses:

```tsx
import { IconProvider } from "filecove";
import { roundedIcons } from "filecove/icons/rounded"; // or filled, outlined, sharp, two-tone

<IconProvider icons={roundedIcons}>
    <FileManager /* ... */ />
</IconProvider>;
```

Replace single icons with `overrides`, any component taking an `svg`'s props, from any icon library:

```tsx
import { Trash2 } from "lucide-react";

<IconProvider overrides={{ delete: Trash2 }}>...</IconProvider>
```

Or give a whole set of your own as `icons` (an `IconSet`, a component for every `IconName`).

Sections, actions and main menu items take an icon name (`"home"`, `"upload"`, `"share"`...) or any element of your own, fitted to the same box:

```tsx
{ id: "drive", label: "Drive", icon: <MyDriveLogo />, rootId: "/" }
```

The coloured file and folder type icons, chosen by name, load as a separate chunk after the component mounts. `typeIcons={false}` keeps the plain icons and never loads them:

```tsx
<IconProvider typeIcons={false}>...</IconProvider>
```

Providers nest, each inheriting what it leaves out from the one above.
