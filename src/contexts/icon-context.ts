import { createContext } from "react";

import { outlinedIcons } from "../icon-sets/outlined";

import type { IconOverrides, IconSet } from "../types";

export interface IconConfig {
    /** The set the icons are drawn from: Outlined unless `IconProvider` gives another. */
    icons: IconSet;
    overrides: IconOverrides;
    /** Whether files and folders get `@react-symbols/icons`' coloured icons, chosen by name. */
    typeIcons: boolean;
}

// Stable reference so consumers of the default context never see a new object.
export const EMPTY_ICON_OVERRIDES: IconOverrides = {};

const defaultConfig: IconConfig = {
    icons: outlinedIcons,
    overrides: EMPTY_ICON_OVERRIDES,
    typeIcons: true,
};

export const IconContext = createContext<IconConfig>(defaultConfig);
