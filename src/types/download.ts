// Internal to the package, not exported from the package entry.

import type { EntriesInFolder, FileAdapter, FileContent, FileEntry } from "./adapter";

/** A file ready for the browser to save: where it is, and the name to save it under, or "" to leave it to its server. */
export interface PreparedDownload {
    content: FileContent;
    name: string;
}

/**
 * Where a download has got to: waiting for a free slot, being prepared by the adapter, ready but
 * waiting for a click, as the browser blocked the tab it opens in, or failed. A download the
 * browser has taken, or that was cancelled, leaves the queue.
 */
export type DownloadStatus = "queued" | "preparing" | "ready" | "failed";

/** A download in the download queue. Replaced, never mutated, as it moves along. */
export interface DownloadItem {
    /** Unique within its queue. */
    id: number;
    /** Already known to hand the entries over (`canDownload`, or `downloadAcross` with `groups`). */
    adapter: FileAdapter;
    entries: FileEntry[];
    /**
     * The entries by the folder they're in, when they're in several and go to the adapter's
     * `downloadAcross` together; missing otherwise.
     */
    groups?: EntriesInFolder[];
    /** The folder the entries are in, or the one holding them all, which names a nameless blob of several. */
    folderName: string;
    /** Whether hidden files were shown when it was asked for, passed on to `download`. */
    showHidden: boolean;
    status: DownloadStatus;
    /** Whether the panel shows it: once it has taken a moment, or at once when it needs the user. */
    shown: boolean;
    /** How much the adapter has reported while preparing it, in bytes, once it has reported any. */
    progress?: { loaded: number; total: number };
    /** What the browser wouldn't open on its own, while `ready`. */
    prepared?: PreparedDownload;
    /** Why it failed, as the adapter said, to show beside it. */
    error?: string;
}
