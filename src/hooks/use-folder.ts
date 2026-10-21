import { useCallback, useContext, useEffect, useSyncExternalStore } from "react";

import { DataContext } from "../contexts/data-context";
import { folderKey } from "../store/folder-store";

import type { Section } from "../types";

/** The folder store and the file manager's adapter, from `DataContext`. */
export const useData = () => {
    const value = useContext(DataContext);

    if (!value) {
        throw new Error("File manager data is only available inside <FileManager>.");
    }

    return value;
};

/** A folder's listing. It is requested the first time `enabled` is true, then served from the store. */
export const useFolder = (section: Section, folderId: string, enabled: boolean) => {
    const { store, adapter: defaultAdapter } = useData();
    const adapter = section.adapter ?? defaultAdapter;
    const key = folderKey(section.id, folderId);

    const state = useSyncExternalStore(store.subscribe, () => store.get(key));

    useEffect(() => {
        if (enabled) {
            store.load(key, adapter, folderId);
        }
    }, [enabled, store, key, adapter, folderId]);

    const reload = useCallback(() => store.load(key, adapter, folderId, true), [store, key, adapter, folderId]);

    return { state, reload };
};
