import { folderOf } from "./navigation";
import { entriesAllow, entriesMoving, folderWritable } from "./permissions";
import { importsFrom } from "./sections";
import { movingThrough } from "./transfer";

import type { FolderStore } from "../store/folder-store";
import type { Clipboard, ClipboardPart, FileAdapter, FileEntry, FolderRef, MovingIds, Section } from "../types";

/**
 * Whether the clipboard can be pasted into the folder at `trail`: only through the adapter its
 * entries came from, into a section that takes entries from each of theirs and a folder that can change
 * (`folderWritable`), never into one of them or below one, when cut, not when they're all in it
 * already, nor when they can't be moved out of their folders (`entriesAllow`), not while a move
 * under way is moving them (`entriesMoving`, by `moving`), whose ids may name nothing once it's
 * done, and not while they're looked for again.
 */
export const canPaste = (
    clipboard: Clipboard,
    adapter: FileAdapter,
    section: Section,
    trail: FolderRef[],
    store: FolderStore,
    moving: MovingIds,
) => {
    const busy = movingThrough(moving, adapter);
    const { parts } = clipboard;

    if (
        parts.some((part) => part.lookup) ||
        clipboard.adapter !== adapter ||
        !(clipboard.kind === "cut" ? adapter.move : adapter.copy) ||
        !folderWritable(store, section, trail, busy) ||
        parts.some(
            (part) =>
                !importsFrom(section, part.section) ||
                entriesMoving(part.section, part.trail, part.entries, busy) ||
                (clipboard.kind === "cut" && !entriesAllow(store, part.section, part.trail, part.entries, "move", busy)),
        )
    ) {
        return false;
    }

    // The trail holds the ids of every folder above the target, so no id has to be parsed.
    const ids = new Set(parts.flatMap((part) => part.entries.map((entry) => entry.id)));

    if ([section.rootId, ...trail.map((step) => step.id)].some((id) => ids.has(id))) {
        return false;
    }

    // Ids are unique within an adapter, so the same folder has the same id in any section.
    const targetId = folderOf(section, trail).id;

    return clipboard.kind === "copy" || parts.some((part) => folderOf(part.section, part.trail).id !== targetId);
};

/** The clipboard with its parts as `change` makes them, null for a part gone; null once none is left. */
const withParts = (clipboard: Clipboard, change: (part: ClipboardPart) => ClipboardPart | null): Clipboard | null => {
    const parts = clipboard.parts.flatMap((part) => change(part) ?? []);

    if (parts.length === 0) {
        return null;
    }

    return parts.length === clipboard.parts.length && parts.every((part, index) => part === clipboard.parts[index])
        ? clipboard
        : { ...clipboard, parts };
};

// The ids of the folders above a part's entries known to still name them: the section's root, and
// the steps of the trail not being found again by name.
const heldIds = ({ section, trail, lookup }: ClipboardPart) => [
    section.rootId,
    ...trail.slice(0, lookup?.by === "name" ? lookup.from : undefined).map((step) => step.id),
];

/**
 * Whether a change to folders whose ids may now name nothing, or others, may have reached a part's
 * entries: one of them is above them, among `dropped` (the folders and every folder any section has
 * cached below them, see `dropFolders`), or their section may be rooted below one, which no id in
 * their trail ties to it (`mayBeBelow`, a section listing none of them, as `dropFolders` has it).
 */
const reaches = (part: ClipboardPart, dropped: ReadonlySet<string>, mayBeBelow: (sectionId: string) => boolean) =>
    mayBeBelow(part.section.id) || heldIds(part).some((id) => dropped.has(id));

/**
 * The clipboard without entries that `adapter` moved, whose ids may have changed, or deleted; null
 * once it's empty. When the folders moved or deleted may have reached the rest, their folder is
 * listed again for them (`lookup` by id), since a moved folder may have taken a free name, or been
 * merged where a same-named entry was kept both, so they can't be found by name. Entries being
 * found by name then can't be found, and leave. Each part goes by its own folder.
 */
export const withoutEntries = (
    clipboard: Clipboard,
    adapter: FileAdapter,
    ids: ReadonlySet<string>,
    dropped: ReadonlySet<string>,
    mayBeBelow: (sectionId: string) => boolean,
): Clipboard | null => {
    if (clipboard.adapter !== adapter) {
        return clipboard;
    }

    return withParts(clipboard, (part) => {
        const reached = reaches(part, dropped, mayBeBelow);

        // Entries being found by name hold ids that may name others now.
        if (part.lookup?.by === "name") {
            return reached ? null : part;
        }

        const entries = part.entries.filter((entry) => !ids.has(entry.id));

        if (entries.length === 0) {
            return null;
        }

        if (reached) {
            return { ...part, entries, lookup: { by: "id" } };
        }

        return entries.length < part.entries.length ? { ...part, entries } : part;
    });
};

/**
 * The clipboard with an entry that `adapter` renamed as it is now, so pasting still finds it. A
 * folder above the entries keeps its place in the trail under its new name, and when its id
 * changed, as path ids do, the ids below it are found again by name (`lookup`). A folder renamed
 * to a new id outside the trail that may still be above them (`reaches`), as when it's the
 * section's root or above it, has their folder listed again for them. Each part goes by its own
 * trail.
 */
export const withRenamed = (
    clipboard: Clipboard,
    adapter: FileAdapter,
    before: FileEntry,
    after: FileEntry,
    dropped: ReadonlySet<string>,
    mayBeBelow: (sectionId: string) => boolean,
): Clipboard | null => {
    if (clipboard.adapter !== adapter) {
        return clipboard;
    }

    return withParts(clipboard, (part) => {
        if (part.lookup?.by !== "name" && part.entries.some((entry) => entry.id === before.id)) {
            return { ...part, entries: part.entries.map((entry) => (entry.id === before.id ? after : entry)) };
        }

        if (before.kind !== "folder") {
            return part;
        }

        // Only the steps still known can be told by id; a step being found again may hold an id
        // that now names another folder.
        const known = part.lookup?.by === "name" ? part.lookup.from : part.trail.length;
        const index = part.trail.slice(0, known).findIndex((step) => step.id === before.id);

        if (index >= 0) {
            const trail = part.trail.map((step, at) => (at === index ? { id: after.id, name: after.name } : step));

            return after.id === before.id
                ? { ...part, trail }
                : { ...part, trail, lookup: { by: "name", from: index + 1 } };
        }

        if (after.id === before.id || !reaches(part, dropped, mayBeBelow)) {
            return part;
        }

        return part.lookup?.by === "name" ? null : { ...part, lookup: { by: "id" } };
    });
};
