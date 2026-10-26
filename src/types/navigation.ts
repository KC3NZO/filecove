import type { IconSource } from "./icon";
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

/**
 * What `FileManagerApi.goToPath` came to: either it went where the path leads, or it says why it
 * couldn't.
 */
export type GoToPathResult =
    | {
          ok: true;
          /** Where it went: the folder the path names, or for a file, the folder holding it. */
          location: FileManagerLocation;
          /** The file the path names, which is selected in `location`, or undefined for a folder. */
          entryId?: string;
      }
    | {
          ok: false;
          /** Why, in the file manager's text (`localeText`), as the path field shows it. */
          message: string;
      };

/** Internal: why a typed path leads nowhere. */
export type PathProblem =
    /** It starts with a name that is no section's label. */
    | { kind: "section"; name: string }
    /** A folder on the way has nothing of that name. */
    | { kind: "missing"; name: string; folder: string }
    /** A name before the path's end is a file. */
    | { kind: "notFolder"; name: string }
    /** A folder on the way couldn't be listed. */
    | { kind: "failed"; folder: string; error: unknown };

/** Internal: where a typed path leads, or why it doesn't. */
export type PathResult =
    | { found: true; location: FileManagerLocation; entryId?: string }
    | { found: false; problem: PathProblem };

/** Internal: a folder of a section as a menu lists it, by its name, with where it is under it. */
export interface PlaceName {
    /** The folder's name, or its section's label at the root. */
    label: string;
    /** The section and the folders above it, to tell folders of one name apart; empty at the root. */
    location: string;
    /** The section's icon at the root, else a folder's. */
    icon: IconSource;
}

/**
 * Internal: a place on the header's back or forward list: how many steps `by` from the current one
 * (negative back), and how it reads.
 */
export interface HistoryStop extends PlaceName {
    by: number;
}
