# Media manager

`MediaManager` is for looking through media and choosing from it, as a CMS's media library is: libraries of pictures, videos, audio or documents, each shown in its own way, searched, opened, uploaded into, and picked from. `MediaPicker` is one library to find, or upload, an asset in, for a field pointing at one. Both use the same adapter as `FileManager`.

The media manager hardcodes nothing about what an asset is: which fields it shows, what's filled in when it's picked or uploaded, and how it plays are all yours, defined in code.

## Libraries

Each library is a `MediaSection` holding **one kind** of asset, rooted at a folder its adapter lists:

```tsx
import { MediaManager } from "filecove";
import type { MediaSectionGroup } from "filecove";
import "filecove/styles.css";

const libraries: MediaSectionGroup[] = [
    {
        id: "site",
        title: "This site",
        sections: [
            { id: "images", label: "Images", kind: "image", rootId: "/images", acceptUploads: "image/*" },
            { id: "videos", label: "Videos", kind: "video", rootId: "/videos", acceptUploads: "video/*" },
            { id: "audio", label: "Audio", kind: "audio", rootId: "/audio" },
            { id: "docs", label: "Documents", kind: "document", rootId: "/documents", layouts: ["list"] },
        ],
    },
];

<div style={{ height: 640 }}>
    <MediaManager adapter={adapter} sections={libraries} />
</div>;
```

- **`kind`** (`"image"`, `"video"`, `"audio"`, `"document"`) sets the tiles' shape (pictures square, videos 16:9, documents 3:4) and how it's shown by default. The media manager trusts the listing and never sorts files into kinds itself, so list only that kind under the root.
- **`layouts`**: `["grid"]`, `["list"]`, or both, the first as it starts, with a button switching. Without it, audio shows as rows and the rest as tiles.
- **`adapter`**: a library's own backend, or the media manager's. A stock photo library on another service sits beside your own.
- **`readOnly`**, **`acceptUploads`**: as a file manager's section.
- A single library can be passed as `section` instead of `sections`.

Assets are listed `FileEntry`s. What your backend delivers them by (a CDN URL, a `srcset`, an HLS manifest, a poster) goes in `FileEntry.meta`, which the media manager carries without reading and hands back with what's picked. Fill `media` (`width`, `height`, `duration`) for the tiles to show dimensions and lengths.

## Browsing or picking

With none of `value`, `defaultValue`, `onChange` and `onChoose`, it's for browsing. Any of them turns on picking: a selected column beside the library, and Choose.

```tsx
import type { MediaChoice } from "filecove";

<MediaManager
    adapter={adapter}
    sections={[images, videos]}
    multiple
    maxChoices={6}
    onChoose={(choices: MediaChoice[]) => {
        saveCarousel(choices.map((choice) => ({ library: choice.section.id, id: choice.asset.id, ...choice.values })));
    }}
/>;
```

