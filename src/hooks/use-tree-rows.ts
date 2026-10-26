import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { folderKey } from "../store/folder-store";
import { TREE_CAPTION_HEIGHT, TREE_DIVIDER_HEIGHT, TREE_FOLDER_HEIGHT, TREE_SECTION_HEIGHT } from "../styles/layout";
import { isHidden } from "../utils/hidden";
import { nameOrder } from "../utils/sort";
import { useData } from "./use-folder";
import { useLocale } from "./use-locale";

import type {
    FileAdapter,
    FileEntry,
    FlatTree,
    FolderRef,
    FolderState,
    Locale,
    Section,
    SectionGroup,
    TreeGuide,
    TreeRow,
} from "../types";

/** A folder whose listing the tree shows, to be listed if it isn't. */
interface Shown {
    key: string;
    section: Section;
    folderId: string;
}

/** Space above and below the folders of an expanded row, in px. */
const LIST_PADDING = 2;
/** Space between the sections of a group, in px. */
const SECTION_GAP = 2;

const ROOT_TRAIL: FolderRef[] = [];

const isFolder = (entry: FileEntry) => entry.kind === "folder";

// Listed for the first time: nothing has come yet, or only some of its pages.
const firstListing = (state: FolderState | undefined) =>
    state?.status === "loading" && (!state.entries || !!state.partial);

// Whether the tree lists the folder: hidden ones only while hidden entries show.
const isShownFolder = (entry: FileEntry, showHidden: boolean) => isFolder(entry) && (showHidden || !isHidden(entry));

interface SortedFolders {
    folders: FileEntry[];
    keys: string[];
}

// A listing's folders in the tree's order, with their keys, all of them and the ones not hidden,
// sorted once per listing and locale, since a listing is replaced rather than changed.
const sortedFolders = new WeakMap<Locale, WeakMap<FileEntry[], { all: SortedFolders; unhidden: SortedFolders }>>();

const foldersOf = (sectionId: string, entries: FileEntry[], showHidden: boolean, locale: Locale) => {
    let byListing = sortedFolders.get(locale);

    if (!byListing) {
        byListing = new WeakMap();
        sortedFolders.set(locale, byListing);
    }

    let sorted = byListing.get(entries);

    if (!sorted) {
        const withKeys = (folders: FileEntry[]) => ({
            folders,
            keys: folders.map((entry) => folderKey(sectionId, entry.id)),
        });
        const all = entries.filter(isFolder).sort(nameOrder(locale));

        sorted = { all: withKeys(all), unhidden: withKeys(all.filter((entry) => !isHidden(entry))) };
        byListing.set(entries, sorted);
    }

    return showHidden ? sorted.all : sorted.unhidden;
};

/**
 * The rows the tree shows, top to bottom, each placed where it goes, with the guide lines along
 * the folders of expanded rows, and the folders whose listings it shows.
 */
