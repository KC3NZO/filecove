import { createContext } from "react";

import type { MovingIds } from "../types";

/**
 * The entries the moves under way are moving, waiting or running, by adapter, so every view
 * showing them can mark them as being moved. Empty outside a `FileManager`.
 */
export const MovingContext = createContext<MovingIds>(new Map());
