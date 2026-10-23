import type { FileAdapter } from "./adapter";
import type { FileManagerLocation } from "./navigation";

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
    /** Moves the focus to the content, as F6 does, e.g. once the file manager shows in a dialog. */
    focus: () => void;
}
