import { folderKey } from "../store/folder-store";
import { folderOf } from "./navigation";
import { sectionLocked } from "./sections";

import type { FolderStore } from "../store/folder-store";
import type {
    EntryPermissions,
    FileEntry,
    FileManagerLocaleText,
    FolderRef,
    MovingKind,
    MovingKinds,
    Section,
} from "../types";

/** Whether every one of the permissions given allows `what`; each allows what it doesn't set to false. */
export const allows = (what: keyof EntryPermissions, ...permissions: (EntryPermissions | undefined)[]) =>
    permissions.every((given) => given?.[what] !== false);

/** Whether an entry is a folder whose own permissions say nothing can be put in it, which shows a lock. */
export const lockedFolder = (entry: FileEntry) => entry.kind === "folder" && !allows("write", entry.permissions);

/**
 * Whether an entry a folder of `section` has can take the place of an entry of its name, a file, or
 * have one merged into it, a folder: its own `write` isn't false, nor, for a folder, its own
 * listing's, when cached. Replace keeps what comes in beside one that can't, as `ConflictPolicy`
 * asks of the adapter.
 */
export const replaceable = (store: FolderStore, section: Section, entry: FileEntry) =>
    allows(
        "write",
        entry.permissions,
        entry.kind === "folder" ? store.get(folderKey(section.id, entry.id))?.permissions : undefined,
    );

/**
 * What holds `entry`, in the folder at `trail`, or with no entry the folder itself: among `moving`,
 * the ids held through the section's adapter (`movingThrough`), the entry, or else the nearest
 * folder it's in, up to its section's root, since everything in a folder goes with it.
 */
export const heldBy = (
    section: Section,
    trail: FolderRef[],
    entry: FileEntry | undefined,
    moving: MovingKinds,
): MovingKind | undefined => {
    if (moving.size === 0) {
        return undefined;
    }

    const ids = [section.rootId, ...trail.map((step) => step.id), ...(entry ? [entry.id] : [])];

    return ids.reduceRight<MovingKind | undefined>((found, id) => found ?? moving.get(id), undefined);
};

/**
 * Whether the folder at `trail`, or one it's in up to its section's root, is among `moving`, the
 * ids a move under way, or the trash's work, through the section's adapter holds (`movingThrough`),
 * so it's being moved too.
 */
export const folderMoving = (section: Section, trail: FolderRef[], moving: MovingKinds) =>
    heldBy(section, trail, undefined, moving) !== undefined;

/** Whether any of `entries`, in the folder at `trail`, is being moved, itself or with a folder it's in. */
export const entriesMoving = (
    section: Section,
    trail: FolderRef[],
    entries: readonly FileEntry[],
    moving: MovingKinds,
) => folderMoving(section, trail, moving) || entries.some((entry) => moving.has(entry.id));

/**
 * Whether what's in the folder at `trail` can change: its section isn't `readOnly` or the trash
 * (`sectionLocked`), it isn't being moved (`folderMoving`, by the ids in `moving`), and neither its
 * own listing's permissions nor its entry's, in the listing of the folder above, refuse writing
 * (`folderPermits`). A folder neither is cached for counts as writable, as the adapter has the final
 * say anyway.
 */
export const folderWritable = (
    store: FolderStore,
    section: Section,
    trail: FolderRef[],
    moving: MovingKinds,
) => {
    if (sectionLocked(section) || folderMoving(section, trail, moving)) {
        return false;
    }

    return folderPermits(store, section, trail);
};

/**
 * Whether the backend lets what's in the folder at `trail` change, whatever the section says:
 * neither its own listing's permissions nor its entry's, in the listing of the folder above,
 * refuse writing. A folder neither is cached for counts as writable.
 */
export const folderPermits = (store: FolderStore, section: Section, trail: FolderRef[]) => {
    const folder = folderOf(section, trail);
    const own = store.get(folderKey(section.id, folder.id))?.permissions;
    // A section's root is in none of the section's listings.
    const above = trail.length > 0 ? folderOf(section, trail.slice(0, -1)) : undefined;
    const entry = above && store.get(folderKey(section.id, above.id))?.entries?.find(({ id }) => id === folder.id);

    return allows("write", own, entry?.permissions);
};

/**
 * Whether `entries`, in the folder at `trail`, can each be renamed, moved out or deleted: their
 * folder can change, none is being moved (by the ids in `moving`), and their own permissions allow it.
 */
export const entriesAllow = (
    store: FolderStore,
    section: Section,
    trail: FolderRef[],
    entries: readonly FileEntry[],
    what: "rename" | "move" | "delete",
    moving: MovingKinds,
) =>
    folderWritable(store, section, trail, moving) &&
    entries.every((entry) => !moving.has(entry.id) && allows(what, entry.permissions));

/** What screen readers hear after the name of an entry held, for what holds it. */
export const heldText = (text: FileManagerLocaleText, kind: MovingKind) =>
    kind === "trash" ? text.entryTrashing : kind === "restore" ? text.entryRestoring : text.entryMoving;

/** Beside the picker's disabled "Copy here" or "Move here", in a folder held, for what holds it. */
export const pickerHeldText = (text: FileManagerLocaleText, kind: MovingKind) =>
    kind === "trash" ? text.pickerTrashing : kind === "restore" ? text.pickerRestoring : text.pickerMoving;

/**
 * What screen readers hear after an entry's name for what only its look shows: that it's being
 * moved, moved to the trash or restored, which counts for more while it lasts, or that it's a
 * folder that shows a lock.
 */
export const drawnState = (text: FileManagerLocaleText, entry: FileEntry, moving: MovingKind | undefined) =>
    moving ? heldText(text, moving) : lockedFolder(entry) ? text.folderLocked : undefined;
