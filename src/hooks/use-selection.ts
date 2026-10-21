import { useCallback, useMemo, useState } from "react";

import { EMPTY_SELECTION, NO_MODIFIERS, nextSelection } from "../utils/selection";

import type { EntrySelection, FileEntry, SelectModifiers } from "../types";

/** The selection among a folder's entries, which `entries` must list in display order for Shift ranges. */
export const useSelection = (entries: FileEntry[] | undefined) => {
    const [selection, setSelection] = useState<EntrySelection>(EMPTY_SELECTION);

    const order = useMemo(() => entries?.map((entry) => entry.id) ?? [], [entries]);

    // Ids of entries that a refresh removed may linger in the set; only listed entries count.
    const selected = useMemo(
        () => entries?.filter((entry) => selection.ids.has(entry.id)) ?? [],
        [entries, selection.ids],
    );

    /**
     * Selects as a click with `modifiers` would. A range starts from `fallbackAnchor` when the
     * folder has no anchor yet, as Shift+arrow does from the focused entry.
     */
    const select = useCallback(
        (id: string, modifiers: SelectModifiers = NO_MODIFIERS, fallbackAnchor?: string) => {
            setSelection((prev) => {
                const anchored =
                    fallbackAnchor !== undefined && (prev.anchor === null || !order.includes(prev.anchor))
                        ? { ...prev, anchor: fallbackAnchor }
                        : prev;

                return nextSelection(anchored, id, modifiers, order);
            });
        },
        [order],
    );

    /** Sets the whole selection, e.g. from a marquee. */
    const replace = useCallback((next: EntrySelection) => setSelection(next), []);

    const selectAll = useCallback(() => setSelection({ ids: new Set(order), anchor: order[0] ?? null }), [order]);

    const clear = useCallback(() => {
        setSelection((prev) => (prev.ids.size === 0 ? prev : EMPTY_SELECTION));
    }, []);

    return { selection, selectedIds: selection.ids, selected, select, replace, selectAll, clear };
};
