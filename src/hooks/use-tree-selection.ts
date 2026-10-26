import { useCallback, useState } from "react";

import { NO_MODIFIERS, nextTreeSelection } from "../utils/selection";

import type { FolderRef, SelectModifiers, TreeSelection, TreeTarget } from "../types";

// Section rows have no parent folder, so selecting one never combines with folders.
const NO_PARENT = "";
const ROOT_TRAIL: FolderRef[] = [];

/**
 * The sidebar tree's selection, kept apart from the content's. While nothing has been Ctrl-,
 * Shift- or right-clicked, `selection` is null and the open folder alone counts as selected;
 * opening another folder returns to that.
 *
 * On touch, the "Select" of a folder's menu (`ActionContext.select`) starts the selection mode
 * (`selecting`), in which every tap toggles a folder. It ends with the selection: as a folder
 * opens, a section's menu opens, or `reset`.
 */
export const useTreeSelection = (openKey: string | null) => {
    const [stored, setStored] = useState<TreeSelection | null>(null);

    const selection = stored && stored.openKey === openKey ? stored : null;
    const selecting = selection?.selecting === true;

    const select = useCallback(
        (target: TreeTarget, modifiers: SelectModifiers = NO_MODIFIERS) => {
            setStored((prev) => nextTreeSelection(prev, openKey, target, modifiers));
        },
        [openKey],
    );

    /**
     * Starts the selection mode with the folders the menu was for: the selection the folder is in,
     * or else the folder alone.
     */
    const startSelecting = useCallback(
        (target: TreeTarget) => {
            setStored((prev) => {
                const kept =
                    prev && prev.openKey === openKey && prev.parentKey === target.parentKey && prev.ids.has(target.key)
                        ? prev
                        : nextTreeSelection(null, openKey, target, NO_MODIFIERS);

                return { ...kept, selecting: true };
            });
        },
        [openKey],
    );

    /** Selects these folders, all of one parent, in place of those selected; for Select all or none. */
    const selectKeys = useCallback(
        (keys: string[]) => {
            setStored((prev) =>
                prev && prev.openKey === openKey ? { ...prev, ids: new Set(keys), anchor: keys[0] ?? null } : prev,
            );
        },
        [openKey],
    );

    const selectSection = useCallback(
        (key: string) => {
            setStored({ ids: new Set([key]), anchor: key, parentKey: NO_PARENT, parentTrail: ROOT_TRAIL, openKey });
        },
        [openKey],
    );

    /** Back to the open folder alone, as when a folder is opened, which ends the selection mode. */
    const reset = useCallback(() => setStored(null), []);

    return { selection, selecting, select, startSelecting, selectKeys, selectSection, reset };
};
