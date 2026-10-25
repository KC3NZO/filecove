import { folderKey } from "../store/folder-store";
import { folderOf } from "./navigation";

import type { FolderStore } from "../store/folder-store";
import type { EntryPermissions, FileEntry, FolderRef, Section } from "../types";

/** Whether every one of the permissions given allows `what`; each allows what it doesn't set to false. */
export const allows = (what: keyof EntryPermissions, ...permissions: (EntryPermissions | undefined)[]) =>
    permissions.every((given) => given?.[what] !== false);

/** Whether an entry is a folder whose own permissions say nothing can be put in it, which shows a lock. */
export const lockedFolder = (entry: FileEntry) => entry.kind === "folder" && !allows("write", entry.permissions);

/**
 * Whether what's in the folder at `trail` can change: its section isn't `readOnly`, and neither its
 * own listing's permissions nor its entry's, in the listing of the folder above, refuse writing. A
 * folder neither is cached for counts as writable, as the adapter has the final say anyway.
 */
export const folderWritable = (store: FolderStore, section: Section, trail: FolderRef[]) => {
    if (section.readOnly) {
        return false;
    }

    const folder = folderOf(section, trail);
    const own = store.get(folderKey(section.id, folder.id))?.permissions;
    // A section's root is in none of the section's listings.
    const above = trail.length > 0 ? folderOf(section, trail.slice(0, -1)) : undefined;
    const entry = above && store.get(folderKey(section.id, above.id))?.entries?.find(({ id }) => id === folder.id);

    return allows("write", own, entry?.permissions);
};

/**
 * Whether `entries`, in the folder at `trail`, can each be renamed, moved out or deleted: their
 * folder can change, and their own permissions allow it.
 */
export const entriesAllow = (
    store: FolderStore,
    section: Section,
    trail: FolderRef[],
    entries: readonly FileEntry[],
    what: "rename" | "move" | "delete",
) => folderWritable(store, section, trail) && entries.every((entry) => allows(what, entry.permissions));
