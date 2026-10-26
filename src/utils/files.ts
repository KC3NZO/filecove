import { sectionLocked } from "./sections";

import type { DroppedFiles, FolderContents, FolderSource, Section } from "../types";

// What a folder dropped or pasted holds, read a batch at a time, as a browser hands over at most
// 100 entries per call.
const entriesOf = async (folder: FileSystemDirectoryEntry) => {
    const reader = folder.createReader();
    const entries: FileSystemEntry[] = [];

    for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));

        if (batch.length === 0) {
            return entries;
        }

        entries.push(...batch);
    }
};

const fileOf = (entry: FileSystemFileEntry) => new Promise<File>((resolve, reject) => entry.file(resolve, reject));

/** Everything in a folder dropped or pasted, folders and all. */
const readFolder = async (folder: FileSystemDirectoryEntry): Promise<FolderContents> => {
    const entries = await entriesOf(folder);
    const [files, folders] = await Promise.all([
        Promise.all(entries.filter((entry) => entry.isFile).map((entry) => fileOf(entry as FileSystemFileEntry))),
        Promise.all(
            entries.filter((entry) => entry.isDirectory).map((entry) => readFolder(entry as FileSystemDirectoryEntry)),
        ),
    ]);

    return { name: folder.name, files, folders };
};

/**
 * The files and folders a drop or a paste carries, taken while its event lasts. Folders show up
 * among the files too, as empty ones, so they're told apart by their entry, which can still be read
 * once the event is over, as their uploads start.
 */
export const filesIn = (data: DataTransfer): DroppedFiles => {
    const files: File[] = [];
    const folders: FolderSource[] = [];

    Array.from(data.items).forEach((item) => {
        if (item.kind !== "file") {
            return;
        }

        const entry = item.webkitGetAsEntry();
        const file = item.getAsFile();

        if (entry?.isDirectory) {
            const folder = entry as FileSystemDirectoryEntry;

            folders.push({ name: folder.name, read: () => readFolder(folder) });
        } else if (file) {
            files.push(file);
        }
    });

    return { files, folders };
};

/** Whether the browser's file picker can pick a folder (`webkitdirectory`). */
export const picksFolders = () =>
    typeof HTMLInputElement !== "undefined" && "webkitdirectory" in HTMLInputElement.prototype;

/**
 * The folder the browser's folder picker handed over, put together from its files' paths
 * (`webkitRelativePath`, "photos/2024/a.jpg"). The picker leaves out folders with no file below
 * them, so there's none when the folder picked holds no file.
 */
export const pickedFolder = (files: File[]): FolderSource | undefined => {
    const top: FolderContents = { name: "", files: [], folders: [] };
    const byPath = new Map<string, FolderContents>([["", top]]);

    files.forEach((file) => {
        const names = file.webkitRelativePath.split("/").slice(0, -1);
        let folder = top;
        let path = "";

        names.forEach((name) => {
            path += `/${name}`;

            let child = byPath.get(path);

            if (!child) {
                child = { name, files: [], folders: [] };
                byPath.set(path, child);
                folder.folders.push(child);
            }

            folder = child;
        });

        folder.files.push(file);
    });

    const [picked] = top.folders;

    return picked && { name: picked.name, read: () => Promise.resolve(picked) };
};

/**
 * Whether a section takes uploads at all: not when it's `readOnly` or the trash, nor when
 * `acceptUploads` is false. An `acceptUploads` string limits which files.
 */
export const takesUploads = (section: Section) => section.acceptUploads !== false && !sectionLocked(section);

/**
 * The patterns of the section's `acceptUploads` string, as a file input reads its `accept`:
 * extensions (".pdf"), MIME types ("image/png") and their wildcards ("image/*"), lowercased. Null
 * when it takes any file: `true`, left out, or a string with no pattern, or with the one for every
 * type.
 */
export const uploadPatterns = (section: Section): string[] | null => {
    const rule = section.acceptUploads;

    if (typeof rule !== "string") {
        return null;
    }

    const patterns = rule
        .split(",")
        .map((pattern) => pattern.trim().toLowerCase())
        .filter(Boolean);

    return patterns.length > 0 && !patterns.includes("*/*") ? patterns : null;
};

// A MIME type without its parameters, so "text/plain;charset=utf-8" is "text/plain".
const bareType = (type: string) => type.split(";")[0].trim().toLowerCase();

const matches = (pattern: string, name: string, type: string) => {
    if (pattern.startsWith(".")) {
        return name.endsWith(pattern);
    }

    return pattern.endsWith("/*") ? type.startsWith(pattern.slice(0, -1)) : type === pattern;
};

/**
 * Whether a file matches any of the patterns, by its name's extension or its MIME type. A file the
 * browser gives no type, as it does for extensions it doesn't know, only matches an extension.
 */
export const acceptsFile = (patterns: readonly string[] | null, file: File) => {
    const name = file.name.toLowerCase();
    const type = bareType(file.type);

    return !patterns || patterns.some((pattern) => matches(pattern, name, type));
};

/**
 * Whether files being dragged in could match, from what a drag tells before the drop: each file's
 * type, but not its name. So with an extension among the patterns, or a file of no type (a folder,
 * or a type the browser doesn't know), they may, and the check at the drop decides.
 */
export const mayAccept = (patterns: readonly string[] | null, items: DataTransferItemList) => {
    if (!patterns || patterns.some((pattern) => pattern.startsWith("."))) {
        return true;
    }

    const files = Array.from(items).filter((item) => item.kind === "file");

    return (
        files.length === 0 ||
        files.some((item) => !item.type || patterns.some((pattern) => matches(pattern, "", bareType(item.type))))
    );
};
