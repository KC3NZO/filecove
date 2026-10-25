import type { FileManagerLocaleText, UndoChange } from "../types";

// A change undone or redone, as the menu's items name it: "Undo rename".
const CHANGES: Record<UndoChange, string> = {
    rename: "rename",
    newFolder: "new folder",
    copy: "copy",
    move: "move",
};

const UNDONE: Record<UndoChange, string> = {
    rename: "Rename undone",
    newFolder: "New folder undone",
    copy: "Copy undone",
    move: "Move undone",
};

const itOrThem = (count: number) => (count === 1 ? "it" : "them");

// An entry by name, or several by count.
const entries = (count: number, name: string) => (count === 1 ? `“${name}”` : `${count} items`);

const files = (count: number) => (count === 1 ? "1 file" : `${count} files`);

const items = (count: number) => (count === 1 ? "1 item" : `${count} items`);

const downloads = (count: number) => (count === 1 ? "a download" : `${count} downloads`);

const folders = (count: number) => (count === 1 ? "1 folder" : `${count} folders`);

// Files and folders together, leaving out a count of none unless both are.
const filesAndFolders = (fileCount: number, folderCount: number) => {
    if (fileCount > 0 && folderCount > 0) {
        return `${files(fileCount)} and ${folders(folderCount)}`;
    }

    return folderCount > 0 ? folders(folderCount) : files(fileCount);
};

/**
 * The component's own text in US English, which every key left out of `localeText` falls back to.
 * It has every key, so it's the place to start a translation from.
 */
