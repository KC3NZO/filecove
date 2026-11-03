import { createContext } from "react";

// How `MediaTile` and `MediaRow` tell the asset they're drawn in, by an app's `renderAsset`, that why
// it can't be chosen is shown by them. What it hands back takes that back. Null outside one, and for
// an asset the media manager draws itself, which has nothing to find out.
export const AssetLookContext = createContext<(() => () => void) | null>(null);
