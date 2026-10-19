// Internal to the package, not exported from the package entry.

import type { FolderRef } from "./section";

/** Modifier keys held while clicking an entry, named by what they do rather than by key. */
export interface SelectModifiers {
    /** Ctrl, or ⌘ on macOS: add the entry to the selection, or take it out. */
    toggle: boolean;
    /** Shift: select every entry from the anchor to this one. */
    range: boolean;
}

/**
 * Selected entries. The content view and the sidebar tree each keep their own, and the two
 * are never merged: a context menu acts on the selection of the pane it was opened in.
 */
export interface EntrySelection {
    ids: ReadonlySet<string>;
    /** Where a Shift-click range starts: the last entry clicked without Shift. */
    anchor: string | null;
}

/**
 * The sidebar tree's selection. Its `ids` are `folderKey`s, and the folders are always siblings,
 * so an action gets one parent folder to happen in, as it does from the content.
 */
export interface TreeSelection extends EntrySelection {
    /** `folderKey` of the folder whose sub-folders are selected. */
    parentKey: string;
    /** Trail to that folder. */
    parentTrail: FolderRef[];
    /** `folderKey` of the open folder when the selection was made; opening another folder drops it. */
    openKey: string | null;
}

/** A sidebar folder row, as something to select. */
export interface TreeTarget {
    key: string;
    parentKey: string;
    parentTrail: FolderRef[];
    /** `folderKey`s of the row and its siblings, in display order. */
    order: string[];
}
