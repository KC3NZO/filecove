import { useEffect } from "react";
import type { ComponentProps, ElementType, ReactNode } from "react";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Slider as BaseSlider } from "@base-ui/react/slider";

import styles from "./ui.module.css";

/*
 * The dev host's own controls, built as an app would build its own: plain elements, and Base UI
 * for the two that need behaviour, a dialog and a slider. It imports nothing of the file manager's
 * insides, which the playground uses only through its public entry.
 */

/** Joins the class names that apply. */
export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ") || undefined;

type TextProps<C extends ElementType> = {
    variant?: "body1" | "body2" | "caption" | "h4" | "h5" | "h6";
    component?: C;
    color?: "secondary" | "error";
    noWrap?: boolean;
} & Omit<ComponentProps<C>, "color">;

export const Text = <C extends ElementType = "p">({
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

export const ButtonBase = ({ className, type = "button", ...props }: ComponentProps<"button">) => (
    <button type={type} className={cx(styles.buttonBase, className)} {...props} />
);

interface ButtonProps extends Omit<ComponentProps<"button">, "color"> {
    variant?: "text" | "outlined" | "contained";
    color?: "primary" | "inherit";
    size?: "small" | "medium";
}

export const Button = ({ variant = "text", color = "primary", size = "medium", className, ...props }: ButtonProps) => (
    <ButtonBase
        className={cx(
            styles.button,
            color === "inherit" && styles.buttonInherit,
            size === "small" && styles.buttonSmall,
            variant === "outlined" && styles.buttonOutlined,
            variant === "contained" && styles.buttonContained,
            className,
        )}
        {...props}
    />
);

interface ChipProps extends Omit<ComponentProps<"span">, "children"> {
    label: ReactNode;
    variant?: "filled" | "outlined";
}

export const Chip = ({ label, variant = "filled", className, ...props }: ChipProps) => (
    <span className={cx(styles.chip, variant === "outlined" && styles.chipOutlined, className)} {...props}>
        {label}
    </span>
);

export const Link = ({ className, ...props }: ComponentProps<"a">) => (
    <a className={cx(styles.link, className)} {...props} />
);

interface TextFieldProps extends ComponentProps<"input"> {
    error?: boolean;
}

/** A field typed in. Its label is the caller's, pointing at its `id` or naming it by `aria-labelledby`. */
export const TextField = ({ error, className, ...props }: TextFieldProps) => (
    <input aria-invalid={error || undefined} className={cx(styles.field, className)} {...props} />
);

interface SpinnerProps extends ComponentProps<"span"> {
    size?: number;
}

export const Spinner = ({ size = 40, className, style, ...props }: SpinnerProps) => (
    <span
        role="progressbar"
        className={cx(styles.spinner, className)}
        style={{ width: size, height: size, ...style }}
        {...props}
    />
);

interface DialogProps {
    open: boolean;
    maxWidth: "md" | "lg";
    className?: string;
    "aria-labelledby"?: string;
    onClose: () => void;
    children: ReactNode;
}

/** A modal dialog over the page, closed by Escape or a press outside it. */
export const Dialog = ({ open, maxWidth, className, onClose, children, ...props }: DialogProps) => (
    <BaseDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
        <BaseDialog.Portal>
            <BaseDialog.Backdrop className={styles.backdrop} />
            <BaseDialog.Viewport className={styles.dialogViewport}>
                <BaseDialog.Popup
                    className={cx(styles.dialog, maxWidth === "md" ? styles.dialogMd : styles.dialogLg, className)}
                    {...props}
                >
                    {children}
                </BaseDialog.Popup>
            </BaseDialog.Viewport>
        </BaseDialog.Portal>
    </BaseDialog.Root>
);

interface SliderProps {
    value: number;
    min: number;
    max: number;
    step: number;
    disabled?: boolean;
    "aria-labelledby"?: string;
    "aria-valuetext"?: string;
    onChange: (value: number) => void;
}

export const Slider = ({ onChange, "aria-labelledby": labelledBy, "aria-valuetext": valueText, ...props }: SliderProps) => (
    <BaseSlider.Root aria-labelledby={labelledBy} onValueChange={(value) => onChange(value)} {...props}>
        <BaseSlider.Control className={styles.slider}>
            <BaseSlider.Track className={styles.sliderTrack}>
                <BaseSlider.Indicator className={styles.sliderFill} />
                <BaseSlider.Thumb aria-valuetext={valueText} className={styles.sliderThumb} />
            </BaseSlider.Track>
        </BaseSlider.Control>
    </BaseSlider.Root>
);

interface SnackbarProps {
    open: boolean;
    message: ReactNode;
    /** How long it shows, in ms. */
    autoHideDuration: number;
    onClose: () => void;
}

/** A passing message at the page's bottom corner. */
export const Snackbar = ({ open, message, autoHideDuration, onClose }: SnackbarProps) => {
    useEffect(() => {
        if (!open) {
            return;
        }

        const timer = window.setTimeout(onClose, autoHideDuration);

        return () => window.clearTimeout(timer);
        // Counted afresh for each message; `onClose` is a new function at each render.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [open, message, autoHideDuration]);

    return open ? (
        <div role="status" className={styles.snackbar}>
            {message}
        </div>
    ) : null;
};
