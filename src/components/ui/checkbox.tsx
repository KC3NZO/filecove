import type { ComponentProps } from "react";

import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";

import { cx } from "../../utils/cx";
import { fmClasses } from "../../styles/classes";
import styles from "./checkbox.module.css";

const BOX = "M19 5v14H5V5zm0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2";
const CHECKED =
    "M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2m-9 14-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z";
const MIXED = "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m-2 10H7v-2h10z";
const RING =
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8";
const DOT = "M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5";

interface CheckMarkProps {
    checked: boolean;
    /** Neither ticked nor unticked, as when only some of what it stands for is. */
    indeterminate?: boolean;
    className?: string;
}

/**
 * A checkbox's box, drawn only. In a menu the item takes the press, holds the focus and carries the
 * role and the state, so the arrow keys keep moving through the menu.
 */
export const CheckMark = ({ checked, indeterminate, className }: CheckMarkProps) => (
    <svg
        viewBox="0 0 24 24"
        focusable="false"
        aria-hidden
        data-on={checked || !!indeterminate}
        className={cx(styles.mark, className)}
    >
        <path d={indeterminate ? MIXED : checked ? CHECKED : BOX} />
    </svg>
);

/** A radio button's ring, drawn only, as `CheckMark` is. */
export const RadioMark = ({ checked, className }: Omit<CheckMarkProps, "indeterminate">) => (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden data-on={checked} className={cx(styles.mark, className)}>
        <path d={RING} />
        {checked && <path d={DOT} />}
    </svg>
);

interface CheckboxProps extends Omit<ComponentProps<typeof BaseCheckbox.Root>, "className" | "render" | "children"> {
    className?: string;
}

/**
 * A checkbox that's ticked and unticked by a press, Space included. `id` goes on its hidden input,
 * for a `label` pointing at it, and what names or describes it (`aria-labelledby`) on the box.
 */
const Checkbox = ({ checked, indeterminate, className, ...props }: CheckboxProps) => (
    <BaseCheckbox.Root
        checked={checked}
        indeterminate={indeterminate}
        className={cx(fmClasses.checkbox, styles.checkbox, className)}
        {...props}
    >
        <CheckMark checked={!!checked} indeterminate={indeterminate} />
    </BaseCheckbox.Root>
);

export default Checkbox;
