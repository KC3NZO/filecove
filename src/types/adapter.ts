/*
 * The contract between the file manager and a backend. An adapter is written once per backend
 * (a REST API, S3, WebDAV...) and the file manager calls it lazily: a folder is listed when it is
 * opened in the content view or expanded in the sidebar, and the listing is shared by both and
 * saved, so opening the folder again shows it at once while it's listed again in the background
 * (`FileManager`'s `relistAfter` sets how often).
 */

import type { FolderRef } from "./section";
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
    /** When the entry was made, which its properties show. */
    createdAt?: Date;
    mimeType?: string;
    /**
     * Files: what a picture, a video or a piece of audio is like, which its properties show. Leave
     * it out, or any part of it, when the backend can't tell cheaply as it lists, and hand it over
     * from `properties` instead.
     */
    media?: MediaInfo;
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

/** What a picture, a video or a piece of audio is like (`FileEntry.media`). */
export interface MediaInfo {
    /** A picture's or a video's width, in pixels. */
    width?: number;
    /** A picture's or a video's height, in pixels. */
    height?: number;
    /** A video's or a piece of audio's length, in seconds. */
    duration?: number;
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

/** Passed to `search`. */
export interface SearchOptions {
    /** Aborted when the results are no longer wanted: something else was typed, or the search ended. */
    signal: AbortSignal;
    /** The `nextCursor` of the page before, when the results come in pages; missing for the first page. */
    cursor?: string;
    /**
     * Whether the file manager shows hidden files, so a backend can leave out hidden entries, and
     * what's in hidden folders, while the user isn't seeing them. Hidden entries that come anyway
     * are left out of the results then.
     */
    showHidden: boolean;
}

/** One entry `search` found, and where it is. */
export interface SearchMatch {
    entry: FileEntry;
    /**
     * The folders from the root searched down to the one holding the entry, outermost first, not
     * counting the root itself; empty for an entry right in the root. The file manager never
     * parses ids, so this is how it shows where the entry is, opens its folder and acts on it there.
     */
    trail: FolderRef[];
}

/** An object rather than a bare array, so fields can be added later without a breaking change. */
export interface SearchResult {
    matches: SearchMatch[];
    /**
     * Where the next page of results starts, as `ListResult.nextCursor`: `search` is called again
     * with it as `cursor` until a page comes without one, and the results show as they arrive.
     * Leave it out on the last page, or to stop at as many results as the backend cares to give.
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
    /**
     * Aborted when the file is no longer wanted, e.g. the preview moved on to another file or closed,
     * or the user cancelled the download.
     */
    signal: AbortSignal;
    /**
     * What the contents are for: "preview", to show them in the preview, or "download", to save
     * them. A URL on another origin is only saved when its server answers with
     * `Content-Disposition: attachment`, so a backend whose preview URLs don't, such as signed links
     * to a bucket, hands over one that does for "download".
     */
    purpose: "preview" | "download";
    /**
     * Reports how much of the file has come, while it's being downloaded and handed over as a blob,
     * e.g. from `XMLHttpRequest`'s `onprogress` with `event.loaded` and `event.total`, or by
     * counting the bytes of a `fetch` response's body as they're read. The download panel shows
     * it; the preview doesn't. Calling it is optional, and pointless for a URL, which the browser
     * downloads itself and shows the progress of. Without it, or while the total isn't known, the
     * download shows as being prepared with no figure.
     */
    onProgress: (loaded: number, total: number) => void;
}

/**
 * Where a file's contents are: a URL the browser loads them from, such as a signed link, which
 * streams and caches as any URL does, or the bytes themselves as a `Blob`, e.g. fetched with
 * headers a URL can't carry. An object rather than a bare value, so fields can be added later.
 */
export type FileContent = { url: string; blob?: never } | { blob: Blob; url?: never };

/** Passed to `download`. */
export interface DownloadOptions {
    /** Aborted when the user cancels while the download is being prepared. */
    signal: AbortSignal;
    /**
     * Whether the file manager showed hidden files when the download was asked for, so a backend
     * can leave what's hidden out of a folder's download while the user isn't seeing it. The
     * entries themselves are always meant, hidden or not.
     */
    showHidden: boolean;
    /**
     * Reports how far it has got before handing the file over, in bytes: fetching a blob, as
     * `content`'s `onProgress` does, or packing a zip, when the server says how far it has got.
     * The download panel shows it. Calling it is optional; without it, or while the total isn't
     * known, the download shows as being prepared with no figure.
     */
    onProgress: (loaded: number, total: number) => void;
}

/**
 * What `download` hands over: one file to save, such as a zip of the entries, as a URL or the bytes,
 * as `content` gives them.
 */
export type DownloadContent = FileContent & {
    /**
     * The name to save it under, e.g. "project.zip". A URL can leave it to its server's
     * `Content-Disposition`. A blob without one is saved under its own name when it's a `File`, or
     * else the entry's name, or for several entries, the name of the folder they're in.
     */
    name?: string;
};

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

/** Passed to `properties`. */
export interface PropertiesOptions {
    /** Aborted when the properties are no longer wanted: the panel moved on to something else, or closed. */
    signal: AbortSignal;
}

/**
 * One value among an entry's properties, of a type the file manager writes out in its `locale`:
 * text, a number, a size in bytes, a date, a link, or a list of tags.
 */
export type PropertyValue =
    | {
          type: "text";
          value: string;
          /** Gives it a button that copies it, e.g. for a checksum or an address. */
          copyable?: boolean;
      }
    | { type: "number"; value: number }
    | { type: "size"; value: number }
    | { type: "date"; value: Date }
    | {
          type: "link";
          /** The link's text. */
          value: string;
          /** Where it goes, opened in a new tab. */
          href: string;
      }
    | { type: "tags"; value: readonly string[] };

/** A property of the backend's own, such as an owner, permissions or a checksum, with its label. */
export type PropertyField = PropertyValue & {
    /** Tells it apart within its group, and stays the same for the same property. */
    id: string;
    /** In the consumer's language, as action labels are. */
    label: string;
};

/** Properties shown together, under a title when they have one. */
export interface PropertyGroup {
    id: string;
    title?: string;
    fields: PropertyField[];
}

/** What `properties` hands over. An object, so fields can be added later without a breaking change. */
export interface EntryProperties {
    /**
     * The entry with the fields its listing left out as too costly to give for every entry, such as
     * `createdAt` or `media`. The properties show it in place of the listed one; the listing stays
     * as it is.
     */
    entry?: FileEntry;
    /** The backend's own properties, shown after the file manager's. */
    groups?: PropertyGroup[];
}

/** Everything in some folders, counted all the way down (`measure`). */
export interface EntryTotals {
    files: number;
    folders: number;
    /** The files' sizes added up, in bytes. */
    size: number;
}

/** Passed to `measure`. */
export interface MeasureOptions {
    /** Aborted when the totals are no longer wanted: the panel moved on to something else, or closed. */
    signal: AbortSignal;
    /**
     * Whether the file manager shows hidden files, so a backend can leave out hidden entries, and
     * what's in hidden folders, while the user isn't seeing them, as `download` can. The folders
     * themselves are always meant, hidden or not.
     */
    showHidden: boolean;
    /**
     * Reports the totals counted so far, which the properties show counting up, as a backend
     * walking the folders one by one would. Calling it is optional; without it, the totals show
     * once they're all counted.
     */
    onProgress: (totals: EntryTotals) => void;
}

export interface FileAdapter {
    /**
     * Lists the direct children of a folder, all at once or a page at a time (`nextCursor`). Reject
     * to show the folder as failed to load. It's called again, in the background, for a folder
     * opened again, so changes made elsewhere show. Entries that come back with the same fields
     * are kept as they were, so nothing showing them renders again.
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
     * cancel. Resolve with the file's entry as it now is, so the file manager can show where it
     * went, even when it was kept under another name beside one of the same name; without it, the
     * file is found by its name, which a file kept both no longer has. Without `upload`, the file
     * manager has no way to upload. Reject with an `Error` to show its message beside the file,
     * e.g. when it's too large or not allowed.
     */
    upload?(file: File, folderId: string, options: UploadOptions): Promise<FileEntry | void>;
    /**
     * Says where a file's contents are, for the preview or to download it (`purpose`): a URL to load
     * them from, or the bytes. For the preview, a URL is used as it is, in an `<img>`, `<video>`,
     * `<audio>` or `<iframe>`, and text is fetched from it, which needs CORS when it's on another
     * origin; it's only called for files the preview can show. To download, a URL on the page's
     * origin is saved under the file's name, and one on another origin opens in a new tab, which the
     * browser closes as it saves the file, provided the server answers with
     * `Content-Disposition: attachment`; otherwise the file shows in that tab. Without it, the file
     * manager has no way to show what's in a file, and downloads files through `download`, if
     * there. Reject with an `Error` to show its message to the user.
     */
    content?(entry: FileEntry, options: ContentOptions): Promise<FileContent>;
    /**
     * Hands over entries as one file to save, such as a zip the server builds: folders with
     * everything in them, several entries, or a single file when there's no `content`, which a
     * single file is otherwise downloaded from. The entries share a parent. A folder downloaded
     * from its own menu, the open folder or a section's root, comes as an entry with only `id`,
     * `name` and `kind`, a root named after its section. A URL is saved as `content`'s are.
     * Without it, only single files can be downloaded, through `content`. Reject with an `Error`
     * to show its message to the user, e.g. when the folder is too large.
     */
    download?(entries: FileEntry[], options: DownloadOptions): Promise<DownloadContent>;
    /**
     * Gives a small picture of a file, which the list and the grid show in place of its icon: a URL
     * or the bytes, as `content` does, or null for a file with none. It's asked for as the file
     * comes into view, once per view, a few at a time, so resolve with null at once for a file that
     * can't have one, rather than asking the server. Thumbnails are kept while the file manager is
     * mounted, and asked for again when a file's size or date modified changes. Without it, or when
     * it rejects, the file's icon shows.
     */
    thumbnail?(entry: FileEntry, options: ThumbnailOptions): Promise<FileContent | null>;
    /**
     * Finds the entries anywhere below `rootId` that match `query`, for a search everywhere: what's
     * typed in the search field, trimmed. It's called once for each section searched, with the
     * section's `rootId`, so two sections sharing the adapter are searched apart, a moment after the
     * typing stops, and again whenever the file manager changes something. How entries match is the
     * backend's to say; the open folder's own search lists the names holding every word typed,
     * anywhere and in any order, case and accents aside. Results come all at once or a page at a
     * time (`nextCursor`). Without it, the sections it serves aren't searched everywhere. Reject
     * with an `Error` to show its message beside the section's results.
     */
    search?(rootId: string, query: string, options: SearchOptions): Promise<SearchResult>;
    /**
     * Hands over one entry's properties, for the properties panel, called a moment after the panel
     * comes to show it: the entry with fields its listing leaves out as too costly (`createdAt`,
     * `media`), and properties of the backend's own, such as an owner, permissions, a checksum or a
     * link to share. A folder shown from its own menu, the open folder or a section's root, may come
     * as an entry with only `id`, `name` and `kind`, a root named after its section, as `download`
     * has them. What a listing brings is shown without it, which is all there is without it.
     * Results are kept for as long as the entry is listed as it was. Reject with an `Error` to show
     * its message in their place.
     */
    properties?(entry: FileEntry, options: PropertiesOptions): Promise<EntryProperties>;
    /**
     * Counts everything in folders, all the way down, for the properties panel: how many files and
     * folders, and the files' sizes added up, together for all of them. The folders may be in
     * different folders, as a search's results are, and may come with only `id`, `name` and
     * `kind`, as `properties` has them. It's called a moment after the panel comes to show them,
     * and again after a change made through the file manager, or a refresh, while it does.
     * Without it, a folder shows how many entries it holds (`childCount`), and the file manager
     * never walks the folders itself. Reject with an `Error` to show its message in place of the
     * totals, e.g. when there are too many to count.
     */
    measure?(folders: FileEntry[], options: MeasureOptions): Promise<EntryTotals>;
}
