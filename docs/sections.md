# Sections

filecove has no built-in locations: no Home, no Trash, no Network. What the sidebar shows is yours, as **sections**, each an independent root folder.

```ts
interface Section {
    id: string;
    label: string;
    icon?: IconSource;          // an icon name ("home", "drive", "pictures"...) or your own element
    rootId: string;             // the folder it opens at, an id its adapter understands
    adapter?: FileAdapter;      // its own backend; the file manager's `adapter` when omitted
    showFolders?: boolean;      // the folder tree under its row; true by default
    importFrom?: SectionImports; // which other sections entries can come in from
    acceptUploads?: boolean | string; // which files can be uploaded into it
    readOnly?: boolean;         // nothing changes in it through the file manager
    trash?: boolean;            // it's its adapter's trash
}
```

Sections come in groups, each divided from the next by a rule, with an optional heading:

```tsx
const sections: SectionGroup[] = [
    {
        id: "mine",
        sections: [
            { id: "home", label: "Home", icon: "home", rootId: "/users/ada" },
            { id: "shared", label: "Shared with me", icon: "share", rootId: "/shared/ada" },
        ],
    },
    {
        id: "projects",
        title: "Projects",
        sections: [
            { id: "site", label: "Website", icon: "folder", rootId: "/projects/site" },
            { id: "api", label: "API service", icon: "folder", rootId: "/projects/api" },
        ],
    },
];

<FileManager adapter={adapter} sections={sections} actions={actions} />;
```

## Independent roots

Sections are independent even when they share an adapter: `/projects/site` and `/projects/site/src` can both be sections, and each has its own place in the history and its own tree. The file manager knows nothing of how they relate; it never compares ids to see that one is inside another.

What sections sharing **one adapter object** do share is what's listed, so a folder renamed in one section shows renamed in every other section showing it.

## A single section

For one root, pass `section` instead of `sections`. Its folders fill the sidebar as the tree itself, with no section row above them:

```tsx
<FileManager adapter={adapter} section={{ id: "files", label: "Files", rootId: "/" }} actions={actions} />
```

The root is reached through the path bar's first segment. With `showFolders: false`, the single section shows as one plain row instead.

## Plain places

`showFolders: false` makes a section a plain row with no tree beneath it, as GNOME Files shows its places. It opens in the content when clicked.

## Several backends

Each section can bring its own `adapter`, so one file manager can show a server's folders beside a bucket's:

```tsx
const sections: SectionGroup[] = [
    {
        id: "places",
        sections: [
            { id: "server", label: "Server", icon: "drive", rootId: "/" },               // the file manager's adapter
            { id: "media", label: "Media bucket", icon: "pictures", rootId: "", adapter: bucketAdapter },
        ],
    },
];
```

Entries can be copied and moved between them. Within one adapter, the adapter's own `copy` and `move` do it. Between two, the file manager does it itself, reading through one adapter's `list` and `content` and writing through the other's `upload` and `createFolder` (and for a move, `delete` on the source), as a desktop copies between disks. Dropping onto another backend copies, unless Shift or ⌘ is held, which moves. See [Copy, move, trash and undo](copy-move-trash-undo.md#between-backends).

## Which sections take entries from which

`importFrom` narrows which other sections entries can be moved or copied into this one from, by dragging, pasting, Move to… or Copy to…:

```ts
{ id: "site", label: "Website", rootId: "/site", importFrom: { allow: ["api"] } }   // only from "api"
{ id: "api", label: "API", rootId: "/api", importFrom: { deny: ["design"] } }        // from all but "design"
{ id: "design", label: "Design", rootId: "/design", importFrom: false }              // from nowhere else
```

The default is `true`, every section. Moving and copying within a section is always allowed (permissions aside).

## Limiting uploads

`acceptUploads` says which files can be uploaded into a section's folders:

```ts
{ id: "photos", label: "Photos", rootId: "/photos", acceptUploads: "image/*,video/*" }
{ id: "archive", label: "Archive", rootId: "/archive", acceptUploads: false }
```

`true` (the default) takes anything, `false` nothing, and a string takes what a file input's `accept` would: extensions (`.pdf`), MIME types (`image/png`) and wildcards (`image/*`). The file picker offers only those types, and files of other types that are dropped or pasted are left out, saying which types the section takes. Your adapter's `upload` still has the final say.

## Read-only sections

`readOnly: true` makes a section read-only through the file manager, whatever its adapter allows: nothing is created, uploaded, pasted, dropped, renamed, moved or deleted in it. Its entries can still be opened, previewed, downloaded and copied out. The same folders shown in another section still change there.

For read-only folders and files decided by the backend, use permissions instead (see [The adapter](adapter.md#permissions)).

## The trash section

`trash: true` marks a section as its adapter's trash, rooted where the adapter's `trash` puts entries. See [Copy, move, trash and undo](copy-move-trash-undo.md#the-trash).

## Changing sections after mounting

`sections` may change at any time: a section added shows, one removed takes its places out of the history (the open one goes to the first section's root), and one rooted elsewhere or served by another adapter goes back to its root. New section objects with the same `id`, `rootId` and `adapter` change nothing.

`sections` may also be empty, as while your app is still fetching them: the content says there's nothing to show, and the `location` you pass waits for its section to arrive.
