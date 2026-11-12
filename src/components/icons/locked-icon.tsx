import type { ReactNode } from "react";

import Icon from "./icon";
import styles from "./icon.module.css";

interface LockedIconProps {
    /** Whether to show the lock; without it, the icon shows as it is. */
    locked: boolean;
    children: ReactNode;
}

/** An icon with a lock at its corner, for a folder nothing can be put in (`lockedFolder`). */
const LockedIcon = ({ locked, children }: LockedIconProps) =>
    locked ? (
        <span className={styles.locked}>
            {children}
            <span className={styles.emblem} aria-hidden>
                <Icon name="lock" />
            </span>
        </span>
    ) : (
        children
    );

export default LockedIcon;
