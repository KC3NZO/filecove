import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";

import { folderKey } from "./folder-store";

import type { FileAdapter } from "../adapter";
import type { Section } from "../types";
import type { FolderStore } from "./folder-store";

interface DataContextValue {
    store: FolderStore;
    /** Used by sections that don't bring their own adapter. */
    adapter: FileAdapter;
}

export const DataContext = createContext<DataContextValue | null>(null);

const useData = () => {
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
