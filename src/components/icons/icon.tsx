import type { SvgIconProps } from "@mui/material/SvgIcon";
import type { SxProps, Theme } from "@mui/material/styles";

import { useIconConfig } from "../../hooks/use-icon-config";
import iconSets from "../../icon-sets/registry";
import { withSx } from "../../styles/sx";

import type { IconName, IconVariant } from "../../types";

interface IconProps extends SvgIconProps {
    name: IconName;
    /** Overrides the variant from `IconProvider` for this icon only. */
    variant?: IconVariant;
}

/**
 * Icons that point the way the text runs. They're drawn for left to right and mirrored right to
 * left, as Material mirrors them (it has `ChecklistRtl` and `DriveFileMoveRtl` for two of them), and
 * so are the consumer's overrides of them.
 */
const MIRRORED: ReadonlySet<IconName> = new Set<IconName>([
    "arrowBack",
    "arrowForward",
    "chevronLeft",
    "chevronRight",
    "move",
    "selectMode",
]);

// `scale` rather than `transform`, so a part that rotates an icon, as the tree's chevrons do, still
// can, and `:dir()` follows the `dir` the page or an ancestor sets.
const mirroredSx = {
    "&:dir(rtl)": { scale: "-1 1" },
} satisfies SxProps<Theme>;

const Icon = ({ name, variant, sx, ...props }: IconProps) => {
    const config = useIconConfig();

    const Component = config.overrides[name] ?? iconSets[variant ?? config.variant][name];

    // The mirroring goes first, so the icon's own `sx` can still override it.
    return <Component {...props} sx={MIRRORED.has(name) ? withSx(mirroredSx, sx) : sx} />;
};

export default Icon;
