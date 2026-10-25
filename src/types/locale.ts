import type { FileEntry } from "./adapter";

type EntryKind = FileEntry["kind"];

/**
 * What the upload panel says, and the name the upload queue gives a folder to keep both. Kept apart
 * from the rest, since the panel and the queue are meant to be shared with the media manager to come.
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
    /** The panel's title while folders are read, with no file waiting or uploading yet. */
    uploadsPreparing: string;
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
    /** `fileName` is the file's name, or the folder's for a folder. */
    uploadCancel: (fileName: string) => string;
    uploadRetry: (fileName: string) => string;
    /** The button on an uploaded file or folder that shows it in the folder it went into. */
    uploadShow: (fileName: string) => string;
    /** A folder's status while what's in it is read, before its files are known. */
    uploadPreparing: string;
    /** A folder's status while it uploads: how many of its files are uploaded so far. */
    uploadFolderProgress: (done: number, total: number) => string;
    /** A folder's status once it's uploaded: how many files it took. */
    uploadFolderDone: (count: number) => string;
    /** A folder's status once it failed: how many of its files couldn't be uploaded. */
    uploadFolderFailed: (count: number, total: number) => string;
    /** Beside a folder's status, how many files in it were left out for their type. */
    uploadFolderSkipped: (count: number) => string;
    /** The button unfolding what failed in a folder uploaded, and folding it away; `name` is the folder's. */
    uploadFailuresShow: (name: string) => string;
    uploadFailuresHide: (name: string) => string;
    /** The list of what failed in a folder uploaded, for screen readers. */
    uploadFailures: (name: string) => string;
    /** Why a folder in a folder uploaded failed, when it was its own call that did. `count` is its files. */
    uploadFailedFolder: (count: number) => string;
    /** Under what failed in a folder uploaded, how many more did than are listed. */
    uploadFailuresMore: (count: number) => string;
    /**
     * The name a folder uploaded is made under to keep both, when a file or folder where it goes
     * has its name, as the folder uploaded or as a folder in it going into a folder merged into:
     * the first free one, counting from 2. `name` comes as it is, not isolated, since this is a name.
     */
    keptBothName: (name: string, number: number) => string;
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
 * What the copy and move panel says. Kept apart from the rest, as the upload and download panels'
 * are, since the panel is meant to be shared with the media manager to come. A copy or move is of
 * one entry, its `name` given, or of `count` of them, and `folderName` is where it goes.
 */
export interface TransferLocaleText {
    /** The panel's name for screen readers. */
    transfers: string;
    /**
     * The panel's title while copies or moves wait or are under way: how many entries are being
     * copied, and how many moved. Either may be 0, never both.
     */
    transfersActive: (copying: number, moving: number) => string;
    /**
     * The panel's title once nothing is under way and some copies or moves failed: how many
     * entries couldn't be copied, and how many moved. Either may be 0, never both.
     */
    transfersFailed: (copying: number, moving: number) => string;
    /** Under the title, how many entries couldn't be copied or moved, when others are under way. */
    transfersFailedCount: (count: number) => string;
    /** How much has been copied or moved of the total, both already formatted, e.g. "1.5 MB" and "4 MB". */
    transferProgress: (done: string, total: string) => string;
    transfersHide: string;
    transfersShow: string;
    transfersCancelAll: string;
    transfersClose: string;
    /** Several entries copied or moved together, named by how many. */
    transferItems: (count: number) => string;
    /** A copy's status while it waits for its turn. */
    transferCopyQueued: (folderName: string) => string;
    /** A move's status while it waits for its turn. */
    transferMoveQueued: (folderName: string) => string;
    /** A copy's status while it's under way, beside how far it has got once the adapter says. */
    transferCopying: (folderName: string) => string;
    /** A move's status while it's under way, beside how far it has got once the adapter says. */
    transferMoving: (folderName: string) => string;
    /** Why a copy failed, when the adapter didn't say. */
    transferCopyFailed: (count: number) => string;
    /** Why a move failed, when the adapter didn't say. */
    transferMoveFailed: (count: number) => string;
    transferCopyCancel: (count: number, name: string) => string;
    transferMoveCancel: (count: number, name: string) => string;
    transferCopyRetry: (count: number, name: string) => string;
    transferMoveRetry: (count: number, name: string) => string;
}

