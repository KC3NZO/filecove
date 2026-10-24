import { useCallback, useEffect, useRef } from "react";
import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";

import type { HeldPress } from "../types";

/** How long a press must be held to count as a long-press, in ms. */
const DELAY = 500;
/** How far the finger may drift before the press is a scroll instead, in px. */
const TOLERANCE = 10;

// Presses on controls stay taps.
const IGNORED = "button, a, input, textarea";

interface LongPressOptions {
    /**
     * Called when an item has been held long enough, with where the press is, which a touch drag
     * can go on from (`DragContext`'s `touch`).
     */
    onLongPress: (id: string, press: HeldPress) => void;
    /** The item a press is on; by default an entry, found by its `data-entry-id`. */
    itemAt?: (target: Element) => string | undefined;
}

const entryAt = (target: Element) => target.closest<HTMLElement>("[data-entry-id]")?.dataset.entryId;

/**
 * Long-press on the entries of a surface, or on the items `itemAt` finds, for touch and pen. It
 * runs on its own timer rather than on `contextmenu`, which iOS Safari never fires for a
 * long-press. A press that moves or turns into a scroll (the browser sends `pointercancel`) is
 * dropped, and the click that follows a long-press is swallowed so it doesn't act on the item a
 * second time.
 */
export const useLongPress = ({ onLongPress, itemAt = entryAt }: LongPressOptions) => {
    const endRef = useRef<(() => void) | null>(null);
    const suppressClick = useRef(false);
    const callbacks = useRef({ onLongPress, itemAt });

    useEffect(() => {
        callbacks.current = { onLongPress, itemAt };
    });

    // A press still held when the view goes away (another folder opened) is dropped with it.
    useEffect(() => () => endRef.current?.(), []);

    const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        // A new press means the last one's click, if any, has long fired; this also covers a
        // long-press that ended in `pointercancel` rather than `pointerup`.
        suppressClick.current = false;

        if (event.pointerType === "mouse" || !event.isPrimary || endRef.current) {
            return;
        }

        if (!(event.target instanceof Element) || event.target.closest(IGNORED)) {
            return;
        }

        const id = callbacks.current.itemAt(event.target);

        if (id === undefined) {
            return;
        }

        const { pointerId, clientX: startX, clientY: startY } = event;
        const press: HeldPress = { pointerId, clientX: startX, clientY: startY, element: event.target };

        const handleMove = (moveEvent: PointerEvent) => {
            if (moveEvent.pointerId !== pointerId) {
                return;
            }

            press.clientX = moveEvent.clientX;
            press.clientY = moveEvent.clientY;

            if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > TOLERANCE) {
                end();
            }
        };

        const fire = () => {
            end();
            navigator.vibrate?.(10);

            // Dropped on the next task after the finger lifts, by when the click has fired if it will.
            suppressClick.current = true;
            window.addEventListener(
                "pointerup",
                () => {
                    setTimeout(() => {
                        suppressClick.current = false;
                    });
                },
                { once: true },
            );

            callbacks.current.onLongPress(id, { ...press });
        };

        const timer = setTimeout(fire, DELAY);

        const end = () => {
            clearTimeout(timer);
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", end);
            window.removeEventListener("pointercancel", end);
            endRef.current = null;
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
        endRef.current = end;
    }, []);

    const onClickCapture = useCallback((event: MouseEvent) => {
        if (suppressClick.current) {
            suppressClick.current = false;
            event.stopPropagation();
        }
    }, []);

    return { onPointerDown, onClickCapture };
};
