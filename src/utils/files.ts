import type { DroppedFiles } from "../types";

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
