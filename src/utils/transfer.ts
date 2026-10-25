import type { Clash, FileEntry } from "../types";

/**
 * The names of `entries`, or of files and folders being uploaded, that a folder's listing already
 * has, which a transfer or upload into it would clash with, with what has each there.
 */
export const findClashes = (
    entries: readonly Pick<FileEntry, "name" | "kind">[],
    listing: FileEntry[] | undefined,
): Clash[] => {
    const byName = new Map(listing?.map((entry): [string, FileEntry["kind"]] => [entry.name, entry.kind]));

    return entries.flatMap(({ name, kind }) => {
        const there = byName.get(name);

        return there ? [{ name, kind, there }] : [];
    });
};

/**
 * Ids of the folders in a folder's listing that a transfer of `entries` into it with "replace"
 * merges folders of their names into, so what's in them may change all the way down.
 */
export const mergedFolders = (entries: readonly FileEntry[], listing: FileEntry[] | undefined) => {
    const names = new Set(entries.filter((entry) => entry.kind === "folder").map((entry) => entry.name));

    return (listing ?? []).filter((entry) => entry.kind === "folder" && names.has(entry.name)).map((entry) => entry.id);
};
