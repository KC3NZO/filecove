import { joinIsolated } from "./bidi";

import type { FileAdapter, FileEntry, FolderRef, Section, TrashInfo, TrashResult, UndoFolder } from "../types";

/** Whether the folder at `trail` is the root of a trash (`Section.trash`), where entries are restored from. */
export const inTrashRoot = (section: Section, trail: readonly FolderRef[]) => !!section.trash && trail.length === 0;

/** The trash sections `served` serves, in the sidebar's order. */
export const trashesOf = (sections: Iterable<Section>, adapter: FileAdapter, served: FileAdapter) =>
    [...sections].filter((section) => section.trash && (section.adapter ?? adapter) === served);

/**
 * The folder an entry in the trash was moved there from, as a folder of a section: the first, in
 * the sidebar's order, served by `served`, not a trash, whose root is in the entry's trail, with
 * the trail below its root, one that isn't `readOnly` coming first, as the entry may go back to
 * the trash from there. Null when no section shows it, as ids are never parsed.
 */
export const trashOrigin = (
    sections: Iterable<Section>,
    adapter: FileAdapter,
    served: FileAdapter,
    { trail }: TrashInfo,
): UndoFolder | null => {
    const showing = [...sections].flatMap((section) => {
        const index = trail.findIndex((step) => step.id === section.rootId);

        return index >= 0 && !section.trash && (section.adapter ?? adapter) === served
            ? [{ section, trail: trail.slice(index + 1) }]
            : [];
    });

    return showing.find(({ section }) => !section.readOnly) ?? showing[0] ?? null;
};

/**
 * Where an entry in the trash was moved there from, written out as a search's results show where
 * they are: the section's label and the folders below its root, or, with no section showing it,
 * every folder of its trail.
 */
export const trashedLocation = (
    sections: Iterable<Section>,
    adapter: FileAdapter,
    served: FileAdapter,
    info: TrashInfo,
) => {
    const origin = trashOrigin(sections, adapter, served, info);
    const names = origin
        ? [origin.section.label, ...origin.trail.map((step) => step.name)]
        : info.trail.map((step) => step.name);

    return joinIsolated(names, " / ");
};

/**
 * The date an entry goes by: in the trash's root, when it was moved there, which the list shows and
 * orders by in place of when it was modified, and elsewhere, when it was modified.
 */
export const trashedDate = (entry: FileEntry) => entry.trashed?.trashedAt ?? entry.modifiedAt;

/** The entries `trash` or `restore` says it moved, when it says. */
export const trashMade = (result: TrashResult | void) =>
    result && Array.isArray(result.entries) ? result.entries : undefined;
