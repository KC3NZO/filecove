import { createContext } from "react";

import type { MovingIds } from "../types";

/**
 * The entries the moves under way are moving, waiting or running, and those going to the trash or
 * coming back from it, by adapter, each with what holds it, so every view showing them can mark
 * them and say why. Empty outside a `FileManager`.
 */
export const MovingContext = createContext<MovingIds>(new Map());
