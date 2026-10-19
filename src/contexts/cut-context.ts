import { createContext } from "react";

import type { FileAdapter } from "../types";

interface CutContextValue {
    /** The adapter the cut entries came from; their ids mean nothing to another. */
    adapter: FileAdapter;
    ids: ReadonlySet<string>;
}

/** The entries cut to the clipboard, so every view showing them can mark them as cut. Null when none are. */
export const CutContext = createContext<CutContextValue | null>(null);
