import type { ComponentProps } from "react";

import { cx } from "../../utils/cx";
import styles from "./misc.module.css";

/** A rule between two parts. */
const Divider = ({ className, ...props }: ComponentProps<"hr">) => (
    <hr className={cx(styles.divider, className)} {...props} />
);

export default Divider;
