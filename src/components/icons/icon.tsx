import type { SVGProps } from "react";

import { useIconConfig } from "../../hooks/use-icon-config";
import { cx } from "../../utils/cx";
import { fmClasses } from "../../styles/classes";
import styles from "./icon.module.css";

import type { IconName } from "../../types";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name" | "fontSize"> {
    name: IconName;
    /** `medium` is 1.5rem, `small` 1.25rem, and `inherit` the size of the text around it. */
    fontSize?: "small" | "medium" | "inherit";
    /**
     * Names the icon for screen readers, and shows as its tooltip, for one that says something by
     * itself. Without it an icon is drawn only, and what it's in says what it means.
     */
    label?: string;
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

const SIZES = { small: styles.small, medium: undefined, inherit: styles.inherit };

/**
 * An icon by its name, from `IconProvider`'s set or the consumer's override of it. Its size and its
 * mirroring are classes, the icon's own `className` after them so it can still override them, so a
 * consumer's icon needs to take no more than an `svg`'s own props.
 */
const Icon = ({ name, fontSize = "medium", label, className, ...props }: IconProps) => {
    const config = useIconConfig();

    const Component = config.overrides[name] ?? config.icons[name];

    return (
        <Component
            {...(label === undefined ? undefined : { role: "img", "aria-label": label, "aria-hidden": undefined })}
            {...props}
            className={cx(fmClasses.icon, styles.icon, SIZES[fontSize], MIRRORED.has(name) && styles.mirrored, className)}
        >
            {label === undefined ? undefined : <title>{label}</title>}
        </Component>
    );
};

export default Icon;
