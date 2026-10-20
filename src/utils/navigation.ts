import type { FileEntry, FolderRef, Place, Section } from "../types";

/** The folder a place points at: the end of its trail, or the section root. */
export const folderOf = (section: Section, trail: FolderRef[]): FolderRef =>
    trail.at(-1) ?? { id: section.rootId, name: section.label };

/**
 * A place in a section showing a folder after it was renamed. The folder's step takes the new name
 * and id. When the id changed, as path ids do, the ids of the folders below it changed too and
 * can't be worked out, so the trail ends at the renamed folder.
 */
export const renameInPlace = (place: Place, before: FileEntry, after: FileEntry): Place => {
    const index = place.trail.findIndex((folder) => folder.id === before.id);

    if (index < 0) {
        return place;
    }

    const step = { id: after.id, name: after.name };
    const trail =
        after.id === before.id
            ? place.trail.map((folder, position) => (position === index ? step : folder))
            : [...place.trail.slice(0, index), step];

    return { ...place, trail };
};

/**
 * A place in a section showing folders after they were deleted, from this section or another: a
 * trail into one of them ends at the folder that held it.
 */
export const outsideDeleted = (place: Place, ids: ReadonlySet<string>): Place => {
    const index = place.trail.findIndex((folder) => ids.has(folder.id));

    return index < 0 ? place : { ...place, trail: place.trail.slice(0, index) };
};
