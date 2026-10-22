import { createContext } from "react";

import type { TextDirection } from "../types";

// The file manager's direction, for the menus, dialogs and drag image it portals to `<body>`, which
// take it as their `dir`. Undefined outside a `FileManager`, where they follow the page.
export const DirectionContext = createContext<TextDirection | undefined>(undefined);
