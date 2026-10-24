// Internal to the package, not exported from the package entry.

import type { FileAdapter, FileEntry } from "./adapter";
import type { FolderRef, Section } from "./section";

/**
 * How the clipboard's entries are looked for again after a change that may have left their ids
 * naming nothing, or other entries, as path ids do.
 */
export type ClipboardLookup =
    /**
     * A folder in `trail` was renamed to a new id. The steps from `from` on, and the entries, are
     * found again by name below it, the names a rename leaves as they were.
     */
    | { by: "name"; from: number }
    /**
     * A folder the entries may be below was renamed outside `trail`, moved or deleted, where names
     * can't be trusted. Their folder is listed again, and the entries still in it are kept.
     */
    | { by: "id" };

/**
 * Entries cut or copied, waiting to be pasted. It lives in the file manager rather than the
 * system clipboard, since entry ids mean nothing outside the adapter they came from.
 */
export interface Clipboard {
    /** "cut" moves the entries when they're pasted, "copy" copies them. */
    kind: "cut" | "copy";
    /** The section the entries were cut or copied in. */
    section: Section;
    /** The section's adapter, the only one their ids mean anything to. */
    adapter: FileAdapter;
    /** Trail to the folder the entries are in. */
    trail: FolderRef[];
    entries: FileEntry[];
    /** Set while the entries are looked for again (`useClipboardFollow`); nothing is pasted meanwhile. */
    lookup?: ClipboardLookup;
}
