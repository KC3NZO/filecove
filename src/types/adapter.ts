/*
 * The contract between the file manager and a backend. An adapter is written once per backend
 * (a REST API, S3, WebDAV...) and the file manager calls it lazily: a folder is listed only
 * when it is first opened in the content view or expanded in the sidebar, and the listing is
 * shared by both.
 */

import type { ViewMode } from "./view";

/** A file or folder as the adapter reports it. */
export interface FileEntry {
    /**
     * Locator the adapter understands, handed back to it in later calls. The file manager never
     * parses it, so it can be a full path such as "/server/project/a/src" or an opaque database
     * id. Must be unique within the adapter.
     */
    id: string;
    name: string;
    kind: "file" | "folder";
    /** Files: size in bytes. */
    size?: number;
    modifiedAt?: Date;
    mimeType?: string;
    /** Folders: how many entries they contain, shown in the size column. */
    childCount?: number;
    /**
     * Folders: whether they contain sub-folders, so the sidebar can drop the expand arrow without
     * listing them first. Leave it out when the backend can't tell cheaply.
     */
    hasSubfolders?: boolean;
    /**
     * Whether the entry is hidden, so it only shows while "Show hidden files" is on. Leave it out to
     * go by the name, which hides what starts with a dot. Set it for a backend with its own idea of
     * hidden, such as a file attribute, or to `false` to always show a dotfile. Hidden entries are
     * still listed, so name clashes are found among them.
     */
    hidden?: boolean;
    /** Anything else the adapter wants to carry for custom actions; the file manager ignores it. */
    meta?: Record<string, unknown>;
}

export interface ListOptions {
    /** Aborted when the result is no longer wanted, e.g. the file manager unmounted. */
    signal: AbortSignal;
    /** The `nextCursor` of the page before, when the folder is listed in pages; missing for the first page. */
    cursor?: string;
}

/** An object rather than a bare array, so fields can be added later without a breaking change. */
export interface ListResult {
    entries: FileEntry[];
    /**
     * Where the next page starts, for a backend that lists a large folder in pages. The file manager
     * calls `list` again with it as `cursor`, until a page comes without one, and shows the entries
     * as they arrive. It's opaque to the file manager, e.g. a continuation token or an offset. Leave
     * it out on the last page, or for a folder listed in one go.
     */
    nextCursor?: string;
}

/** Passed to calls that change the backend. */
export interface OperationOptions {
    /**
     * Aborted when the user cancels while the call is in flight. The change may have been made by
     * then, so the folder is listed again either way.
     */
    signal: AbortSignal;
}

/**
 * What to do with an entry whose name the destination folder already has: replace what is there,
 * keep both by giving the incoming entry a free name, or leave that entry out.
 */
export type ConflictPolicy = "replace" | "keepBoth" | "skip";

/** Passed to `copy` and `move`. */
export interface TransferOptions extends OperationOptions {
    /**
     * Chosen by the user when the destination's cached listing showed a clash, and "keepBoth"
     * otherwise, so a clash the cache missed never overwrites anything.
     */
    conflict: ConflictPolicy;
}

/** Passed to `upload`. */
export interface UploadOptions extends OperationOptions {
    /**
     * Chosen by the user when the folder's cached listing showed a clash, and "keepBoth" otherwise,
     * so a clash the cache missed never overwrites anything. Files the user chose to skip are never
     * sent, so "skip" only reaches clashes the cache missed.
     */
    conflict: ConflictPolicy;
    /**
     * Reports how much of the file has been sent, e.g. from `XMLHttpRequest`'s `upload.onprogress`
     * with `event.loaded` and `event.total`. Calling it is optional; without it the file shows as
     * uploading with no figure.
     */
    onProgress: (loaded: number, total: number) => void;
}

/** Passed to `content`. */
export interface ContentOptions {
    /** Aborted when the file is no longer wanted, e.g. the preview moved on to another file or closed. */
    signal: AbortSignal;
}

/**
 * Where a file's contents are: a URL the browser loads them from, such as a signed link, which
 * streams and caches as any URL does, or the bytes themselves as a `Blob`, e.g. fetched with
 * headers a URL can't carry. An object rather than a bare value, so fields can be added later.
 */
