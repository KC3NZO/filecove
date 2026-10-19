/*
 * The contract between the file manager and a backend. An adapter is written once per backend
 * (a REST API, S3, WebDAV...) and the file manager calls it lazily: a folder is listed only
 * when it is first opened in the content view or expanded in the sidebar, and the listing is
 * shared by both.
 */

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
    /** Anything else the adapter wants to carry for custom actions; the file manager ignores it. */
    meta?: Record<string, unknown>;
}

export interface ListOptions {
    /** Aborted when the result is no longer wanted, e.g. the file manager unmounted. */
    signal: AbortSignal;
}

/** An object rather than a bare array, so fields such as a paging cursor can be added later without a breaking change. */
export interface ListResult {
    entries: FileEntry[];
}

/** Passed to calls that change the backend. */
export interface OperationOptions {
    /**
     * Aborted when the user cancels while the call is in flight. The change may have been made by
     * then, so the folder is listed again either way.
     */
    signal: AbortSignal;
}

export interface FileAdapter {
    /** Lists the direct children of a folder. Reject to show the folder as failed to load. */
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
}
