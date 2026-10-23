import type { FileEntry, FileManagerLocation, FolderRef, Section } from "../types";

/** The folder a place points at: the end of its trail, or the section root. */
export const folderOf = (section: Section, trail: FolderRef[]): FolderRef =>
    trail.at(-1) ?? { id: section.rootId, name: section.label };

/** Whether two places are the same folder of the same section, by id. */
export const samePlace = (a: FileManagerLocation, b: FileManagerLocation) =>
    a.sectionId === b.sectionId &&
    a.trail.length === b.trail.length &&
    a.trail.every((folder, index) => folder.id === b.trail[index].id);

/** Whether two places are the same and their folders go by the same names too. */
export const equalPlace = (a: FileManagerLocation, b: FileManagerLocation) =>
    samePlace(a, b) && a.trail.every((folder, index) => folder.name === b.trail[index].name);

/**
 * The folder left by going from `from` up to `to`, a folder above it in the same section: the one
 * on `from`'s trail right below `to`. Undefined when `to` isn't above `from`.
 */
export const folderLeft = (from: FileManagerLocation, to: FileManagerLocation): FolderRef | undefined =>
    from.sectionId === to.sectionId &&
    to.trail.length < from.trail.length &&
    to.trail.every((folder, index) => folder.id === from.trail[index].id)
        ? from.trail[to.trail.length]
        : undefined;

/**
 * A place in a section showing a folder after it was renamed. The folder's step takes the new name
 * and id. When the id changed, as path ids do, the ids of the folders below it changed too and
 * can't be worked out, so the trail ends at the renamed folder.
 */
export const renameInPlace = (place: FileManagerLocation, before: FileEntry, after: FileEntry): FileManagerLocation => {
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
export const outsideDeleted = (place: FileManagerLocation, ids: ReadonlySet<string>): FileManagerLocation => {
    const index = place.trail.findIndex((folder) => ids.has(folder.id));

    return index < 0 ? place : { ...place, trail: place.trail.slice(0, index) };
};
