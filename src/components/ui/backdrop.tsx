import type { ComponentProps } from "react";

import { cx } from "../../utils/cx";
import styles from "./backdrop.module.css";

interface BackdropProps extends ComponentProps<"div"> {
    open: boolean;
}

/** The dim layer behind an overlay, which a press on closes. It stays mounted, hidden while closed. */
const Backdrop = ({ open, className, ...props }: BackdropProps) => (
    <div aria-hidden data-open={open} className={cx(styles.backdrop, className)} {...props} />
);

export default Backdrop;
