import { useState } from "react";

import { sameIds } from "../utils/sets";

/**
 * `values` as a set that stays the same object for as long as it holds the same values, so a
 * consumer passing a new array of them each render doesn't count as a change. Undefined while
 * `values` is.
 */
export const useStableSet = (values: Iterable<string> | undefined) => {
    const [stable, setStable] = useState<ReadonlySet<string> | undefined>(() => values && new Set(values));
    const given = values && new Set(values);

    if (given && !(stable && sameIds(stable, given))) {
        setStable(given);

        return given;
    }

    return given && stable;
};
