import type { MouseEvent } from "react";

import type { EntrySelection, SelectModifiers, TreeSelection, TreeTarget } from "../types";

export const EMPTY_SELECTION: EntrySelection = { ids: new Set(), anchor: null };

export const NO_MODIFIERS: SelectModifiers = { toggle: false, range: false };

/** What a click's modifier keys ask for. ⌘ stands in for Ctrl on macOS, where Ctrl-click opens the context menu. */
export const selectModifiers = (event: MouseEvent): SelectModifiers => ({
    toggle: event.ctrlKey || event.metaKey,
    range: event.shiftKey,
});

/**
 * The selection after clicking the entry `id`, where `order` is every entry id as displayed.
 *
 * - A plain click selects only that entry.
 * - Toggle adds the entry, or takes it out if it was selected.
 * - Range selects from the anchor to the entry, replacing the selection, or adding to it when
 *   toggle is held as well. Without an anchor in the folder it acts as a plain click.
 *
 * Every click except a range one moves the anchor, so repeated Shift-clicks pivot on one entry.
 */
export const nextSelection = (
    selection: EntrySelection,
    id: string,
    { toggle, range }: SelectModifiers,
    order: string[],
): EntrySelection => {
    const from = selection.anchor === null ? -1 : order.indexOf(selection.anchor);
    const to = order.indexOf(id);

    if (range && from !== -1 && to !== -1) {
        const span = order.slice(Math.min(from, to), Math.max(from, to) + 1);

        return { ids: new Set(toggle ? [...selection.ids, ...span] : span), anchor: selection.anchor };
    }

    if (toggle) {
        const ids = new Set(selection.ids);

        if (ids.has(id)) {
            ids.delete(id);
        } else {
            ids.add(id);
        }

        return { ids, anchor: id };
    }

    return { ids: new Set([id]), anchor: id };
};

/**
 * The sidebar tree's selection after clicking a folder row. `prev` only counts while the folder
 * it was made in is still open; without it, the open folder is what Ctrl and Shift build from.
 * Selected folders stay siblings, so a click under another parent starts a new selection.
 */
export const nextTreeSelection = (
    prev: TreeSelection | null,
    openKey: string | null,
    target: TreeTarget,
    modifiers: SelectModifiers,
): TreeSelection => {
    const live = prev && prev.openKey === openKey ? prev : null;
    let base: EntrySelection = EMPTY_SELECTION;

    if (live) {
        base = live.parentKey === target.parentKey ? live : EMPTY_SELECTION;
    } else if (openKey !== null && target.order.includes(openKey)) {
        base = { ids: new Set([openKey]), anchor: openKey };
    }

    return {
        ...nextSelection(base, target.key, modifiers, target.order),
        parentKey: target.parentKey,
        parentTrail: target.parentTrail,
        openKey,
    };
};
