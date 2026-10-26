// Internal to the package, not exported from the package entry.

import type { FileAdapter } from "./adapter";
import type { EntryGroup } from "./menu";

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

/** The clipboard's entries of one folder, with its section, the trail to it and the adapter serving it. */
export interface ClipboardPart extends EntryGroup {
    /** The adapter serving the section, the only one the entries' ids mean anything to. */
    adapter: FileAdapter;
    /** Set while the entries are looked for again (`useClipboardFollow`); nothing is pasted meanwhile. */
    lookup?: ClipboardLookup;
}

/**
 * Entries cut or copied, waiting to be pasted. It lives in the file manager rather than the
 * system clipboard, since entry ids mean nothing outside the adapter they came from.
 */
export interface Clipboard {
    /** "cut" moves the entries when they're pasted, "copy" copies them. */
    kind: "cut" | "copy";
    /**
     * The entries by the folder they're in: one part, or several for a search's results from
     * several folders, of one section or more, served by one adapter or several. Never empty, nor
     * is any part.
     */
    parts: ClipboardPart[];
}

/** Ids of entries by the adapter serving them, as ids are only unique within an adapter. */
export type AdapterIds = ReadonlyMap<FileAdapter, ReadonlySet<string>>;
