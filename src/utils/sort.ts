import { describeType } from "./format";

import type { FileEntry, SortDirection, SortKey, SortOrder } from "../types";

interface SortKeyInfo {
    /** The list column's label, which the view menu uses too. */
    label: string;
    /** The direction the key starts in when picked. */
    initial: SortDirection;
    /** How the view menu names each direction for this key. */
    asc: string;
    desc: string;
}

/** In the order the list view's columns show them. */
export const SORT_KEYS: readonly SortKey[] = ["name", "size", "type", "modified"];

// Sizes and dates start largest and newest first, as in most file managers.
export const SORT_KEY_INFO: Record<SortKey, SortKeyInfo> = {
    name: { label: "Name", initial: "asc", asc: "A to Z", desc: "Z to A" },
    size: { label: "Size", initial: "desc", asc: "Smallest first", desc: "Largest first" },
    type: { label: "Type", initial: "asc", asc: "A to Z", desc: "Z to A" },
    modified: { label: "Modified", initial: "desc", asc: "Oldest first", desc: "Newest first" },
};

export const DEFAULT_SORT: SortOrder = { key: "name", direction: "asc" };

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Folders by item count, files by bytes; unknown sizes sort as the smallest. */
const sizeOf = (entry: FileEntry) => (entry.kind === "folder" ? entry.childCount : entry.size) ?? -1;

// Each one ascending. Unknown dates sort as the oldest.
const compareBy: Record<SortKey, (a: FileEntry, b: FileEntry) => number> = {
    name: (a, b) => collator.compare(a.name, b.name),
    size: (a, b) => sizeOf(a) - sizeOf(b),
    type: (a, b) => collator.compare(describeType(a), describeType(b)),
    modified: (a, b) => (a.modifiedAt?.getTime() ?? 0) - (b.modifiedAt?.getTime() ?? 0),
};

/**
 * Folders first in either direction, then by the key in natural order, so "file2" sorts before
 * "file10". Ties fall back to the name A to Z, so entries of one size or type stay easy to scan.
 */
export const entryComparator = ({ key, direction }: SortOrder) => {
    const compare = compareBy[key];
    const sign = direction === "asc" ? 1 : -1;

    return (a: FileEntry, b: FileEntry) => {
        if (a.kind !== b.kind) {
            return a.kind === "folder" ? -1 : 1;
        }

        return sign * compare(a, b) || compareBy.name(a, b);
    };
};

/** The sidebar tree's fixed order, which the content's sort never changes. */
export const compareEntries = entryComparator({ key: "name", direction: "asc" });

/** Switches to `key` in the direction it starts in; picking the current key keeps its direction. */
export const withSortKey = (sort: SortOrder, key: SortKey): SortOrder =>
    key === sort.key ? sort : { key, direction: SORT_KEY_INFO[key].initial };

/** As a column header does: the current key reverses, and any other starts in its own direction. */
export const toggleSortKey = (sort: SortOrder, key: SortKey): SortOrder =>
    key === sort.key ? { key, direction: sort.direction === "asc" ? "desc" : "asc" } : withSortKey(sort, key);
