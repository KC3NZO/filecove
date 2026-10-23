import type { FileEntry } from "./adapter";

type EntryKind = FileEntry["kind"];

/**
 * What the upload panel says. Kept apart from the rest, since the panel is meant to be shared with
 * the media manager to come.
 */
export interface UploadLocaleText {
    /** The panel's name for screen readers. */
    uploads: string;
    /** The panel's title while files wait or upload. */
    uploadsActive: (count: number) => string;
    /** The panel's title once nothing is uploading and some files failed. */
    uploadsFailed: (count: number) => string;
    /** The panel's title once nothing is uploading or failed. */
    uploadsDone: (count: number) => string;
    /** The panel's title once every file was cancelled. */
    uploadsCancelled: string;
    /** Under the title, how many uploaded, when some failed too. */
    uploadsDoneCount: (count: number) => string;
    /** Under the title, how many were cancelled, when others ended otherwise. */
    uploadsCancelledCount: (count: number) => string;
    /** Bytes sent of the total, both already formatted, e.g. "1.5 MB" and "4 MB". */
    uploadProgress: (sent: string, total: string) => string;
    uploadsHide: string;
    uploadsShow: string;
    uploadsCancelAll: string;
    uploadsClose: string;
    /** A file's status while it waits for its turn. */
    uploadQueued: string;
    /** A file's status while it uploads, before the adapter has said how far it got. */
    uploadUploading: string;
    uploadCancelled: string;
    /** Why a file failed, when the adapter didn't say. */
    uploadFailed: string;
    /** Read for an uploaded file's check mark. */
    uploadDone: string;
    uploadCancel: (fileName: string) => string;
    uploadRetry: (fileName: string) => string;
}

/**
 * What the download panel says. Kept apart from the rest, as the upload panel's is, since the
 * panel is meant to be shared with the media manager to come. A download is of one entry, its
 * `name` given, or of `count` of them.
 */
export interface DownloadLocaleText {
    /** The panel's name for screen readers. */
    downloads: string;
    /** The panel's title while downloads wait or are being prepared. */
    downloadsPreparing: (count: number) => string;
    /** The panel's title once nothing is being prepared and some downloads wait for a click. */
    downloadsReady: (count: number) => string;
    /** The panel's title once nothing is being prepared or ready, and some downloads failed. */
    downloadsFailed: (count: number) => string;
    /** Under the title, how many are ready, when others are being prepared. */
    downloadsReadyCount: (count: number) => string;
    /** Under the title, how many failed, when others are being prepared or ready. */
    downloadsFailedCount: (count: number) => string;
    downloadsHide: string;
    downloadsShow: string;
    downloadsCancelAll: string;
    downloadsClose: string;
    /** A download of several entries, named by how many. */
    downloadItems: (count: number) => string;
    /** A download's status while it waits for its turn. */
    downloadQueued: string;
    /** A download's status while the adapter prepares it, before it has said how far it got. */
    downloadPreparing: string;
    /** How much the adapter has fetched or packed of the total, both already formatted, e.g. "1.5 MB" and "4 MB". */
    downloadProgress: (loaded: string, total: string) => string;
    /** A download's status when the browser wouldn't start it on its own, so it waits for a click. */
    downloadReady: string;
    /** Why a download failed, when the adapter didn't say. */
    downloadFailed: (count: number) => string;
    downloadCancel: (count: number, name: string) => string;
    downloadRetry: (count: number, name: string) => string;
    /** The button that starts a ready download. */
    downloadSave: (count: number, name: string) => string;
}

/**
 * Every text `FileManager` shows or reads to screen readers, apart from what the consumer passes it
 * (section and action labels, `title`). Texts about entries are functions, so each language words
 * and pluralizes them its own way. Counts come as plain numbers, and `name` is the entry's name,
 * meant for when `count` is 1. `kind` is "file" or "folder".
 */
export interface FileManagerLocaleText extends UploadLocaleText, DownloadLocaleText {
    // Shared
    loading: string;
    cancel: string;
    close: string;
    back: string;
    tryAgain: string;

    // Entries' sizes and types
    /** A folder's size: how many entries it holds. */
    itemCount: (count: number) => string;
    typeFolder: string;
    /** The type of a file with no extension and no known MIME type. */
    typeFile: string;
    typeImage: string;
    typeVideo: string;
    typeAudio: string;
    typeText: string;
    typeArchive: string;

    // Sorting, in the view menu and the list's column headers
    sortBy: string;
    sortName: string;
    sortSize: string;
    sortType: string;
    sortModified: string;
    sortAToZ: string;
    sortZToA: string;
    sortSmallestFirst: string;
    sortLargestFirst: string;
    sortOldestFirst: string;
    sortNewestFirst: string;
    /** Read after the label of the column sorting the list, with its order, e.g. "A to Z". */
    sortedColumn: (order: string) => string;

    // Header bar
    showSidebar: string;
    forward: string;
    /** Turns touch selection mode on. */
    select: string;
    doneSelecting: string;
    search: string;
    /** The search field's placeholder, with the name of the folder searched in, e.g. "Search in Documents". */
    searchIn: (folder: string) => string;
    /** The search field's ✕ while something is typed in it. */
    clearSearch: string;
    /** The search field's ✕ while nothing is typed in it. */
    closeSearch: string;
    gridView: string;
    listView: string;
    viewOptions: string;
    showHiddenFiles: string;
    /** Ctrl+H, shown beside "Show hidden files" as the language's keyboards name it ("Strg+H" in German). */
    showHiddenFilesShortcut: string;
    /** The path bar's name for screen readers. */
    path: string;
    folderMenu: string;

