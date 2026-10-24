import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent, RefObject } from "react";
import { flushSync } from "react-dom";

import { isRtl } from "../utils/dom";

import type { DragContextValue } from "../contexts/drag-context";
import type { DraggedEntries, DragSource, DropEffect, DropInto, FileAdapter, FileEntry } from "../types";

/**
 * What the drag image shows: the entry the drag started from, and how many entries go along. A
 * touch drag's follows the finger, showing what letting go would do.
 */
interface Preview {
    entry: FileEntry;
    count: number;
    touch: boolean;
}

/** A touch drag: armed by a long-press until the finger moves on, then under way. */
interface TouchDrag {
    pointerId: number;
    /** Where it was armed, and where the finger is now, in the viewport. */
    startX: number;
    startY: number;
    x: number;
    y: number;
    pick: (() => DragSource | null) | null;
    onRelease?: () => void;
    active: boolean;
    /** The element the finger was last over, which the drag events went to. */
    over: Element | null;
    effect: DropEffect;
    /** Ctrl or Option (Alt) is held on a keyboard, which copies, as with a mouse. */
    copying: boolean;
    frame: number;
    timer: number;
    stop: () => void;
}

/** How far the finger moves on from a long-press before it drags, in px. */
const TOUCH_THRESHOLD = 8;
/** How often the drag events are sent again while the finger rests, as browsers send dragover, in ms. */
const RESEND_INTERVAL = 150;
/** Depth of the band along a scrolling area's edges that scrolls it while dragging, in px. */
const EDGE = 40;
/** Fastest auto-scroll, in px per frame. */
const MAX_SPEED = 20;

const scrolls = (overflow: string) => overflow === "auto" || overflow === "scroll";

// The area that scrolls nearest to an element, either way, inside `root`.
const scrollerAt = (element: Element, root: Element) => {
    for (let node: Element | null = element; node && root.contains(node); node = node.parentElement) {
        const { overflowX, overflowY } = getComputedStyle(node);

        if (
            (scrolls(overflowY) && node.scrollHeight > node.clientHeight) ||
            (scrolls(overflowX) && node.scrollWidth > node.clientWidth)
        ) {
            return node;
        }
    }

    return null;
};

// How fast to scroll for a point `offset` px into a band of `EDGE` px, faster nearer the edge.
const speedAt = (offset: number) => (offset < EDGE ? Math.ceil(((EDGE - Math.max(offset, 0)) / EDGE) * MAX_SPEED) : 0);

/**
 * Drag and drop of entries, out of the content or the sidebar tree and into a folder in either.
 * The drag under way is kept here rather than in its `dataTransfer`, which can't be read until the
 * drop, so every view can tell where the entries may go and fade them wherever it lists them.
 * `context` goes to `DragContext`; `onPointerDownCapture` and `end` go on `rootRef`'s element,
 * around every view, `end` for both `drop` and `dragend`. `uploadInto` is handed on to the views as
 * it is, for files dragged in from outside.
 *
 * A mouse drag is the browser's own. Its image is taken from `previewRef`'s element, which the
 * caller renders while `preview` is set, for a single frame.
 *
 * A touch drag is the file manager's own, since a touch press scrolls, and browsers drag by touch
 * differently or not at all: a long-press arms it (`touch`), and the finger moving on starts it.
 * It sends the views the drag events a mouse drag would, to whatever is under the finger inside
 * the root, so they take it as they take one, holding to open folders included. The drag image
 * follows the finger while `preview` is set, `touch`, and areas scroll near their edges. It moves
 * the entries, or copies them where only that can be done, or while Ctrl or Option is held on a
 * keyboard (`effect`).
 */
