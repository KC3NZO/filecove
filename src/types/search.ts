// `SearchScope` and `FileManagerSearch` are public; the rest is internal to the package.

import type { FileAdapter, FileEntry } from "./adapter";
import type { FolderRef, Section } from "./section";

/**
 * What a search covers: the open folder ("folder", Ctrl+F and the button by the path bar) or every
 * section checked in the field's sections menu ("everywhere", Ctrl+Shift+F and the magnifier at the
 * top of the sidebar), as GNOME Files splits them.
 */
export type SearchScope = "folder" | "everywhere";

/** The search field while it's open: what it searches and what's typed in it. */
export interface FileManagerSearch {
    scope: SearchScope;
    /** What's typed, as typed: not trimmed. */
    query: string;
}

/** A section a search everywhere covers, with the adapter that searches it. */
export interface SearchTarget {
    section: Section;
    adapter: FileAdapter;
}

/** One section's part of a search everywhere, as `useSearch` keeps it. */
export interface SectionSearch {
    /**
     * "searching" while a page is awaited, with the matches so far, or those of what was searched
     * before until the first page comes; "ready" once the last page has come; "error" when the
     * adapter rejected, with the matches it had.
     */
    status: "searching" | "ready" | "error";
    matches: SearchHit[];
    error?: unknown;
}

/** An entry a search everywhere found, in a section, with where it is. */
export interface SearchHit {
    /**
     * Tells it apart from every other result, as entries of different adapters may share ids:
     * `resultKey` of its section and its id.
     */
    key: string;
    section: Section;
    /** The adapter that found it, the section's. */
    adapter: FileAdapter;
    /** Trail to the folder it's in, below the section's root. */
    trail: FolderRef[];
    entry: FileEntry;
}
