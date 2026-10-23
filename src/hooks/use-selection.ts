import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { EMPTY_SELECTION, NO_MODIFIERS, nextSelection } from "../utils/selection";
import { sameIds } from "../utils/sets";

import type { EntrySelection, FileEntry, SelectModifiers } from "../types";

interface SelectionOptions {
    /** The selected ids, while the consumer controls them; the hook keeps its own otherwise. */
    ids?: ReadonlySet<string>;
    /** The ids the hook's own selection starts with. */
    initialIds?: readonly string[];
    /**
     * Told every change made through the hook as it's made, with the entries it selects. It's how a
     * controlled selection changes, since the hook then doesn't change the ids itself.
     */
    onChange?: (ids: ReadonlySet<string>, selected: FileEntry[]) => void;
}

/**
 * The selection among a folder's entries, which `entries` must list in display order for Shift
 * ranges. Controlled through `ids`, only the anchor is kept here.
 */
export const useSelection = (
    entries: FileEntry[] | undefined,
    { ids, initialIds, onChange }: SelectionOptions = {},
) => {
    const [own, setOwn] = useState<EntrySelection>(() =>
        initialIds?.length ? { ids: new Set(initialIds), anchor: null } : EMPTY_SELECTION,
    );

    const selection = useMemo(() => (ids && ids !== own.ids ? { ids, anchor: own.anchor } : own), [ids, own]);

    const order = useMemo(() => entries?.map((entry) => entry.id) ?? [], [entries]);

    // Ids of entries not listed, such as hidden ones, stay in the set, but only listed entries count.
    const selected = useMemo(
        () => entries?.filter((entry) => selection.ids.has(entry.id)) ?? [],
        [entries, selection.ids],
    );

    // What a change builds on: the selection as of the latest render, or as of the latest change
    // made since, so changes made one after another in one event add up.
    const latest = useRef({ selection, entries, order, onChange });

    useLayoutEffect(() => {
        latest.current = { selection, entries, order, onChange };
    });

    const commit = useCallback((next: EntrySelection) => {
        const { selection: prev, entries: listed, onChange: report } = latest.current;
        const idsChanged = !sameIds(next.ids, prev.ids);

        if (!idsChanged && next.anchor === prev.anchor) {
            return;
        }

        latest.current = { ...latest.current, selection: next };
        setOwn(next);

        if (idsChanged) {
            report?.(next.ids, listed?.filter((entry) => next.ids.has(entry.id)) ?? []);
        }
    }, []);

    /**
     * Selects as a click with `modifiers` would. A range starts from `fallbackAnchor` when the
     * folder has no anchor yet, as Shift+arrow does from the focused entry.
     */
    const select = useCallback(
        (id: string, modifiers: SelectModifiers = NO_MODIFIERS, fallbackAnchor?: string) => {
            const { selection: prev, order: listed } = latest.current;
            const anchored =
                fallbackAnchor !== undefined && (prev.anchor === null || !listed.includes(prev.anchor))
                    ? { ...prev, anchor: fallbackAnchor }
                    : prev;

            commit(nextSelection(anchored, id, modifiers, listed));
        },
        [commit],
    );

    /** Sets the whole selection, e.g. from a marquee. */
    const replace = useCallback((next: EntrySelection) => commit(next), [commit]);

    const selectAll = useCallback(() => {
        const listed = latest.current.order;

        commit({ ids: new Set(listed), anchor: listed[0] ?? null });
    }, [commit]);

    const clear = useCallback(() => {
        if (latest.current.selection.ids.size > 0) {
            commit(EMPTY_SELECTION);
        }
    }, [commit]);

    /** Drops the ids `listed` doesn't hold, e.g. of entries gone from the folder. */
    const retain = useCallback(
        (listed: ReadonlySet<string>) => {
            const { ids: held, anchor } = latest.current.selection;

            if ([...held].every((id) => listed.has(id))) {
                return;
            }

            commit({
                ids: new Set([...held].filter((id) => listed.has(id))),
                anchor: anchor !== null && listed.has(anchor) ? anchor : null,
            });
        },
        [commit],
    );

    return {
        selection,
        selectedIds: selection.ids,
        selected,
        /** The ids last set through the hook, which a controlled selection follows once the consumer takes them. */
        requestedIds: own.ids,
        select,
        replace,
        selectAll,
        clear,
        retain,
    };
};
