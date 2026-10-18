import { createContext } from "react";

import type { FolderStore } from "../store/folder-store";
import type { FileAdapter } from "../types";

interface DataContextValue {
    store: FolderStore;
    /** Used by sections that don't bring their own adapter. */
    adapter: FileAdapter;
}

export const DataContext = createContext<DataContextValue | null>(null);
