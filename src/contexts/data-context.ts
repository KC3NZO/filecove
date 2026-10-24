import { createContext } from "react";

import type { FolderStore } from "../store/folder-store";
import type { ThumbnailCache } from "../store/thumbnail-cache";
import type { FileAdapter } from "../types";

interface DataContextValue {
    store: FolderStore;
    /** Used by sections that don't bring their own adapter. */
    adapter: FileAdapter;
    thumbnails: ThumbnailCache;
    /** How old, in ms, a listing may be before opening its folder lists it again in the background. */
    relistAfter: number;
}

export const DataContext = createContext<DataContextValue | null>(null);
