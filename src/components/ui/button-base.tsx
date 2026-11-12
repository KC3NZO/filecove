import type { ComponentProps } from "react";

import { cx } from "../../utils/cx";
import styles from "./button.module.css";

/**
 * A `button` with none of the browser's look, for a part to style with its own `className`. It's
 * never a form's submit button unless it says so, and shows a ring on keyboard focus.
 */
const ButtonBase = ({ className, type = "button", ...props }: ComponentProps<"button">) => (
    <button type={type} className={cx(styles.base, className)} {...props} />
);

export default ButtonBase;
