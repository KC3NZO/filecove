import { folderOf } from "./navigation";
import { importsFrom } from "./sections";

import type { Clipboard, FileAdapter, FileEntry, FolderRef, Section } from "../types";

/**
 * Whether the clipboard can be pasted into the folder at `trail`: only through the adapter its
 * entries came from, into a section that takes entries from theirs, never into one of them or
 * below one, when cut, not into their own folder, and not while they're looked for again.
 */
export const canPaste = (clipboard: Clipboard, adapter: FileAdapter, section: Section, trail: FolderRef[]) => {
    if (
        clipboard.lookup ||
        clipboard.adapter !== adapter ||
        !(clipboard.kind === "cut" ? adapter.move : adapter.copy) ||
        !importsFrom(section, clipboard.section)
    ) {
        return false;
    }

    // The trail holds the ids of every folder above the target, so no id has to be parsed.
    const ids = new Set(clipboard.entries.map((entry) => entry.id));

    if ([section.rootId, ...trail.map((step) => step.id)].some((id) => ids.has(id))) {
        return false;
    }

    // Ids are unique within an adapter, so the same folder has the same id in any section.
    return clipboard.kind === "copy" || folderOf(section, trail).id !== folderOf(clipboard.section, clipboard.trail).id;
};

// The ids of the folders above the entries known to still name them: the section's root, and the
// steps of the trail not being found again by name.
const heldIds = ({ section, trail, lookup }: Clipboard) => [
    section.rootId,
    ...trail.slice(0, lookup?.by === "name" ? lookup.from : undefined).map((step) => step.id),
];

/**
 * Whether a change to folders whose ids may now name nothing, or others, may have reached the
 * entries: one of them is above them, among `dropped` (the folders and every folder any section has
 * cached below them, see `dropFolders`), or their section may be rooted below one, which no id in
 * their trail ties to it (`mayBeBelow`, a section listing none of them, as `dropFolders` has it).
 */
const reaches = (clipboard: Clipboard, dropped: ReadonlySet<string>, mayBeBelow: boolean) =>
    mayBeBelow || heldIds(clipboard).some((id) => dropped.has(id));

/**
 * The clipboard without entries that `adapter` moved, whose ids may have changed, or deleted; null
 * once it's empty. When the folders moved or deleted may have reached the rest, their folder is
 * listed again for them (`lookup` by id), since a moved folder may have taken a free name, or been
 * merged where a same-named entry was kept both, so they can't be found by name. Entries being
 * found by name then can't be found, and leave.
 */
export const withoutEntries = (
    clipboard: Clipboard,
    adapter: FileAdapter,
    ids: ReadonlySet<string>,
    dropped: ReadonlySet<string>,
    mayBeBelow: boolean,
): Clipboard | null => {
    if (clipboard.adapter !== adapter) {
        return clipboard;
    }

    const reached = reaches(clipboard, dropped, mayBeBelow);

    // Entries being found by name hold ids that may name others now.
    if (clipboard.lookup?.by === "name") {
        return reached ? null : clipboard;
    }

    const entries = clipboard.entries.filter((entry) => !ids.has(entry.id));

    if (entries.length === 0) {
        return null;
    }

    if (reached) {
        return { ...clipboard, entries, lookup: { by: "id" } };
    }

    return entries.length < clipboard.entries.length ? { ...clipboard, entries } : clipboard;
};

/**
 * The clipboard with an entry that `adapter` renamed as it is now, so pasting still finds it. A
 * folder above the entries keeps its place in the trail under its new name, and when its id
 * changed, as path ids do, the ids below it are found again by name (`lookup`). A folder renamed
 * to a new id outside the trail that may still be above them (`reaches`), as when it's the
 * section's root or above it, has their folder listed again for them.
 */
export const withRenamed = (
    clipboard: Clipboard,
    adapter: FileAdapter,
    before: FileEntry,
    after: FileEntry,
    dropped: ReadonlySet<string>,
    mayBeBelow: boolean,
): Clipboard | null => {
    if (clipboard.adapter !== adapter) {
        return clipboard;
    }

    if (clipboard.lookup?.by !== "name" && clipboard.entries.some((entry) => entry.id === before.id)) {
        return { ...clipboard, entries: clipboard.entries.map((entry) => (entry.id === before.id ? after : entry)) };
    }

    if (before.kind !== "folder") {
        return clipboard;
    }

    // Only the steps still known can be told by id; a step being found again may hold an id that
    // now names another folder.
    const known = clipboard.lookup?.by === "name" ? clipboard.lookup.from : clipboard.trail.length;
    const index = clipboard.trail.slice(0, known).findIndex((step) => step.id === before.id);

    if (index >= 0) {
        const trail = clipboard.trail.map((step, at) => (at === index ? { id: after.id, name: after.name } : step));

        return after.id === before.id
            ? { ...clipboard, trail }
            : { ...clipboard, trail, lookup: { by: "name", from: index + 1 } };
    }

    if (after.id === before.id || !reaches(clipboard, dropped, mayBeBelow)) {
        return clipboard;
    }

    return clipboard.lookup?.by === "name" ? null : { ...clipboard, lookup: { by: "id" } };
};
