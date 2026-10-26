import { createContext } from "react";
import type { DragEvent } from "react";

import type { AdapterIds, DragSource, Drop, DroppedFiles, DropKeys, DropTarget, HeldPress } from "../types";

export interface DragContextValue {
    /**
     * The dragged entries' ids, by the adapter serving them, so every view listing them can fade
     * them. Null while no entries are dragged, as when the drag came from outside, such as files
     * from the desktop.
     */
    dragged: AdapterIds | null;
    /**
     * Starts a drag from a mouse press with what `pick` picks up, once it has selected whatever
     * it needs, or cancels the drag when it picks up nothing. `pick` isn't asked for a touch or
     * pen press, which drags through `touch`.
     */
    start: (event: DragEvent, pick: () => DragSource | null) => void;
    /**
     * Goes on from a touch or pen press held long enough on an item (`useLongPress`): the finger
     * moving on drags what `pick` picks up, once it has selected whatever it needs, and lifting it
     * without moving calls `onRelease`, e.g. to open the item's menu. Without `pick`, the finger
     * moving on scrolls, as ever.
     */
    touch: (press: HeldPress, pick: (() => DragSource | null) | null, onRelease?: () => void) => void;
    /**
     * What dropping the dragged entries into `target` with `keys` held does, copying or moving
     * them, to be run on drop, or undefined when they can't go there.
     */
    dropInto: (target: DropTarget, keys: DropKeys) => Drop | undefined;
    /**
     * What dropping files from outside, such as from the desktop, into `target` does, to be called
     * on drop with what was dropped, or undefined when it doesn't take uploads, or can't take any of
     * the files dragged (`items`, whose types a drag tells before the drop).
     */
    uploadInto: (target: DropTarget, items: DataTransferItemList) => ((dropped: DroppedFiles) => void) | undefined;
}

/** The drag of entries under way, shared by the content and the sidebar tree. */
export const DragContext = createContext<DragContextValue | null>(null);
