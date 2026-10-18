import filled from "./sets/filled";
import outlined from "./sets/outlined";
import rounded from "./sets/rounded";
import sharp from "./sets/sharp";
import twoTone from "./sets/two-tone";

import type { IconSet, IconVariant } from "./types";

const iconSets: Record<IconVariant, IconSet> = {
    filled,
    outlined,
    rounded,
    sharp,
    twoTone,
};

export default iconSets;