/**
 * What the properties panel says. Kept apart from the rest, as the upload and download panels'
 * are, since the panel is meant to be shared with the media manager to come. The backend's own
 * properties come labelled by the consumer, in their language.
 */
export interface PropertiesLocaleText {
    /** The panel's title, and its name for screen readers. */
    properties: string;
    propertiesClose: string;
    /** The header's button holding the app's actions that don't fit there, or have no icon. */
    propertiesMoreActions: string;
    /** In place of the properties while nothing is selected among a search's results. */
    propertiesNothingSelected: string;
    /** Several entries named by how many, and how many entries a folder holds while they can't be counted down. */
    propertiesItems: (count: number) => string;
    propertiesType: string;
    /** A type label with the MIME type it was told by, e.g. "Image" and "image/png". */
    propertiesTypeWithMime: (type: string, mimeType: string) => string;
    propertiesSize: string;
    /** A size with its exact bytes, both already formatted, e.g. "4.2 MB" and "4,213,045 bytes". */
    propertiesSizeExact: (size: string, bytes: string) => string;
    propertiesContents: string;
    /**
     * What's in folders, counted all the way down, or several entries and what's in them, the size
     * already formatted, e.g. "12 files and 3 folders, totalling 4.5 MB". Both counts may be 0.
     */
    propertiesTotals: (files: number, folders: number, size: string) => string;
    /** Several entries, when what's in their folders can't be counted: "2 files and 1 folder". */
    propertiesKinds: (files: number, folders: number) => string;
    /** Read for the spinner beside totals still being counted. */
    propertiesCounting: string;
    propertiesLocation: string;
    /** In place of the location of entries in different folders, as a search's results may be. */
    propertiesSeveralFolders: string;
    /** The button on a search's result that opens the folder it's in. */
    propertiesOpenLocation: string;
    propertiesModified: string;
    propertiesCreated: string;
    propertiesDimensions: string;
    propertiesDuration: string;
    /** The button that asks for a new name. */
    propertiesRename: string;
    /** Read while the backend's own properties are being asked for. */
    propertiesLoading: string;
    /** Why the backend's own properties couldn't be had, when the adapter didn't say. */
    propertiesFailed: string;
    /** Why what's in folders couldn't be counted, when the adapter didn't say; `count` is the folders. */
    propertiesCountFailed: (count: number) => string;
    propertiesTryAgain: string;
    /** The button copying a property's value; `label` is the property's. */
    propertiesCopy: (label: string) => string;
    /** Read once a value is copied; `label` is the property's. */
    propertiesCopied: (label: string) => string;
}

/**
 * Every text `FileManager` shows or reads to screen readers, apart from what the consumer passes it
 * (section and action labels, `title`). Texts about entries are functions, so each language words
 * and pluralizes them its own way. Counts come as plain numbers, and `name` is the entry's name,
 * meant for when `count` is 1. `kind` is "file" or "folder".
 */
