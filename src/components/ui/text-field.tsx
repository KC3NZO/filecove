import { useId, useLayoutEffect, useRef } from "react";
import type { ChangeEventHandler, FocusEventHandler, KeyboardEventHandler, ReactNode, Ref } from "react";

import { cx } from "../../utils/cx";
import { fmClasses } from "../../styles/classes";
import styles from "./text-field.module.css";

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

interface TextFieldProps {
    id?: string;
    /** The field's name, shown on its top edge. Without one, the field is named by `inputProps`. */
    label?: ReactNode;
    value: string;
    type?: string;
    placeholder?: string;
    size?: "small" | "medium";
    fullWidth?: boolean;
    disabled?: boolean;
    /** Draws the field, and `helperText`, as a failure. */
    error?: boolean;
    /** A line under the field: what's wrong with what's typed, or a hint. */
    helperText?: ReactNode;
    /** Several lines, as tall as what's typed, between `minRows` and `maxRows`. */
    multiline?: boolean;
    minRows?: number;
    maxRows?: number;
    /** The browser's own select, its `option`s as `children`. */
    select?: boolean;
    children?: ReactNode;
    className?: string;
    inputRef?: Ref<HTMLInputElement>;
    /** Attributes of the `input`, `textarea` or `select` itself. */
    inputProps?: Record<string, unknown>;
    onChange?: ChangeEventHandler<Control>;
    onKeyDown?: KeyboardEventHandler<Control>;
    onBlur?: FocusEventHandler<Control>;
}

// A textarea's height follows what's typed: its own height is let go, read back as its content's,
// and held between the fewest and the most rows, past which it scrolls.
const useRows = (value: string, enabled: boolean, minRows: number, maxRows: number | undefined) => {
    const ref = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        const area = ref.current;

        if (!enabled || !area) {
            return;
        }

        const line = parseFloat(getComputedStyle(area).lineHeight) || 23;
        const most = maxRows === undefined ? Infinity : line * maxRows;

        area.style.height = "auto";

        const wanted = Math.max(area.scrollHeight, line * minRows);

        area.style.height = `${Math.min(wanted, most)}px`;
        area.style.overflowY = wanted > most ? "auto" : "hidden";
    }, [value, enabled, minRows, maxRows]);

    return ref;
};

/**
 * A field typed in, outlined, with its name on its top edge and a line under it. It's an `input`,
 * a `textarea` that grows with what's typed (`multiline`), or the browser's own `select`. Every
 * side is logical, so it follows the page's direction with nothing asked of it.
 */
const TextField = ({
    id,
    label,
    value,
    type,
    placeholder,
    size = "medium",
    fullWidth,
    disabled,
    error,
    helperText,
    multiline = false,
    minRows = 1,
    maxRows,
    select,
    children,
    className,
    inputRef,
    inputProps,
    onChange,
    onKeyDown,
    onBlur,
}: TextFieldProps) => {
    const ownId = useId();
    const fieldId = id ?? ownId;
    const areaRef = useRows(value, multiline, minRows, maxRows);
    const shared = {
        id: fieldId,
        value,
        disabled,
        className: styles.input,
        "aria-invalid": error || undefined,
        onChange,
        onKeyDown,
        onBlur,
        ...inputProps,
    };

    return (
        <div
            className={cx(
                fmClasses.textField,
                styles.field,
                size === "small" && styles.small,
                fullWidth && styles.fullWidth,
                error && styles.invalid,
                disabled && styles.disabled,
                className,
            )}
            data-error={!!error}
        >
            {label !== undefined && (
                <label className={styles.label} htmlFor={fieldId}>
                    {label}
                </label>
            )}
            <div className={styles.control}>
                {select ? (
                    <>
                        <select {...shared}>{children}</select>
                        <svg className={styles.arrow} viewBox="0 0 24 24" focusable="false" aria-hidden>
                            <path d="M7 10l5 5 5-5z" />
                        </svg>
                    </>
                ) : multiline ? (
                    <textarea ref={areaRef} rows={minRows} placeholder={placeholder} {...shared} />
                ) : (
                    <input ref={inputRef} type={type ?? "text"} placeholder={placeholder} {...shared} />
                )}
                <fieldset aria-hidden className={styles.outline}>
                    <legend className={cx(styles.notch, label === undefined && styles.unlabelled)}>
                        {label !== undefined && <span>{label}</span>}
                    </legend>
                </fieldset>
            </div>
            {helperText !== undefined && helperText !== null && helperText !== "" && (
                // A blank one keeps its line, so what's under the field doesn't jump as a message shows.
                <p className={styles.helper}>{helperText === " " ? "\u200B" : helperText}</p>
            )}
        </div>
    );
};

export default TextField;
