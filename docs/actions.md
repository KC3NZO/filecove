# Actions

filecove adds nothing to its menus by itself. Every item in the context menu, and every button you add to the header, the preview or the properties panel, is an **action** of yours: you choose its label, icon, shortcut and place. What the file manager gives you is an `ActionContext`, saying what was targeted and offering the operations that can run there.

## How an action works

```ts
interface FileAction {
    id: string;
    label: string;
    icon?: IconSource;         // an icon name or your own element
    target?: "selection" | "folder"; // only for entries, or only for a folder's empty space
    single?: boolean;          // only when exactly one entry is targeted
    acrossFolders?: boolean;   // also for a search's results from several folders
    visible?: (context: ActionContext) => boolean;
    disabled?: (context: ActionContext) => boolean;
    shortcut?: string;         // "Ctrl+C", "Shift+Ctrl+N", "F2", "Delete"
    destructive?: boolean;     // shown in the error colour
    onSelect: (context: ActionContext) => void;
}

interface ActionGroup {
    id: string;
    actions: FileAction[];     // a rule divides each group from the next
}
```

The context menu opens on a right-click, the ⋮ buttons, the Menu key or Shift+F10, and a long-press on touch. It's built from your groups, leaving out actions whose `target`, `single`, `acrossFolders` or `visible` rule them out, and groups left empty. When nothing applies, the browser's own menu is left alone.

### The context

```ts
interface ActionContext {
    target: "selection" | "folder";
    entries: FileEntry[];      // what's selected, or none for a folder's empty space
    folder: FolderRef;         // the folder they're in, or the folder itself
    section: Section;
    byFolder?: ContextFolder[]; // a search's results from several folders, grouped
    readOnly: boolean;         // the folder can't change
    moving: boolean;           // a move under way holds the entries
    refresh(): void;
    openFolder(entry: FileEntry): void;
    properties(): void;        // always there

    // Each of the rest is optional, `() => void`, and there only when it can run here:
    // open, openLocation, openOrigin, select, preview, closePreview, download,
    // createFolder, createFolderInto, rename, copyTo, moveTo, cut, copy, paste, pasteInto,
    // delete, trash, restore, emptyTrash, upload (takes optional files), uploadFolder, undo, redo
}
```

**An operation is missing when it can't run here**: the adapter lacks the method (`rename` without `adapter.rename`), the permissions or a read-only section refuse it, the target doesn't fit (`rename` with several entries, `paste` with nothing to paste), or it's the wrong kind of place (`restore` outside a trash). So the usual pattern is to show an action only while its operation is there:

```ts
visible: (context) => !!context.rename,
onSelect: (context) => context.rename?.(),
```

Or keep it in the menu, greyed out, as Paste usually is:

```ts
disabled: (context) => !context.paste,
onSelect: (context) => context.paste?.(),
```

The operations open the file manager's own dialogs where they need to ask something (a name, a destination, a confirmation), run in the background where they take a while, and show their errors.

### Actions of your own

An action doesn't have to call an operation. Anything of your app's goes in `onSelect`, with the context saying what it's for:

```ts
{
    id: "share",
    label: "Share",
    icon: "share",
    target: "selection",
    acrossFolders: true,
    visible: (context) => !context.section.trash,
    onSelect: (context) => openShareDialog(context.entries),
},
{
    id: "compress",
    label: "Compress…",
    target: "selection",
    // The archive goes beside the entries, which a read-only folder can't take.
    visible: (context) => !context.readOnly && !context.moving,
    onSelect: async (context) => {
        await api.compress(context.folder.id, context.entries.map((entry) => entry.id));
        context.refresh();
    },
},
```

Call `context.refresh()` after changing the backend yourself, so the folder is listed again.

### A search's results from several folders

A search everywhere's selection may hold entries from several folders, even several sections. Most adapter calls take entries sharing one folder, so actions are left out for such a selection unless marked `acrossFolders: true`. Mark an action so when it goes by `entries` alone, by `byFolder`, or calls the context's own operations, which all handle several folders. Leave it off for an action that acts on `context.folder` or `context.section`, which aren't where all the entries are.

### Shortcuts

`shortcut` is shown beside the label and bound to the keyboard: a press runs the action for the selection if it applies there, or else for the open folder. Write keys joined by `+`, as `"Ctrl+C"`, `"Shift+Ctrl+N"`, `"Alt+Enter"`, `"F2"` or `"Delete"`.

- `Ctrl` also matches ⌘ on macOS.
- A letter or digit is the key printed with it, on any keyboard layout: Ctrl+Z is the key marked Z on AZERTY and QWERTZ too, and on a Russian or Arabic layout, the key with the Latin Z printed beside its own letter.
- Your shortcuts come before the file manager's own keys, so an action bound to Space or Enter takes them in the content.
- A shortcut on a disabled action still takes the key, so the browser does nothing with it. The paste key is the exception, as the browser's paste may carry files from the desktop to upload.
- Browsers keep some keys for themselves: Chrome never passes Ctrl+N, Ctrl+T or Ctrl+W to a page.

