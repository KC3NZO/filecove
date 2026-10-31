---
paths:
  - "src/types/locale.ts"
  - "src/locales/**"
  - "src/utils/format.ts"
  - "src/hooks/use-locale.ts"
  - "src/contexts/locale-context.ts"
  - "src/components/file-manager/file-manager.tsx"
  - "src/components/uploads/upload-panel.tsx"
  - "src/components/properties/**"
---

# Text and locale

Every text the component shows or reads to screen readers comes from `FileManagerLocaleText` (`types/locale.ts`, public), never from a string in a component. Section and action labels and `title` are the consumer's already, so they aren't in it. Two props set it:

- **`localeText`** (`Partial<FileManagerLocaleText>`) gives another language or other wording. Keys left out, or given as undefined, stay in English. `enUS` (`locales/en-us.ts`, exported) has every key, as the place to start a translation from.
- **`locale`** (a BCP 47 tag) is the language numbers, sizes and dates are written in, and names are sorted and matched by. The browser's language when omitted. It changes no text.

The component ships no translations but English. A translation is a value for `localeText`, so ones made later need no change to the API.

## The keys

- Flat, so a consumer overrides one without restating the rest, and named by area (`sort…`, `upload…`, `download…`, `preview…`).
- A text about entries is a function, so each language words and pluralizes it its own way: counts come as plain numbers, `name` is the entry's name for when `count` is 1, `kind` is "file" or "folder". A text built around a value the component formats, such as a size or a date, takes it already formatted, as a string.
- Whole sentences rather than pieces glued together, since word order differs between languages. The only joins left in code are " · " between details, "×" in dimensions, "/" in the preview's counter, " / " between the folders of a search result's location and of the path of what failed in a folder uploaded, ": " before an adapter's message in the picker and before why an undo or redo did nothing in its announcement, ". " between the tree's `folderLoadFailed` and `retry` in its row's label, in keyboard shortcuts "+" between keys pressed together and "/" between alternatives, ":" between the hours, minutes and seconds of a length (`formatDuration`), and " / " between the folders of a location in the properties.
- Keys are named by the text (`keyCtrl`, `keyShift`, `keyEnter`... "Strg" in German), through `keyLabel` (`utils/shortcut.ts`), in the keyboard shortcuts window and the main menu's own item. Arrows show as arrows, and letters, digits and F-keys as they are. The consumer's shortcuts are shown as written in the menus, since the string is also what's matched, and with their keys named by the text in the shortcuts window. `showHiddenFilesShortcut` predates the key names and stays a whole string.
- `UploadLocaleText`, `DownloadLocaleText`, `TransferLocaleText` and `PropertiesLocaleText` hold the upload, download, copy and move, and properties panels' keys, which `FileManagerLocaleText` extends, since the panels are meant for the media manager too (see `uploads.md`, `download.md`, `transfers.md` and `properties.md`). `UploadLocaleText` also has `keptBothName`, which the upload queue names folders with, as the upload check does. They share no keys: each panel has its own close and its own "Try again", the download and transfer panels their own `downloadItems` and `transferItems` for "3 items", and the properties panel its own `propertiesItems` and `propertiesMoreActions`, the preview's header having `moreActions`. The properties panel's labels for the backend's own fields come from the adapter, in the consumer's language, as action labels do.
- `previewFontCharacters` and `previewFontSample` are what a font's specimen shows, in the language's own script, so a translation gives its own letters, digits and sentence rather than translating the English pangram word for word.
- Messages that only a developer sees (an adapter missing a method, a list handing back its cursor, a component outside `FileManager`) stay in English.
- An adapter's own error message is shown as it is. A text such as `deleteFailed` or `uploadFailed` is only for when it gives none.
- A name, an adapter's or server's message, or a size or date handed to a text comes isolated between FSI and PDI (`isolate`), so it keeps its own direction in a sentence in any language, and a translation doesn't isolate it again. The joins in code isolate their pieces (`joinIsolated`) (see `rtl.md`).
- `MediaManagerLocaleText` (public) is `MediaManager`'s `localeText`: its own keys, named `media…`, the properties panel's, and the few of `FileManagerLocaleText`'s it shows too (`loading`, `tryAgain`, `itemCount`, the type labels), so a translation of it covers everything it shows. `enUS` holds every key of both (`LocaleText`, internal), and `Locale.text` is that, so a shared part reads its keys whichever component provides the locale (see `media-manager.md`).

Adding a text means adding its key to the interface, with a comment when its use isn't plain from the name, and to `enUS`.

## How the parts get it

`FileManager`, and `MediaManager` alike, builds a `Locale` (`types/locale.ts`, internal) with `createLocale` (`utils/format.ts`) and provides it through `LocaleContext`. Parts read it with `useLocale()`: `text`, every key filled in, and the formats and comparisons that follow `locale`.

- `formatSize` writes bytes in decimal units through `Intl.NumberFormat`'s `unit` style, so units are in the locale's own words too ("1,5 ko" in French): "byte" in full below 1 kB, then kilobytes up to terabytes, short.
- `formatNumber` writes digits in the locale's script without grouping, for dimensions and counters; `formatCount` grouped ("12,345"), for a number among the backend's properties; `formatPercent` the image viewer's zoom.
- `formatBytes` writes bytes exactly, grouped, with the unit in the locale's words ("4,213,045 bytes"), beside a size in the properties; `formatDate` a date and time in full (medium date, short time), for the properties, where the list's `describeDate` is short; `formatDay` a day without its time (medium date), for a property the app defines as a `date`; `formatList` values one after another as the locale lists them ("a, b, c", `Intl.ListFormat`'s short unit list), for a list's text; `formatDuration` a length as a clock does ("4:05", "1:02:03"), in the locale's digits.
- `describeSize`, `describeDate` and `describeType` describe an entry for the list and the preview. `describeAccepted` names the types a section's `acceptUploads` takes with `describeType`'s labels, each isolated, joined by `Intl.ListFormat` ("Image, Video, and PDF"), for the upload check's notices. `describeType` takes "PDF", "JSON" and an uppercased extension as they are.
- `compareNames` sorts names in natural order (`numeric`), and `sameLetters` matches type-ahead, both case and accents aside, both by the locale's collation, so a language that counts "å" as a letter of its own keeps it apart from "a".
- `foldLetters` readies names and what's typed for a folder search: lowercased the locale's way, then with every accent dropped, "å" included, since collation can't find text within text (see "Searching the open folder" in `file-manager.md`).
- Sorting goes through it: `entryComparator(sort, locale)` and `nameOrder(locale)` for the tree's and the picker's fixed order, the same function for as long as the locale is, so the tree's sorted folders are cached by locale and listing.
- Outside a `FileManager`, the context's default is English in the browser's language (`DEFAULT_LOCALE`), so a shared part such as the upload panel works anywhere.

`useLocaleValue` makes the `Locale` afresh only when `locale` or one of the texts changes, compared key by key, since every row rendered reads it, and memoized rows render again with a new one. A `localeText` object written inline is fine; functions written inline are new each render and defeat it, which the prop's comment says.

Text direction is not the locale's: it comes from the page's `dir`, as in MUI (see `rtl.md`).

## Not yet

Translations shipped with the package, taking `localeText` from the theme as MUI's own components do (part of theme `defaultProps`, under packaging in the roadmap), and a playground page in another language (`?locale=` only sets the formats).
