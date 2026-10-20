import { useContext, useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";

import { DragContext } from "../contexts/drag-context";

import type { DropTarget } from "../types";

interface DropTargetOptions {
    /**
     * The folders a drop where `event` happened could go into, the likeliest first; the first
     * that takes the dragged entries gets them.
     */
    targetsAt: (event: DragEvent) => DropTarget[];
    /**
     * Called with the key of the first of them once a drag has rested on it for `HOLD_DELAY`,
     * whether it takes the entries or not, e.g. to expand it.
     */
    onHold?: (key: string) => void;
}

/** How long a drag rests on a target before `onHold`, in ms. */
const HOLD_DELAY = 700;

// Ctrl copies rather than moves, as in Windows and GNOME, and so does Option (Alt), as in the macOS Finder.
const copies = (event: DragEvent) => event.ctrlKey || event.altKey;

/**
 * Takes drops of the entries dragged in the file manager, on a whole view whose `targetsAt` finds
 * the folder under the pointer, or on a single row. `dropKey` is the key of the target that
 * letting go now would drop into, and `handlers` go on the element. Drags from elsewhere, such as
 * files from the desktop, are left to the browser.
 */
export const useDropTarget = ({ targetsAt, onHold }: DropTargetOptions) => {
    const drag = useContext(DragContext);
    const [dropKey, setDropKey] = useState<string | null>(null);
    const hold = useRef<{ key: string; timer?: number } | null>(null);

    // However the drag ended, nothing here stays marked.
    if (!drag?.dragged && dropKey !== null) {
        setDropKey(null);
    }

    useEffect(() => () => window.clearTimeout(hold.current?.timer), []);

    // Starts the wait over whenever the drag moves on to another target, and stops it off them all.
    const rest = (key: string | null) => {
        if (hold.current?.key === key) {
            return;
        }

        window.clearTimeout(hold.current?.timer);
        hold.current =
            key === null ? null : { key, timer: onHold && window.setTimeout(() => onHold(key), HOLD_DELAY) };
    };

    // The drop that letting go now would make, if any.
    const dropAmong = (targets: DropTarget[], copy: boolean) => {
        for (const target of targets) {
            const run = drag?.dropInto(target, copy);

            if (run) {
                return { key: target.key, run };
            }
        }

        return null;
    };

    // Used for dragenter as well, since a target that doesn't cancel it may not be offered the drop.
    const onDragOver = (event: DragEvent) => {
        if (!drag?.dragged) {
            return;
        }

        const targets = targetsAt(event);
        const copy = copies(event);
        const drop = dropAmong(targets, copy);

        rest(targets[0]?.key ?? null);

        if (drop) {
            event.preventDefault();
            event.dataTransfer.dropEffect = copy ? "copy" : "move";
        }

        setDropKey(drop?.key ?? null);
    };

    // Going from one element to the next inside the target leaves the first; only leaving the target counts.
    const onDragLeave = (event: DragEvent) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
            rest(null);
            setDropKey(null);
        }
    };

    // The drag itself is ended around every view, once the drop has bubbled up there.
    const onDrop = (event: DragEvent) => {
        if (!drag?.dragged) {
            return;
        }

        event.preventDefault();
        rest(null);
        dropAmong(targetsAt(event), copies(event))?.run();
    };

    return { dropKey, handlers: { onDragEnter: onDragOver, onDragOver, onDragLeave, onDrop } };
};
