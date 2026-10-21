import { useCallback, useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent } from "react";
import { flushSync } from "react-dom";

import type { DragContextValue } from "../contexts/drag-context";
import type { DraggedEntries, DragSource, DropInto, FileAdapter, FileEntry } from "../types";

/** What the drag image shows: the entry the drag started from, and how many entries go along. */
interface Preview {
    entry: FileEntry;
    count: number;
}

/**
 * Native drag and drop of entries, out of the content or the sidebar tree and into a folder in
 * either. The drag under way is kept here rather than in its `dataTransfer`, which can't be read
 * until the drop, so every view can tell where the entries may go and fade them wherever it lists
 * them. `context` goes to `DragContext`; `onPointerDownCapture` and `end` go on an element around
 * every view, `end` for both `drop` and `dragend`. The drag image is taken from `previewRef`'s
 * element, which the caller renders while `preview` is set, for a single frame. `uploadInto` is
 * handed on to the views as it is, for files dragged in from outside.
 */
export const useEntryDrag = (
    adapter: FileAdapter,
    dropInto: DropInto,
    uploadInto: DragContextValue["uploadInto"],
) => {
    const previewRef = useRef<HTMLDivElement>(null);
    // The pointer of the latest press, which a drag starts from.
    const pointerType = useRef("mouse");
    const [dragged, setDragged] = useState<DraggedEntries | null>(null);
    const [preview, setPreview] = useState<Preview | null>(null);

    // Mouse only: on touch, a press scrolls or, held, selects.
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
                setPreview({ entry: grabbed, count: entries.length });
            });

            event.dataTransfer.effectAllowed = "copyMove";
            // Firefox starts no drag without data. Dropped on a text field, the names go in as text.
            event.dataTransfer.setData("text/plain", entries.map((entry) => entry.name).join("\n"));

            if (previewRef.current) {
                event.dataTransfer.setDragImage(previewRef.current, 0, 0);
            }

            // The picture has been taken by the next frame, which is painted without the preview.
            requestAnimationFrame(() => flushSync(() => setPreview(null)));
        },
        [adapter],
    );

    const marked = useMemo(
        () => dragged && { adapter: dragged.adapter, ids: new Set(dragged.entries.map((entry) => entry.id)) },
        [dragged],
    );

    const context = useMemo<DragContextValue>(
        () => ({
            dragged: marked,
            start,
            dropInto: (target, copy) =>
                dragged ? dropInto(dragged, copy, target.section, target.trail) : undefined,
            uploadInto,
        }),
        [marked, dragged, start, dropInto, uploadInto],
    );

    const onPointerDownCapture = (event: PointerEvent) => {
        pointerType.current = event.pointerType;
    };

    // Ended on drop as well as dragend, since a move can take the dragged entries' rows away
    // before dragend arrives.
    const end = useCallback(() => setDragged(null), []);

    return { context, previewRef, preview, onPointerDownCapture, end };
};
