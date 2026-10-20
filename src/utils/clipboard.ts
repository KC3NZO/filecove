import { folderOf } from "./navigation";
import { importsFrom } from "./sections";

import type { Clipboard, FileAdapter, FileEntry, FolderRef, Section } from "../types";

/**
 * Whether the clipboard can be pasted into the folder at `trail`: only through the adapter its
 * entries came from, into a section that takes entries from theirs, never into one of them or
 * below one, and, when cut, not into their own folder.
 */
export const canPaste = (clipboard: Clipboard, adapter: FileAdapter, section: Section, trail: FolderRef[]) => {
    if (
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

/** The clipboard without entries that `adapter` moved, whose ids may have changed; null once it's empty. */
export const withoutMoved = (clipboard: Clipboard, adapter: FileAdapter, ids: ReadonlySet<string>) => {
    if (clipboard.adapter !== adapter || !clipboard.entries.some((entry) => ids.has(entry.id))) {
        return clipboard;
    }

    const entries = clipboard.entries.filter((entry) => !ids.has(entry.id));

    return entries.length > 0 ? { ...clipboard, entries } : null;
};

/** The clipboard with an entry that `adapter` renamed as it is now, so pasting still finds it. */
export const withRenamed = (clipboard: Clipboard, adapter: FileAdapter, before: FileEntry, after: FileEntry) => {
    if (clipboard.adapter !== adapter || !clipboard.entries.some((entry) => entry.id === before.id)) {
        return clipboard;
    }

    return { ...clipboard, entries: clipboard.entries.map((entry) => (entry.id === before.id ? after : entry)) };
};
