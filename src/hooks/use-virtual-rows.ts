import { useCallback, useMemo } from "react";

import { laidHeight, useScrollMeasure } from "./use-scroll-measure";

import type { ScrollView } from "../types";

/** A row that knows where it sits in its list. */
interface PlacedRow {
    id: string;
    /** How far down the list the row is, in px. */
    top: number;
    height: number;
}

/** The first and last row to render, by index. */
interface RowRange {
    first: number;
    last: number;
}

const NO_ROWS: RowRange = { first: 0, last: -1 };

const sameRange = (a: RowRange, b: RowRange) => a.first === b.first && a.last === b.last;

/** The index of the first row reaching below `y`, or the number of rows when none does. */
const firstBelow = (rows: PlacedRow[], y: number) => {
    let low = 0;
    let high = rows.length;

    while (low < high) {
        const middle = (low + high) >> 1;

        if (rows[middle].top + rows[middle].height > y) {
            high = middle;
        } else {
            low = middle + 1;
        }
    }

    return low;
};

/** The index of the last row starting above `y`, or -1 when none does. */
const lastAbove = (rows: PlacedRow[], y: number) => {
    let low = 0;
    let high = rows.length;

    while (low < high) {
        const middle = (low + high) >> 1;

        if (rows[middle].top < y) {
            low = middle + 1;
        } else {
            high = middle;
        }
    }

    return low - 1;
};

const measureRange = (view: ScrollView, rows: PlacedRow[], height: number): RowRange => {
    const span = view.place(height);

    if (!span) {
        return { first: 0, last: rows.length - 1 };
    }

    return { first: firstBelow(rows, span.top), last: lastAbove(rows, span.bottom) };
};

/**
 * Renders only the rows in or near the scroll panel, of a list `height` px tall whose rows are
 * placed already, each knowing its `top` and `height`, in order from the top. The list takes
 * `ref` and the `height` this gives, which is less than all its rows while they're too many for
 * the browser to lay out and are squeezed into fewer px (see `useScrollMeasure`), and its rows go
 * in it absolutely positioned, as `shown` places them: where they are in the whole list, less
 * `offset`, which is 0 while it isn't squeezed.
 *
 * `keep` names rows to render wherever they are, such as the focused one. `span` is how far the
 * rows rendered in order reach, in px of the whole list, for what's drawn alongside them, which
 * goes `offset` higher too. `reveal` scrolls to a row.
 */
export const useVirtualRows = <Row extends PlacedRow>(rows: Row[], height: number, keep: (string | null)[]) => {
    const { ref, measured, offset, show } = useScrollMeasure(
        (view) => measureRange(view, rows, height),
        NO_ROWS,
        sameRange,
    );

    // Each row placed for the offset, made once per row while the offset stays, so the rows
    // rendered are the same objects from one render to the next.
    const placed = useMemo(() => new WeakMap<Row, Row>(), [offset]);
    const place = (row: Row) => {
        if (offset === 0) {
            return row;
        }

        let moved = placed.get(row);

        if (!moved) {
            moved = { ...row, top: row.top - offset };
            placed.set(row, moved);
        }

        return moved;
    };

    // The range may be a render behind the rows, until they're measured again.
    const first = Math.max(measured.first, 0);
    const last = Math.min(measured.last, rows.length - 1);
    const kept = new Set(keep);
    const shown = rows.filter((row, index) => (index >= first && index <= last) || kept.has(row.id)).map(place);

    const span =
        first <= last ? { top: rows[first].top, bottom: rows[last].top + rows[last].height } : { top: 0, bottom: 0 };

    /**
     * Scrolls the panel by the least that shows a row of `rows`, as placed in the whole list, and
     * `element`, its own when it's rendered, with the page around as needed.
     */
    const reveal = useCallback(
        (row: PlacedRow, element?: HTMLElement | null) => show(row.top, row.top + row.height, element),
        [show],
    );

    return { ref, shown, span, offset, height: laidHeight(height), reveal };
};