Each `MediaChoice` has the `asset` as listed (`meta` and all), its `section`, the `values` your pick form holds for it, and its `trail` (the groups it's in). Ids are only unique within an adapter, so **store a pick's `section.id` with its `asset.id`** to find it again.

- **One at a time** by default; `multiple` adds and removes with each click, and Shift selects a range. What's selected in one library stays as another is shown, so one pick can span libraries (a carousel of pictures and videos). Pass only the libraries of the kinds you take.
- **The order** set in the selected column (drag, or Space and the arrow keys) is the order `onChoose` hands over.
- **`maxChoices`** limits how many, across libraries, with `multiple`.
- **`canSelect(asset, section, choices, trail)`** is your rule beside what's picked, returning `true`, `false` or why not: "one video at most". A library's own **`selectable(entry)`** is for rules of its backend, "licence expired". An asset has to pass both.
- **`defaultValue`** starts from an existing pick, such as a carousel being edited; **`value`** and **`onChange`** keep it in your state, for a field in your own form saved by your own button. Without `onChoose`, there's no Choose button.

## Groups

A library can hold groups inside each other, as your backend keeps them: collections, albums, series, seasons. A group is an entry of `kind: "folder"`, listed with `list` one level at a time, so groups need nothing new in the adapter; a library listing no folders is flat.

A click goes into a group; the header shows the path walked, any part of which goes back. The component never knows what a group means: what one has of its own (a cover, a description, a teaser) is yours, in its properties, its form and how you draw it.

- **`renderGroup`** draws a group's tile, as `renderAsset` does an asset's.
- **`groupHeader(group, section)`** draws what you like above an open group's contents: its cover, its description, a trailer.
- **`createGroups`** (`true`, or a function of the parent group) shows New group, made with the adapter's `createFolder` from a name, or from **`groupForm`** with the adapter's `createGroup`. `groupForm` with `updateGroup` gives a group's details an Edit.
- **`selectGroups`** lets groups be picked as assets are, a whole album; `onChoose` hands the group back for your backend to expand.

## What an asset shows: properties

An asset opens in the library's place (its tile's Open button, or Alt+Enter), showing it by your previewers and its fields by your definitions. The adapter's `properties` hands over plain values, and you define what's shown, as a data grid's columns read a row:

```ts
import type { PropertyDefinitionGroup } from "filecove";

const imageProperties: PropertyDefinitionGroup[] = [
    {
        id: "description",
        title: "Description",
        properties: [
            { field: "alt", label: "Alt text", type: "string", editable: true, maxLength: 250 },
            { field: "caption", label: "Caption", type: "string", multiline: true, editable: true },
        ],
    },
    {
        id: "details",
        properties: [
            {
                field: "dimensions",
                label: "Dimensions",
                type: "string",
                valueGetter: (_, entry) => entry.media?.width ? `${entry.media.width} × ${entry.media.height}` : undefined,
            },
            { field: "size", label: "Size", type: "number", kind: "size", valueGetter: (_, entry) => entry.size },
            { field: "takenAt", label: "Taken", type: "date" },
            { field: "usage", label: "Usage", type: "string", editable: true,
              options: [{ value: "editorial", label: "Editorial" }, { value: "commercial", label: "Commercial" }] },
            { field: "tags", label: "Tags", type: "string", multiple: true, editable: true },
        ],
    },
];

// On the library: { id: "images", ..., properties: imageProperties }
// Or for every library: <MediaManager properties={(asset, section) => ...} />
```

```ts
// The adapter hands over values by the same keys:
async properties(entry) {
    const asset = await api.asset(entry.id);
    return { values: { alt: asset.alt, caption: asset.caption, takenAt: asset.taken_at, usage: asset.usage, tags: asset.tags } };
}
```

- **Types** are `"string"`, `"number"`, `"boolean"` and `"date"`. **Kinds** refine how one is shown: `url` on a string, `size` and `duration` on a number, `datetime` on a date. `options` makes it a choice, `multiple` a list.
- **`valueGetter(value, entry)`** reads it from the raw value or the entry; **`valueFormatter(value, entry)`** gives its text.
- **`render(params)`** draws it entirely your way (a list of renditions with their progress, say), and **`renderEdit(params)`** its editor. Leave out `type` for a property that's only yours, with `render` required.
- **`editable: true`** saves through the adapter's `updateProperties`, `{ [field]: value }`.
- `PropertyDisplay`, exported, draws a value the default way, for a `render` that only adds something beside it.

## Previewers

