import { createContext } from "react";

import type { IconOverrides, IconVariant } from "../types";

export interface IconConfig {
    variant: IconVariant;
    overrides: IconOverrides;
}

export const DEFAULT_ICON_VARIANT: IconVariant = "outlined";

// Stable reference so consumers of the default context never see a new object.
export const EMPTY_ICON_OVERRIDES: IconOverrides = {};

const defaultConfig: IconConfig = {
    variant: DEFAULT_ICON_VARIANT,
    overrides: EMPTY_ICON_OVERRIDES,
};

export const IconContext = createContext<IconConfig>(defaultConfig);
