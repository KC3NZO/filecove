import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import type { ZoomStep } from "../types";

/** How far the wheel turns, or a touchpad's pinch goes, to zoom a step, in px: a mouse's notch is about 100. */
const WHEEL_STEP = 50;
/** A wheel's line, for browsers that count its turns in lines, in px. */
const LINE_HEIGHT = 40;
/** How long a pause in the wheel starts its count afresh, in ms. */
const WHEEL_PAUSE = 250;
/** How far Safari's pinch spreads or closes the fingers to zoom a step, as a ratio. */
const PINCH_STEP = 1.4;

/**
 * A pinch on a Mac's touchpad in Safari, which sends it as gesture events rather than as Ctrl+wheel.
 * `scale` is how far the fingers have spread since it began. Not in TypeScript's DOM types.
 */
type GestureLike = Event & { scale: number };

/**
 * Zooms by steps with Ctrl+wheel over `ref`'s element, which is also how Chrome and Firefox send a
 * touchpad's pinch, and with Safari's touchpad pinch, which it sends as gesture events, in place of
 * the browser zooming the page. A mouse's notch is a step, and a pinch steps as it goes on. The
 * listeners aren't passive, so the page doesn't zoom instead. On a touch screen, where Safari sends
 * gesture events alongside the touches, a pinch is left to the browser.
 */
export const useWheelZoom = (ref: RefObject<HTMLElement | null>, onZoom: (step: ZoomStep) => void) => {
    const latest = useRef(onZoom);

    useEffect(() => {
        latest.current = onZoom;
    });

    useEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        // How far the wheel has turned since the last step, in px, and when it last did.
        let travelled = 0;
        let lastTurn = -Infinity;
        // The scale Safari's pinch under way last stepped at; null while there's none.
        let pinchedAt: number | null = null;
        const touches = new Set<number>();

        const handleWheel = (event: WheelEvent) => {
            if (!event.ctrlKey) {
                return;
            }

            event.preventDefault();

            // Safari's pinch comes as gesture events, which zoom already.
            if (pinchedAt !== null) {
                return;
            }

            const unit =
                event.deltaMode === WheelEvent.DOM_DELTA_LINE
                    ? LINE_HEIGHT
                    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                      ? element.clientHeight
                      : 1;
            const delta = event.deltaY * unit;

            // A pause, or turning the other way, counts afresh.
            if (event.timeStamp - lastTurn > WHEEL_PAUSE || Math.sign(delta) !== Math.sign(travelled)) {
                travelled = 0;
            }

            lastTurn = event.timeStamp;
            travelled += delta;

            // Turning it away from the user, or spreading the fingers, zooms in.
            if (Math.abs(travelled) >= WHEEL_STEP) {
                latest.current(travelled < 0 ? 1 : -1);
                travelled = 0;
            }
        };

        const handleGestureStart = (event: Event) => {
            if (touches.size === 0) {
                event.preventDefault();
                pinchedAt = 1;
            }
        };

        const handleGestureChange = (event: Event) => {
            if (pinchedAt === null) {
                return;
            }

            const { scale } = event as GestureLike;

            event.preventDefault();

            if (scale >= pinchedAt * PINCH_STEP) {
                pinchedAt = scale;
                latest.current(1);
            } else if (scale <= pinchedAt / PINCH_STEP) {
                pinchedAt = scale;
                latest.current(-1);
            }
        };

        const handleGestureEnd = (event: Event) => {
            if (pinchedAt !== null) {
                event.preventDefault();
                pinchedAt = null;
            }
        };

        const handlePointerDown = (event: PointerEvent) => {
            if (event.pointerType === "touch") {
                touches.add(event.pointerId);
            }
        };

        // Heard on the window, so a finger lifted outside, or a touch the browser took over, still counts.
        const handlePointerUp = (event: PointerEvent) => touches.delete(event.pointerId);

        element.addEventListener("wheel", handleWheel, { passive: false });
        element.addEventListener("gesturestart", handleGestureStart, { passive: false });
        element.addEventListener("gesturechange", handleGestureChange, { passive: false });
        element.addEventListener("gestureend", handleGestureEnd, { passive: false });
        element.addEventListener("pointerdown", handlePointerDown, { capture: true });
        window.addEventListener("pointerup", handlePointerUp, { capture: true });
        window.addEventListener("pointercancel", handlePointerUp, { capture: true });

        return () => {
            element.removeEventListener("wheel", handleWheel);
            element.removeEventListener("gesturestart", handleGestureStart);
            element.removeEventListener("gesturechange", handleGestureChange);
            element.removeEventListener("gestureend", handleGestureEnd);
            element.removeEventListener("pointerdown", handlePointerDown, { capture: true });
            window.removeEventListener("pointerup", handlePointerUp, { capture: true });
            window.removeEventListener("pointercancel", handlePointerUp, { capture: true });
        };
    }, [ref]);
};
