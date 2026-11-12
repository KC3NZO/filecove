import type { ComponentProps } from "react";

import { cx } from "../../utils/cx";
import { fmClasses } from "../../styles/classes";
import styles from "./progress.module.css";

interface CircularProgressProps extends Omit<ComponentProps<"span">, "color"> {
    /** The ring's width and height, in px. */
    size?: number;
    /** `determinate` fills the ring as far as `value` says; otherwise it turns. */
    variant?: "indeterminate" | "determinate";
    /** How far it is, from 0 to 100, for a `determinate` ring. */
    value?: number;
    /** The accent unless it's `inherit`, the colour of the text around it. */
    color?: "primary" | "inherit";
}

const RADIUS = 20.2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A ring for something awaited, named for screen readers by its `aria-label`. */
const CircularProgress = ({
    size = 40,
    variant = "indeterminate",
    value = 0,
    color = "primary",
    className,
    style,
    ...props
}: CircularProgressProps) => {
    const determinate = variant === "determinate";

    return (
        <span
            role="progressbar"
            aria-valuenow={determinate ? Math.round(value) : undefined}
            className={cx(
                fmClasses.spinner,
                styles.circular,
                determinate ? styles.circularDeterminate : styles.circularIndeterminate,
                color === "inherit" && styles.circularInherit,
                className,
            )}
            style={{ width: size, height: size, ...style }}
            {...props}
        >
            <svg viewBox="22 22 44 44">
                <circle
                    cx={44}
                    cy={44}
                    r={RADIUS}
                    style={
                        determinate
                            ? {
                                  strokeDasharray: CIRCUMFERENCE.toFixed(3),
                                  strokeDashoffset: `${(((100 - value) / 100) * CIRCUMFERENCE).toFixed(3)}px`,
                              }
                            : undefined
                    }
                />
            </svg>
        </span>
    );
};

export default CircularProgress;