export type FileContent = { url: string; blob?: never } | { blob: Blob; url?: never };

/** Passed to `thumbnail`. */
export interface ThumbnailOptions {
    /** Aborted when the thumbnail is no longer wanted, e.g. the file was scrolled out of view. */
    signal: AbortSignal;
    /**
     * The view the file is shown in, whose thumbnails differ in size: small beside the name in the
     * list, larger in the grid. A backend that keeps a few sizes picks one by it.
     */
    view: ViewMode;
    /**
     * The side of the square the thumbnail is fitted into, in device pixels (CSS pixels times
     * `devicePixelRatio`), for a backend that makes thumbnails to order. A larger picture is shrunk
     * to fit and a smaller one is shown as it is, never stretched.
     */
    size: number;
}

export interface FileAdapter {
    /**
     * Lists the direct children of a folder, all at once or a page at a time (`nextCursor`). Reject
     * to show the folder as failed to load.
     */
    list(folderId: string, options: ListOptions): Promise<ListResult>;
    /**
     * Creates a folder named `name` in `parentId` and resolves with its entry. Without it, the file
     * manager has no way to create folders. Reject with an `Error` to show its message to the user,
     * e.g. when the name is taken or not allowed.
     */
    createFolder?(parentId: string, name: string, options: OperationOptions): Promise<FileEntry>;
    /**
     * Renames an entry and resolves with it as it is now. Its id may change, as it does when ids are
     * paths. Without it, the file manager has no way to rename. Reject with an `Error` to show its
     * message to the user.
     */
    rename?(entry: FileEntry, name: string, options: OperationOptions): Promise<FileEntry>;
    /**
     * Copies entries, folders with everything in them, into `targetId`. The entries share a
     * parent. Without it, the file manager has no way to copy. Reject with an `Error` to show its
     * message to the user.
     */
    copy?(entries: FileEntry[], targetId: string, options: TransferOptions): Promise<void>;
    /**
     * Moves entries into `targetId`; never into themselves, nor into the folder they're in. The
     * entries share a parent. Without it, the file manager has no way to move. Reject with an
     * `Error` to show its message to the user.
     */
    move?(entries: FileEntry[], targetId: string, options: TransferOptions): Promise<void>;
    /**
     * Deletes entries for good, folders with everything in them. The entries share a parent, and
     * the user has already confirmed. Without it, the file manager has no way to delete. Reject
     * with an `Error` to show its message to the user.
     */
    delete?(entries: FileEntry[], options: OperationOptions): Promise<void>;
    /**
     * Uploads one file into `folderId`. Files from the browser's file picker or dropped from the
     * desktop are uploaded one call each, a few at a time, so each has its own progress, error and
     * cancel. Without it, the file manager has no way to upload. Reject with an `Error` to show its
     * message beside the file, e.g. when it's too large or not allowed.
     */
    upload?(file: File, folderId: string, options: UploadOptions): Promise<void>;
    /**
     * Says where a file's contents are, for the preview: a URL to load them from, or the bytes. A
     * URL is used as it is, in an `<img>`, `<video>`, `<audio>` or `<iframe>`, and text is fetched
     * from it, which needs CORS when it's on another origin. Only called for files the preview can
     * show. Without it, the file manager has no way to show what's in a file. Reject with an
     * `Error` to show its message to the user.
     */
    content?(entry: FileEntry, options: ContentOptions): Promise<FileContent>;
    /**
     * Gives a small picture of a file, which the list and the grid show in place of its icon: a URL
     * or the bytes, as `content` does, or null for a file with none. It's asked for as the file
     * comes into view, once per view, a few at a time, so resolve with null at once for a file that
     * can't have one, rather than asking the server. Thumbnails are kept while the file manager is
     * mounted, and asked for again when a file's size or date modified changes. Without it, or when
     * it rejects, the file's icon shows.
     */
    thumbnail?(entry: FileEntry, options: ThumbnailOptions): Promise<FileContent | null>;
}
