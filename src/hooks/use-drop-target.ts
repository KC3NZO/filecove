import { useCallback, useContext, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";

import { DragContext } from "../contexts/drag-context";
import { filesIn } from "../utils/files";

import type { DropTarget } from "../types";

interface DropTargetOptions {
    /**
     * The folders a drop where `event` happened could go into, the likeliest first; the first
     * that takes what is dragged gets it.
     */
    targetsAt: (event: DragEvent) => DropTarget[];
    /**
     * Called with the key of the first of them once a drag has rested on it for `HOLD_DELAY`,
     * whether it takes what is dragged or not, e.g. to expand it.
     */
    onHold?: (key: string) => void;
}

/** The target that letting go now would drop into, and whether files from outside are dragged. */
interface Over {
    key: string;
    files: boolean;
}

/** How long a drag rests on a target before `onHold`, in ms. */
export const HOLD_DELAY = 700;

// Ctrl copies rather than moves, as in Windows and GNOME, and so does Option (Alt), as in the macOS Finder.
const copies = (event: DragEvent) => event.ctrlKey || event.altKey;

/**
 * Whether files are dragged in from outside, such as from the desktop. Only that there are some can
 * be told before the drop, not what they are.
 */
export const carriesFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files");

/**
 * Waits for a drag to rest on one target for `HOLD_DELAY`, then calls `onHold` with its key.
 * `rest` starts the wait over whenever the drag moves on to another target, and stops it off them
 * all (null).
 */
const useHold = (onHold: ((key: string) => void) | undefined) => {
    const hold = useRef<{ key: string; timer?: number } | null>(null);
    const callback = useRef(onHold);

    useEffect(() => {
        callback.current = onHold;
    });

    useEffect(() => () => window.clearTimeout(hold.current?.timer), []);

    return useCallback((key: string | null) => {
        if (hold.current?.key === key) {
            return;
        }

        window.clearTimeout(hold.current?.timer);
        hold.current =
            key === null ? null : { key, timer: window.setTimeout(() => callback.current?.(key), HOLD_DELAY) };
    }, []);
};

/**
 * Takes drops on a whole view whose `targetsAt` finds the folder under the pointer, or on a single
 * row: of the entries dragged in the file manager, and of files dragged in from outside, which are
 * uploaded. `dropKey` is the key of the target that letting go now would drop into, and `handlers`
 * go on the element. Other drags from elsewhere, such as text, are left to the browser.
 */
export const useDropTarget = ({ targetsAt, onHold }: DropTargetOptions) => {
    const drag = useContext(DragContext);
    const [over, setOver] = useState<Over | null>(null);
    const rest = useHold(onHold);

    // However a drag of entries ended, nothing here stays marked. The file manager never hears how
    // a drag of files from outside ends, so it's unmarked when it leaves or drops.
    if (over && !over.files && !drag?.dragged) {
        setOver(null);
    }

    const handles = (event: DragEvent) => !!drag?.dragged || carriesFiles(event);

    // The drop that letting go now would make, if any. Dropped files are read only when it's run.
    const dropAmong = (event: DragEvent, targets: DropTarget[]) => {
        for (const target of targets) {
            if (drag?.dragged) {
                const run = drag.dropInto(target, copies(event));

                if (run) {
                    return { key: target.key, run };
                }
            } else {
                const upload = drag?.uploadInto(target, event.dataTransfer.items);

                if (upload) {
                    return { key: target.key, run: () => upload(filesIn(event.dataTransfer)) };
                }
            }
        }

        return null;
    };

    // Used for dragenter as well, since a target that doesn't cancel it may not be offered the drop.
    const onDragOver = (event: DragEvent) => {
        if (!handles(event)) {
            return;
        }

        const targets = targetsAt(event);
        const drop = dropAmong(event, targets);

        rest(targets[0]?.key ?? null);

        if (drop) {
            event.preventDefault();
            event.dataTransfer.dropEffect = drag?.dragged && !copies(event) ? "move" : "copy";
        }

        // Dragover repeats while the pointer rests, so the state is only replaced when it changes.
        const files = !drag?.dragged;

        setOver((prev) =>
            drop ? (prev?.key === drop.key && prev.files === files ? prev : { key: drop.key, files }) : null,
        );
    };

    // Going from one element to the next inside the target leaves the first; only leaving the target counts.
    const onDragLeave = (event: DragEvent) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
            rest(null);
            setOver(null);
        }
    };

    // A drag of entries is ended around every view, once the drop has bubbled up there.
    const onDrop = (event: DragEvent) => {
        if (!handles(event)) {
            return;
        }

        event.preventDefault();
        rest(null);
        setOver(null);
        dropAmong(event, targetsAt(event))?.run();
    };

    return { dropKey: over?.key ?? null, handlers: { onDragEnter: onDragOver, onDragOver, onDragLeave, onDrop } };
};

/**
 * A control that a drag resting on it for `HOLD_DELAY` acts on, without taking the drop, such as
 * the button that shows the sidebar: a drag of entries or of files from outside. It cancels the
 * drag events, saying "none", so the browser keeps sending them to it, which it wouldn't after a
 * `dragenter` left alone, and shows its no-drop cursor. `over` is set while one is over it, and
 * `handlers` go on the element.
 */
export const useDragHold = (onHold: () => void) => {
    const drag = useContext(DragContext);
    // Whether a drag is over it, and whether that's of files from outside.
    const [over, setOver] = useState<{ files: boolean } | null>(null);
    const rest = useHold(onHold);

    // As with a drop target, a drag of entries that ended anywhere leaves nothing marked.
    if (over && !over.files && !drag?.dragged) {
        setOver(null);
    }

    const onDragOver = (event: DragEvent) => {
        if (!drag?.dragged && !carriesFiles(event)) {
            return;
        }

        const files = !drag?.dragged;

        event.preventDefault();
        event.dataTransfer.dropEffect = "none";
        rest("");
        setOver((prev) => (prev?.files === files ? prev : { files }));
    };

    const onDragLeave = (event: DragEvent) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
            rest(null);
            setOver(null);
        }
    };

    const onDrop = () => {
        rest(null);
        setOver(null);
    };

    return { over: over !== null, handlers: { onDragEnter: onDragOver, onDragOver, onDragLeave, onDrop } };
};
