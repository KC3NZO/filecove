// Internal to the package, not exported from the package entry.

import type { FileEntry } from "./adapter";

export interface FolderState {
    status: "loading" | "ready" | "error";
    /** The latest listing. Kept while a refresh is loading so the view doesn't blank out. */
    entries?: FileEntry[];
    /**
     * Set while a folder listed for the first time is still coming in page by page, with `entries`
     * holding the pages so far, never none. Whatever needs the whole folder, such as looking for
     * names that clash, waits until it's gone.
     */
    partial?: boolean;
    error?: unknown;
}
