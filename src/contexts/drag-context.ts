import { createContext } from "react";
import type { DragEvent } from "react";

import type { DragSource, DropTarget, FileAdapter } from "../types";

export interface DragContextValue {
    /**
     * The dragged entries' adapter and ids, so every view listing them can fade them. Null while
     * no entries are dragged, as when the drag came from outside, such as files from the desktop.
     */
    dragged: { adapter: FileAdapter; ids: ReadonlySet<string> } | null;
    /**
     * Starts a drag from a mouse press with what `pick` picks up, once it has selected whatever
     * it needs, or cancels the drag when it picks up nothing. `pick` isn't asked for a touch or
     * pen press, which scrolls or, held, selects.
     */
    start: (event: DragEvent, pick: () => DragSource | null) => void;
    /**
     * What dropping the dragged entries into `target` does, copying them when `copy` is set and
     * moving them otherwise, to be called on drop, or undefined when they can't go there.
     */
    dropInto: (target: DropTarget, copy: boolean) => (() => void) | undefined;
}

/** The drag of entries under way, shared by the content and the sidebar tree. */
export const DragContext = createContext<DragContextValue | null>(null);
