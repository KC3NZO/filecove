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
    /**
     * What the user may do with the entry, as the backend allows it, so the file manager doesn't
     * offer what would only fail. Leave it out to allow everything.
     */
    permissions?: EntryPermissions;
    /**
     * Entries right in a trash's root (`Section.trash`): where each was moved to the trash from,
     * and when, which the trash shows and `restore` puts it back by. An entry without it isn't
     * offered to restore. Leave it out everywhere else, what's inside a trashed folder included.
     */
    trashed?: TrashInfo;
    /** Anything else the adapter wants to carry for custom actions; the file manager ignores it. */
    meta?: Record<string, unknown>;
}

/** Where an entry in the trash was moved there from, and when (`FileEntry.trashed`). */
export interface TrashInfo {
    /**
     * The folders the entry was in, outermost first, the one holding it last: from the root of a
     * section of the file manager's, or from above it, such as the top of the backend, down to that
     * folder. The file manager never parses ids, so this is how it finds the section the entry came
     * from (the first served by the adapter whose root is among them), shows where it was, and
     * checks that folder's names before restoring it. It holds that folder at least.
     */
    trail: FolderRef[];
    /** When it was moved to the trash, which the trash shows in place of the date modified. */
    trashedAt?: Date;
}

/**
 * What the user may do with an entry (`FileEntry.permissions`), or in a folder (`ListResult.permissions`).
 * Each is allowed unless it's false, so a backend sets only what it refuses, and the adapter still
 * has the final say: a call refused anyway shows its error as ever. A read-only entry sets them all
 * to false. Copying an entry out, downloading it and previewing it are only reading, and always allowed.
 */
