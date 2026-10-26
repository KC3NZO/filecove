// Internal to the package, not exported from the package entry, but for `UndoChange`, which the
// text's keys take.

import type { FileAdapter, FileEntry } from "./adapter";
import type { EntryGroup } from "./menu";
import type { FolderRef, Section } from "./section";

/** A change made through the file manager that can be undone, as the text names it: "Undo rename". */
export type UndoChange = "rename" | "newFolder" | "copy" | "move" | "trash" | "restore";

/** A folder of a section, by the trail to it. */
export interface UndoFolder {
    section: Section;
    trail: FolderRef[];
}

/** Entries going into a folder, by a move that undoes or redoes one. */
export interface UndoMove {
    /** The entries where they are now, sharing a folder. */
    group: EntryGroup;
    /** The folder they go into. */
    to: UndoFolder;
    /**
     * The name each of `group.entries` had there, in their order, taken back once it's there when
     * it was kept both on the way in under another; missing for a redo, which leaves the names to
     * the adapter as the move did.
     */
    names?: string[];
}

/** Entries in the trash going back into a folder, by a restore that undoes or redoes one. */
export interface UndoRestore {
    /** The entries in the trash, as the change left them there. */
    entries: FileEntry[];
    /** The folder they were moved to the trash from, which they go back to. */
    to: UndoFolder;
}

/**
 * What undoing, or redoing, a change does, with what it acts on as the change left it, which is
 * checked against the folders' listings before anything is done.
 */
export type UndoAction =
    /** Renames `group`'s one entry to `name`. */
    | { kind: "rename"; group: EntryGroup; name: string }
    /** Deletes `group`'s one entry, a folder made, while it's still empty. */
    | { kind: "remove"; group: EntryGroup }
    /** Makes a folder named `name` in `to`. */
    | { kind: "create"; to: UndoFolder; name: string }
    /**
     * Deletes the copies `group` holds, once the user confirms, as it's for good, while each is as
     * it was made. `sources` are the entries they were copied from, by folder, to copy again.
     */
    | { kind: "removeCopies"; group: EntryGroup; sources: EntryGroup[] }
    /** Copies `sources` into `to` again. */
    | { kind: "copy"; sources: EntryGroup[]; to: UndoFolder }
    /** Moves each one's entries into its folder, as many transfers. */
    | { kind: "move"; moves: UndoMove[] }
    /** Moves each group's entries to the trash, a folder's at a time. */
    | { kind: "trash"; groups: EntryGroup[] }
    /** Puts the entries in the trash back, each one's into its folder, together, keeping both. */
    | { kind: "restore"; restores: UndoRestore[] };

/** A change made through the file manager, which the history undoes, or redoes once undone. */
export interface UndoStep {
    /** Unique within the history, for the notice offering to undo or redo it. */
    id: number;
    change: UndoChange;
    /** The adapter serving every section the action names. */
    adapter: FileAdapter;
    /** What undoing it does, on the undo list, or redoing it, on the redo list. */
    action: UndoAction;
}

/** An entry given to `copy` or `move`, and what the adapter says it became in the target. */
export interface MadePair {
    from: FileEntry;
    to: FileEntry;
}

/** Which of the history's lists: the changes that can be undone, or those undone that can be redone. */
export type UndoDirection = "undo" | "redo";

/** The changes that can be undone and redone, each list's latest last. */
export type UndoHistory = Record<UndoDirection, UndoStep[]>;