    // Sidebar
    /** Shown at the top of the sidebar when `FileManager` has no `title`. */
    sidebarTitle: string;
    mainMenu: string;
    /** The sidebar's name for screen readers. */
    sidebar: string;
    /** The tree's name for screen readers, when there are several sections. */
    sections: string;
    noFolders: string;
    /** In the tree, in place of the folders of a folder that couldn't be listed. */
    folderLoadFailed: string;
    retry: string;

    // Content
    folderEmpty: string;
    folderOpenFailed: string;
    /** Read to screen readers as the selection changes. */
    selectedCount: (count: number) => string;
    /** The touch selection bar's title while nothing is selected. */
    selectItems: string;
    /** The touch selection bar's title. */
    selectionCount: (count: number) => string;
    selectAll: string;
    selectNone: string;
    selectionActions: string;

    // Creating and renaming
    /** The title of the dialog creating a folder. */
    newFolder: string;
    /** The name a new folder is offered: the first free one, counting from 1. */
    untitledFolder: (number: number) => string;
    renameTitle: (kind: EntryKind) => string;
    nameLabel: (kind: EntryKind) => string;
    create: string;
    rename: string;
    /** A name no entry can have, such as ".". */
    nameReserved: (name: string, kind: EntryKind) => string;
    nameHasSlash: (kind: EntryKind) => string;
    /** A name the folder already has, for an entry of `kind`. */
    nameTaken: (kind: EntryKind) => string;
    /** Why creating failed, when the adapter didn't say. */
    createFailed: string;
    /** Why renaming failed, when the adapter didn't say. */
    renameFailed: (kind: EntryKind) => string;

    // Deleting
    delete: string;
    deleteTitle: (count: number, name: string) => string;
    /** Whether any of them is a folder, which goes with everything in it. */
    deleteWarning: (count: number, hasFolders: boolean) => string;
    /** Why deleting failed, when the adapter didn't say. */
    deleteFailed: (count: number) => string;

    // Copying and moving
    copyToTitle: (count: number, name: string) => string;
    moveToTitle: (count: number, name: string) => string;
    copyHere: string;
    moveHere: string;
    /** The picker's list of sections. */
    pickerLocations: string;
    /** The picker's list of the folders in a folder, for screen readers. */
    pickerFolders: (folderName: string) => string;
    /** The title of a paste asking about names the folder already has. */
    copyTitle: (count: number, name: string) => string;
    moveTitle: (count: number, name: string) => string;
    copyFailedTitle: (count: number, name: string) => string;
    moveFailedTitle: (count: number, name: string) => string;
    /** Why copying failed, when the adapter didn't say. */
    copyFailed: (count: number) => string;
    /** Why moving failed, when the adapter didn't say. */
    moveFailed: (count: number) => string;

    // Names a folder already has, when copying, moving or uploading into it
    /** `name` is the one clashing name, meant for when `count` is 1. */
    conflictMessage: (count: number, name: string, folderName: string) => string;
    conflictHint: (count: number) => string;
    skip: string;
    keepBoth: string;
    replace: string;

    // Uploading
    upload: string;
    /** `name` is the file's name, meant for when `count` is 1. */
    uploadTitle: (count: number, name: string, folderName: string) => string;
    /** When only folders were dropped. `name` is the folder's name, meant for when `count` is 1. */
    uploadFoldersFailedTitle: (count: number, name: string) => string;
    uploadFoldersOnly: string;
    /** When folders were dropped with files. `name` is the folder's name, meant for when `count` is 1. */
    uploadFoldersLeftOut: (count: number, name: string) => string;

    // Downloading
    /** The preview's Download button. */
    download: string;

    // Preview
    previous: string;
    next: string;
    /** Read to screen readers on stepping to a file. */
    previewPosition: (name: string, position: number, count: number) => string;
    previewUnavailable: string;
    /** The date already formatted. */
    modifiedOn: (date: string) => string;
    previewFailed: string;
    fileEmpty: string;
    /** Under a text file cut short, with the size shown, already formatted. */
    previewTruncated: (size: string) => string;
    /** Why a file couldn't be shown, when the browser couldn't load or show it. */
    previewMediaFailed: string;
    /** Why a file couldn't be shown, when the adapter didn't say. */
    previewLoadFailed: string;
    /** Why a text file couldn't be read, when its URL answered with an error. */
    serverError: (status: number, statusText: string) => string;
    zoomIn: string;
    zoomOut: string;
    zoomFit: string;
}

/**
 * What `FileManager` hands its parts through `LocaleContext`: its `localeText` over the English
 * defaults, and formats and comparisons in its `locale`.
 */
export interface Locale {
    /** Every key filled in. */
    text: FileManagerLocaleText;
    /** A number in the locale's digits, without grouping, as dimensions and counters show it. */
    formatNumber: (value: number) => string;
    /** A fraction as a whole percentage, e.g. 1.5 as "150%". */
    formatPercent: (value: number) => string;
    /** Bytes in decimal units, as GNOME Files shows them: "999 bytes", "1.5 kB". */
    formatSize: (bytes: number) => string;
    /** A file's size, or how many entries a folder holds, or a dash when it isn't known. */
    describeSize: (entry: FileEntry) => string;
    /** When an entry was modified, or a dash when it isn't known. */
    describeDate: (entry: FileEntry) => string;
    /** A short type label from the MIME type, falling back to the extension. */
    describeType: (entry: FileEntry) => string;
    /** Names in natural order, so "file2" comes before "file10", case and accents aside. */
    compareNames: (a: string, b: string) => number;
    /** Whether two strings have the same letters, case and accents aside, for type-ahead. */
    sameLetters: (a: string, b: string) => boolean;
}
