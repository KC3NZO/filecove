import type { FileEntry, FileManagerLocaleText, Locale, SortDirection, SortKey, SortOrder } from "../types";

type Comparator = (a: FileEntry, b: FileEntry) => number;

interface SortKeyLabels {
    /** The list column's label, which the view menu uses too. */
    label: string;
    /** How the view menu names each direction for this key. */
    asc: string;
    desc: string;
}

/** In the order the list view's columns show them. */
export const SORT_KEYS: readonly SortKey[] = ["name", "size", "type", "modified"];

// The direction each key starts in when picked. Sizes and dates start largest and newest first, as
// in most file managers.
const INITIAL_DIRECTIONS: Record<SortKey, SortDirection> = {
    name: "asc",
    size: "desc",
    type: "asc",
    modified: "desc",
};

/** How the list's column and the view menu name each key, and each of its directions. */
export const SORT_LABELS: Record<SortKey, (text: FileManagerLocaleText) => SortKeyLabels> = {
    name: (text) => ({ label: text.sortName, asc: text.sortAToZ, desc: text.sortZToA }),
    size: (text) => ({ label: text.sortSize, asc: text.sortSmallestFirst, desc: text.sortLargestFirst }),
    type: (text) => ({ label: text.sortType, asc: text.sortAToZ, desc: text.sortZToA }),
    modified: (text) => ({ label: text.sortModified, asc: text.sortOldestFirst, desc: text.sortNewestFirst }),
};

export const DEFAULT_SORT: SortOrder = { key: "name", direction: "asc" };

/** Whether two orders are the same, by key and direction. */
export const sameSort = (a: SortOrder, b: SortOrder) => a.key === b.key && a.direction === b.direction;

/** Folders by item count, files by bytes; unknown sizes sort as the smallest. */
const sizeOf = (entry: FileEntry) => (entry.kind === "folder" ? entry.childCount : entry.size) ?? -1;

// Each one ascending, names and types in the locale's order. Unknown dates sort as the oldest.
const comparators = (locale: Locale): Record<SortKey, Comparator> => ({
    name: (a, b) => locale.compareNames(a.name, b.name),
    size: (a, b) => sizeOf(a) - sizeOf(b),
    type: (a, b) => locale.compareNames(locale.describeType(a), locale.describeType(b)),
    modified: (a, b) => (a.modifiedAt?.getTime() ?? 0) - (b.modifiedAt?.getTime() ?? 0),
});

/**
 * Folders first in either direction, then by the key in natural order, so "file2" sorts before
 * "file10". Ties fall back to the name A to Z, so entries of one size or type stay easy to scan.
 */
export const entryComparator = ({ key, direction }: SortOrder, locale: Locale): Comparator => {
    const compareBy = comparators(locale);
    const compare = compareBy[key];
    const sign = direction === "asc" ? 1 : -1;

    return (a: FileEntry, b: FileEntry) => {
        if (a.kind !== b.kind) {
            return a.kind === "folder" ? -1 : 1;
        }

        return sign * compare(a, b) || compareBy.name(a, b);
    };
};

const nameOrders = new WeakMap<Locale, Comparator>();

/**
 * The fixed order of the sidebar tree and the transfer picker, by name, which the content's sort
 * never changes. It's the same function for as long as the locale is, so lists sorted by it can
 * be kept.
 */
export const nameOrder = (locale: Locale) => {
    let compare = nameOrders.get(locale);

    if (!compare) {
        compare = entryComparator(DEFAULT_SORT, locale);
        nameOrders.set(locale, compare);
    }

    return compare;
};

/** Switches to `key` in the direction it starts in; picking the current key keeps its direction. */
export const withSortKey = (sort: SortOrder, key: SortKey): SortOrder =>
    key === sort.key ? sort : { key, direction: INITIAL_DIRECTIONS[key] };

/** As a column header does: the current key reverses, and any other starts in its own direction. */
export const toggleSortKey = (sort: SortOrder, key: SortKey): SortOrder =>
    key === sort.key ? { key, direction: sort.direction === "asc" ? "desc" : "asc" } : withSortKey(sort, key);
