import type { FileManagerLocaleText } from "../types";

const itOrThem = (count: number) => (count === 1 ? "it" : "them");

// An entry by name, or several by count.
const entries = (count: number, name: string) => (count === 1 ? `“${name}”` : `${count} items`);

const files = (count: number) => (count === 1 ? "1 file" : `${count} files`);

const downloads = (count: number) => (count === 1 ? "a download" : `${count} downloads`);

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
    path: "Path",
    folderMenu: "Folder menu",

    sidebarTitle: "Files",
    mainMenu: "Main menu",
    sidebar: "Sidebar",
    sections: "Sections",
    noFolders: "No folders",
    folderLoadFailed: "Couldn't load",
    retry: "Retry",

    folderEmpty: "Folder is empty",
    folderOpenFailed: "Couldn't open this folder",
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

    copyToTitle: (count, name) => `Copy ${entries(count, name)} to…`,
    moveToTitle: (count, name) => `Move ${entries(count, name)} to…`,
    copyHere: "Copy here",
    moveHere: "Move here",
    pickerLocations: "Locations",
    pickerFolders: (folderName) => `Folders in ${folderName}`,
    copyTitle: (count, name) => `Copy ${entries(count, name)}`,
    moveTitle: (count, name) => `Move ${entries(count, name)}`,
    copyFailedTitle: (count, name) => `Couldn't copy ${entries(count, name)}`,
    moveFailedTitle: (count, name) => `Couldn't move ${entries(count, name)}`,
    copyFailed: (count) => `Couldn't copy ${itOrThem(count)}.`,
    moveFailed: (count) => `Couldn't move ${itOrThem(count)}.`,

    conflictMessage: (count, name, folderName) =>
        count === 1
            ? `“${name}” already exists in “${folderName}”.`
            : `${count} items already exist in “${folderName}”.`,
    conflictHint: (count) => `Replace what is there, keep both with new names, or skip ${itOrThem(count)}.`,
    skip: "Skip",
    keepBoth: "Keep both",
    replace: "Replace",

    upload: "Upload",
    uploadTitle: (count, name, folderName) =>
        `Upload ${count === 1 ? `“${name}”` : `${count} files`} to “${folderName}”`,
    uploadFoldersFailedTitle: (count, name) => `Couldn't upload ${count === 1 ? `“${name}”` : `${count} folders`}`,
    uploadFoldersOnly: "Folders can't be uploaded yet, only files.",
    uploadFoldersLeftOut: (count, name) =>
        `Folders can't be uploaded yet, so ${count === 1 ? `“${name}” is` : `${count} folders are`} left out.`,

    download: "Download",

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

    uploads: "Uploads",
    uploadsActive: (count) => `Uploading ${files(count)}`,
    uploadsFailed: (count) => `Couldn't upload ${files(count)}`,
    uploadsDone: (count) => `Uploaded ${files(count)}`,
    uploadsCancelled: "Uploads cancelled",
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
};
