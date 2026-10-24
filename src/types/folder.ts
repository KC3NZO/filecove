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
    /**
     * Set while a ready listing is listed again in the background, as its folder opens, and may yet
     * bring entries it doesn't have. It shows as it is meanwhile, but whatever gives up on an entry
     * the listing lacks, or drops it from the selection, waits until it's gone.
     */
    checking?: boolean;
    error?: unknown;
}

/**
 * A name that what's copied, moved or uploaded into a folder clashes with: what comes in, and what
 * the folder's listing already has under that name, by kind.
 */
export interface Clash {
    name: string;
    /** What comes in. */
    kind: FileEntry["kind"];
    /** What the folder already has under the name. */
    there: FileEntry["kind"];
}
