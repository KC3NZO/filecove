import { useCallback, useEffect, useRef } from "react";
import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";

import { selectModifiers } from "../utils/selection";

import type { SelectModifiers } from "../types";

/** How far a press must move before it is a marquee rather than a click, in px. */
const THRESHOLD = 4;
/** Depth of the band along the scroll panel's top and bottom edges that scrolls it while dragging, in px. */
const EDGE = 40;
/** Fastest auto-scroll, in px per frame. */
const MAX_SPEED = 24;

// Presses here never start a marquee: controls, and the parts of an entry kept for dragging the entry itself.
const IGNORED = "button, a, input, textarea, [data-no-marquee]";

interface Box {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

interface Drag {
    pointerId: number;
    /** Where the press began, relative to the surface, so it stays put in the content while scrolling. */
    startX: number;
    startY: number;
    /** Latest pointer position in the viewport. */
    clientX: number;
    clientY: number;
    modifiers: SelectModifiers;
    scroller: HTMLElement | null;
    /** Entry boxes relative to the surface, measured once the marquee starts. */
    items: { id: string; box: Box }[];
    active: boolean;
    /** The covered ids as last reported, to report only changes. */
    hitsKey: string | null;
    frame: number;
}

interface MarqueeOptions {
    enabled: boolean;
    /** Called once a press has moved far enough to become a marquee. */
    onStart: () => void;
    /** Called whenever the entries under the marquee change, with their ids in display order. */
    onChange: (ids: string[], modifiers: SelectModifiers) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const scrollParent = (element: HTMLElement) => {
    for (let node = element.parentElement; node; node = node.parentElement) {
        const { overflowY } = getComputedStyle(node);

        if (overflowY === "auto" || overflowY === "scroll") {
            return node;
        }
    }

    return null;
};

/** Every element marked with `data-entry-id` inside the surface, in document (display) order. */
const measureEntries = (surface: HTMLElement) => {
    const origin = surface.getBoundingClientRect();

    return Array.from(surface.querySelectorAll<HTMLElement>("[data-entry-id]"), (element) => {
        const rect = element.getBoundingClientRect();

        return {
            id: element.dataset.entryId ?? "",
            box: {
                left: rect.left - origin.left,
                top: rect.top - origin.top,
                right: rect.right - origin.left,
                bottom: rect.bottom - origin.top,
            },
        };
    });
};

const overlaps = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * Rubber-band selection over a surface whose entries carry `data-entry-id`. The rectangle is
 * drawn by moving `marqueeRef`'s element directly, so dragging doesn't re-render the view;
 * only a change in the covered entries reaches `onChange`. Mouse only: on touch, a drag scrolls.
 */
export const useMarquee = ({ enabled, onStart, onChange }: MarqueeOptions) => {
    const surfaceRef = useRef<HTMLDivElement>(null);
    const marqueeRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<Drag | null>(null);
    const endRef = useRef<(() => void) | null>(null);
    const suppressClick = useRef(false);
    const callbacks = useRef({ onStart, onChange });

    useEffect(() => {
        callbacks.current = { onStart, onChange };
    });

    // A drag still running when the view goes away (another folder opened) is dropped with it.
    useEffect(() => () => endRef.current?.(), []);

    const onPointerDown = useCallback(
        (event: ReactPointerEvent<HTMLElement>) => {
            const surface = surfaceRef.current;

            if (!enabled || !surface || dragRef.current || event.button !== 0 || event.pointerType !== "mouse") {
                return;
            }

            if (event.target instanceof Element && event.target.closest(IGNORED)) {
                return;
            }

            const origin = surface.getBoundingClientRect();
            const drag: Drag = {
                pointerId: event.pointerId,
                startX: event.clientX - origin.left,
                startY: event.clientY - origin.top,
                clientX: event.clientX,
                clientY: event.clientY,
                modifiers: selectModifiers(event),
                scroller: scrollParent(surface),
                items: [],
                active: false,
                hitsKey: null,
                frame: 0,
            };

            const update = () => {
                const rect = surface.getBoundingClientRect();
                const x = clamp(drag.clientX - rect.left, 0, surface.clientWidth);
                const y = clamp(drag.clientY - rect.top, 0, surface.offsetHeight);

                if (!drag.active) {
                    if (Math.hypot(x - drag.startX, y - drag.startY) < THRESHOLD) {
                        return;
                    }

                    drag.active = true;
                    drag.items = measureEntries(surface);
                    callbacks.current.onStart();
                }

                const box = {
                    left: Math.min(drag.startX, x),
                    top: Math.min(drag.startY, y),
                    right: Math.max(drag.startX, x),
                    bottom: Math.max(drag.startY, y),
                };

                const marquee = marqueeRef.current;

                if (marquee) {
                    marquee.style.setProperty("--marquee-left", `${box.left}px`);
                    marquee.style.setProperty("--marquee-top", `${box.top}px`);
                    marquee.style.setProperty("--marquee-width", `${box.right - box.left}px`);
                    marquee.style.setProperty("--marquee-height", `${box.bottom - box.top}px`);
                    marquee.dataset.active = "true";
                }

                const hits = drag.items.filter((item) => overlaps(item.box, box)).map((item) => item.id);
                const hitsKey = hits.join("\u0000");

                if (hitsKey !== drag.hitsKey) {
                    drag.hitsKey = hitsKey;
                    callbacks.current.onChange(hits, drag.modifiers);
                }
            };

            // Runs every frame while the button is held: scrolls when the pointer nears or leaves the
            // panel's top or bottom edge, and redraws, which also follows wheel scrolling mid-drag.
            const tick = () => {
                if (drag.active && drag.scroller) {
                    const bounds = drag.scroller.getBoundingClientRect();
                    const above = bounds.top + EDGE - drag.clientY;
                    const below = drag.clientY - (bounds.bottom - EDGE);

                    if (above > 0) {
                        drag.scroller.scrollTop -= Math.min(MAX_SPEED, Math.ceil((above / EDGE) * MAX_SPEED));
                    } else if (below > 0) {
                        drag.scroller.scrollTop += Math.min(MAX_SPEED, Math.ceil((below / EDGE) * MAX_SPEED));
                    }
                }

                update();
                drag.frame = requestAnimationFrame(tick);
            };

            // Window listeners rather than pointer capture: capture would retarget the click that
            // ends a press without a drag, and rows rely on that click to be selected.
            const handleMove = (moveEvent: PointerEvent) => {
                if (moveEvent.pointerId === drag.pointerId) {
                    drag.clientX = moveEvent.clientX;
                    drag.clientY = moveEvent.clientY;
                }
            };

            const end = () => {
                cancelAnimationFrame(drag.frame);
                window.removeEventListener("pointermove", handleMove);
                window.removeEventListener("pointerup", end);
                window.removeEventListener("pointercancel", end);

                if (marqueeRef.current) {
                    delete marqueeRef.current.dataset.active;
                }

                // The click that follows a drag would clear the selection just made; swallow it. It
                // fires right after pointerup if at all, so the flag is dropped on the next task.
                if (drag.active) {
                    suppressClick.current = true;
                    setTimeout(() => {
                        suppressClick.current = false;
                    });
                }

                dragRef.current = null;
                endRef.current = null;
            };

            window.addEventListener("pointermove", handleMove);
            window.addEventListener("pointerup", end);
            window.addEventListener("pointercancel", end);
            dragRef.current = drag;
            endRef.current = end;
            drag.frame = requestAnimationFrame(tick);

            // Keeps the press from starting a text selection.
            event.preventDefault();
        },
        [enabled],
    );

    const onClickCapture = useCallback((event: MouseEvent) => {
        if (suppressClick.current) {
            suppressClick.current = false;
            event.stopPropagation();
        }
    }, []);

    return { surfaceRef, marqueeRef, onPointerDown, onClickCapture };
};
