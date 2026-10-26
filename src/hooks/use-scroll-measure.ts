import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { scrollParent } from "../utils/dom";

import type { ScrollTarget, ScrollView } from "../types";

/** How far past the scroll panel's top and bottom edges items are rendered, ready to scroll in, in px. */
const OVERSCAN = 400;

/**
 * The tallest a list is laid out, in px. Browsers cap an element's height (Firefox at about 17.9
 * million px, Chrome and Safari at about 33.5 million) and place things less precisely long
 * before, so a list that would be taller is laid out this tall and squeezed into it (`Squeeze`).
 */
export const MAX_LIST_HEIGHT = 6_000_000;

/**
 * The steps, in px, by which a squeezed list's items are placed further up than they'd be laid
 * out whole (`Squeeze.offset`), so they're rendered again only once a step, however far the
 * panel scrolls in between.
 */
const OFFSET_STEP = 1_000_000;

/**
 * How a list taller than `MAX_LIST_HEIGHT` is squeezed into that height. The panel then scrolls
 * through it proportionally: `ratio` px of the list go by for each px it scrolls, the same at
 * either end, so the scrollbar still spans all of it. The items in or near the panel are moved up
 * the list by `drift`, which grows as it scrolls, so they're where they'd be with the list laid
 * out whole and scrolled that far. Their `top` is `offset` less than that, which only changes in
 * whole steps, and the rest of the drift moves the whole list, through its `translate`, which is
 * set on it directly as it scrolls. A list that fits is laid out whole, with a ratio of 1.
 */
interface Squeeze {
    /** How many px of the list go by for each px the panel scrolls. */
    ratio: number;
    /** How far the panel scrolls over the list, in px, from its top at the panel's top to its end. */
    range: number;
    /** How far the items shown are moved up the list, in px. */
    drift: number;
    /** What's taken off each item's `top` as it's rendered, in px: the drift, in whole steps. */
    offset: number;
}

const WHOLE: Squeeze = { ratio: 1, range: 0, drift: 0, offset: 0 };

/** How tall a list of `height` px is laid out, in px. */
export const laidHeight = (height: number) => Math.min(height, MAX_LIST_HEIGHT);

/**
 * How far the panel's top is down the list, in px, as the list is laid out: its `translate`
 * (`moved`) aside. Negative while the list starts below the panel's top.
 */
const scrolledPast = ({ list, scroller }: ScrollTarget, moved: number) =>
    scroller ? scroller.getBoundingClientRect().top + scroller.clientTop - list.getBoundingClientRect().top - moved : 0;

/** How far the panel's top is down the whole list, in px, scrolled `past` px down it as laid out. */
const shownTop = ({ ratio, range }: Squeeze, past: number) =>
    past + Math.min(Math.max(past, 0), range) * (ratio - 1);

/** How far down the list as laid out the panel's top goes to show the whole list from `top`, in px. */
const pastFor = ({ ratio, range }: Squeeze, top: number) => {
    if (ratio === 1 || top <= 0) {
        return top;
    }

    return top <= range * ratio ? top / ratio : top - range * (ratio - 1);
};

/**
 * How a list of `height` px is squeezed, from where its panel is scrolled and what follows it
 * there, which the end of the scroll shows with it.
 */
const squeezeOf = (target: ScrollTarget, height: number, moved: number): Squeeze => {
    const { list, scroller } = target;

    if (!scroller || height <= MAX_LIST_HEIGHT) {
        return WHOLE;
    }

    // The list as the page has it now, which is the height last rendered.
    const laid = list.offsetHeight;

    if (height <= laid) {
        return WHOLE;
    }

    const past = scrolledPast(target, moved);
    // Whole px, so the ratio doesn't wobble with the fractions the page's rects come in.
    const below = Math.round(scroller.scrollHeight - (scroller.scrollTop - past) - laid);
    // The part of the panel the list fills, scrolled to its end.
    const filled = scroller.clientHeight - below;
    const range = laid - filled;

    if (range <= 0) {
        return WHOLE;
    }

    const ratio = (height - filled) / range;
    const drift = Math.min(Math.max(past, 0), range) * (ratio - 1);

    return { ratio, range, drift, offset: Math.floor(drift / OFFSET_STEP) * OFFSET_STEP };
};

