import type { ComponentProps } from "react";

import { cx } from "../../utils/cx";
import styles from "./misc.module.css";

/** A link in the accent colour. */
const Link = ({ className, ...props }: ComponentProps<"a">) => <a className={cx(styles.link, className)} {...props} />;

export default Link;
