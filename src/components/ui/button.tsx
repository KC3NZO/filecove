import type { ComponentProps, ReactNode } from "react";

import { cx } from "../../utils/cx";
import { fmClasses } from "../../styles/classes";
import styles from "./button.module.css";
import CircularProgress from "./circular-progress";

export interface ButtonProps extends Omit<ComponentProps<"button">, "color"> {
    /** Plain text unless it's `outlined`, or `contained` for the one that does the work. */
    variant?: "text" | "outlined" | "contained";
    /** The accent unless it's `inherit`, the colour of the text around it, or `error`. */
    color?: "primary" | "inherit" | "error";
    size?: "small" | "medium";
    /** A filled button without its shadow. */
    disableElevation?: boolean;
    fullWidth?: boolean;
    startIcon?: ReactNode;
    endIcon?: ReactNode;
    /** Shows a spinner in the label's place and takes no press, while what it started is under way. */
    loading?: boolean;
}

/** A button with a label. Its own `className` goes last, so a part's stylesheet can change it. */
const Button = ({
    variant = "text",
    color = "primary",
    size = "medium",
    disableElevation,
    fullWidth,
    startIcon,
    endIcon,
    loading,
    disabled,
    className,
    type = "button",
    children,
    ...props
}: ButtonProps) => (
    <button
        type={type}
        disabled={disabled || loading}
        data-variant={variant}
        data-color={color}
        className={cx(
            fmClasses.button,
            styles.base,
            styles.button,
            color !== "primary" && styles[color],
            size === "small" && styles.small,
            variant !== "text" && styles[variant],
            disableElevation && styles.flat,
            fullWidth && styles.fullWidth,
            loading && styles.loading,
            className,
        )}
        {...props}
    >
        {startIcon && <span className={styles.startIcon}>{startIcon}</span>}
        {children}
        {endIcon && <span className={styles.endIcon}>{endIcon}</span>}
        {loading && (
            <span className={styles.spinner}>
                <CircularProgress size={16} color="inherit" aria-hidden />
            </span>
        )}
    </button>
);

export default Button;
