import { useEffect, useRef } from "react";
import type { PointerEvent, RefObject } from "react";

import { isRtl } from "../utils/dom";

/** How far a finger moves before the swipe is taken as sideways, or as a scroll, in px. */
const SLOP = 10;
/** How much of the width a swipe has to cross to step, unless it's flicked. */
const DISTANCE = 0.25;
/** How fast a flick is going as the finger lifts, at least, in px per ms. */
const FLICK_SPEED = 0.4;
/** How far back the finger's speed is measured from as it lifts, in ms. */
const SPEED_WINDOW = 100;
/** How much of the finger's way the content follows towards a side with nothing more to show. */
const RESISTANCE = 0.3;
/** How far the file stepped to slides in from, in px. */
const ENTRANCE = 48;
const DURATION = 200;
// Decelerating, as something settling into place does.
const EASING = "cubic-bezier(0.2, 0, 0, 1)";

// Presses on controls and players keep doing what they do, as do parts of a previewer of the app's
// own that pan sideways themselves.
const IGNORED = "button, a, input, textarea, select, video, audio, [data-no-swipe]";

interface Sample {
    x: number;
    time: number;
}

interface Swipe {
    pointerId: number;
    startX: number;
    startY: number;
    width: number;
    rtl: boolean;
    /** Whether it has gone far enough sideways to be a swipe, rather than a tap or a scroll. */
    sideways: boolean;
    /**
     * How far what's under the finger pans with it before the swipe takes over, finger moving
     * left and right, in px, as a zoomed image does up to its edge; null when nothing pans.
     */
    room: Room | null;
    /** Where the finger has been lately, for its speed as it lifts. */
    samples: Sample[];
}

/** How far, in px, something panned by the finger can still go with the finger moving left and right. */
export interface Room {
    left: number;
    right: number;
}

