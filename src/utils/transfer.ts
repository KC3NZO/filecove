import type { Clash, FileAdapter, FileEntry, MovingIds, TransferItem } from "../types";

const NONE: ReadonlySet<string> = new Set();

/**
 * The names of `entries`, or of files and folders being uploaded, that a folder's listing already
 * has, which a transfer or upload into it would clash with, with what has each there, and whether
 * it can be replaced or merged into (`replaceable`, given the entry there).
 */
export const findClashes = (
    entries: readonly Pick<FileEntry, "name" | "kind">[],
    listing: FileEntry[] | undefined,
    replaceable: (entry: FileEntry) => boolean,
): Clash[] => {
    const byName = new Map(listing?.map((entry): [string, FileEntry] => [entry.name, entry]));

    return entries.flatMap(({ name, kind }) => {
        const there = byName.get(name);

        return there ? [{ name, kind, there: there.kind, locked: !replaceable(there) }] : [];
    });
};

/**
 * Ids of the folders in a folder's listing that a transfer of `entries` into it with "replace"
 * merges folders of their names into, so what's in them may change all the way down: those that
 * can be merged into (`replaceable`).
 */
export const mergedFolders = (
    entries: readonly FileEntry[],
    listing: FileEntry[] | undefined,
    replaceable: (entry: FileEntry) => boolean,
) => {
    const names = new Set(entries.filter((entry) => entry.kind === "folder").map((entry) => entry.name));

    return (listing ?? [])
        .filter((entry) => entry.kind === "folder" && names.has(entry.name) && replaceable(entry))
        .map((entry) => entry.id);
};

/** Whether a copy or move is a move still to end, waiting or under way; a failed one has stopped. */
export const isMoving = (item: TransferItem) => item.kind === "move" && item.status !== "failed";

/** The entries the moves among `items` are moving, by the adapter serving them (`isMoving`). */
export const movingIds = (items: readonly TransferItem[]): MovingIds => {
    const moving = new Map<FileAdapter, Set<string>>();

    items.filter(isMoving).forEach(({ adapter, entries }) => {
        const ids = moving.get(adapter) ?? new Set<string>();

        entries.forEach((entry) => ids.add(entry.id));
        moving.set(adapter, ids);
    });

    return moving;
};

/** The ids of the entries being moved through `adapter`. */
export const movingThrough = (moving: MovingIds, adapter: FileAdapter | undefined) =>
    (adapter && moving.get(adapter)) || NONE;
