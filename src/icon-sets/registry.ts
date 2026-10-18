import filled from "./filled";
import outlined from "./outlined";
import rounded from "./rounded";
import sharp from "./sharp";
import twoTone from "./two-tone";

import type { IconSet, IconVariant } from "../types";

const iconSets: Record<IconVariant, IconSet> = {
    filled,
    outlined,
    rounded,
    sharp,
    twoTone,
};

export default iconSets;
