import type { ComponentProps, ElementType } from "react";

import { cx } from "../../utils/cx";
import styles from "./text.module.css";

type TextVariant = "body1" | "body2" | "caption";

type TextProps<C extends ElementType> = {
    /** The text's size: `body1` is 1rem, `body2` 0.875rem and `caption` 0.75rem. */
    variant?: TextVariant;
    /** The element drawn: a `p` unless it's a caption, which is a `span`. */
    component?: C;
    /**
     * `secondary` for text that matters less, `error` for a failure, `disabled` for what's off for
     * now; else the colour around it.
     */
    color?: "secondary" | "error" | "disabled";
    /** Keeps the text on one line, cut short with an ellipsis. */
    noWrap?: boolean;
} & Omit<ComponentProps<C>, "color">;

/**
 * A piece of text in one of the component's sizes. Its own `className` goes after the size's, so
 * a part's stylesheet can change what it sets.
 */
const Text = <C extends ElementType = "p">({
    variant = "body1",
    component,
    color,
    noWrap,
    className,
    ...props
}: TextProps<C>) => {
    const Component: ElementType = component ?? (variant === "caption" ? "span" : "p");

    return (
        <Component
            className={cx(styles[variant], color && styles[color], noWrap && styles.noWrap, className)}
            {...props}
        />
    );
};

export default Text;
