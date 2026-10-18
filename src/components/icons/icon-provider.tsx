import { useMemo } from "react";
import type { PropsWithChildren } from "react";

import { IconContext } from "../../contexts/icon-context";
import { useIconConfig } from "../../hooks/use-icon-config";

import type { IconOverrides, IconVariant } from "../../types";

interface IconProviderProps extends PropsWithChildren {
    /** Icon variant for everything below; inherits from a parent provider when omitted. */
    variant?: IconVariant;
    /** Per-icon replacements, merged over any parent provider's overrides. */
    overrides?: IconOverrides;
}

const IconProvider = ({ variant, overrides, children }: IconProviderProps) => {
    const parent = useIconConfig();

    const value = useMemo(
        () => ({
            variant: variant ?? parent.variant,
            overrides: overrides ? { ...parent.overrides, ...overrides } : parent.overrides,
        }),
        [variant, overrides, parent],
    );

    return <IconContext value={value}>{children}</IconContext>;
};

export default IconProvider;
