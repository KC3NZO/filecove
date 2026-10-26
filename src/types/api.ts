import type { ActionContext } from "./action";
import type { FileAdapter, FileEntry } from "./adapter";
import type { FileManagerLocation, GoToPathResult } from "./navigation";
import type { SearchScope } from "./search";

export interface RefreshOptions {
    /**
     * Only the sections this adapter serves, the file manager's `adapter` or a section's own, since
     * ids mean something only to their adapter. Every section when omitted.
     */
    adapter?: FileAdapter;
}

/**
 * Drives a `FileManager` from outside, through its `apiRef`. The object stays the same for as long
 * as the file manager is mounted, so it can be kept, and each method does what it says as of the
 * moment it's called.
 */
export interface FileManagerApi {
    /**
     * Goes to a location, as the user going there does: it's added to the history, reported to
     * `onLocationChange` as "navigate", and with a controlled `location`, only asked for. A location
     * in a section the file manager doesn't have is ignored.
     */
    navigate: (location: FileManagerLocation) => void;
    /** Goes back through the history, as the header's back button does; nothing when there's nowhere to go. */
    back: () => void;
    /** Goes forward through the history, as the header's forward button does. */
    forward: () => void;
    /**
     * Lists folders again wherever the file manager has them, e.g. after the backend changed them
     * some other way: the folders with these ids, and every folder listing one of them, for its item
     * count, or every folder it has listed when `folderIds` is omitted. Folders it hasn't listed are
     * listed when they're shown, so they need nothing. What's on screen stays until the new listing
     * comes, as with the context menu's `refresh`.
     */
    refresh: (folderIds?: readonly string[], options?: RefreshOptions) => void;
    /**
     * Shows an entry in its folder: selects it alone and scrolls the content to it, once the
     * folder's listing has it, and it takes the content's focus if the content has it, or the Tab
     * stop otherwise. With `location`, it goes there first, as `navigate` does; without, the entry
     * is in the open folder. It's given up on when the whole folder has come without it, so an
     * entry made outside the file manager wants `refresh` of its folder first, and while hidden
     * files are off, for a hidden one. A controlled selection is asked to take it.
     */
    reveal: (entryId: string, location?: FileManagerLocation) => void;
    /**
     * Downloads entries as the context menu's `download` does, e.g. from a toolbar of the
     * consumer's own: prepared in the background, shown in the download panel if it takes a moment,
     * and saved by the browser. The entries are in the open folder, or in the one at `location`,
     * which isn't gone to; with none, that folder itself is downloaded. Returns false when nothing
     * was asked for: `location`'s section is missing, or its adapter can't hand the entries over
     * (no `download`, and they aren't a single file it has `content` for).
     */
    download: (entries?: readonly FileEntry[], location?: FileManagerLocation) => boolean;
    /**
     * What the context menu's actions are given, for a toolbar of the consumer's own to do what the
     * menu does: `createFolder`, `upload`, `paste`, `rename`, `delete`, `preview`, `copyTo` and the
     * rest, each missing when the menu wouldn't offer it. For entries of the open folder, e.g. the
     * selection's `entries` from `onSelectionChange`, or of the one at `location`, which isn't gone
     * to; with none, for that folder itself (`target` "folder"). Built as of the call, so ask again
     * once the selection, the clipboard or the location changes, e.g. as the toolbar renders. Null
     * when `location`'s section is missing.
     */
    actionContext: (entries?: readonly FileEntry[], location?: FileManagerLocation) => ActionContext | null;
    /**
     * Opens the search field, as Ctrl+F (`"folder"`) or Ctrl+Shift+F (`"everywhere"`) does, and
     * focuses it; open already, it switches to `scope`. `query` is put in it, or what's typed stays
     * when omitted. Asked for through `onSearchChange` with a controlled `search`, and focused if
     * the change is applied by the next render. Returns false when nothing was asked for: no
     * section is shown, or `"everywhere"` with no section whose adapter has `search`.
     */
    search: (scope: SearchScope, query?: string) => boolean;
    /** Closes the search field, as Escape does, which gives the focus back if it had it. */
    closeSearch: () => void;
    /**
     * Opens the path field in the path bar's place, as Ctrl+L does, with the open folder's path
     * selected, and focuses it; open already, it focuses it again. It ends a search, which the field
     * takes the place of. Returns false when no section is shown.
     */
    editPath: () => boolean;
    /**
     * Goes where a path leads, as typing it in the path field does: the folder it names, or for a
     * file the folder holding it, with the file selected. A path starting with "/" begins with a
     * section's label, as the path bar writes it ("/Documents/Reports"); any other begins in the open
     * folder, where ".." is the folder above. It's asked of the adapters' listings folder by folder,
     * so no ids are parsed. Resolves once it has gone, as `navigate` does, or with `ok: false` and
     * why, in the file manager's text. A controlled `location` is asked for it.
     */
    goToPath: (path: string) => Promise<GoToPathResult>;
    /** Moves the focus to the content, as F6 does, e.g. once the file manager shows in a dialog. */
    focus: () => void;
    /**
     * Opens the window listing the keyboard shortcuts, as Ctrl+? and the main menu's "Keyboard
     * shortcuts" do, e.g. from a help menu of the consumer's own. It gives the focus back to what
     * had it as it closes.
     */
    showShortcuts: () => void;
    /**
     * Undoes the latest change made through the file manager, as Ctrl+Z and the main menu's Undo
     * do, e.g. from a toolbar of the consumer's own, which can tell whether there's anything to undo
     * from `actionContext()`'s `undo`. Returns false when there's nothing to undo, or an undo or
     * redo is still under way.
     */
    undo: () => boolean;
    /**
     * Does the latest change undone again, as Shift+Ctrl+Z and the main menu's Redo do. Returns false
     * when there's nothing to redo, or an undo or redo is still under way.
     */
    redo: () => boolean;
}
