# Text, languages and right to left

## The component's text

Everything the component shows or reads to screen readers is a key of `FileManagerLocaleText` (or `MediaManagerLocaleText` for the media manager). It ships in English only, as `enUS`. Pass `localeText` for another language or other wording; keys you leave out stay in English.

```tsx
import { FileManager } from "filecove";
import type { FileManagerLocaleText } from "filecove";

const localeText: Partial<FileManagerLocaleText> = {
    sidebarTitle: "Dateien",
    deleteDone: (count, name) => (count === 1 ? `„${name}“ gelöscht` : `${count} Elemente gelöscht`),
};

<FileManager localeText={localeText} /* ... */ />;
```

- **Start a translation from `enUS`**, which has every key: `import { enUS } from "filecove"`, copy it, and translate each value. TypeScript tells you the shape of each.
- **Texts about entries are functions**, so each language words and pluralizes its own way: counts come as numbers, a name as the entry's name for one entry.
- **Names, messages, sizes and dates come already isolated** (between Unicode FSI and PDI), so they keep their own direction in a sentence of any language. Don't isolate them again.
- **Keep the object stable.** A new object with the same strings is fine, but functions written inline are new each render and make every row render again. Define `localeText` outside your component, or memoize it.

Your own labels (sections, actions, the main menu, property labels from your adapter) are yours already, in whatever language your app uses, and aren't in `localeText`. So are error messages from your adapter, shown as they are.

## Formats

`locale` is the BCP 47 language tag numbers, sizes and dates are written in, and names are sorted and matched by:

```tsx
<FileManager locale="de-DE" /* ... */ />
```

The browser's language when left out. It changes no text; that's `localeText`. With `locale="ar-EG"`, digits and dates are Arabic; with `"de"`, sizes read "1,5 MB".

Names sort in natural order ("file 2" before "file 10"), case and accents aside, by the language's collation, so a language that counts "å" as a letter of its own keeps it apart from "a".

## Right to left

Set `dir="rtl"` on the page, or on any element around the component:

```html
<html dir="rtl">
```

That's all. There's no provider, theme direction or RTL plugin to set up. The styles use logical properties and follow the element's direction: the sidebar docks on the right, the tree indents from the right, back and forward arrows are mirrored, Left and Right swap, menus open the other way. Menus, dialogs and tooltips, which open outside the component, take its direction too.

The component's stylesheets are static files, so an RTL plugin of your app's (such as `stylis-plugin-rtl`) never sees them, and nothing is flipped twice.

A page that sets `direction: rtl` in CSS without the `dir` attribute gets the keys and menus right but not the mirrored styles: use `dir`.

Names in any script show correctly in both directions: a Latin name on a right-to-left page keeps its extension at its end, and an Arabic name in a left-to-right list reads right to left.

## The media manager

`MediaManager` and `MediaPicker` take `localeText` (a `Partial<MediaManagerLocaleText>`) and `locale` the same way. `MediaManagerLocaleText` holds the media manager's own keys, named `media…`, and the few it shares with the file manager. `enUS` has the keys of both.

Text inside your forms, properties and previewers is yours, in your app's language.