/**
 * Measures a list against the panel it scrolls in, for rendering only what's in or near view:
 * after every render, as the panel scrolls, and as either resizes. The measure is state, which
 * renders again only when `same` says it changed, and a scroll or resize that changes it renders
 * at once, so what scrolls in is there in the frame that shows it.
 *
 * `measure` is handed a `ScrollView` of the panel, whose `place` lays the list out for its whole
 * height, squeezing it into `MAX_LIST_HEIGHT` when it's taller, and says what of it the panel
 * shows, in px of the whole list. Items are rendered at their place in the whole list less
 * `offset`, and the list takes `laidHeight` of its height.
 *
 * `ref` goes on the list. `target` holds it and its panel, to be read outside rendering, and
 * `settled` says whether the latest render matched the measure, as it doesn't when the list has
 * just mounted. `show` scrolls to a part of the list, and `drift` says how far the items shown
 * are moved up it.
 */
export const useScrollMeasure = <T>(
    measure: (view: ScrollView) => T,
    initial: T,
    same: (a: T, b: T) => boolean,
) => {
    const [measured, setMeasured] = useState({ value: initial, offset: 0 });
    const target = useRef<ScrollTarget | null>(null);
    const detach = useRef<(() => void) | null>(null);
    const latest = useRef({ measure, same });
    const isSettled = useRef(true);
    // The squeeze the list was last laid out by, the offset its items were last rendered with, and
    // how far its `translate` moves it now.
    const placed = useRef(WHOLE);
    const rendered = useRef(0);
    const moved = useRef(0);

    // Measures the list, with the squeeze its `place` comes to.
    const read = useCallback((scrollTarget: ScrollTarget, measureList: (view: ScrollView) => T) => {
        let squeeze = WHOLE;
        // Whether the measure scrolled the panel to a place of its own.
        let scrolled = false;
        const { scroller } = scrollTarget;
        const view: ScrollView = {
            target: scrollTarget,
            top: () => shownTop(placed.current, scrolledPast(scrollTarget, moved.current)),
            place: (height) => {
                squeeze = squeezeOf(scrollTarget, height, moved.current);

                if (!scroller) {
                    return null;
                }

                // As the list's height changes, or the panel's, so does the squeeze's ratio, and the
                // panel keeps its place in the whole list, as it does over a list laid out whole,
                // rather than jumping to where the new ratio puts its `scrollTop`.
                if (!scrolled && squeeze.ratio !== placed.current.ratio) {
                    const past = scrolledPast(scrollTarget, moved.current);
                    const kept = pastFor(squeeze, shownTop(placed.current, past));

                    if (Math.abs(kept - past) >= 1) {
                        scroller.scrollTop += kept - past;
                        squeeze = squeezeOf(scrollTarget, height, moved.current);
                    }
                }

                const top = shownTop(squeeze, scrolledPast(scrollTarget, moved.current)) - OVERSCAN;

                return { top, bottom: top + scroller.clientHeight + 2 * OVERSCAN };
            },
            scrollTo: (top, height) => {
                if (scroller) {
                    const past = scrolledPast(scrollTarget, moved.current);

                    scrolled = true;
                    scroller.scrollTop += pastFor(squeezeOf(scrollTarget, height, moved.current), top) - past;
                }
            },
        };

        return { value: measureList(view), squeeze };
    }, []);

    // Moves the list by the part of the drift its items' places, as rendered, leave out.
    const apply = useCallback((list: HTMLElement, squeeze: Squeeze) => {
        const shift = squeeze.drift - rendered.current;

        placed.current = squeeze;

        if (shift !== moved.current) {
            moved.current = shift;
            list.style.translate = shift ? `0 ${-shift}px` : "";
        }
    }, []);

    const update = useCallback(() => {
        const scrollTarget = target.current;

        if (scrollTarget) {
            const { value, squeeze } = read(scrollTarget, latest.current.measure);

            flushSync(() =>
                setMeasured((previous) =>
                    latest.current.same(previous.value, value) && previous.offset === squeeze.offset
                        ? previous
                        : { value, offset: squeeze.offset },
                ),
            );
            apply(scrollTarget.list, squeeze);
        }
    }, [read, apply]);

    // A callback ref, so it follows the list when another element takes its place. It tears down
    // when called with null rather than returning a cleanup, which React 18 would ignore.
    const ref = useCallback(
        (list: HTMLElement | null) => {
            detach.current?.();
            detach.current = null;
            target.current = null;
            // A new list isn't moved yet. The squeeze stays, as the panel was scrolled by it.
            moved.current = 0;

            if (!list) {
                return;
            }

            const scroller = scrollParent(list);
            const observer = new ResizeObserver(update);

            observer.observe(list);

            if (scroller) {
                observer.observe(scroller);
                scroller.addEventListener("scroll", update, { passive: true });
            }

            target.current = { list, scroller };
            detach.current = () => {
                observer.disconnect();
                scroller?.removeEventListener("scroll", update);
            };
        },
        [update],
    );

    // Measured after every render too, since anything may have moved.
    useLayoutEffect(() => {
        latest.current = { measure, same };

        const scrollTarget = target.current;

        rendered.current = measured.offset;

        if (!scrollTarget) {
            isSettled.current = true;

            return;
        }

        const { value, squeeze } = read(scrollTarget, measure);

        apply(scrollTarget.list, squeeze);
        isSettled.current = same(measured.value, value) && measured.offset === squeeze.offset;

        if (!isSettled.current) {
            setMeasured({ value, offset: squeeze.offset });
        }
    });

    const settled = useCallback(() => isSettled.current, []);

    /**
     * Scrolls the panel by the least that shows the part of the list from `top` to `bottom`, in px
     * of the whole list. `element`, the item there when it's rendered, is scrolled to with the
     * browser's own `scrollIntoView` too, which keeps clear of a sticky header by its scroll
     * margins and scrolls the page around as needed. Through a squeezed list only the squeeze knows
     * where the panel has to go, so it's put there first, and the list moved by the drift there at
     * once, so the element is where the browser then finds it.
     */
    const show = useCallback((top: number, bottom: number, element?: HTMLElement | null) => {
        const scrollTarget = target.current;
        const scroller = scrollTarget?.scroller;
        const squeeze = placed.current;

        if (!scrollTarget || !scroller || (element && squeeze.ratio === 1)) {
            element?.scrollIntoView({ block: "nearest" });

            return;
        }

        const style = element ? getComputedStyle(element) : null;
        const before = parseFloat(style?.scrollMarginTop ?? "") || 0;
        const after = parseFloat(style?.scrollMarginBottom ?? "") || 0;
        const past = scrolledPast(scrollTarget, moved.current);
        const shown = shownTop(squeeze, past);
        const room = scroller.clientHeight;
        let to = shown;

        if (top - before < shown) {
            to = top - before;
        } else if (bottom + after > shown + room) {
            to = Math.min(bottom + after - room, top - before);
        }

        scroller.scrollTop += pastFor(squeeze, to) - past;

        if (element) {
            const now = scrolledPast(scrollTarget, moved.current);

            apply(scrollTarget.list, { ...squeeze, drift: shownTop(squeeze, now) - now });
            element.scrollIntoView({ block: "nearest" });
        }
    }, [apply]);

    /**
     * How far the items shown are moved up the list, in px: what keeps a point that stays put in
     * the list, such as where a marquee started, under the item it was on as a squeezed list
     * scrolls. 0 while the list is laid out whole.
     */
    const drift = useCallback(() => placed.current.drift, []);

    return { ref, target, measured: measured.value, offset: measured.offset, settled, show, drift };
};