export interface EntryPermissions {
    /**
     * Folders: whether what's in them can change, as a read-only folder's can't. When false, no
     * folder is created, nothing is uploaded, pasted, dropped, moved, copied or merged in, and none
     * of its entries is renamed, moved out or deleted, whatever their own permissions say. Files:
     * whether their contents can change. When false, nothing copied, moved or uploaded in takes the
     * file's place, and is kept beside it instead (see `ConflictPolicy`); otherwise the file manager
     * doesn't change a file's contents itself, so it's for an app's own actions, such as an
     * editor's, to go by.
     */
    write?: boolean;
    /** Whether the entry can be renamed. */
    rename?: boolean;
    /** Whether the entry can be moved out of its folder, by "Move to…", cutting it or dragging it. */
    move?: boolean;
    /** Whether the entry can be deleted. */
    delete?: boolean;
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
    /**
     * The listed folder's own permissions, such as `{ write: false }` for a read-only folder, given
     * with its first page when it comes in pages. They count with its entry's own in the listing it's
     * in, what either refuses being refused, and are how a section's root, which no listing holds,
     * says what it allows.
     */
    permissions?: EntryPermissions;
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
    /**
     * How well the entry answers the query, higher being better, for the backend that ranks its
     * matches itself. The results ordered by relevance go by it when it's there, and by how the
     * name answers what's typed when it's not. Scores are compared across sections, so adapters
     * searched together should share a scale.
     */
    score?: number;
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

/** Passed to `checkName`: what the name is for. */
export interface NameCheck {
    /** Whether the name is for a file or a folder. */
    kind: FileEntry["kind"];
    /** The folder the entry is created, renamed or uploaded in. */
    parentId: string;
    /** The entry being renamed, or undefined for a new folder or an upload. */
    entry?: FileEntry;
}

/**
 * What to do with an entry whose name the destination folder already has:
 *
 * - "replace": a file takes the place of the file there, and a folder is merged into the folder
 *   there, what's in it going in the same way, all the way down, so files with the same names are
 *   replaced, folders with the same names merged, and the rest added. A file never takes the place
 *   of a folder, nor a folder of a file, and nothing takes the place of a file whose `write`
 *   permission is false, nor is merged into a folder that can't change (its entry's or its own
 *   listing's `write` false): such an entry is kept beside it, as with "keepBoth".
 * - "keepBoth": the incoming entry is given a free name, such as "notes (2).txt".
 * - "skip": the entry is left out.
 *
 * The user sees "replace" as Merge when only folders clash, and isn't offered it when every clash
 * is between a file and a folder, or with what can't be changed.
 */
export type ConflictPolicy = "replace" | "keepBoth" | "skip";

/** Passed to `copy` and `move`. */
export interface TransferOptions extends OperationOptions {
    /**
     * Chosen by the user when the destination's cached listing showed a clash, and "keepBoth"
     * otherwise, so a clash the cache missed never overwrites anything. One choice covers every
     * entry, so with "replace", an entry whose name an entry of the other kind, or one that can't
     * be changed, has there is kept beside it (see `ConflictPolicy`).
     */
    conflict: ConflictPolicy;
    /**
     * Reports how much has been copied or moved, in bytes, e.g. from a server saying how far a copy
     * has got. Calling it is optional; without it the transfer shows as under way with no figure, as
     * a move that only renames on the backend would.
     */
    onProgress: (loaded: number, total: number) => void;
    /**
     * Reports an entry given that has gone into the target, all of it, as soon as it has, with what
     * it now is there (`made`) when the backend can say, as `TransferResult` gives it. Leave out the
     * entries skipped. Calling it is optional, and it's what tells, should the copy or move then
     * fail or be cancelled, which entries went: the transfer panel says how many, Try again goes for
     * the rest only, and what went can be undone when each came with `made`. Without it, a copy that
     * failed is tried again for every entry, and a move for those still in their folder.
     */
    onEntryDone: (entry: FileEntry, made?: FileEntry) => void;
}

/** What `copy` and `move` may resolve with. An object, so fields can be added later without a breaking change. */
export interface TransferResult {
    /**
     * The entries as they now are in the target: the copies made, or the entries moved, one for
     * each entry given that went there, in the order they were given, under the name each went in
     * by, which "keepBoth" may have changed. Those skipped are left out. It's what lets the user
     * undo a copy, deleting the copies, or a move, moving the entries back, as the file manager
     * can't find them by name: a name kept both is the adapter's to choose.
     */
    entries: FileEntry[];
}

/** Passed to `restore`. */
export interface RestoreOptions extends OperationOptions {
    /**
     * Chosen by the user when the listing of a folder the entries go back to showed a clash, and
     * "keepBoth" otherwise, so a clash the cache missed never overwrites anything, as `copy` and
     * `move` take it (`ConflictPolicy`).
     */
    conflict: ConflictPolicy;
}

/** What `trash` and `restore` may resolve with. An object, so fields can be added later without a breaking change. */
export interface TrashResult {
    /**
     * The entries as they now are: in the trash, or back in the folders they were moved to the
     * trash from, one for each entry given that went, in the order they were given, under the name
     * each went by, which a restore with "keepBoth" may have changed. Those skipped are left out.
     * It's what lets the user undo it, restoring what went to the trash, or moving what was
     * restored to the trash again.
     */
    entries: FileEntry[];
}

/** Passed to `upload`. */
export interface UploadOptions extends OperationOptions {
    /**
     * Chosen by the user when the folder's cached listing showed a clash, and "keepBoth" otherwise,
     * so a clash the cache missed never overwrites anything. Files the user chose to skip are never
     * sent, so "skip" only reaches clashes the cache missed, and a file whose name the listing showed
     * a folder, or a file that can't be written, has is sent with "keepBoth", so "replace" only meets
     * those the cache missed, which the file is kept beside (see `ConflictPolicy`).
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
     * What the contents are for: "preview", to show them in the preview, "download", to save them,
     * or "copy", to copy the file into a folder another adapter serves, whose `upload` is handed
     * the bytes. A URL on another origin is only saved when its server answers with
     * `Content-Disposition: attachment`, so a backend whose preview URLs don't, such as signed links
     * to a bucket, hands over one that does for "download". For "copy", hand over the file as it
     * is, as for "download", and a URL is fetched by the page, so on another origin it needs CORS.
     */
    purpose: "preview" | "download" | "copy";
    /**
     * Reports how much of the file has come, while it's being downloaded and handed over as a blob,
     * e.g. from `XMLHttpRequest`'s `onprogress` with `event.loaded` and `event.total`, or by
     * counting the bytes of a `fetch` response's body as they're read. The download panel shows
     * it, and the transfer panel for a copy; the preview doesn't. Calling it is optional, and
     * pointless for a URL, which the browser downloads itself and shows the progress of. Without it,
     * or while the total isn't known, the download shows as being prepared with no figure.
     */
    onProgress: (loaded: number, total: number) => void;
}

/**
 * Where a file's contents are: a URL the browser loads them from, such as a signed link, which
 * streams and caches as any URL does, or the bytes themselves as a `Blob`, e.g. fetched with
 * headers a URL can't carry. An object rather than a bare value, so fields can be added later.
 */
export type FileContent = { url: string; blob?: never } | { blob: Blob; url?: never };

/** Entries that share a folder, among entries from several (`downloadAcross`). */
export interface EntriesInFolder {
    folder: FolderRef;
    entries: FileEntry[];
}

/** Passed to `download` and `downloadAcross`. */
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
     * `devicePixelRatio`), for a backend that makes thumbnails to order, or picks the nearest larger
     * size it keeps. It grows as the view is zoomed in, and the file is asked about again then; a
     * larger thumbnail already given serves a view zoomed out. A larger picture is shrunk to fit and
     * a smaller one is shown as it is, never stretched.
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
          /**
           * Lets the user change it in the properties, saved through `updateProperties`, e.g. a
           * picture's alt text or caption. Its `id` is then unique among the entry's groups.
           */
          editable?: boolean;
          /** Edited over several lines, e.g. a caption or a description. */
          multiline?: boolean;
          /** How many characters it takes at most, while it's edited. */
          maxLength?: number;
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
    | {
          type: "tags";
          value: readonly string[];
          /**
           * Lets the user add and remove tags in the properties, saved through `updateProperties`.
           * Its `id` is then unique among the entry's groups.
           */
          editable?: boolean;
      };

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
    /** The backend's own properties, shown after the file manager's, where the app defines none. */
    groups?: PropertyGroup[];
    /**
     * The entry's values by their keys, which the app's own definitions of its properties read by
     * their `field` (`PropertyDefinition`, the media manager's `properties`), as a data grid's
     * columns read a row: anything the backend keeps, as plain JSON, dates as ISO strings.
     */
    values?: Record<string, unknown>;
}

