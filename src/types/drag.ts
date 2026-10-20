// Internal to the package, not exported from the package entry.

import type { FileEntry } from "./adapter";
import type { Clipboard } from "./clipboard";
import type { FolderRef, Section } from "./section";

/**
 * Entries being dragged: a clipboard of their own, which is cut or copied only once they're
 * dropped, by the modifier keys held at that moment.
 */
export type DraggedEntries = Omit<Clipboard, "kind">;

/** What a view picks up when a drag starts in it. */
export interface DragSource {
    /** The section the entries are dragged from. */
    section: Section;
    /** Trail to the folder the entries are in. */
    trail: FolderRef[];
    entries: FileEntry[];
    /** The entry the drag started from, which the drag image shows. */
    grabbed: FileEntry;
}

/** A folder that dragged entries could be dropped into. */
export interface DropTarget {
    /** Tells the folder apart from a view's other drop targets, so the view can mark it. */
    key: string;
    section: Section;
    /** Trail to the folder. */
    trail: FolderRef[];
}

/**
 * What dropping `dragged` into the folder at `trail` of `section` does, copying them when `copy`
 * is set and moving them otherwise, to be called on drop, or undefined when they can't go there,
 * so the folder doesn't take the drop.
 */
export type DropInto = (
    dragged: DraggedEntries,
    copy: boolean,
    section: Section,
    trail: FolderRef[],
) => (() => void) | undefined;
