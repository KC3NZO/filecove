// Internal to the package, not exported from the package entry.

import type { FileAdapter, FileEntry } from "./adapter";
import type { FolderRef, Section } from "./section";

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
}
