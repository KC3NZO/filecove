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
 */
export const useTreeSelection = (openKey: string | null) => {
    const [stored, setStored] = useState<TreeSelection | null>(null);

    const selection = stored && stored.openKey === openKey ? stored : null;

    const select = useCallback(
        (target: TreeTarget, modifiers: SelectModifiers = NO_MODIFIERS) => {
            setStored((prev) => nextTreeSelection(prev, openKey, target, modifiers));
        },
        [openKey],
    );

    const selectSection = useCallback(
        (key: string) => {
            setStored({ ids: new Set([key]), anchor: key, parentKey: NO_PARENT, parentTrail: ROOT_TRAIL, openKey });
        },
        [openKey],
    );

    /** Back to the open folder alone, as when a folder is opened. */
    const reset = useCallback(() => setStored(null), []);

    return { selection, select, selectSection, reset };
};
