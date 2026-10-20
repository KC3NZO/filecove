// Internal to the package, not exported from the package entry.

import type { FileEntry } from "./adapter";
import type { FolderRef, Section } from "./section";

/** Entries dragged out of a folder, as they'd be dropped at this moment. */
export interface EntryDrag {
    /** "move", unless a modifier key held over the drop target asks for a copy. */
    kind: "move" | "copy";
    /** The section the entries were dragged from. */
    section: Section;
    /** Trail to the folder the entries are in. */
    trail: FolderRef[];
    entries: FileEntry[];
}

/**
 * What dropping `drag` into the folder at `trail` of `section` does, to be called on drop, or
 * undefined when the entries can't go there, so the folder doesn't take the drop.
 */
export type DropInto = (drag: EntryDrag, section: Section, trail: FolderRef[]) => (() => void) | undefined;
