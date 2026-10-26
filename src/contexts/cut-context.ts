import { createContext } from "react";

import type { AdapterIds } from "../types";

/**
 * The entries cut to the clipboard, by the adapter they came from, as their ids mean nothing to
 * another, so every view showing them can mark them as cut. Null when none are.
 */
export const CutContext = createContext<AdapterIds | null>(null);
