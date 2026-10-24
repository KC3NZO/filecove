// Internal to the package, not exported from the package entry.

import type { FileAdapter, FileEntry } from "./adapter";
import type { FolderRef, Section } from "./section";

/**
 * An entry the properties panel shows, with what it knows of it from outside. The panel is meant
 * for the media manager too, so it knows nothing of sections or the file manager.
 */
export interface PropertiesItem {
    entry: FileEntry;
    /** The adapter serving it, which `properties` and `measure` are asked. */
    adapter: FileAdapter;
    /** Where it is, written out, e.g. "Website / src"; missing for a root, which is nowhere. */
    location?: string;
    /**
     * How many entries a folder holds, from its own listing, when the entry doesn't say
     * (`childCount`), as for a section's root, which no listing holds.
     */
    childCount?: number;
    /** Asks for a new name for it; missing when it can't be renamed. */
    rename?: () => void;
    /** Opens the folder it's in and shows it there, for a search's result; missing otherwise. */
    openLocation?: () => void;
}

/**
 * What was asked of the adapter for the properties: on its way, with what's come so far when it
 * reports that, come, or failed with what it rejected with.
 */
export type Requested<T> =
    | { status: "loading"; progress?: T }
    | { status: "ready"; value: T }
    | { status: "error"; error: unknown };

/** A folder to count what's in, with the adapter that counts it. */
export interface CountTarget {
    entry: FileEntry;
    adapter: FileAdapter;
}

/** An entry `PropertiesSubject` names, with where it is. */
export interface SubjectEntry {
    entry: FileEntry;
    section: Section;
    /** Trail to the folder holding it, below the section's root. */
    trail: FolderRef[];
}

/**
 * What the file manager's properties panel shows: entries, which a search's results may have in
 * different folders, a folder itself, the open one or one whose menu asked, or nothing.
 */
export type PropertiesSubject =
    | { kind: "entries"; entries: SubjectEntry[]; inResults: boolean }
    | { kind: "folder"; section: Section; trail: FolderRef[] }
    | { kind: "none" };
