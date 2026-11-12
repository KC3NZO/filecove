import type { ReactNode } from "react";

import styles from "./collapse.module.css";

interface CollapseProps {
    /** Whether the content shows; it folds away by its height otherwise, and stays mounted. */
    in: boolean;
    children: ReactNode;
}

/** Content that folds away and back, such as a panel's list of rows. */
const Collapse = ({ in: open, children }: CollapseProps) => (
    <div className={styles.collapse} data-open={open}>
        <div>{children}</div>
    </div>
);

export default Collapse;
