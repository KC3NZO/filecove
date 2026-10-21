import { useCallback, useContext, useEffect, useSyncExternalStore } from "react";

import { DataContext } from "../contexts/data-context";
import { devicePixels } from "../utils/dom";

import type { FileAdapter, FileEntry, ViewMode } from "../types";

// Unsubscribes from nothing, for an entry with no thumbnail to wait for.
const unsubscribed = () => undefined;

/**
 * The URL of a file's thumbnail for a view, `rem` square, once the adapter has given one and it
 * has loaded; null until then, and for folders, files with none, or an adapter without
 * `thumbnail`. It's asked for while the component is mounted, so only the entries rendered, those
 * in or near view, ask for theirs.
 */
export const useThumbnail = (
    entry: FileEntry,
    adapter: FileAdapter | undefined,
    view: ViewMode | undefined,
    rem: number,
) => {
    const thumbnails = useContext(DataContext)?.thumbnails;
    const source = thumbnails && adapter?.thumbnail && view && entry.kind === "file" ? adapter : undefined;
    const { id } = entry;

    const subscribe = useCallback(
        (listener: () => void) =>
            thumbnails && source && view ? thumbnails.subscribe(source, view, id, listener) : unsubscribed,
        [thumbnails, source, view, id],
    );
    const url = useSyncExternalStore(subscribe, () =>
        thumbnails && source && view ? thumbnails.get(source, view, id) : null,
    );

    useEffect(() => {
        if (!thumbnails || !source || !view) {
            return;
        }

        return thumbnails.want(source, entry, view, devicePixels(rem));
    }, [thumbnails, source, entry, view, rem]);

    return url;
};
