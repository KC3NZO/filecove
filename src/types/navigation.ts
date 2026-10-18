// Internal to the package, not exported from the package entry.

import type { FolderRef } from "./section";

/** Where the file manager is: a section, and the folders opened below its root. */
export interface Place {
    sectionId: string;
    /** Folders below the section root, outermost first; empty at the root. */
    trail: FolderRef[];
}
