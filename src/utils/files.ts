import type { DroppedFiles, Section } from "../types";

/**
 * The files a drop or a paste carries, read while its event lasts. Folders show up among the files
 * too, as empty ones, so they're told apart by their entry and only named.
 */
export const filesIn = (data: DataTransfer): DroppedFiles => {
    const files: File[] = [];
    const folders: string[] = [];

    Array.from(data.items).forEach((item) => {
        if (item.kind !== "file") {
            return;
        }

        const entry = item.webkitGetAsEntry();
        const file = item.getAsFile();

        if (entry?.isDirectory) {
            folders.push(entry.name);
        } else if (file) {
            files.push(file);
        }
    });

    return { files, folders };
};

/** Whether a section takes uploads at all; an `acceptUploads` string limits which files. */
export const takesUploads = (section: Section) => section.acceptUploads !== false;

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
