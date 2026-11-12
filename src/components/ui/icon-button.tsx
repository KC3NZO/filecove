import type { ComponentProps } from "react";

import { cx } from "../../utils/cx";
import { fmClasses } from "../../styles/classes";
import styles from "./button.module.css";

export interface IconButtonProps extends Omit<ComponentProps<"button">, "color"> {
    size?: "small" | "medium";
    /** The icons' own colour unless it's `inherit`, the colour of the text around it, or `primary`. */
    color?: "default" | "inherit" | "primary";
}

/**
 * A round button holding an icon alone. In `src/` an icon-only button is a `TooltipIconButton`,
 * which names it; this is for the one that's hidden from screen readers.
 */
const IconButton = ({ size = "medium", color = "default", className, type = "button", ...props }: IconButtonProps) => (
    <button
        type={type}
        className={cx(
            fmClasses.iconButton,
            styles.base,
            styles.iconButton,
            size === "small" && styles.iconSmall,
            color === "inherit" && styles.iconInherit,
            color === "primary" && styles.iconPrimary,
            className,
        )}
        {...props}
    />
);

export default IconButton;
