# Properties

The properties panel shows what's selected in the content, or the open folder while nothing is, and follows the selection. It docks beside the content when the file manager is at least 1100px wide, and opens over it when narrower. Alt+Enter, the view menu, or `context.properties()` show it.

It works with any adapter: what the listing brings (type, size, location, dates, a picture's dimensions) is shown with nothing more. Three optional members add to it.

## The backend's own fields: `properties`

```ts
properties?(entry: FileEntry, options: { signal: AbortSignal }): Promise<EntryProperties>;

interface EntryProperties {
    entry?: FileEntry;          // fields the listing left out as too costly: createdAt, media...
    groups?: PropertyGroup[];   // the backend's own fields, described
    values?: Record<string, unknown>; // plain values, for definitions of your own (media manager)
}

interface PropertyGroup {
    id: string;
    title?: string;
    fields: PropertyField[];
}
```

Each field has an `id`, a `label` in your users' language, and a typed value the panel writes out in the `locale`:

| `type` | `value` | Extra |
|---|---|---|
| `"text"` | string | `copyable`, `editable`, `multiline`, `maxLength` |
| `"number"` | number | shown grouped |
| `"size"` | bytes | shown as "4.2 MB" |
| `"date"` | `Date` | |
| `"link"` | the link's text | `href`, opened in a new tab |
| `"tags"` | string[] | `editable` |

```ts
async properties(entry, { signal }) {
    const info = await api.info(entry.id, signal);
    return {
        entry: { ...entry, createdAt: new Date(info.createdAt) },
        groups: [
            {
                id: "sharing",
                title: "Sharing",
                fields: [
                    { id: "owner", label: "Owner", type: "text", value: info.owner },
                    { id: "link", label: "Link", type: "link", value: "Open", href: info.publicUrl },
                ],
            },
            {
                id: "details",
                fields: [
                    { id: "checksum", label: "SHA-256", type: "text", value: info.sha256, copyable: true },
                    { id: "description", label: "Description", type: "text", value: info.description ?? "",
                      editable: true, multiline: true, maxLength: 500 },
                    { id: "tags", label: "Tags", type: "tags", value: info.tags, editable: true },
                ],
            },
        ],
    };
}
```

- It's called a moment after the panel comes to show one entry, so moving through a list with the arrow keys only asks where the user stops.
- A folder shown from its own menu, the open folder or a section's root, may come as an entry with only `id`, `name` and `kind`.
- Results are kept for as long as the entry is listed unchanged.
- Rejecting with an `Error` shows its message in place of the fields, with Try again; what the listing brought still shows.

## Editing fields: `updateProperties`

```ts
updateProperties?(entry: FileEntry, values: Record<string, unknown>, options: { signal: AbortSignal }):
    Promise<EntryProperties | void>;
```

Fields marked `editable` (text and tags) get an Edit button and are changed in place in the panel, one at a time. `values` holds the field's new value by its `id`: a string for text, trimmed; a string array for tags, trimmed, each once, none empty.

```ts
async updateProperties(entry, values, { signal }) {
    await api.update(entry.id, values, signal); // e.g. { description: "New text" }
}
```

- Resolve with the entry's properties as they now are, to show what the backend made of them, or with nothing, and the value given shows as saved.
- Reject with an `Error` to show its message under the field, which stays as the user left it, to try again.
- Without `updateProperties`, nothing is editable, whatever the fields say.
- Fields aren't edited in a read-only section, the trash, a folder whose permissions refuse writing, or while a move holds the entry.
- An editable field's `id` must be unique among the entry's groups.

## Folder totals: `measure`

```ts
measure?(folders: FileEntry[], options: {
    signal: AbortSignal;
    showHidden: boolean;
    onProgress: (totals: EntryTotals) => void;
}): Promise<EntryTotals>;

interface EntryTotals {
    files: number;
    folders: number;
    size: number; // bytes
}
```

Counts what's in folders, all the way down, together: "12 files and 3 folders, totalling 4.5 MB". It's separate from `properties` because it's the slow part (S3 has no folder sizes), so the panel shows the rest while the totals count.

- The folders may be in different folders, as a search's results are.
- `onProgress` is optional; calling it shows the totals counting up.
- `showHidden` says whether hidden files are showing, so the totals can leave them out.
- Without `measure`, a folder shows how many entries it holds (`childCount`). The file manager never walks folders with `list` to count them.

## Actions in the panel's header

`propertiesActions` puts actions in the panel's header, for what it shows (see [Actions](actions.md#buttons-in-the-previews-and-the-properties-headers)).

## Controlling it

Whether the docked panel shows, and its width, are public state: `propertiesOpen` / `defaultPropertiesOpen` / `onPropertiesOpenChange` and `propertiesWidth` / `defaultPropertiesWidth` / `onPropertiesWidthChange` (240 to 480 px, 300 by default). See [State and the API](state-and-api.md).

To show the panel for particular entries from your own code:

```ts
apiRef.current?.actionContext(entries)?.properties();
```
