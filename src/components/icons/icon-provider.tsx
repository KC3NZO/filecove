import { useMemo } from "react";
import type { PropsWithChildren } from "react";

import { IconContext } from "../../contexts/icon-context";
import { useIconConfig } from "../../hooks/use-icon-config";

import type { IconOverrides, IconSet } from "../../types";

interface IconProviderProps extends PropsWithChildren {
    /**
     * The icons for everything below: a Material style imported from the package's `icons/<style>`
     * (`filledIcons`, `outlinedIcons`, `roundedIcons`, `sharpIcons`, `twoToneIcons`), or a set of the
     * app's own. Inherits from a parent provider when omitted, and is Outlined with none.
     */
    icons?: IconSet;
    /** Per-icon replacements, merged over any parent provider's overrides. */
    overrides?: IconOverrides;
    /**
     * Coloured file and folder icons chosen by name (a PDF's, a `src` folder's), from
     * `@react-symbols/icons`, which is loaded on its own once the component mounts, the set's plain
     * file and folder icons standing in until it has. `false` keeps the plain ones and never loads
     * it. Inherits from a parent provider when omitted, and is `true` with none.
     */
    typeIcons?: boolean;
}

const IconProvider = ({ icons, overrides, typeIcons, children }: IconProviderProps) => {
    const parent = useIconConfig();

    const value = useMemo(
        () => ({
            icons: icons ?? parent.icons,
            overrides: overrides ? { ...parent.overrides, ...overrides } : parent.overrides,
            typeIcons: typeIcons ?? parent.typeIcons,
        }),
        [icons, overrides, typeIcons, parent],
    );

    return <IconContext value={value}>{children}</IconContext>;
};

export default IconProvider;
