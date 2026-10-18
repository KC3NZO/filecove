// Internal to the package, not exported from the package entry.

import type { FileEntry } from "./adapter";

export interface FolderState {
    status: "loading" | "ready" | "error";
    /** The latest listing. Kept while a refresh is loading so the view doesn't blank out. */
    entries?: FileEntry[];
    error?: unknown;
}