Every shortcut you give is listed in the file manager's keyboard shortcuts window (Ctrl+?).

## A complete set to start from

This is the set the development playground uses, without its demo actions. Copy it, change the labels to your app's wording or language, and remove what you don't want. Every item hides itself where it can't run.

```ts
import type { ActionGroup } from "filecove";

export const fileActions: ActionGroup[] = [
    {
        id: "open",
        actions: [
            { id: "open", label: "Open", icon: "folderOpen", target: "selection", single: true,
              visible: (c) => !!c.open, onSelect: (c) => c.open?.() },
            // Only on a search's result: opens the folder it's in.
            { id: "open-location", label: "Open item location", icon: "folder", target: "selection", single: true,
              visible: (c) => !!c.openLocation, onSelect: (c) => c.openLocation?.() },
            // Only on an entry in the trash: opens the folder it came from.
            { id: "open-origin", label: "Open original location", icon: "folder", target: "selection", single: true,
              visible: (c) => !!c.openOrigin, onSelect: (c) => c.openOrigin?.() },
            // Only after a long-press on a folder in the sidebar tree, for its touch selection mode.
            { id: "select", label: "Select", icon: "selectMode", target: "selection",
              visible: (c) => !!c.select, onSelect: (c) => c.select?.() },
            { id: "preview", label: "Preview", icon: "preview", shortcut: "Space", target: "selection", acrossFolders: true,
              visible: (c) => !!c.preview, onSelect: (c) => c.preview?.() },
            // On a folder's empty space or a section row, downloads the folder itself.
            { id: "download", label: "Download", icon: "download", acrossFolders: true,
              visible: (c) => !!c.download, onSelect: (c) => c.download?.() },
        ],
    },
    {
        id: "create",
        actions: [
            { id: "new-folder", label: "New folder…", icon: "newFolder", shortcut: "Shift+Ctrl+N", target: "folder",
              visible: (c) => !!c.createFolder, onSelect: (c) => c.createFolder?.() },
            { id: "new-folder-inside", label: "New folder inside…", icon: "newFolder", target: "selection", single: true,
              visible: (c) => !!c.createFolderInto, onSelect: (c) => c.createFolderInto?.() },
            { id: "upload", label: "Upload files…", icon: "upload", target: "folder",
              visible: (c) => !!c.upload, onSelect: (c) => c.upload?.() },
            { id: "upload-folder", label: "Upload folder…", icon: "uploadFolder", target: "folder",
              visible: (c) => !!c.uploadFolder, onSelect: (c) => c.uploadFolder?.() },
        ],
    },
    {
        id: "clipboard",
        actions: [
            { id: "cut", label: "Cut", icon: "cut", shortcut: "Ctrl+X", target: "selection", acrossFolders: true,
              visible: (c) => !!c.cut, onSelect: (c) => c.cut?.() },
            { id: "copy", label: "Copy", icon: "copy", shortcut: "Ctrl+C", target: "selection", acrossFolders: true,
              visible: (c) => !!c.copy, onSelect: (c) => c.copy?.() },
            // Greyed out while there's nothing to paste; hidden in the trash, which takes nothing.
            { id: "paste", label: "Paste", icon: "paste", shortcut: "Ctrl+V", target: "folder",
              visible: (c) => !c.section.trash, disabled: (c) => !c.paste, onSelect: (c) => c.paste?.() },
            { id: "paste-into", label: "Paste into folder", icon: "paste", target: "selection", single: true,
              visible: (c) => c.entries[0].kind === "folder" && !c.section.trash,
              disabled: (c) => !c.pasteInto, onSelect: (c) => c.pasteInto?.() },
        ],
    },
    {
        id: "organize",
        actions: [
            { id: "copy-to", label: "Copy to…", icon: "copy", target: "selection", acrossFolders: true,
              visible: (c) => !!c.copyTo, onSelect: (c) => c.copyTo?.() },
            { id: "move-to", label: "Move to…", icon: "move", target: "selection", acrossFolders: true,
              visible: (c) => !!c.moveTo, onSelect: (c) => c.moveTo?.() },
            { id: "rename", label: "Rename…", icon: "rename", shortcut: "F2", target: "selection", single: true,
              visible: (c) => !!c.rename, onSelect: (c) => c.rename?.() },
        ],
    },
    {
        id: "trash",
        actions: [
            { id: "restore", label: "Restore", icon: "restore", target: "selection",
              visible: (c) => !!c.restore, onSelect: (c) => c.restore?.() },
            { id: "empty-trash", label: "Empty trash…", icon: "deleteForever", target: "folder", destructive: true,
              visible: (c) => !!c.emptyTrash, onSelect: (c) => c.emptyTrash?.() },
        ],
    },
    {
        id: "delete",
        actions: [
            // Where the adapter has a trash, Delete moves there and Shift+Delete deletes for good.
            { id: "trash", label: "Move to trash", icon: "delete", shortcut: "Delete", target: "selection", acrossFolders: true,
              visible: (c) => !!c.trash, onSelect: (c) => c.trash?.() },
            { id: "delete-for-good", label: "Delete permanently…", icon: "deleteForever", shortcut: "Shift+Delete",
              target: "selection", acrossFolders: true, destructive: true,
              visible: (c) => !!c.delete && !!c.trash, onSelect: (c) => c.delete?.() },
            // Where there's no trash, Delete deletes for good, after asking.
            { id: "delete", label: "Delete…", icon: "delete", shortcut: "Delete", target: "selection",
              acrossFolders: true, destructive: true,
              visible: (c) => !!c.delete && !c.trash && !c.section.trash, onSelect: (c) => c.delete?.() },
            // In the trash itself.
            { id: "delete-from-trash", label: "Delete permanently…", icon: "deleteForever", shortcut: "Delete",
              target: "selection", destructive: true,
              visible: (c) => !!c.delete && !!c.section.trash, onSelect: (c) => c.delete?.() },
        ],
    },
    {
        id: "view",
        actions: [
            { id: "refresh", label: "Refresh", icon: "refresh", shortcut: "F5", target: "folder",
              onSelect: (c) => c.refresh() },
            { id: "properties", label: "Properties", icon: "info", acrossFolders: true,
              onSelect: (c) => c.properties() },
        ],
    },
];
```

