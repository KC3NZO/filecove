import { shownSpan, useScrollMeasure } from "./use-scroll-measure";

import type { ScrollTarget } from "../types";

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

const measureRange = (target: ScrollTarget, rows: PlacedRow[]): RowRange => {
    const span = shownSpan(target);

    if (!span) {
        return { first: 0, last: rows.length - 1 };
    }

    return { first: firstBelow(rows, span.top), last: lastAbove(rows, span.bottom) };
};

/**
 * Renders only the rows in or near the scroll panel, of a list whose rows are placed already, each
 * knowing its `top` and `height`, in order from the top. The list takes `ref` and is as tall as
 * all its rows, which go in it absolutely positioned.
 *
 * `keep` names rows to render wherever they are, such as the focused one. `span` is how far the
 * rows rendered in order reach, in px, for what's drawn alongside them.
 */
export const useVirtualRows = <Row extends PlacedRow>(rows: Row[], keep: (string | null)[]) => {
    const { ref, measured } = useScrollMeasure((target) => measureRange(target, rows), NO_ROWS, sameRange);

    // The range may be a render behind the rows, until they're measured again.
    const first = Math.max(measured.first, 0);
    const last = Math.min(measured.last, rows.length - 1);
    const kept = new Set(keep);
    const shown = rows.filter((row, index) => (index >= first && index <= last) || kept.has(row.id));

    const span =
        first <= last ? { top: rows[first].top, bottom: rows[last].top + rows[last].height } : { top: 0, bottom: 0 };

    return { ref, shown, span };
};
