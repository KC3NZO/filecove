// Internal to the package, not exported from the package entry.

import type { ConflictPolicy, FileAdapter } from "./adapter";
import type { FolderRef } from "./section";

/**
 * Where an upload has got to: waiting for a free slot, being sent, or ended. Only failed and
 * cancelled uploads can be tried again.
 */
export type UploadStatus = "queued" | "uploading" | "done" | "failed" | "cancelled";

/** A file in the upload queue. Replaced, never mutated, as it moves along. */
export interface UploadItem {
    /** Unique within its queue. */
    id: number;
    file: File;
    /** Already known to take uploads. */
    adapter: FileAdapter;
    /** The folder it goes into. */
    folder: FolderRef;
    conflict: ConflictPolicy;
    status: UploadStatus;
    /** How much has been sent, from 0 to 1, once the adapter has reported any. */
    progress?: number;
    /** Why it failed, as the adapter said, to show beside it. */
    error?: string;
}

/**
 * What was dropped from outside, or picked with the browser's file picker. Folders can't be
 * uploaded yet, so only their names are kept, to say they were left out.
 */
export interface DroppedFiles {
    files: File[];
    folders: string[];
}