const flatten = (
    groups: SectionGroup[],
    single: Section | null,
    expanded: ReadonlySet<string>,
    showHidden: boolean,
    locale: Locale,
    stateOf: (section: Section, folderId: string) => FolderState | undefined,
) => {
    const hasFolders = (entries: FileEntry[]) => entries.some((entry) => isShownFolder(entry, showHidden));
    const rows: TreeRow[] = [];
    const guides: TreeGuide[] = [];
    const shown: Shown[] = [];
    let offset = 0;

    const add = (row: TreeRow) => {
        rows.push(row);
        offset += row.height;
    };

    // The folders listed in a folder, at `depth`, each followed by its own while it's expanded.
    const addFolders = (section: Section, group: number, folderId: string, trail: FolderRef[], depth: number) => {
        const state = stateOf(section, folderId);

        if (state?.status === "error") {
            add({
                kind: "error",
                id: `${folderKey(section.id, folderId)}\u0000error`,
                top: offset,
                height: TREE_FOLDER_HEIGHT,
                group,
                depth,
                position: 1,
                siblingCount: 1,
                label: `${locale.text.folderLoadFailed}. ${locale.text.retry}`,
                section,
                folderId,
            });

            return;
        }

        if (!state?.entries) {
            return;
        }

        const { folders, keys } = foldersOf(section.id, state.entries, showHidden, locale);

        folders.forEach((entry, index) => {
            const key = keys[index];
            const own = stateOf(section, entry.id);
            const isExpanded = expanded.has(key);
            const folderTrail = [...trail, { id: entry.id, name: entry.name }];
            // Once the folder has been listed, the listing wins over the adapter's hint, e.g. after
            // a folder was created in it.
            const hasNoFolders = own?.entries ? !hasFolders(own.entries) : entry.hasSubfolders === false;

            add({
                kind: "folder",
                id: key,
                top: offset,
                height: TREE_FOLDER_HEIGHT,
                group,
                depth,
                position: index + 1,
                siblingCount: folders.length,
                label: entry.name,
                section,
                entry,
                parentKey: folderKey(section.id, folderId),
                parentTrail: trail,
                trail: folderTrail,
                siblings: folders,
                siblingKeys: keys,
                expandable: !hasNoFolders,
                expanded: isExpanded,
                loading: firstListing(own),
            });

            if (isExpanded && entry.hasSubfolders !== false) {
                shown.push({ key, section, folderId: entry.id });
            }

            if (isExpanded && !hasNoFolders) {
                addBelow(section, group, entry.id, folderTrail, depth + 1);
            }
        });
    };

    // The folders below an expanded row, set off by a little space, with a guide line along them.
    const addBelow = (section: Section, group: number, folderId: string, trail: FolderRef[], depth: number) => {
        offset += LIST_PADDING;

        const top = offset;

        addFolders(section, group, folderId, trail, depth);

        if (offset > top) {
            guides.push({ depth: depth - 1, top, bottom: offset });
        }

        offset += LIST_PADDING;
    };

    // A single section's folders are the tree's top level, with no row for the root.
    if (single) {
        const state = stateOf(single, single.rootId);

        shown.push({ key: folderKey(single.id, single.rootId), section: single, folderId: single.rootId });

        if (!state || (state.status === "loading" && !state.entries)) {
            add({ kind: "status", id: "loading", top: offset, height: TREE_FOLDER_HEIGHT, group: 0, loading: true });
        } else if (state.status === "ready" && !(state.entries && hasFolders(state.entries))) {
            add({ kind: "status", id: "empty", top: offset, height: TREE_FOLDER_HEIGHT, group: 0, loading: false });
        } else {
            addFolders(single, 0, single.rootId, ROOT_TRAIL, 0);
        }

        return { rows, guides, height: offset, shown };
    }

    groups.forEach((group, groupIndex) => {
        if (groupIndex > 0) {
            add({
                kind: "divider",
                id: `${group.id}\u0000divider`,
                top: offset,
                height: TREE_DIVIDER_HEIGHT,
                group: groupIndex,
            });
        }

        if (group.title) {
            add({
                kind: "caption",
                id: `${group.id}\u0000caption`,
                top: offset,
                height: TREE_CAPTION_HEIGHT,
                group: groupIndex,
                title: group.title,
            });
        }

        group.sections.forEach((section, index) => {
            const key = folderKey(section.id, section.rootId);
            const showFolders = section.showFolders !== false;
            const isExpanded = showFolders && expanded.has(key);
            const state = stateOf(section, section.rootId);
            const hasNoFolders =
                !showFolders || (state?.status === "ready" && !(state.entries && hasFolders(state.entries)));

            if (index > 0) {
                offset += SECTION_GAP;
            }

            add({
                kind: "section",
                id: key,
                top: offset,
                height: TREE_SECTION_HEIGHT,
                group: groupIndex,
                depth: 0,
                position: index + 1,
                siblingCount: group.sections.length,
                label: section.label,
                section,
                expandable: !hasNoFolders,
                expanded: isExpanded,
                loading: firstListing(state),
            });

            if (isExpanded) {
                shown.push({ key, section, folderId: section.rootId });
            }

            if (isExpanded && !hasNoFolders) {
                addBelow(section, groupIndex, section.rootId, ROOT_TRAIL, 1);
            }
        });
    });

    return { rows, guides, height: offset, shown };
};

/**
 * The sidebar tree as a flat list of the rows it shows: the sections of `groups` with the folders
 * below the expanded ones, or `single`'s folders. Reading every listing it shows from the store,
 * it's flattened again whenever any listing changes. A folder is listed once the tree comes to
 * show its folders, as it's expanded or one above it is, and listed again in the background then
 * once its listing is `relistAfter` old. Hidden folders are left out unless `showHidden`.
 */
export const useTreeRows = (
    groups: SectionGroup[],
    single: Section | null,
    expanded: ReadonlySet<string>,
    showHidden: boolean,
): FlatTree => {
    const { store, adapter, relistAfter } = useData();
    const locale = useLocale();
    const version = useSyncExternalStore(store.subscribe, store.version);

    const tree = useMemo(
        () =>
            flatten(groups, single, expanded, showHidden, locale, (section, folderId) =>
                store.get(folderKey(section.id, folderId)),
            ),
        // `version` stands for the listings `flatten` reads.
        [groups, single, expanded, showHidden, locale, store, version],
    );

    // The listings the tree shows are kept while it does.
    useEffect(() => {
        const hides = tree.shown.map(({ key }) => store.show(key));

        return () => hides.forEach((hide) => hide());
    }, [tree.shown, store]);

    // Only folders the tree has just come to show are opened, so a folder whose listing failed is
    // tried again from its Retry, or once it's shown again, rather than on every change. So are
    // folders shown already whose section another adapter now serves, whose listings the file
    // manager drops (`forgetSection`), and a folder whose listing is dropped while it's shown, as
    // after a change that may have made its id another folder's, is listed afresh.
    const requested = useRef<ReadonlyMap<string, FileAdapter>>(new Map());

    useEffect(() => {
        const served = new Map<string, FileAdapter>();

        tree.shown.forEach(({ key, section, folderId }) => {
            const folderAdapter = section.adapter ?? adapter;

            served.set(key, folderAdapter);

            if (requested.current.get(key) !== folderAdapter) {
                store.open(key, folderAdapter, folderId, relistAfter);
            } else if (!store.get(key)) {
                store.load(key, folderAdapter, folderId);
            }
        });

        requested.current = served;
    }, [tree.shown, store, adapter, relistAfter]);

    return tree;
};