/**
 * New values of an entry's editable properties, by their fields' ids or their definitions' `field`:
 * text for a text field, trimmed, for tags, the tags, trimmed, each once, none empty, and for a
 * property the app defines, its value as its type has it (a string, a number, a boolean, a date as an
 * ISO string, a list of them with `multiple`) or as its own editor or renderer saves it.
 */
export type PropertyValues = Record<string, unknown>;

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
     * are kept as they were, so nothing showing them renders again. A folder copied or moved into a
     * folder another adapter serves is walked with it, all the way down.
     */
    list(folderId: string, options: ListOptions): Promise<ListResult>;
    /**
     * Creates a folder named `name` in `parentId` and resolves with its entry. Without it, the file
     * manager has no way to create folders, nor to upload folders or copy them in from another
     * adapter, which it makes with it. Reject with an `Error` to show its message to the user, e.g.
     * when the name is taken or not allowed.
     */
    createFolder?(parentId: string, name: string, options: OperationOptions): Promise<FileEntry>;
    /**
     * Renames an entry and resolves with it as it is now. Its id may change, as it does when ids are
     * paths. Without it, the file manager has no way to rename. Reject with an `Error` to show its
     * message to the user.
     */
    rename?(entry: FileEntry, name: string, options: OperationOptions): Promise<FileEntry>;
    /**
     * Says why the backend won't take a name, so it's refused before anything is sent: e.g.
     * Windows' `\:*?"<>|`, reserved names such as "CON", or a length limit. New folder and Rename
     * show it under the field as it's typed, with the button disabled; an upload leaves out the
     * files and folders given whose names it refuses, saying so, and fails those inside uploaded
     * folders with it, listed under the folder's row, without sending them. Return the message, in
     * the user's language as action labels are, or nothing when the name is fine. A typed name is
     * trimmed, and no name is ever empty, ".", ".." or holding "/", which the file manager refuses
     * itself. It runs on every keystroke, so it must be synchronous and quick. Without it, only
     * those rules and the folder's listed names are checked; either way `createFolder`, `rename`
     * and `upload` have the final say.
     */
    checkName?(name: string, check: NameCheck): string | null | undefined;
    /**
     * Copies entries, folders with everything in them, into `targetId`, a folder this adapter
     * serves. The entries share a parent. It runs in the background while the user browses, shown
     * in a panel once it takes a moment, and several may run at once. Report each entry as it's
     * done (`onEntryDone`), so a copy failing partway says what went. Resolve with the copies'
     * entries (`TransferResult`), so the user can undo the copy; without them, it can't be undone.
     * Without `copy`, the file manager has no way to copy within this adapter. Reject with an
     * `Error` to show its message to the user. A copy into a folder another adapter serves is the
     * file manager's, reading through `list` and `content` and writing through the other's `upload`
     * and `createFolder`.
     */
    copy?(entries: FileEntry[], targetId: string, options: TransferOptions): Promise<TransferResult | void>;
    /**
     * Moves entries into `targetId`, a folder this adapter serves; never into themselves, nor into
     * the folder they're in. The entries share a parent. It runs in the background as `copy` does.
     * Resolve with the entries as they now are (`TransferResult`), so the user can undo the move;
     * without them, it can't be undone. Without `move`, the file manager has no way to move within
     * this adapter. Reject with an `Error` to show its message to the user. A move into a folder
     * another adapter serves is copied as `copy` says, and each entry deleted here with `delete`
     * once all of it is there.
     */
    move?(entries: FileEntry[], targetId: string, options: TransferOptions): Promise<TransferResult | void>;
    /**
     * Deletes entries for good, folders with everything in them. The entries share a parent, and
     * the user has already confirmed. It also empties the trash (`Section.trash`), with every entry
     * its root lists, and deletes an entry moved into a folder another adapter serves once it has
     * been copied there, one entry a call. Without it, the file manager has no way to delete, nor to
     * move entries to another adapter. Reject with an `Error` to show its message to the user.
     */
    delete?(entries: FileEntry[], options: OperationOptions): Promise<void>;
    /**
     * Moves entries to the backend's trash, folders with everything in them, from where `restore`
     * puts them back. The entries share a parent. It's done at once, without asking, as it can be
     * undone: resolve with the entries as they now are in the trash (`TrashResult`), so the user
     * can, with `restore`; without them, or without `restore`, it can't be undone. A section with
     * `trash` set shows the trash, its root listing each entry with its `trashed`. Without `trash`,
     * entries are only deleted, for good. Reject with an `Error` to show its message to the user.
     */
    trash?(entries: FileEntry[], options: OperationOptions): Promise<TrashResult | void>;
    /**
     * Puts entries of the trash back in the folders they were moved to the trash from
     * (`FileEntry.trashed`), folders with everything in them: entries right in the root of a section
     * with `trash` set, which may go back to different folders. Names a folder has now are settled
     * by `conflict`, as `move` settles them; a folder they came from that's gone is the backend's to
     * make again, or to refuse with a message. Resolve with the entries as they now are
     * (`TrashResult`), so the user can undo it, moving them to the trash again; without them, it
     * can't be undone. Without it, entries in the trash can only be deleted for good. Reject with an
     * `Error` to show its message to the user.
     */
    restore?(entries: FileEntry[], options: RestoreOptions): Promise<TrashResult | void>;
    /**
     * Uploads one file into `folderId`. Files from the browser's file picker or dropped from the
     * desktop are uploaded one call each, a few at a time, so each has its own progress, error and
     * cancel, and so are the files of entries copied or moved in from a section another adapter
     * serves, one after another, read through that adapter's `content`. Resolve with the file's
     * entry as it now is, so the file manager can show where it went, even when it was kept under
     * another name beside one of the same name, and undo a copy from another adapter; without it,
     * the file is found by its name, which a file kept both no longer has. Without `upload`, the
     * file manager has no way to upload, nor to take entries from another adapter. Reject with an
     * `Error` to show its message beside the file, e.g. when it's too large or not allowed.
     */
    upload?(file: File, folderId: string, options: UploadOptions): Promise<FileEntry | void>;
    /**
     * Says where a file's contents are, for the preview or to download it (`purpose`): a URL to load
     * them from, or the bytes. For the preview, a URL is used as it is, in an `<img>`, `<video>`,
     * `<audio>` or `<iframe>`, and text is fetched from it, which needs CORS when it's on another
     * origin; it's only called for files the preview can show. To download, a URL on the page's
     * origin is saved under the file's name, and one on another origin opens in a new tab, which the
     * browser closes as it saves the file, provided the server answers with
     * `Content-Disposition: attachment`; otherwise the file shows in that tab. To copy the file into
     * a folder another adapter serves (`purpose` "copy"), the bytes are handed to that adapter's
     * `upload`, a URL fetched by the page first. Without it, the file manager has no way to show
     * what's in a file, nor to copy it to another adapter, and downloads files through `download`,
     * if there. Reject with an `Error` to show its message to the user.
     */
    content?(entry: FileEntry, options: ContentOptions): Promise<FileContent>;
    /**
     * Hands over entries as one file to save, such as a zip the server builds: folders with
     * everything in them, several entries, or a single file when there's no `content`, which a
     * single file is otherwise downloaded from. The entries share a parent. A folder downloaded
     * from its own menu, the open folder or a section's root, comes as an entry with only `id`,
     * `name` and `kind`, a root named after its section. A URL is saved as `content`'s are.
     * Without it, only single files can be downloaded, through `content`. Reject with an `Error`
     * to show its message to the user, e.g. when the folder is too large. Entries from several
     * folders, as a search's results may be, go to `downloadAcross`, or without it, a folder's at a
     * time to this, each saved as a file of its own.
     */
    download?(entries: FileEntry[], options: DownloadOptions): Promise<DownloadContent>;
    /**
     * Hands over entries from several folders as one file to save, as `download` does a folder's,
     * for a search's results: each folder with its entries, in the order the user sees them. Files
     * of different folders may share a name, which the file has to keep apart, e.g. by putting each
     * folder's entries in a folder of its name, as a zip can, or numbering them. A blob without a
     * name is saved under the name of the folder holding them all. Without it, they're downloaded
     * a folder at a time through `download` and `content`.
     */
    downloadAcross?(groups: EntriesInFolder[], options: DownloadOptions): Promise<DownloadContent>;
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
     * link to share, as `groups` it describes, or as `values` the app's own definitions show (the
     * media manager's `properties`). A folder shown from its own menu, the open folder or a section's root, may come
     * as an entry with only `id`, `name` and `kind`, a root named after its section, as `download`
     * has them. What a listing brings is shown without it, which is all there is without it.
     * Results are kept for as long as the entry is listed as it was. Reject with an `Error` to show
     * its message in their place.
     */
    properties?(entry: FileEntry, options: PropertiesOptions): Promise<EntryProperties>;
    /**
     * Saves what the user changed of an entry's properties, the fields `properties` marked
     * `editable`, by their ids, or the app's own definitions marked so, by their `field`, one at a
     * time from the properties panel. Resolve with the
     * entry's properties as they now are, to show what the backend made of them, or with nothing,
     * and the values given show as they were saved. Reject with an `Error` to show its message
     * under the field, which stays as the user left it, to try again. Fields are only edited where
     * the entry's folder can change, so not in a `readOnly` section or the trash; leave `editable`
     * out of what the backend won't let the user change. Without it, nothing is editable.
     */
    updateProperties?(entry: FileEntry, values: PropertyValues, options: OperationOptions): Promise<EntryProperties | void>;
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
