import type { SvgIconProps } from "@mui/material/SvgIcon";

import { useIconConfig } from "../../hooks/use-icon-config";
import iconSets from "../../icon-sets/registry";

import type { IconName, IconVariant } from "../../types";

interface IconProps extends SvgIconProps {
    name: IconName;
    /** Overrides the variant from `IconProvider` for this icon only. */
    variant?: IconVariant;
}

const Icon = ({ name, variant, ...props }: IconProps) => {
    const config = useIconConfig();

    const Component = config.overrides[name] ?? iconSets[variant ?? config.variant][name];

    return <Component {...props} />;
};

export default Icon;