export const useEntryDrag = (
    adapter: FileAdapter,
    dropInto: DropInto,
    uploadInto: DragContextValue["uploadInto"],
    rootRef: RefObject<HTMLElement | null>,
) => {
    const previewRef = useRef<HTMLDivElement>(null);
    // The pointer of the latest press, which a drag starts from.
    const pointerType = useRef("mouse");
    const [dragged, setDragged] = useState<DraggedEntries | null>(null);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [effect, setEffect] = useState<DropEffect>("move");
    // Stops listening for the end of a mouse drag whose source went away.
    const stopMouse = useRef<(() => void) | null>(null);
    const touchRef = useRef<TouchDrag | null>(null);

    // Ended on drop as well as dragend, since a move can take the dragged entries' rows away
    // before dragend arrives.
    const end = useCallback(() => {
        stopMouse.current?.();
        stopMouse.current = null;
        setDragged(null);
    }, []);

    // Mouse only: a touch press scrolls or, held, selects, and a touch drag is `touch`'s.
    const start = useCallback(
        (event: DragEvent, pick: () => DragSource | null) => {
            const source = pointerType.current === "mouse" ? pick() : null;

            if (!source) {
                event.preventDefault();

                return;
            }

            const { section, trail, entries, grabbed } = source;

            // Rendered right away, so the preview is there for the browser to take its picture of.
            flushSync(() => {
                setDragged({ section, adapter: section.adapter ?? adapter, trail, entries });
                setPreview({ entry: grabbed, count: entries.length, touch: false });
            });

            event.dataTransfer.effectAllowed = "copyMove";
            // Firefox starts no drag without data. Dropped on a text field, the names go in as text.
            event.dataTransfer.setData("text/plain", entries.map((entry) => entry.name).join("\n"));

            const preview = previewRef.current;

            // Held by its top corner on the start side, the right one right to left.
            if (preview) {
                event.dataTransfer.setDragImage(preview, isRtl(preview) ? preview.offsetWidth : 0, 0);
            }

            // The picture has been taken by the next frame, which is painted without the preview.
            requestAnimationFrame(() => flushSync(() => setPreview(null)));

            // The element dragged from may go while the drag goes on, as when a drag resting on a
            // folder opens it, and its dragend then never reaches the root. It's still sent to the
            // element itself, in some browsers, and in the others the drag is over once the mouse
            // moves or presses again, which it doesn't while dragging.
            const element = event.target instanceof Element ? event.target : null;
            const resumed = () => {
                if (element && !element.isConnected) {
                    end();
                }
            };

            stopMouse.current?.();
            element?.addEventListener("dragend", end);
            window.addEventListener("pointermove", resumed, true);
            window.addEventListener("pointerdown", resumed, true);
            stopMouse.current = () => {
                element?.removeEventListener("dragend", end);
                window.removeEventListener("pointermove", resumed, true);
                window.removeEventListener("pointerdown", resumed, true);
            };
        },
        [adapter, end],
    );

    // Sends a drag event to an element, as the browser would to what's under the pointer, with
    // Ctrl held for a copy, which the views read as a mouse drag's. Returns whether it would drop
    // there: cancelled, and not saying "none", as a control that only acts on a drag resting on it
    // does (`useDragHold`).
    const send = (type: string, target: Element, touch: TouchDrag, copy = false, related: Element | null = null) => {
        const dataTransfer = new DataTransfer();

        dataTransfer.effectAllowed = "copyMove";

        const event = new globalThis.DragEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX: touch.x,
            clientY: touch.y,
            ctrlKey: copy,
            relatedTarget: related,
            dataTransfer,
        });

        target.dispatchEvent(event);

        return event.defaultPrevented && dataTransfer.dropEffect !== "none";
    };

    // What's under the finger, inside the root only, so nothing outside the file manager is sent
    // drag events it never asked for.
    const elementAt = (x: number, y: number) => {
        const root = rootRef.current;
        const element = document.elementFromPoint(x, y);

        return root && element && root.contains(element) ? element : null;
    };

    // Tells the element under the finger, and the one it left, as dragenter, dragleave and
    // dragover would, and learns what letting go would do there: a move, or else a copy, or with
    // Ctrl or Option held on a keyboard, a copy only, as a mouse drag would.
    const sendOver = (touch: TouchDrag) => {
        const element = elementAt(touch.x, touch.y);

        if (element !== touch.over) {
            if (touch.over) {
                send("dragleave", touch.over, touch, false, element);
            }

            if (element) {
                send("dragenter", element, touch, false, touch.over);
            }

            touch.over = element;
        }

        let next: DropEffect = "none";

        if (element && !touch.copying && send("dragover", element, touch)) {
            next = "move";
        } else if (element && send("dragover", element, touch, true)) {
            next = "copy";
        }

        if (next !== touch.effect) {
            touch.effect = next;
            setEffect(next);
        }
    };

    // Keeps the drag image by the finger, on its end side and above it, so the finger doesn't hide
    // it. It's hidden until it's first placed, so it never shows in the corner.
    const place = (touch: TouchDrag) => {
        const element = previewRef.current;

        if (!element) {
            return;
        }

        const left = isRtl(element) ? touch.x - element.offsetWidth - 4 : touch.x + 4;

        element.style.transform = `translate(${left}px, ${touch.y - element.offsetHeight + 8}px)`;
        element.style.visibility = "visible";
    };

    // Each frame, keeps the drag image by the finger, and scrolls the area under the finger, the
    // ways it scrolls, while the finger is near its edges, then sends the drag events again, since
    // what's under the finger has moved.
    const scroll = (touch: TouchDrag) => {
        const root = rootRef.current;
        const element = touch.over;
        const scroller = root && element ? scrollerAt(element, root) : null;

        place(touch);

        if (scroller) {
            const rect = scroller.getBoundingClientRect();
            const vertical = scroller.scrollHeight > scroller.clientHeight;
            const horizontal = scroller.scrollWidth > scroller.clientWidth;
            const dy = vertical ? speedAt(rect.bottom - touch.y) - speedAt(touch.y - rect.top) : 0;
            const dx = horizontal ? speedAt(rect.right - touch.x) - speedAt(touch.x - rect.left) : 0;

            if (dx || dy) {
                scroller.scrollBy(dx, dy);
                sendOver(touch);
            }
        }

        touch.frame = requestAnimationFrame(() => scroll(touch));
    };

    const begin = (touch: TouchDrag) => {
        const source = touch.pick?.();

        if (!source) {
            touch.stop();

            return;
        }

        const { section, trail, entries, grabbed } = source;

        // The views only take the drag once they've rendered with it, so the drag events start with
        // the next move, frame or resend.
        touch.active = true;
        setDragged({ section, adapter: section.adapter ?? adapter, trail, entries });
        setPreview({ entry: grabbed, count: entries.length, touch: true });
        setEffect("move");
        touch.effect = "move";
        touch.frame = requestAnimationFrame(() => scroll(touch));
        touch.timer = window.setInterval(() => sendOver(touch), RESEND_INTERVAL);
    };

    // Lets go: drops where the finger is, when something takes the entries there, or else leaves.
    const release = (touch: TouchDrag) => {
        if (!touch.active) {
            touch.stop();
            touch.onRelease?.();

            return;
        }

        sendOver(touch);

        if (touch.over && touch.effect !== "none") {
            send("drop", touch.over, touch, touch.effect === "copy");
        } else if (touch.over) {
            send("dragleave", touch.over, touch);
        }

        touch.stop();
    };

    const cancel = (touch: TouchDrag) => {
        if (touch.active && touch.over) {
            send("dragleave", touch.over, touch);
        }

        touch.stop();
    };

    // Called from a long-press, which has stopped listening by then, so the press is this one's.
    const touch = useCallback<DragContextValue["touch"]>(
        (press, pick, onRelease) => {
            if (touchRef.current) {
                return;
            }

            const drag: TouchDrag = {
                pointerId: press.pointerId,
                startX: press.clientX,
                startY: press.clientY,
                x: press.clientX,
                y: press.clientY,
                pick,
                onRelease,
                active: false,
                over: null,
                effect: "move",
                copying: false,
                frame: 0,
                timer: 0,
                stop: () => {},
            };

            const handleMove = (event: globalThis.PointerEvent) => {
                if (event.pointerId !== drag.pointerId) {
                    return;
                }

                drag.x = event.clientX;
                drag.y = event.clientY;

                if (!drag.active) {
                    if (drag.pick && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > TOUCH_THRESHOLD) {
                        begin(drag);
                    }

                    return;
                }

                sendOver(drag);
            };

            const handleUp = (event: globalThis.PointerEvent) => {
                if (event.pointerId === drag.pointerId) {
                    release(drag);
                }
            };

            const handleCancel = (event: globalThis.PointerEvent) => {
                if (event.pointerId === drag.pointerId) {
                    cancel(drag);
                }
            };

            // A keyboard on a tablet copies with Ctrl or Option held, and calls the drag off with
            // Escape, as with a mouse, and nothing else takes that Escape, such as leaving selection
            // mode.
            const handleKey = (event: KeyboardEvent) => {
                const copying = event.ctrlKey || event.altKey;

                if (copying !== drag.copying) {
                    drag.copying = copying;

                    if (drag.active) {
                        sendOver(drag);
                    }
                }

                if (event.type === "keydown" && event.key === "Escape" && drag.active) {
                    event.preventDefault();
                    event.stopPropagation();
                    cancel(drag);
                }
            };

            drag.stop = () => {
                window.removeEventListener("pointermove", handleMove);
                window.removeEventListener("pointerup", handleUp);
                window.removeEventListener("pointercancel", handleCancel);
                window.removeEventListener("keydown", handleKey, true);
                window.removeEventListener("keyup", handleKey, true);
                cancelAnimationFrame(drag.frame);
                window.clearInterval(drag.timer);
                touchRef.current = null;

                if (drag.active) {
                    drag.active = false;
                    setDragged(null);
                    setPreview(null);
                }
            };

            window.addEventListener("pointermove", handleMove);
            window.addEventListener("pointerup", handleUp);
            window.addEventListener("pointercancel", handleCancel);
            window.addEventListener("keydown", handleKey, true);
            window.addEventListener("keyup", handleKey, true);
            touchRef.current = drag;
        },
        // The helpers it calls read only refs, setters and `adapter`.
        [adapter],
    );

    // The page mustn't scroll under a finger that drags, nor under one held to drag, which would
    // take the press away (`pointercancel`). That can only be refused from a touchmove listener
    // that isn't passive, there when the touch began, so it's on the root for good, and lets every
    // other touch scroll.
    useEffect(() => {
        const root = rootRef.current;

        if (!root) {
            return;
        }

        const handleTouchMove = (event: TouchEvent) => {
            const drag = touchRef.current;

            if (drag && (drag.active || drag.pick) && event.cancelable) {
                event.preventDefault();
            }
        };

        root.addEventListener("touchmove", handleTouchMove, { passive: false });

        return () => {
            root.removeEventListener("touchmove", handleTouchMove);
            touchRef.current?.stop();
            stopMouse.current?.();
        };
    }, [rootRef]);

    const marked = useMemo(
        () => dragged && { adapter: dragged.adapter, ids: new Set(dragged.entries.map((entry) => entry.id)) },
        [dragged],
    );

    const context = useMemo<DragContextValue>(
        () => ({
            dragged: marked,
            start,
            touch,
            dropInto: (target, copy) =>
                dragged ? dropInto(dragged, copy, target.section, target.trail) : undefined,
            uploadInto,
        }),
        [marked, dragged, start, touch, dropInto, uploadInto],
    );

    // A touch or pen press keeps the browser from dragging what it's on by itself, as some do on a
    // long-press, so the file manager's own touch drag is the only one (`data-touch-press`).
    const onPointerDownCapture = (event: PointerEvent<HTMLElement>) => {
        const root = event.currentTarget;

        pointerType.current = event.pointerType;

        if (event.pointerType === "mouse") {
            return;
        }

        const lift = () => {
            delete root.dataset.touchPress;
            window.removeEventListener("pointerup", lift);
            window.removeEventListener("pointercancel", lift);
        };

        root.dataset.touchPress = "";
        window.addEventListener("pointerup", lift);
        window.addEventListener("pointercancel", lift);
    };

    return { context, previewRef, preview, effect, onPointerDownCapture, end };
};
