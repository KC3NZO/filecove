import type { FolderRef } from "./section";

/**
 * Where the file manager is: a section, and the folders opened below its root, as `location`,
 * `defaultLocation` and `onLocationChange` take it. The trail is the consumer's to build when they
 * pass one, since the file manager never parses ids: each folder in it is one listed in the folder
 * before it, the first one in the section's root.
 */
export interface FileManagerLocation {
    sectionId: string;
    /** Folders below the section root, outermost first; empty at the root. */
    trail: FolderRef[];
}

/**
 * Why the location changed, as `onLocationChange` is told:
 *
 * - "navigate": the user went somewhere, or `FileManagerApi.navigate` did.
 * - "back" and "forward": through the file manager's history, with its buttons, Alt+Left and
 *   Alt+Right, or the `FileManagerApi`.
 * - "replace": the place the file manager was at is no longer there as it was, so it was rewritten
 *   rather than gone from: the folder it was in was renamed, deleted or moved away, or its section
 *   was removed, rooted elsewhere or given another adapter. A URL kept in step is replaced, not pushed.
 */
export type LocationChangeReason = "navigate" | "back" | "forward" | "replace";
