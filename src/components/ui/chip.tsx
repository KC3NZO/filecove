import type { MouseEventHandler, ReactNode } from "react";

import { cx } from "../../utils/cx";
import { fmClasses } from "../../styles/classes";
import styles from "./misc.module.css";

interface ChipProps {
    label: ReactNode;
    variant?: "filled" | "outlined";
    /** Makes the chip a button that removes it, with a ✕ after its label. */
    onRemove?: () => void;
    disabled?: boolean;
    className?: string;
    title?: string;
    "aria-label"?: string;
    onMouseDown?: MouseEventHandler<HTMLElement>;
}

/**
 * A small pill for a tag or one value among several. With `onRemove` it's a button, pressed or
 * activated from the keyboard to remove it, its ✕ drawn only.
 */
const Chip = ({ label, variant = "filled", onRemove, disabled, className, ...props }: ChipProps) => {
    const names = cx(fmClasses.chip, styles.chip, variant === "outlined" && styles.chipOutlined, onRemove && styles.chipButton, className);

    if (!onRemove) {
        return (
            <span className={names} {...props}>
                <span className={styles.chipLabel}>{label}</span>
            </span>
        );
    }

    return (
        <button type="button" className={names} disabled={disabled} onClick={onRemove} {...props}>
            <span className={styles.chipLabel}>{label}</span>
            <svg className={styles.chipRemove} viewBox="0 0 24 24" focusable="false" aria-hidden>
                <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2m5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12z" />
            </svg>
        </button>
    );
};

export default Chip;