interface SwipeOptions {
    /** The element that follows the finger, inside the one the handlers go on. */
    ref: RefObject<HTMLElement | null>;
    /** Whether there's anything `direction` way: 1 on, -1 back. */
    canStep: (direction: 1 | -1) => boolean;
    onStep: (direction: 1 | -1) => void;
    /**
     * How far what's under the finger pans with it, as a zoomed image does, before the swipe takes
     * over the rest of the finger's way; null while nothing pans.
     */
    room?: () => Room | null;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const recent = (samples: Sample[], now: number) => samples.filter(({ time }) => now - time <= SPEED_WINDOW);

/** The part of the finger's sideways way `dx` beyond what pans with it. */
const beyond = (dx: number, room: Room | null) => {
    if (!room) {
        return dx;
    }

    return dx > 0 ? Math.max(0, dx - room.right) : Math.min(0, dx + room.left);
};

/**
 * Swiping sideways on touch to step through what's shown one at a time. The content follows the
 * finger, and once the swipe has crossed a quarter of the width, or was flicked, it steps (towards
 * the end when swiping towards the start: left in LTR) and the content stepped to slides in.
 * Otherwise it springs back, as it does from a side with nothing more, which it follows only part
 * of the way. A scroll (`pointercancel`) cancels it, and so does a second finger, leaving the pinch
 * to what's under it. What pans with the finger, a zoomed image, does so up to its edge, and the
 * swipe takes the rest of the way from there, as a photo viewer's does.
 *
 * `slide` slides the content in the same way for a step made otherwise, by a button or a key.
 *
 * The handlers go on an element whose `touch-action` leaves sideways moves to the page (`pan-y`).
 */
export const useSwipe = (options: SwipeOptions) => {
    const latest = useRef(options);
    const swipe = useRef<Swipe | null>(null);
    const animation = useRef<Animation | null>(null);

    useEffect(() => {
        latest.current = options;
    });

    const directionOf = (current: Swipe, dx: number) => ((dx < 0) !== current.rtl ? 1 : -1);

    // The content back at rest, slid there from `from` when motion is welcome.
    const settle = (element: HTMLElement, from: Keyframe, to: Keyframe) => {
        element.style.transform = "";

        if (!reducedMotion()) {
            animation.current = element.animate([from, to], { duration: DURATION, easing: EASING });
        }
    };

    const springBack = () => {
        const element = latest.current.ref.current;

        if (element) {
            settle(element, { transform: element.style.transform || "none" }, { transform: "none" });
        }
    };

    // The content stepped to slides in from the side the swipe would have brought it from: the
    // end side going on, the start side going back.
    const slideIn = (element: HTMLElement, from: number) =>
        settle(element, { transform: `translateX(${from}px)`, opacity: 0 }, { transform: "none", opacity: 1 });

    /** Slides the content in for a step made by a button or a key: 1 on, -1 back. */
    const slide = (direction: 1 | -1) => {
        const element = latest.current.ref.current;

        if (!element) {
            return;
        }

        animation.current?.cancel();
        slideIn(element, direction * (isRtl(element) ? -1 : 1) * ENTRANCE);
    };

    // Runs in the capture phase, so the content is at rest before what's under the finger measures
    // where it went down.
    const onPointerDownCapture = (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType !== "touch") {
            return;
        }

        const { ref, canStep, room } = latest.current;
        const element = ref.current;

        animation.current?.cancel();
        animation.current = null;

        // A second finger makes it a pinch.
        if (!event.isPrimary) {
            if (element) {
                element.style.transform = "";
            }

            swipe.current = null;

            return;
        }

        const target = event.target instanceof Element ? event.target : null;

        if (!element || target?.closest(IGNORED) || (!canStep(1) && !canStep(-1))) {
            return;
        }

        swipe.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            width: element.clientWidth,
            rtl: isRtl(element),
            sideways: false,
            room: room?.() ?? null,
            samples: [],
        };
    };

    const onPointerMove = (event: PointerEvent<HTMLElement>) => {
        const current = swipe.current;
        const { ref, canStep } = latest.current;
        const element = ref.current;

        if (!current || !element || event.pointerId !== current.pointerId) {
            return;
        }

        const moved = event.clientX - current.startX;
        const dx = beyond(moved, current.room);
        const dy = event.clientY - current.startY;

        current.samples = [...recent(current.samples, event.timeStamp), { x: event.clientX, time: event.timeStamp }];

        if (!current.sideways) {
            // Going up or down first, it's a scroll, or a pan of what's under the finger, and left
            // alone. Sideways, what pans with the finger does so up to its edge, and the swipe
            // takes the rest of the way.
            if (Math.abs(dy) > SLOP && Math.abs(dy) >= Math.abs(moved)) {
                swipe.current = null;
                return;
            }

            if (Math.abs(dx) <= SLOP) {
                return;
            }

            current.sideways = true;
        }

        const offset = canStep(directionOf(current, dx)) ? dx : dx * RESISTANCE;

        element.style.transform = `translateX(${offset}px)`;
    };

    const onPointerUp = (event: PointerEvent<HTMLElement>) => {
        const current = swipe.current;
        const { ref, canStep, onStep } = latest.current;
        const element = ref.current;

        if (!current || event.pointerId !== current.pointerId) {
            return;
        }

        swipe.current = null;

        if (!current.sideways || !element) {
            return;
        }

        const dx = beyond(event.clientX - current.startX, current.room);
        const samples = [...recent(current.samples, event.timeStamp), { x: event.clientX, time: event.timeStamp }];
        const first = samples[0];
        const last = samples[samples.length - 1];
        // How fast the finger was going the way the swipe went, negative going back.
        const speed = last.time > first.time ? ((last.x - first.x) / (last.time - first.time)) * Math.sign(dx) : 0;
        const direction = directionOf(current, dx);
        const steps =
            canStep(direction) &&
            (speed > FLICK_SPEED || (Math.abs(dx) > current.width * DISTANCE && speed > -FLICK_SPEED));

        if (!steps) {
            springBack();
            return;
        }

        onStep(direction);
        slideIn(element, -Math.sign(dx) * ENTRANCE);
    };

    const onPointerCancel = (event: PointerEvent<HTMLElement>) => {
        if (swipe.current?.pointerId === event.pointerId) {
            const { sideways } = swipe.current;

            swipe.current = null;

            if (sideways) {
                springBack();
            }
        }
    };

    return { handlers: { onPointerDownCapture, onPointerMove, onPointerUp, onPointerCancel }, slide };
};
