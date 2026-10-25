import { useRef } from "react";
import type { RefObject } from "react";

import { gridColumns } from "../utils/dom";
import { shownSpan, useScrollMeasure } from "./use-scroll-measure";

import type { ScrollTarget, VirtualLines } from "../types";

/** The lines as last measured, and which of them to render. */
interface Measure {
    /** Entries per line. */
    columns: number;
    /** A line's height, in px. */
    height: number;
    /** From one line's top to the next one's, in px. */
    pitch: number;
    /** The first and last line to render. */
    first: number;
    last: number;
}

/**
 * The entry at the panel's top as the lines changed size, or how many a line holds, and how far
 * down its line the top was, from 0 to 1, to put it back there once the list is as tall as the new
 * lines make it.
 */
interface Anchor {
    index: number;
    fraction: number;
}

/** A box in viewport coordinates. */
type Rect = Pick<DOMRectReadOnly, "left" | "top" | "right" | "bottom">;

// Until an entry has been rendered to be measured, only the first line is rendered.
const UNMEASURED: Measure = { columns: 1, height: 0, pitch: 0, first: 0, last: 0 };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const sameMeasure = (a: Measure, b: Measure) =>
    a.columns === b.columns && a.height === b.height && a.pitch === b.pitch && a.first === b.first && a.last === b.last;

/** How far the panel's top is down the list, in px; negative while the list starts below it. */
const scrolledPast = ({ list, scroller }: ScrollTarget) =>
    scroller ? scroller.getBoundingClientRect().top + scroller.clientTop - list.getBoundingClientRect().top : 0;

/**
 * Measures the lines of `count` entries: how many entries a line holds from the list's column
 * tracks, how tall it is from the first entry rendered, the row gap between lines, and which
 * lines are in or near the panel.
 *
 * Lines that change size, or the number a line holds, as zooming or the panel resizing does, keep
 * the entry at the panel's top where it was: it's noted against the `previous` measure as `anchor`,
 * and scrolled back to on the measure after, once the list has been rendered as tall as the new
 * lines make it, so the panel can scroll that far.
 */
const measure = (
    target: ScrollTarget,
    count: number,
    previous: Measure,
    anchor: RefObject<Anchor | null>,
): Measure => {
    const { list, scroller } = target;
    const entry = list.firstElementChild;
    const columns = gridColumns(list);
    const height = entry ? entry.getBoundingClientRect().height : 0;
    const pitch = height + (parseFloat(getComputedStyle(list).rowGap) || 0);
    const lastLine = Math.max(Math.ceil(count / columns) - 1, 0);

    // Hidden, the list has nothing to measure, and only its first line is rendered until it shows.
    if (height === 0) {
        return { columns, height, pitch: 0, first: 0, last: 0 };
    }

    if (scroller && previous.pitch > 0 && (previous.pitch !== pitch || previous.columns !== columns)) {
        const offset = scrolledPast(target);

        anchor.current =
            offset > 0
                ? {
                      index: Math.floor(offset / previous.pitch) * previous.columns,
                      fraction: (offset % previous.pitch) / previous.pitch,
                  }
                : null;
    } else if (scroller && anchor.current) {
        const { index, fraction } = anchor.current;

        anchor.current = null;
        scroller.scrollTop += (Math.floor(index / columns) + fraction) * pitch - scrolledPast(target);
    }

    const span = shownSpan(target);

    if (!span) {
        return { columns, height, pitch, first: 0, last: lastLine };
    }

    return {
        columns,
        height,
        pitch,
        first: clamp(Math.floor(span.top / pitch), 0, lastLine),
        last: clamp(Math.floor(span.bottom / pitch), 0, lastLine),
    };
};

/**
 * Renders only the entries in or near the scroll panel, so a folder of any size lists as fast as a
 * small one. The entries go in lines of equal height on a listbox that is a CSS grid, so container
 * queries still decide the layout: its column tracks say how many entries a line holds, its row
 * gap spaces the lines, and the first entry rendered is measured for their height. Each rendered
 * entry is absolutely positioned at its line, and in the grid in its column, and the listbox is as
 * tall as all the lines, so the panel scrolls as it would with every entry there.
 *
 * `keep` lists entries to render wherever they are, such as the focused one. `indexesIn` finds
 * entries by where the lines put them, rendered or not, and `settled` says whether the rendered
 * ones are in their places yet, to be scrolled to, which they aren't until the latest measure is
 * rendered.
 */
export const useVirtualLines = (count: number, keep: number[]) => {
    // The measure last made, rendered or about to be, which the next is compared with.
    const lastMeasure = useRef(UNMEASURED);
    const anchor = useRef<Anchor | null>(null);
    const { ref, target, measured, settled } = useScrollMeasure(
        (scrollTarget) => {
            lastMeasure.current = measure(scrollTarget, count, lastMeasure.current, anchor);

            return lastMeasure.current;
        },
        UNMEASURED,
        sameMeasure,
    );

    const { columns, height, pitch, first, last } = measured;
    const lineCount = Math.ceil(count / columns);
    const start = Math.min(first * columns, count);
    const end = Math.min((last + 1) * columns, count);

    // Kept entries away from the panel go before or after the others, so the page keeps their order.
    const outside = [...new Set(keep)]
        .filter((index) => index >= 0 && index < count && (index < start || index >= end))
        .sort((a, b) => a - b);
    const indexes = outside.filter((index) => index < start);

    for (let index = start; index < end; index += 1) {
        indexes.push(index);
    }

    indexes.push(...outside.filter((index) => index >= end));

    const lines: VirtualLines = {
        ref,
        indexes,
        columns,
        pitch,
        height: lineCount > 0 ? (lineCount - 1) * pitch + height : 0,
    };

    /**
     * The indexes of the entries a box in viewport coordinates touches, in order, whether they're
     * rendered or not, from where the lines and the list's column tracks put them.
     */
    const indexesIn = (box: Rect) => {
        const list = target.current?.list;

        if (!list || pitch <= 0) {
            return [];
        }

        const origin = list.getBoundingClientRect();
        const style = getComputedStyle(list);
        const width = parseFloat(style.gridTemplateColumns) || origin.width;
        const step = width + (parseFloat(style.columnGap) || 0);
        // Columns start from the right in a right-to-left list.
        const [left, right] =
            style.direction === "rtl"
                ? [origin.right - box.right, origin.right - box.left]
                : [box.left - origin.left, box.right - origin.left];
        const top = box.top - origin.top;
        const bottom = box.bottom - origin.top;

        // The lines and columns the box overlaps, the gaps between them aside.
        const firstLine = Math.max(Math.floor((top - height) / pitch) + 1, 0);
        const lastLine = Math.min(Math.ceil(bottom / pitch) - 1, lineCount - 1);
        const firstColumn = Math.max(Math.floor((left - width) / step) + 1, 0);
        const lastColumn = Math.min(Math.ceil(right / step) - 1, columns - 1);
        const hits: number[] = [];

        for (let line = firstLine; line <= lastLine; line += 1) {
            for (let column = firstColumn; column <= lastColumn; column += 1) {
                const index = line * columns + column;

                if (index < count) {
                    hits.push(index);
                }
            }
        }

        return hits;
    };

    return { lines, indexesIn, settled };
};