Keep the array outside your component (or memoized) so it isn't rebuilt on every render.

Undo and redo don't need actions: Ctrl+Z, Shift+Ctrl+Z and the sidebar's main menu do them. `context.undo` and `context.redo` are there for a toolbar of your own.

## Buttons in the header

`headerActions` puts actions in the header bar, for the content's selection, or with nothing selected, the open folder itself (`target: "folder"`):

```tsx
const headerActions: ActionGroup[] = [
    {
        id: "header",
        actions: [
            { id: "new-folder", label: "New folder", icon: "newFolder", target: "folder",
              visible: (c) => !!c.createFolder, onSelect: (c) => c.createFolder?.() },
            { id: "upload", label: "Upload files", icon: "upload", target: "folder",
              visible: (c) => !!c.upload, onSelect: (c) => c.upload?.() },
            { id: "share", label: "Share", icon: "share", target: "selection",
              onSelect: (c) => openShareDialog(c.entries) },
        ],
    },
];

<FileManager headerActions={headerActions} /* ... */ />;
```

Two actions with an icon show as buttons while the file manager is at least 900px wide; the rest, and those without an icon, go in a "More actions" menu, as do all of them when it's narrower. Their shortcuts work anywhere in the file manager outside a text field. The same action objects can be in `actions` too.

## Buttons in the preview's and the properties' headers

`previewActions` and `propertiesActions` work the same way, for the file shown in the preview and for what the properties panel shows. The preview shows up to four as buttons, the properties panel two.

In the preview's context, `preview` is missing (it's previewing already) and `closePreview` is there, for an action taking the user elsewhere, such as an editor of yours:

```ts
const previewActions: ActionGroup[] = [
    {
        id: "file",
        actions: [
            { id: "rename", label: "Rename…", icon: "rename", shortcut: "F2",
              visible: (c) => !!c.rename, onSelect: (c) => c.rename?.() },
            { id: "edit", label: "Open in editor", icon: "edit",
              visible: (c) => c.entries[0].permissions?.write !== false,
              onSelect: (c) => { c.closePreview?.(); openEditor(c.entries[0]); } },
        ],
    },
];
```

Rename, Delete, Move to… and Copy to… open their dialogs over the preview, which follows what they did.

## The main menu

The ☰ button in the sidebar's header opens the main menu, for what belongs to your app rather than to entries: preferences, help, about. The file manager puts Undo and Redo at its top and "Keyboard shortcuts" at its end.

```tsx
import type { MainMenuGroup } from "filecove";

const mainMenu: MainMenuGroup[] = [
    {
        id: "app",
        items: [
            { id: "preferences", label: "Preferences", icon: "settings", shortcut: "Ctrl+,", onSelect: openPreferences },
            { id: "about", label: "About", onSelect: openAbout },
        ],
    },
];

<FileManager mainMenu={mainMenu} /* ... */ />;
```

An item's `shortcut` works anywhere in the file manager.

## Calling operations from outside

A toolbar of your own, outside the file manager, gets the same context from `apiRef.current.actionContext(entries?, location?)` (see [State and the API](state-and-api.md#the-api)):

```ts
const context = apiRef.current?.actionContext();   // the open folder
context?.createFolder?.();
```