export const enUS: FileManagerLocaleText = {
    loading: "Loading",
    cancel: "Cancel",
    close: "Close",
    back: "Back",
    tryAgain: "Try again",

    itemCount: (count) => (count === 1 ? "1 item" : `${count} items`),
    typeFolder: "Folder",
    typeFile: "File",
    typeImage: "Image",
    typeVideo: "Video",
    typeAudio: "Audio",
    typeText: "Text",
    typeArchive: "Archive",

    sortBy: "Sort by",
    sortName: "Name",
    sortSize: "Size",
    sortType: "Type",
    sortModified: "Modified",
    sortRelevance: "Relevance",
    sortAToZ: "A to Z",
    sortZToA: "Z to A",
    sortSmallestFirst: "Smallest first",
    sortLargestFirst: "Largest first",
    sortOldestFirst: "Oldest first",
    sortNewestFirst: "Newest first",
    sortedColumn: (order) => `, sorted ${order}`,

    showSidebar: "Show sidebar",
    forward: "Forward",
    select: "Select",
    doneSelecting: "Done selecting",
    search: "Search",
    searchFolder: "Search in folder",
    searchEverywhere: "Search everywhere",
    searchIn: (folder) => `Search in ${folder}`,
    searchInSections: (count) => (count === 1 ? "Search in 1 section" : `Search in ${count} sections`),
    searchSections: "Sections to search",
    allSections: "All sections",
    sectionCount: (count) => (count === 1 ? "1 section" : `${count} sections`),
    clearSearch: "Clear search",
    closeSearch: "Close search",
    gridView: "Grid view",
    listView: "List view",
    viewOptions: "View options",
    showHiddenFiles: "Show hidden files",
    showHiddenFilesShortcut: "Ctrl+H",
    zoom: "Zoom",
    zoomReset: "Reset zoom",
    zoomResetFrom: (percent) => `${percent}, reset zoom`,
    zoomChanged: (percent) => `Zoom ${percent}`,
    path: "Path",
    folderMenu: "Folder menu",

    sidebarTitle: "Files",
    mainMenu: "Main menu",
    sidebar: "Sidebar",
    sections: "Sections",
    noFolders: "No folders",
    folderLoadFailed: "Couldn't load",
    retry: "Retry",

    noSections: "No sections to show",
    folderEmpty: "Folder is empty",
    folderOpenFailed: "Couldn't open this folder",
    searchNoResults: "No results found",
    searchNoResultsHint: "Try a different search",
    searchResultCount: (count) => (count === 0 ? "No results" : count === 1 ? "1 result" : `${count} results`),
    searchResults: "Search results",
    searchAll: "All",
    searchTabs: "Results by section",
    searchLocation: "Location",
    searchFailed: (section) => `Couldn't search ${section}`,
    searchSomeFailed: "Some sections couldn't be searched",
    selectedCount: (count) => (count === 1 ? "1 item selected" : `${count} items selected`),
    selectItems: "Select items",
    selectionCount: (count) => `${count} selected`,
    selectAll: "Select all",
    selectNone: "Select none",
    selectionActions: "Actions for the selection",

    newFolder: "New folder",
    untitledFolder: (number) => (number === 1 ? "New folder" : `New folder (${number})`),
    renameTitle: (kind) => `Rename ${kind}`,
    nameLabel: (kind) => (kind === "folder" ? "Folder name" : "File name"),
    create: "Create",
    rename: "Rename",
    nameReserved: (name, kind) => `A ${kind} can't be called "${name}".`,
    nameHasSlash: (kind) => `${kind === "folder" ? "Folder" : "File"} names can't contain "/".`,
    nameTaken: (kind) => `A ${kind} with that name already exists.`,
    createFailed: "Couldn't create the folder.",
    renameFailed: (kind) => `Couldn't rename the ${kind}.`,
    createDone: (name) => `Created folder “${name}”`,
    renameDone: (name, newName) => `Renamed “${name}” to “${newName}”`,

    delete: "Delete",
    deleteTitle: (count, name) => `Delete ${entries(count, name)}?`,
    deleteWarning: (count, hasFolders) => {
        if (!hasFolders) {
            return "This can't be undone.";
        }

        return count === 1
            ? "Everything in it is deleted too. This can't be undone."
            : "Folders are deleted with everything in them. This can't be undone.";
    },
    deleteFailed: (count) => `Couldn't delete ${itOrThem(count)}.`,
    deleteDone: (count, name) => `Deleted ${entries(count, name)}`,

    copyToTitle: (count, name) => `Copy ${entries(count, name)} to…`,
    moveToTitle: (count, name) => `Move ${entries(count, name)} to…`,
    copyHere: "Copy here",
    moveHere: "Move here",
    pickerLocations: "Locations",
    pickerFolders: (folderName) => `Folders in ${folderName}`,
    pickerReadOnly: "This folder is read-only",
    pickerMoving: "This folder is being moved",
    folderLocked: "Read-only",
    entryMoving: "Being moved",
    copyTitle: (count, name) => `Copy ${entries(count, name)}`,
    moveTitle: (count, name) => `Move ${entries(count, name)}`,
    copyFailedNotice: (count, name, folderName) => `Couldn't copy ${entries(count, name)} to “${folderName}”`,
    moveFailedNotice: (count, name, folderName) => `Couldn't move ${entries(count, name)} to “${folderName}”`,
    copyDone: (count, name, folderName) => `Copied ${entries(count, name)} to “${folderName}”`,
    moveDone: (count, name, folderName) => `Moved ${entries(count, name)} to “${folderName}”`,
    clipboardCut: (count, name) => `Cut ${entries(count, name)}, ready to paste`,
    clipboardCopied: (count, name) => `Copied ${entries(count, name)}, ready to paste`,

    undo: "Undo",
    redo: "Redo",
    undoChange: (change) => `Undo ${CHANGES[change]}`,
    redoChange: (change) => `Redo ${CHANGES[change]}`,
    undone: (change) => UNDONE[change],
    undoFailed: (change) => `Couldn't undo the ${CHANGES[change]}`,
    redoFailed: (change) => `Couldn't redo the ${CHANGES[change]}`,
    undoChanged: (count, name) =>
        count === 1
            ? `“${name}” has changed since, so nothing was done.`
            : `${count} items have changed since, so nothing was done.`,
    undoNotEmpty: (name) => `“${name}” isn't empty any more, so it's kept.`,
    undoCopyTitle: (count, name) => `Undo copying ${entries(count, name)}?`,
    undoCopyWarning: (count, folderName) =>
        count === 1
            ? `The copy in “${folderName}” is deleted for good.`
            : `The ${count} copies in “${folderName}” are deleted for good.`,

    conflictMessage: (count, name, folderName) =>
        count === 1
            ? `“${name}” already exists in “${folderName}”.`
            : `${count} items already exist in “${folderName}”.`,
    conflictSharedMessage: (count, name, folderName) =>
        count === 1
            ? `Another item going into “${folderName}” is also named “${name}”.`
            : `${count} items going into “${folderName}” have the same names as others going there.`,
    conflictSharedToo: (count, name) =>
        count === 1
            ? `“${name}” is also the name of another item going there.`
            : `${count} more have the same names as other items going there.`,
    conflictHint: (count) => `Replace what is there, keep both with new names, or skip ${itOrThem(count)}.`,
    conflictMergeHint: (count) =>
        count === 1
            ? "Merge what's in it into the folder already there, replacing files with the same names, keep both " +
              "with a new name, or skip it."
            : "Merge the folders into the ones already there, replacing files with the same names, keep both " +
              "with new names, or skip them.",
    conflictKindHint: (count, kind) =>
        count === 1
            ? `A ${kind === "folder" ? "file can't replace a folder" : "folder can't replace a file"}. Keep both ` +
              "with a new name, or skip it."
            : "A file and a folder can't replace each other. Keep both with new names, or skip them.",
    conflictLockedHint: (count, kind) =>
        count === 1
            ? `The ${kind} there is read-only, so it can't be ${kind === "folder" ? "merged into" : "replaced"}. ` +
              "Keep both with a new name, or skip it."
            : "The items there are read-only, so they can't be replaced. Keep both with new names, or skip them.",
    conflictNothingReplacedHint:
        "Nothing there can be replaced: some of it is read-only, and a file and a folder can't replace each " +
        "other. Keep both with new names, or skip them.",
    conflictReplaceMerges: (count) =>
        count === 1
            ? "Replacing a folder merges what's in it into the one already there."
            : "Replacing folders merges what's in them into the ones already there.",
    conflictKindKept: (count, name) =>
        `A file and a folder can't replace each other, so ${
            count === 1 ? `“${name}” would get a new name` : `${count} items would get new names`
        }.`,
    conflictLockedKept: (count, name) =>
        count === 1
            ? `“${name}” is read-only there, so the one coming in would get a new name.`
            : `${count} items are read-only there, so the ones coming in would get new names.`,
    skip: "Skip",
    keepBoth: "Keep both",
    replace: "Replace",
    merge: "Merge",

    upload: "Upload",
    uploadTitle: (count, name, folderName) => `Upload ${entries(count, name)} to “${folderName}”`,
    uploadFoldersFailedTitle: (count, name) => `Couldn't upload ${count === 1 ? `“${name}”` : `${count} folders`}`,
    uploadFoldersOnly: "Folders can't be uploaded here, only files.",
    uploadFoldersLeftOut: (count, name) =>
        `Folders can't be uploaded here, so ${count === 1 ? `“${name}” is` : `${count} folders are`} left out.`,
    uploadFailedTitle: (count, name) => `Couldn't upload ${count === 1 ? `“${name}”` : `${count} items`}`,
    uploadTypesOnly: (sectionName, types) => `“${sectionName}” only takes these types of files: ${types}.`,
    uploadTypesLeftOut: (count, name, sectionName, types) =>
        `${count === 1 ? `“${name}” is` : `${count} files are`} left out, since “${sectionName}” only takes ` +
        `these types of files: ${types}.`,
    uploadNamesRefused: (count, name, reason) =>
        count === 1
            ? `“${name}” can't be uploaded here: ${reason}`
            : `${count} items can't be uploaded here, as their names aren't allowed, such as “${name}”: ${reason}`,
    uploadShown: (name, folderName) => `Showing “${name}” in “${folderName}”`,

    download: "Download",

    showProperties: "Show properties",
    propertiesShown: "Properties shown",
    propertiesHidden: "Properties hidden",
    resizeProperties: "Resize properties",
    resizeSidebar: "Resize sidebar",

    previous: "Previous",
    next: "Next",
    previewPosition: (name, position, count) => `${name}, ${position} of ${count}`,
    previewUnavailable: "No preview available",
    modifiedOn: (date) => `Modified ${date}`,
    previewFailed: "Couldn't preview this file",
    fileEmpty: "File is empty",
    previewTruncated: (size) => `Showing the first ${size}`,
    previewMediaFailed: "The browser couldn't load it, or can't show this kind of file.",
    previewLoadFailed: "Couldn't get the file.",
    serverError: (status, statusText) => `The server answered ${status}${statusText && ` ${statusText}`}.`,
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    zoomFit: "Best fit",
    rotateClockwise: "Rotate clockwise",
    rotateCounterclockwise: "Rotate counterclockwise",
    fullScreen: "Full screen",
    exitFullScreen: "Exit full screen",
    moreActions: "More actions",
    previewShowMore: "Show more",
    previewPdfUnavailable: "This browser can't show PDF files here.",
    previewOpenInTab: "Open in a new tab",
    previewFontCharacters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789 .,:;!?&@#%*()[]{}",
    previewFontSample: "The quick brown fox jumps over the lazy dog.",
    previewFontSize: (size) => `${size} px`,

    keyboardShortcuts: "Keyboard shortcuts",
    shortcutsGeneral: "General",
    shortcutsNavigation: "Navigation",
    shortcutsSelection: "Selection",
    shortcutsSearch: "Search",
    shortcutsSidebar: "Sidebar",
    shortcutsPreview: "Preview",
    shortcutsActions: "Actions",
    shortcutContextMenu: "Open the context menu",
    shortcutToggleHidden: "Show or hide hidden files",
    shortcutPasteFiles: "Upload files from the clipboard",
    shortcutToggleSidebar: "Show or hide the sidebar",
    shortcutToggleProperties: "Show or hide the properties",
    shortcutResizePanes: "Resize the sidebar or the properties, on their edge",
    shortcutSwitchPane: "Switch between the sidebar, the content and the properties",
    shortcutExpand: "Expand a folder",
    shortcutCollapse: "Collapse a folder",
    shortcutOpen: "Open the focused item",
    shortcutGoUp: "Go to the folder above",
    shortcutMove: "Move between items",
    shortcutFirstLast: "Go to the first or last item",
    shortcutPage: "Move a page up or down",
    shortcutTypeAhead: "Go to an item by its name",
    shortcutTypeAheadKeys: "Type its first letters",
    shortcutToggleSelected: "Select or deselect the focused item",
    shortcutExtend: "Extend the selection",
    shortcutSelectRange: "Select up to the focused item",
    shortcutMoveOnly: "Move without selecting",
    shortcutSearchResults: "Go from the search field to the results",
    shortcutPreviewStep: "Previous or next file",
    shortcutFirstLastFile: "First or last file",
    shortcutZoomOriginal: "Original size",
    shortcutPan: "Move around a zoomed-in image",

    keyCtrl: "Ctrl",
    keyShift: "Shift",
    keyAlt: "Alt",
    keyEnter: "Enter",
    keyEscape: "Esc",
    keySpace: "Space",
    keyBackspace: "Backspace",
    keyDelete: "Delete",
    keyInsert: "Insert",
    keyTab: "Tab",
    keyHome: "Home",
    keyEnd: "End",
    keyPageUp: "Page Up",
    keyPageDown: "Page Down",
    keyMenu: "Menu",
    keyArrows: "Arrow keys",

    uploads: "Uploads",
    uploadsActive: (count) => `Uploading ${files(count)}`,
    uploadsFailed: (count) => `Couldn't upload ${files(count)}`,
    uploadsDone: (count) => `Uploaded ${files(count)}`,
    uploadsCancelled: "Uploads cancelled",
    uploadsPreparing: "Preparing to upload",
    uploadsDoneCount: (count) => `${count} uploaded`,
    uploadsCancelledCount: (count) => `${count} cancelled`,
    uploadProgress: (sent, total) => `${sent} of ${total}`,
    uploadsHide: "Hide the uploads",
    uploadsShow: "Show the uploads",
    uploadsCancelAll: "Cancel every upload",
    uploadsClose: "Close",
    uploadQueued: "Waiting",
    uploadUploading: "Uploading",
    uploadCancelled: "Cancelled",
    uploadFailed: "Couldn't upload it.",
    uploadDone: "Uploaded",
    uploadCancel: (fileName) => `Cancel uploading ${fileName}`,
    uploadRetry: (fileName) => `Upload ${fileName} again`,
    uploadShow: (fileName) => `Show ${fileName} in its folder`,
    uploadPreparing: "Preparing",
    uploadFolderProgress: (done, total) => `${done} of ${files(total)}`,
    uploadFolderDone: (count) => files(count),
    uploadFolderFailed: (count, total) => `Couldn't upload ${count} of ${files(total)}`,
    uploadFolderSkipped: (count) => `${files(count)} of other types left out`,
    uploadFailuresShow: (name) => `Show what failed in ${name}`,
    uploadFailuresHide: (name) => `Hide what failed in ${name}`,
    uploadFailures: (name) => `What failed in ${name}`,
    uploadFailedFolder: (count) =>
        count === 0 ? "Couldn't upload this folder" : `Couldn't upload this folder or the ${files(count)} in it`,
    uploadFailuresMore: (count) => `And ${count} more`,
    keptBothName: (name, number) => `${name} (${number})`,

    downloads: "Downloads",
    downloadsPreparing: (count) => `Preparing ${downloads(count)}`,
    downloadsReady: (count) => (count === 1 ? "A download is ready" : `${count} downloads are ready`),
    downloadsFailed: (count) => (count === 1 ? "A download failed" : `${count} downloads failed`),
    downloadsReadyCount: (count) => `${count} ready`,
    downloadsFailedCount: (count) => `${count} failed`,
    downloadsHide: "Hide the downloads",
    downloadsShow: "Show the downloads",
    downloadsCancelAll: "Cancel every download",
    downloadsClose: "Close",
    downloadItems: (count) => `${count} items`,
    downloadQueued: "Waiting",
    downloadPreparing: "Preparing…",
    downloadProgress: (loaded, total) => `${loaded} of ${total}`,
    downloadReady: "Ready to download",
    downloadFailed: (count) => `Couldn't download ${itOrThem(count)}.`,
    downloadCancel: (count, name) => `Cancel downloading ${entries(count, name)}`,
    downloadRetry: (count, name) => `Download ${entries(count, name)} again`,
    downloadSave: (count, name) => `Download ${entries(count, name)}`,

    transfers: "Copying and moving",
    transfersActive: (copying, moving) => {
        if (copying > 0 && moving > 0) {
            return `Copying ${items(copying)} and moving ${items(moving)}`;
        }

        return copying > 0 ? `Copying ${items(copying)}` : `Moving ${items(moving)}`;
    },
    transfersFailed: (copying, moving) => {
        if (copying > 0 && moving > 0) {
            return `Couldn't copy ${items(copying)} or move ${items(moving)}`;
        }

        return copying > 0 ? `Couldn't copy ${items(copying)}` : `Couldn't move ${items(moving)}`;
    },
    transfersFailedCount: (count) => `${count} failed`,
    transferProgress: (done, total) => `${done} of ${total}`,
    transfersHide: "Hide the copies and moves",
    transfersShow: "Show the copies and moves",
    transfersCancelAll: "Cancel every copy and move",
    transfersClose: "Close",
    transferItems: (count) => `${count} items`,
    transferCopyQueued: (folderName) => `Waiting to copy to “${folderName}”`,
    transferMoveQueued: (folderName) => `Waiting to move to “${folderName}”`,
    transferCopying: (folderName) => `Copying to “${folderName}”`,
    transferMoving: (folderName) => `Moving to “${folderName}”`,
    transferCopyFailed: (count) => `Couldn't copy ${itOrThem(count)}.`,
    transferMoveFailed: (count) => `Couldn't move ${itOrThem(count)}.`,
    transferCopyCancel: (count, name) => `Cancel copying ${entries(count, name)}`,
    transferMoveCancel: (count, name) => `Cancel moving ${entries(count, name)}`,
    transferCopyRetry: (count, name) => `Copy ${entries(count, name)} again`,
    transferMoveRetry: (count, name) => `Move ${entries(count, name)} again`,

    properties: "Properties",
    propertiesClose: "Close the properties",
    propertiesMoreActions: "More actions",
    propertiesNothingSelected: "Select an item to see its properties",
    propertiesItems: (count) => (count === 1 ? "1 item" : `${count} items`),
    propertiesType: "Type",
    propertiesTypeWithMime: (type, mimeType) => `${type} (${mimeType})`,
    propertiesSize: "Size",
    propertiesSizeExact: (size, bytes) => `${size} (${bytes})`,
    propertiesContents: "Contents",
    propertiesTotals: (fileCount, folderCount, size) =>
        fileCount === 0 && folderCount === 0
            ? "Empty"
            : `${filesAndFolders(fileCount, folderCount)}, totalling ${size}`,
    propertiesKinds: (fileCount, folderCount) => filesAndFolders(fileCount, folderCount),
    propertiesCounting: "Counting",
    propertiesLocation: "Location",
    propertiesSeveralFolders: "Several folders",
    propertiesOpenLocation: "Open item location",
    propertiesModified: "Modified",
    propertiesCreated: "Created",
    propertiesDimensions: "Dimensions",
    propertiesDuration: "Duration",
    propertiesRename: "Rename…",
    propertiesLoading: "Loading",
    propertiesFailed: "Couldn't get the rest of the properties.",
    propertiesCountFailed: (count) => `Couldn't count what's in ${itOrThem(count)}.`,
    propertiesTryAgain: "Try again",
    propertiesCopy: (label) => `Copy ${label}`,
    propertiesCopied: (label) => `${label} copied`,
};
