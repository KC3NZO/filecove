import type { ComponentProps } from "react";

import { cx } from "../../utils/cx";
import { fmClasses } from "../../styles/classes";
import styles from "./progress.module.css";

interface LinearProgressProps extends ComponentProps<"span"> {
    /** `determinate` fills the bar as far as `value` says; otherwise it sweeps. */
    variant?: "indeterminate" | "determinate";
    /** How far it is, from 0 to 100, for a `determinate` bar. */
    value?: number;
}

/**
 * A bar for something awaited, filling from the start side, the right right to left, and drawn in
 * the system's selection colour under forced colors.
 */
const LinearProgress = ({ variant = "indeterminate", value = 0, className, ...props }: LinearProgressProps) => {
    const determinate = variant === "determinate";

    return (
        <span
            role="progressbar"
            aria-valuenow={determinate ? Math.round(value) : undefined}
            aria-valuemin={determinate ? 0 : undefined}
            aria-valuemax={determinate ? 100 : undefined}
            className={cx(fmClasses.progress, styles.linear, className)}
            {...props}
        >
            {determinate ? (
                <span className={styles.bar} style={{ transform: `translateX(${value - 100}%)` }} />
            ) : (
                <>
                    <span className={cx(styles.bar, styles.sweep1)} />
                    <span className={cx(styles.bar, styles.sweep2)} />
                </>
            )}
        </span>
    );
};

export default LinearProgress;
