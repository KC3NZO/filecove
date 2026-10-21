import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { scrollParent } from "../utils/dom";

import type { ScrollTarget } from "../types";

/** How far past the scroll panel's top and bottom edges items are rendered, ready to scroll in, in px. */
const OVERSCAN = 400;

/**
 * The part of a list its panel shows, widened by the overscan, in px from the list's top, or null
 * when nothing around the list scrolls, so all of it shows.
 */
export const shownSpan = ({ list, scroller }: ScrollTarget) => {
    if (!scroller) {
        return null;
    }

    const top = scroller.getBoundingClientRect().top + scroller.clientTop - list.getBoundingClientRect().top - OVERSCAN;

    return { top, bottom: top + scroller.clientHeight + 2 * OVERSCAN };
};

/**
 * Measures a list against the panel it scrolls in, for rendering only what's in or near view:
 * after every render, as the panel scrolls, and as either resizes. The measure is state, which
 * renders again only when `same` says it changed, and a scroll or resize that changes it renders
 * at once, so what scrolls in is there in the frame that shows it.
 *
 * `ref` goes on the list. `target` holds it and its panel, to be read outside rendering, and
 * `settled` says whether the latest render matched the measure, as it doesn't when the list has
 * just mounted.
 */
export const useScrollMeasure = <T>(
    measure: (target: ScrollTarget) => T,
    initial: T,
    same: (a: T, b: T) => boolean,
) => {
    const [measured, setMeasured] = useState(initial);
    const target = useRef<ScrollTarget | null>(null);
    const detach = useRef<(() => void) | null>(null);
    const latest = useRef({ measure, same });
    const isSettled = useRef(true);

    const update = useCallback(() => {
        if (target.current) {
            const next = latest.current.measure(target.current);

            flushSync(() => setMeasured((previous) => (latest.current.same(previous, next) ? previous : next)));
        }
    }, []);

    // A callback ref, so it follows the list when another element takes its place. It tears down
    // when called with null rather than returning a cleanup, which React 18 would ignore.
    const ref = useCallback(
        (list: HTMLElement | null) => {
            detach.current?.();
            detach.current = null;
            target.current = null;

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
        const next = target.current ? measure(target.current) : measured;

        latest.current = { measure, same };
        isSettled.current = same(measured, next);

        if (!isSettled.current) {
            setMeasured(next);
        }
    });

    const settled = useCallback(() => isSettled.current, []);

    return { ref, target, measured, settled };
};
