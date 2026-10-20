import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { flushSync } from "react-dom";

import type { FileEntry } from "../types";

interface EntryDragOptions {
    /**
     * The entries a drag from entry `id` carries, once whatever it needs is selected, or null to
     * keep the drag from starting.
     */
    onStart: (id: string) => FileEntry[] | null;
    /**
     * What dropping `entries` onto entry `id` does, copying them when `copy` is set and moving them
     * otherwise, or undefined when they can't go there, e.g. onto a file or into one of themselves.
     */
    dropOnto: (entries: FileEntry[], id: string, copy: boolean) => (() => void) | undefined;
}

interface Dragged {
    entries: FileEntry[];
    ids: ReadonlySet<string>;
}

/** What the drag image shows: the entry the drag started from, and how many entries go along. */
interface Preview {
    entry: FileEntry;
    count: number;
}

const NONE: ReadonlySet<string> = new Set();

/** The entry an event happened on, by its `data-entry-id`. */
const entryIdAt = (target: EventTarget) =>
    target instanceof Element ? target.closest<HTMLElement>("[data-entry-id]")?.dataset.entryId : undefined;

// Ctrl copies rather than moves, as in Windows and GNOME, and so does Option (Alt), as in the macOS Finder.
const copies = (event: DragEvent) => event.ctrlKey || event.altKey;

/**
 * Native drag and drop of a surface's entries, which carry `data-entry-id`, onto its folders. The
 * handlers go on the surface and find the entry from the event, so drags from elsewhere, such as
 * files from the desktop, are left to the browser. The drag image is taken from `previewRef`'s
 * element, which the caller renders while `preview` is set, for a single frame.
 */
export const useEntryDrag = ({ onStart, dropOnto }: EntryDragOptions) => {
    const previewRef = useRef<HTMLDivElement>(null);
    const [dragged, setDragged] = useState<Dragged | null>(null);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [dropId, setDropId] = useState<string | null>(null);

    // The drop that letting go here would make, if any.
    const dropAt = (event: DragEvent) => {
        const id = entryIdAt(event.target);
        const run = dragged && id !== undefined ? dropOnto(dragged.entries, id, copies(event)) : undefined;

        return run && id !== undefined ? { id, run } : null;
    };

    const end = () => {
        setDragged(null);
        setDropId(null);
    };

    const onDragStart = (event: DragEvent) => {
        const id = entryIdAt(event.target);
        const entries = id === undefined ? null : onStart(id);
        const entry = entries?.find((item) => item.id === id);

        if (!entries || !entry) {
            event.preventDefault();

            return;
        }

        // Rendered right away, so the preview is there for the browser to take its picture of.
        flushSync(() => {
            setDragged({ entries, ids: new Set(entries.map((item) => item.id)) });
            setPreview({ entry, count: entries.length });
        });

        event.dataTransfer.effectAllowed = "copyMove";
        // Firefox starts no drag without data. Dropped on a text field, the names go in as text.
        event.dataTransfer.setData("text/plain", entries.map((item) => item.name).join("\n"));

        if (previewRef.current) {
            event.dataTransfer.setDragImage(previewRef.current, 0, 0);
        }

        // The picture has been taken by the next frame, which is painted without the preview.
        requestAnimationFrame(() => flushSync(() => setPreview(null)));
    };

    // Used for dragenter as well, since a target that doesn't cancel it may not be offered the drop.
    const onDragOver = (event: DragEvent) => {
        if (!dragged) {
            return;
        }

        const drop = dropAt(event);

        if (drop) {
            event.preventDefault();
            event.dataTransfer.dropEffect = copies(event) ? "copy" : "move";
        }

        setDropId(drop?.id ?? null);
    };

    // Going from one element to the next inside the surface leaves the first; only leaving the surface counts.
    const onDragLeave = (event: DragEvent) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
            setDropId(null);
        }
    };

    const onDrop = (event: DragEvent) => {
        if (!dragged) {
            return;
        }

        event.preventDefault();
        dropAt(event)?.run();
        // Ended here too, since a move can take the dragged entries' rows away before dragend arrives.
        end();
    };

    return {
        previewRef,
        preview,
        draggedIds: dragged?.ids ?? NONE,
        dropId,
        onDragStart,
        onDragOver,
        onDragLeave,
        onDrop,
        onDragEnd: end,
    };
};
