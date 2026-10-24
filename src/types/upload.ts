// Internal to the package, not exported from the package entry.

import type { ConflictPolicy, FileAdapter } from "./adapter";
import type { FolderRef } from "./section";

/**
 * Where an upload has got to: waiting for a free slot, being sent, or ended. Only failed and
 * cancelled uploads can be tried again.
 */
export type UploadStatus = "queued" | "uploading" | "done" | "failed" | "cancelled";

interface UploadBase {
    /** Unique within its queue. */
    id: number;
    /** Already known to take uploads, and for a folder to make folders. */
    adapter: FileAdapter;
    /** The folder it goes into. */
    folder: FolderRef;
    conflict: ConflictPolicy;
    status: UploadStatus;
    /** How much has been sent, from 0 to 1, once the adapter has reported any. */
    progress?: number;
    /** Why it failed, as the adapter said, to show beside it. */
    error?: string;
    /**
     * The id of what it put in `folder`, once known, to show it there: a file's, once sent, when
     * the adapter's `upload` resolved with its entry, and a folder's once made, or found there to
     * merge into.
     */
    entryId?: string;
}

/** A file in the upload queue. Replaced, never mutated, as it moves along. */
export interface FileUploadItem extends UploadBase {
    kind: "file";
    file: File;
}

/** Something in a folder uploaded that failed: a file, or a folder with everything in it. */
export interface UploadFailure {
    kind: "file" | "folder";
    /** The names from the folder uploaded down to it, or that folder's own name for itself. */
    path: string[];
    /** A folder's files, none of which were uploaded. */
    files: number;
    /** Why, as the adapter said. */
    error?: string;
}

/**
 * A folder in the upload queue, with everything in it: its folders made with the adapter's
 * `createFolder`, and its files sent one call each, as files on their own are. Replaced, never
 * mutated, as it moves along. `error` is the first thing in it that failed.
 */
export interface FolderUploadItem extends UploadBase {
    kind: "folder";
    /** Its name in the folder it goes into. */
    name: string;
    /** How many files it holds, once it's been read; undefined meanwhile. */
    files?: number;
    /** Their size together, in bytes. */
    size: number;
    /** How many of its files are uploaded. */
    done: number;
    /** How many of its files couldn't be, those in folders that couldn't be made included. */
    failed: number;
    /** How many of its files were left out for their type. */
    skipped: number;
    /** The first things in it that failed, in the order they did, and how many more did. */
    failures: UploadFailure[];
    moreFailures: number;
}

export type UploadItem = FileUploadItem | FolderUploadItem;

/** A folder to upload, with everything in it. */
export interface FolderContents {
    name: string;
    files: File[];
    folders: FolderContents[];
}

/**
 * A folder dropped, pasted or picked: its name at once, and what's in it only once read, since a
 * large one takes a while, so it's read as its upload starts.
 */
export interface FolderSource {
    name: string;
    read: () => Promise<FolderContents>;
}

/** What was dropped from outside, pasted, or picked with the browser's file or folder picker. */
export interface DroppedFiles {
    files: File[];
    folders: FolderSource[];
}

/** A folder to upload, as the check before queueing settled it. */
export interface FolderUpload {
    source: FolderSource;
    /** The name it's made under: the source's, or a free one to keep both. */
    name: string;
    /** The id of a folder of that name already there, to upload into instead, merging the two. */
    mergeInto?: string;
}
