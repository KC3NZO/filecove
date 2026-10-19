import type { FileEntry } from "../types";

const sizeFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });

const SIZE_UNITS = ["kB", "MB", "GB", "TB"];

const MIME_LABELS: [prefix: string, label: string][] = [
    ["image/", "Image"],
    ["video/", "Video"],
    ["audio/", "Audio"],
    ["text/", "Text"],
    ["application/pdf", "PDF"],
    ["application/json", "JSON"],
    ["application/zip", "Archive"],
];

/** Decimal units, as GNOME Files shows them. */
export const formatSize = (bytes: number) => {
    if (bytes < 1000) {
        return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
    }

    let value = bytes / 1000;
    let unit = 0;

    while (value >= 1000 && unit < SIZE_UNITS.length - 1) {
        value /= 1000;
        unit += 1;
    }

    return `${sizeFormat.format(value)} ${SIZE_UNITS[unit]}`;
};

export const describeSize = (entry: FileEntry) => {
    if (entry.kind === "folder") {
        return entry.childCount === undefined
            ? "—"
            : `${entry.childCount} ${entry.childCount === 1 ? "item" : "items"}`;
    }

    return entry.size === undefined ? "—" : formatSize(entry.size);
};

export const describeDate = (entry: FileEntry) => (entry.modifiedAt ? dateFormat.format(entry.modifiedAt) : "—");

/** A short type label from the MIME type, falling back to the extension. */
export const describeType = (entry: FileEntry) => {
    if (entry.kind === "folder") {
        return "Folder";
    }

    const mimeType = entry.mimeType;
    const match = mimeType ? MIME_LABELS.find(([prefix]) => mimeType.startsWith(prefix)) : undefined;

    if (match) {
        return match[1];
    }

    const dot = entry.name.lastIndexOf(".");

    return dot > 0 ? entry.name.slice(dot + 1).toUpperCase() : "File";
};