export interface FileManagerLocaleText
    extends UploadLocaleText, DownloadLocaleText, TransferLocaleText, PropertiesLocaleText {
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
    /** The search field's name for screen readers. */
    search: string;
    /** The button by the path bar that searches the open folder. */
    searchFolder: string;
    /** The magnifier at the top of the sidebar that searches every section, and the field's placeholder then. */
    searchEverywhere: string;
    /**
     * The search field's placeholder, with the name of the folder searched in, e.g. "Search in
     * Documents", or of the one section a search everywhere is left with.
     */
    searchIn: (folder: string) => string;
    /** The search field's placeholder while a search everywhere covers some of the sections. */
    searchInSections: (count: number) => string;
    /** The search field's button for the menu of sections a search everywhere covers. */
    searchSections: string;
    /** That button's text, and the menu's first item, while every section is checked. */
    allSections: string;
    /** That button's text while only some sections are checked. */
    sectionCount: (count: number) => string;
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
    /**
     * The view menu's zoom row, between its label and the buttons zooming out (`zoomOut`) and in
     * (`zoomIn`, both shared with the preview), and the name screen readers hear for the row.
     */
    zoom: string;
    /** Ctrl+0, and the tooltip of the view menu's percentage, putting the list's or the grid's zoom back to its start. */
    zoomReset: string;
    /** The view menu's percentage for screen readers, with the size already formatted ("150%"). */
    zoomResetFrom: (percent: string) => string;
    /** Read to screen readers as the content zooms, with the size already formatted ("150%"). */
    zoomChanged: (percent: string) => string;
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
    /** In place of the content while the file manager has no section, as while an app is still getting them. */
    noSections: string;
    folderEmpty: string;
    folderOpenFailed: string;
    /** In place of the entries while a search matches none of them. */
    searchNoResults: string;
    /** Below `searchNoResults`. */
    searchNoResultsHint: string;
    /**
     * Read to screen readers as a search's results change, "3 results" or none, and after a
     * section's name on its tab of a search everywhere's results.
     */
    searchResultCount: (count: number) => string;
    /** Names the list of a search everywhere's results for screen readers. */
    searchResults: string;
    /** The tab of a search everywhere's results that shows every section's. */
    searchAll: string;
    /** Names the tabs of a search everywhere's results, one per section, for screen readers. */
    searchTabs: string;
    /** The list's column, among a search everywhere's results, saying which folder each is in. */
    searchLocation: string;
    /** In place of a section's results, or on its tab, when its adapter couldn't search it. */
    searchFailed: (section: string) => string;
    /** In place of every section's results when some couldn't be searched and the rest found nothing. */
    searchSomeFailed: string;
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
    /** Read to screen readers once a folder is made, unless the focus goes to it. */
    createDone: (name: string) => string;
    /** Read to screen readers once an entry is renamed, unless the focus goes to it. */
    renameDone: (name: string, newName: string) => string;

    // Deleting
    delete: string;
    deleteTitle: (count: number, name: string) => string;
    /** Whether any of them is a folder, which goes with everything in it. */
    deleteWarning: (count: number, hasFolders: boolean) => string;
    /** Why deleting failed, when the adapter didn't say. */
    deleteFailed: (count: number) => string;
    /** Read to screen readers once the entries are deleted. */
    deleteDone: (count: number, name: string) => string;

    // Copying and moving
    copyToTitle: (count: number, name: string) => string;
    moveToTitle: (count: number, name: string) => string;
    copyHere: string;
    moveHere: string;
    /** The picker's list of sections. */
    pickerLocations: string;
    /** The picker's list of the folders in a folder, for screen readers. */
    pickerFolders: (folderName: string) => string;
    /** Beside the picker's disabled "Copy here" or "Move here", in a folder nothing can be put in. */
    pickerReadOnly: string;
    /** Beside the picker's disabled "Copy here" or "Move here", in a folder a move under way is moving. */
    pickerMoving: string;
    /**
     * Read to screen readers after the name of a folder nothing can be put in, which shows a lock
     * (`EntryPermissions.write` false), in the list, the grid, the sidebar tree and the picker.
     */
    folderLocked: string;
    /**
     * Read to screen readers after the name of an entry a move under way is moving, itself or with
     * a folder it's in, which shows faded until the move ends, in the list, the grid, the sidebar
     * tree and the picker. It's read in place of `folderLocked`.
     */
    entryMoving: string;
    /** The title of a paste asking about names the folder already has. */
    copyTitle: (count: number, name: string) => string;
    moveTitle: (count: number, name: string) => string;
    /**
     * Read to screen readers as a copy fails while the copy and move panel wasn't showing, since a
     * panel just shown isn't read out; once it shows, its title says so.
     */
    copyFailedNotice: (count: number, name: string, folderName: string) => string;
    /** Read to screen readers as a move fails while the copy and move panel wasn't showing. */
    moveFailedNotice: (count: number, name: string, folderName: string) => string;
    /** Read to screen readers once entries are copied, by a paste, a drop or "Copy to…". */
    copyDone: (count: number, name: string, folderName: string) => string;
    /** Read to screen readers once entries are moved, by a paste, a drop or "Move to…". */
    moveDone: (count: number, name: string, folderName: string) => string;
    /** Read to screen readers as entries are cut, to be moved where they're pasted. */
    clipboardCut: (count: number, name: string) => string;
    /** Read to screen readers as entries are copied, to be copied where they're pasted. */
    clipboardCopied: (count: number, name: string) => string;

    // Names a folder already has, when copying, moving or uploading into it
    /** `name` is the one clashing name, meant for when `count` is 1. */
    conflictMessage: (count: number, name: string, folderName: string) => string;
    /** When a file clashes with a file: Replace, Keep both or Skip. `count` is every name that clashes. */
    conflictHint: (count: number) => string;
    /**
     * In place of `conflictHint`, when no file clashes with a file but a folder does with a folder:
     * Merge, Keep both or Skip. `count` is every name that clashes.
     */
    conflictMergeHint: (count: number) => string;
    /**
     * In place of `conflictHint`, when every name clashes with one of the other kind, a file with a
     * folder or a folder with a file, which can't replace each other: Keep both or Skip. `kind` is
     * what has the name there, meant for when `count` is 1.
     */
    conflictKindHint: (count: number, kind: EntryKind) => string;
    /** Beside `conflictHint`, when folders clash with folders too: what Replace does to them. */
    conflictReplaceMerges: (count: number) => string;
    /**
     * Beside `conflictHint` or `conflictMergeHint`, when some names clash with one of the other kind:
     * what Replace or Merge does to those. `name` is the one's, meant for when `count` is 1.
     */
    conflictKindKept: (count: number, name: string) => string;
    skip: string;
    keepBoth: string;
    replace: string;
    /** In place of Replace, when no file clashes with a file but a folder does with a folder. */
    merge: string;

    // Uploading
    upload: string;
    /** `count` is the files and folders together; `name` is the one's name, meant for when `count` is 1. */
    uploadTitle: (count: number, name: string, folderName: string) => string;
    /** When only folders were dropped. `name` is the folder's name, meant for when `count` is 1. */
    uploadFoldersFailedTitle: (count: number, name: string) => string;
    uploadFoldersOnly: string;
    /** When folders were dropped with files. `name` is the folder's name, meant for when `count` is 1. */
    uploadFoldersLeftOut: (count: number, name: string) => string;
    /**
     * When nothing dropped, picked or pasted can be uploaded, with files of types the section doesn't
     * take among them. `count` is every file and folder; `name` is the one's name, for when it's 1.
     */
    uploadFailedTitle: (count: number, name: string) => string;
    /**
     * Why: the section, by its label, takes only `types`, already listed the locale's way from the
     * type labels ("Image, Video, and PDF").
     */
    uploadTypesOnly: (sectionName: string, types: string) => string;
    /** When files of types the section doesn't take were given with others. `name` is for when `count` is 1. */
    uploadTypesLeftOut: (count: number, name: string, sectionName: string, types: string) => string;
    /**
     * When the backend's own rules (the adapter's `checkName`) refuse the names of files or folders
     * given, with others or alone. `name` and `reason` are the first one's, `reason` being the
     * adapter's message.
     */
    uploadNamesRefused: (count: number, name: string, reason: string) => string;
    /**
     * Read to screen readers as an upload is shown in its folder from the panel, which keeps the
     * focus. `name` is the file's or folder's, `folderName` the folder's it went into.
     */
    uploadShown: (name: string, folderName: string) => string;

    // Downloading
    /** The preview's Download button. */
    download: string;

    // Properties, beside the panel's own texts
    /** The view menu's item showing and hiding the docked properties, or opening them over the content. */
    showProperties: string;
    /** Read to screen readers as Alt+Enter shows the docked properties, which leaves the focus where it is. */
    propertiesShown: string;
    /** Read to screen readers as Alt+Enter hides the docked properties, when the focus wasn't in them. */
    propertiesHidden: string;

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
    /** The preview's zoom buttons and keys, and the view menu's, which zoom the content. */
    zoomIn: string;
    zoomOut: string;
    zoomFit: string;
    rotateClockwise: string;
    rotateCounterclockwise: string;
    /** The header's button that fills the screen with the preview, and its key. */
    fullScreen: string;
    exitFullScreen: string;
    /** The header's button holding the app's actions that don't fit there, or have no icon. */
    moreActions: string;
    /** Under a text file cut short, reading as much of it again. */
    previewShowMore: string;
    /** In place of a PDF, on a browser that has no PDF viewer, as some phones' browsers haven't. */
    previewPdfUnavailable: string;
    /** The button beside `previewPdfUnavailable`, which leaves the PDF to the browser in a tab of its own. */
    previewOpenInTab: string;
    /**
     * A font's characters, shown in it, a line each: letters, digits and punctuation in the
     * language's own script, which a translation puts its own in place of.
     */
    previewFontCharacters: string;
    /** A sentence shown in a font at several sizes, in the language's own script. */
    previewFontSample: string;
    /** The size a font's sample is shown at, already formatted. */
    previewFontSize: (size: string) => string;

    // Keyboard shortcuts, in the main menu and the window listing them. Rows reuse texts shown
    // elsewhere too, such as `back`, `selectAll`, `searchFolder` or `zoomIn`.
    /** The main menu's item, and the title of the window listing the keys. */
    keyboardShortcuts: string;
    shortcutsGeneral: string;
    shortcutsNavigation: string;
    shortcutsSelection: string;
    shortcutsSearch: string;
    shortcutsSidebar: string;
    shortcutsPreview: string;
    /** The section listing the consumer's actions and main menu items that have a shortcut. */
    shortcutsActions: string;
    shortcutContextMenu: string;
    shortcutToggleHidden: string;
    /** Ctrl+V and Shift+Insert, uploading files copied on the desktop. */
    shortcutPasteFiles: string;
    shortcutToggleSidebar: string;
    /** Alt+Enter, showing and hiding the properties. */
    shortcutToggleProperties: string;
    /** F6, between the sidebar tree, the content and the docked properties. */
    shortcutSwitchPane: string;
    shortcutExpand: string;
    shortcutCollapse: string;
    shortcutOpen: string;
    shortcutGoUp: string;
    shortcutMove: string;
    shortcutFirstLast: string;
    shortcutPage: string;
    /** Type-ahead, which goes to the next item whose name starts with what's typed. */
    shortcutTypeAhead: string;
    /** In place of keys beside `shortcutTypeAhead`. */
    shortcutTypeAheadKeys: string;
    shortcutToggleSelected: string;
    /** Shift with the arrows. */
    shortcutExtend: string;
    /** Shift+Space, from the anchor to the focused item. */
    shortcutSelectRange: string;
    /** Ctrl with the arrows, which move the focus and leave the selection be. */
    shortcutMoveOnly: string;
    /** Down or Enter in the search field. */
    shortcutSearchResults: string;
    shortcutPreviewStep: string;
    /** Home and End in the preview. */
    shortcutFirstLastFile: string;
    /** The key 1, which shows an image at its own size. */
    shortcutZoomOriginal: string;
    /** The arrows panning an image zoomed in. */
    shortcutPan: string;

    // Keys as the language's keyboards name them ("Strg" in German). Arrows show as arrows,
    // and letters, digits and F-keys as they are.
    keyCtrl: string;
    keyShift: string;
    keyAlt: string;
    keyEnter: string;
    keyEscape: string;
    keySpace: string;
    keyBackspace: string;
    keyDelete: string;
    keyInsert: string;
    keyTab: string;
    keyHome: string;
    keyEnd: string;
    keyPageUp: string;
    keyPageDown: string;
    /** The Menu key, which opens the context menu. */
    keyMenu: string;
    /** Read to screen readers for the four arrows standing for any arrow key. */
    keyArrows: string;
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
    /** A number grouped as the locale groups digits, e.g. "12,345", as a property of the backend's shows it. */
    formatCount: (value: number) => string;
    /** A fraction as a whole percentage, e.g. 1.5 as "150%". */
    formatPercent: (value: number) => string;
    /** Bytes in decimal units, as GNOME Files shows them: "999 bytes", "1.5 kB". */
    formatSize: (bytes: number) => string;
    /** Bytes exactly, grouped: "4,213,045 bytes". */
    formatBytes: (bytes: number) => string;
    /** A date and time in full, for the properties: "Oct 24, 2026, 3:12 PM". */
    formatDate: (date: Date) => string;
    /** A length in seconds as a clock shows it: "4:05", "1:02:03". */
    formatDuration: (seconds: number) => string;
    /** A file's size, or how many entries a folder holds, or a dash when it isn't known. */
    describeSize: (entry: FileEntry) => string;
    /** When an entry was modified, or a dash when it isn't known. */
    describeDate: (entry: FileEntry) => string;
    /** A short type label from the MIME type, falling back to the extension. */
    describeType: (entry: FileEntry) => string;
    /**
     * The types a section's `acceptUploads` patterns take, as `describeType`'s labels, listed the
     * locale's way: "Image, Video, and PDF".
     */
    describeAccepted: (patterns: readonly string[]) => string;
    /** Names in natural order, so "file2" comes before "file10", case and accents aside. */
    compareNames: (a: string, b: string) => number;
    /** Whether two strings have the same letters, case and accents aside, for type-ahead. */
    sameLetters: (a: string, b: string) => boolean;
    /** Text with case and accents left out, to find what's typed in a search within names. */
    foldLetters: (text: string) => string;
}
