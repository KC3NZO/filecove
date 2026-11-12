import { useCallback, useContext, useEffect, useSyncExternalStore } from "react";

import { DataContext } from "../contexts/data-context";
import { folderKey } from "../store/folder-store";

import type { Section } from "../types";

/** The folder store and the adapter of the file manager or the media manager, from `DataContext`. */
export const useData = () => {
    const value = useContext(DataContext);

    if (!value) {
        throw new Error("File manager data is only available inside <FileManager> or <MediaManager>.");
    }

    return value;
};

/**
 * A folder's listing. It is requested the first time `enabled` is true, then served from the store,
 * which keeps it while it's shown. Opened (`open`), as the content and the picker open folders, a
 * listing saved from before shows at once and is listed again in the background once it's
 * `relistAfter` old. One dropped while it's shown, as after a change that may have made its id
 * another folder's, is listed afresh.
 */
export const useFolder = (section: Section, folderId: string, enabled: boolean, open = false) => {
    const { store, adapter: defaultAdapter, relistAfter } = useData();
    const adapter = section.adapter ?? defaultAdapter;
    const key = folderKey(section.id, folderId);

    const state = useSyncExternalStore(store.subscribe, () => store.get(key), () => store.get(key));
    const dropped = state === undefined;

    useEffect(() => (enabled ? store.show(key) : undefined), [enabled, store, key]);

    // `dropped` lists it again once the store drops it.
    useEffect(() => {
        if (enabled && open) {
            store.open(key, adapter, folderId, relistAfter);
        } else if (enabled) {
            store.load(key, adapter, folderId);
        }
    }, [enabled, open, store, key, adapter, folderId, relistAfter, dropped]);

    const reload = useCallback(() => store.load(key, adapter, folderId, true), [store, key, adapter, folderId]);

    return { state, reload };
};