The asset view shows an asset by the first previewer that takes it: the library's own `previewers`, then the media manager's. They're the same `FilePreviewer` as the file manager's (see [Opening and previewing](previewing.md#previewers-of-your-own)). With none, it shows the thumbnail. The media manager plays nothing itself, so an HLS stream is a previewer of yours handing `meta.hls` to hls.js:

```tsx
const hlsPreviewer: FilePreviewer = {
    id: "hls",
    accepts: (entry) => typeof entry.meta?.hls === "string",
    reads: "none",
    render: ({ entry }) => <HlsPlayer src={entry.meta!.hls as string} poster={entry.meta?.poster as string} />,
};
```

## Forms

What's asked of a pick, of files about to be uploaded, and of an asset to be processed again are forms of yours. Each is a function returning a `MediaForm`, or `null` for nothing to ask:

```ts
interface MediaForm<P> {
    defaults: V;                      // what it holds as it's shown
    render(params: P): ReactNode;     // draws it
    ready?(state): boolean | string;  // whether it can go on, or why not
}
```

| Form | Where | Handed |
|---|---|---|
| `pickForm(asset, section)` | `MediaManager` / `MediaPicker`, or a library's `pickForm(asset)` | what's asked of each pick for this use of it: a caption, a link text |
| `uploadForm(files)` | a library | what the backend should make of the files: optimize, convert, stream as HLS |
| `processForm(asset)` | a library | what to make of an asset again |
| `groupForm({ group, parent })` | a library | a group's own fields |

The media manager keeps the values and never reads them, so a form follows itself in plain code: a field turned off while another is, what it held dropped.

```tsx
import { MediaFields } from "filecove";
import type { MediaPickForm, MediaPickFormParams } from "filecove";

interface Caption { caption: string; decorative: boolean }

// A component of its own, defined outside, so its hooks and state persist.
function CaptionFields(form: MediaPickFormParams<Caption>) {
    return (
        <MediaFields
            {...form}
            groups={[
                {
                    id: "caption",
                    properties: [
                        { field: "decorative", label: "Decorative", type: "boolean", editable: true },
                        { field: "caption", label: "Caption", type: "string", editable: true, required: true,
                          disabled: form.values.decorative },
                    ],
                },
            ]}
        />
    );
}

const captionForm: MediaPickForm<Caption> = {
    defaults: { caption: "", decorative: false },
    render: (form) => <CaptionFields {...form} />,
    ready: ({ values }) => values.decorative || values.caption.trim() !== "" || "Write a caption first.",
};

<MediaManager<Caption> pickForm={() => captionForm} /* ... */ />;
```

- **`MediaFields`** draws fields from the same definitions properties use, for all of a form or a part; anything else you like can go around them.
- **Return the same form object** each time, not one made inside the function.
- **`ready`** holds the button back (Choose, Upload, Process) until it's `true`, showing the string beside it.
- **Refusals**: when the adapter's `process`, `createGroup` or `updateGroup`, or an upload form's `validate`, rejects with an `Error` carrying `errors` by your backend's keys (as Laravel's validation answers do), the message shows over the form and each field's under it, found by its definition's `errorKey`.

### The backend's errors for picks

Picks are saved by your app, and your backend answers. Pass its answer as `errors`, by its own keys, and say where each pick's are:

```tsx
<MediaManager
    errors={serverErrors}   // { "media.0.caption": ["The caption is required."], "media.2": ["Still processing."] }
    choiceErrorKey={({ index }) => `media.${index}`}
    /* ... */
/>
```

A field finds its own with ``errorKey: ({ index }) => `media.${index}.caption` ``, and a pick form's `errorKeys` lists them so a pick's row counts what's to fix. Keys go by the order the picks were handed over, so a pick moved since still finds its own.

## Uploading

A library takes uploads while its adapter has `upload` and it isn't `readOnly`: the header's Upload, a drop, or a paste. Each file goes through `upload` with what its `uploadForm` held as `values`. While the app takes a pick, what arrives is selected, as WordPress's and Shopify's pickers do.

## Processing

What an asset is made into after its upload (renditions, sizes, formats) is your backend's. The listing says when it's working on one:

```ts
// FileEntry.processing
{ status: "processing", progress: 0.4, label: "Making the 720p rendition" }
{ status: "failed", message: "The file is corrupt." }
{ status: "processing", usable: true } // still usable meanwhile, e.g. a video being re-encoded
```

An asset being processed shows a bar and can't be chosen until it's done, unless `usable`. To follow it, give the adapter one of:

- **`processing(entries, { signal })`**: polled, every 2 s and less often while nothing changes, resolving `{ [id]: state }`, `{ status: "ready", entry? }` when done.
- **`watchProcessing(entries, onChange)`**: pushed, through your own WebSocket or server-sent events; return the function that stops it.

**`process(entry, values, { signal })`**, with a library's `processForm`, gives the asset view a Process button, to ask for more or again: "Transcribe", "Make the responsive sizes". Resolve once the backend takes the work on, then list the asset with `processing`.

## Drawing assets

Three steps, most apps stopping at the second:

```tsx
import { MediaRow, MediaTile } from "filecove";

// 1. A class over the default tile.
renderAsset: (params) => <MediaTile {...params} className="my-tile" />

// 2. A little changed: title, detail, badge, picture.
renderAsset: (params) => <MediaRow {...params} title={params.asset.meta?.title as string} detail="Episode 3" />

// 3. Entirely your own.
renderAsset: ({ asset, thumbnail }) => <img src={thumbnail ?? ""} alt="" />
```

- `renderAsset` goes on a library, or on `MediaManager` for all of them; `renderGroup` the same for groups.
- What makes an asset selectable (its role, keys, focus) stays the component's, around whatever you draw, so it can't be broken. Draw for showing, not acting: buttons belong in the asset view.
- **Every asset in a library must be drawn the same height**, as only those in view are rendered.
- Keep the function outside your component: a new one each render redraws every asset.

## The header's actions

`actions` (`MediaActionGroup[]`) puts your own buttons in `MediaManager`'s header, for what the component leaves to you, such as reordering a group or sharing what's selected. Each gets a `MediaActionContext`: the `section`, its `adapter`, the open `group` and `trail`, what's `viewed`, the `choices`, `readOnly`, and `refresh()`.

## State and the API

As the file manager's, each can be controlled:

| State | Props |
|---|---|
| The library and group open | `location`, `defaultLocation`, `onLocationChange` |
| What's shown in the library's place | `viewed`, `defaultViewed`, `onViewedChange` |
| The search | `search`, `defaultSearch`, `onSearchChange` |
| Each library's layout | `layout`, `defaultLayout`, `onLayoutChange` |
| What's selected | `value`, `defaultValue`, `onChange` |

`apiRef` takes a `MediaManagerApi`: `navigate`, `view`, `closeView`, `search`, `closeSearch`, `select`, `choose`, `upload`, `refresh`, `focus`. `relistAfter` and `limits` work as the file manager's do.

## `MediaPicker`

One library to find an asset in and choose it, for a field pointing at an asset of another library, such as a series' poster or a product's manual. It has no list of libraries, no asset view, and nothing for managing; place it in a dialog of your own:

```tsx
import { MediaPicker } from "filecove";

<Dialog open={open} onClose={close}>
    <MediaPicker
        adapter={adapter}
        section={images}
        allowUpload
        onChoose={([choice]) => {
            setPoster({ library: choice.section.id, id: choice.asset.id });
            close();
        }}
        onCancel={close}
    />
</Dialog>;
```

It takes `multiple`, `maxChoices`, `canSelect`, `selectGroups`, `pickForm` (which adds the selected column), `value`, `defaultValue` (as `{ asset, values? }`), `onChange`, `slots`, `slotProps`, `relistAfter`, `limits`, `localeText` and `locale`. `allowUpload` lets the user upload into it; uploads still running finish when it closes.

### `MediaPicture`

Draws an entry's thumbnail, or its type icon, in a box you size, for the field showing what was picked:

```tsx
import { MediaPicture } from "filecove";

<MediaPicture entry={poster.asset} adapter={adapter} style={{ width: 96, aspectRatio: "16 / 9" }} />
```
