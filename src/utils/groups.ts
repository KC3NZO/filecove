import { folderOf } from "./navigation";

import type { EntryGroup, FileAdapter, FileEntry, FolderRef, MenuRequest, Section } from "../types";

/** An entry of a section, with where it is and the adapter serving it. */
interface PlacedEntry {
    section: Section;
    adapter: FileAdapter;
    trail: FolderRef[];
    entry: FileEntry;
}

/** The entries of groups, in their order. */
export const groupedEntries = (groups: readonly { entries: FileEntry[] }[]) => groups.flatMap((group) => group.entries);

/** The entries a request names by folder: its `groups`, or its entries in its folder. */
export const requestGroups = ({ section, trail, entries, groups }: MenuRequest): EntryGroup[] =>
    groups ?? [{ section, trail, entries }];

/**
 * Entries, with where each is, as groups of the entries sharing a folder, in the order each folder
 * first comes. Ids are unique within an adapter, so a folder two sections sharing an adapter both
 * show is one group, in the first section it comes in, and an entry found in both is in it once.
 */
export const groupByFolder = (items: readonly PlacedEntry[]): EntryGroup[] => {
    const groups = new Map<FileAdapter, Map<string, { group: EntryGroup; ids: Set<string> }>>();
    const ordered: EntryGroup[] = [];

    items.forEach(({ section, adapter, trail, entry }) => {
        const folders = groups.get(adapter) ?? new Map<string, { group: EntryGroup; ids: Set<string> }>();
        const id = folderOf(section, trail).id;
        const found = folders.get(id);

        groups.set(adapter, folders);

        if (!found) {
            const group = { section, trail, entries: [entry] };

            folders.set(id, { group, ids: new Set([entry.id]) });
            ordered.push(group);
        } else if (!found.ids.has(entry.id)) {
            found.ids.add(entry.id);
            found.group.entries.push(entry);
        }
    });

    return ordered;
};

/** The trail to the nearest folder holding the folders at every one of the trails. */
export const commonTrail = (trails: readonly FolderRef[][]): FolderRef[] => {
    const [first = []] = trails;
    let length = 0;

    while (length < first.length && trails.every((trail) => trail[length]?.id === first[length].id)) {
        length += 1;
    }

    return first.slice(0, length);
};

/**
 * What a menu, a shortcut or the properties' header acts on for entries grouped by folder: one
 * folder's entries there, as ever, or those of several, in the first group's section, at the
 * nearest folder holding that section's.
 */
export const selectionRequest = (groups: EntryGroup[]): MenuRequest => {
    const [first] = groups;

    if (groups.length === 1) {
        return { target: "selection", section: first.section, trail: first.trail, entries: first.entries };
    }

    const ownTrails = groups.filter((group) => group.section === first.section).map((group) => group.trail);

    return {
        target: "selection",
        section: first.section,
        trail: commonTrail(ownTrails),
        entries: groupedEntries(groups),
        groups,
    };
};
