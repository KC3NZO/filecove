import { useRef } from "react";
import type { ComponentProps, KeyboardEventHandler, ReactNode } from "react";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";

import { fmClasses } from "../../styles/classes";
import theme from "../../styles/theme.module.css";
import { cx } from "../../utils/cx";
import styles from "./dialog.module.css";

import type { TextDirection } from "../../types";

/** What closed a dialog: Escape, a press on the backdrop, or something else the dialog holds. */
export type DialogCloseReason = "escapeKeyDown" | "backdropClick" | "other";

interface DialogProps {
    open: boolean;
    /** The dialog's direction, the file manager's, since it portals to `<body>`. */
    dir?: TextDirection;
    /** How wide the dialog may grow; `false` leaves its width to its `className`. */
    maxWidth?: "xs" | "sm" | "md" | "lg" | false;
    /** As wide as `maxWidth` allows, rather than as its content. */
    fullWidth?: boolean;
    className?: string;
    "aria-labelledby"?: string;
    /** Leaves the focus where it is as the dialog closes, for a part that places it itself. */
    disableRestoreFocus?: boolean;
    onClose: (reason: DialogCloseReason) => void;
    /** Called once the dialog has faded in, when the part can place the focus in it. */
    onEntered?: () => void;
    /** Called once the dialog has faded out, when what it showed can be let go. */
    onExited?: () => void;
    onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
    children: ReactNode;
    [data: `data-${string}`]: string | boolean | undefined;
}

/**
 * A modal dialog in the middle of the viewport, over a backdrop, opened and closed by the part
 * that owns it. Escape and a press outside it ask to close it. The focus goes to the dialog itself
 * as it opens, until `onEntered` places it, stays inside it, and goes back to where it was as it
 * closes. It portals to `<body>`, so it takes `dir` and the theme's class.
 */
const Dialog = ({
    open,
    dir,
    maxWidth = "sm",
    fullWidth,
    className,
    disableRestoreFocus,
    onClose,
    onEntered,
    onExited,
    children,
    ...props
}: DialogProps) => {
    const popupRef = useRef<HTMLDivElement>(null);

    return (
        <BaseDialog.Root
            open={open}
            onOpenChange={(next, details) => {
                if (!next) {
                    onClose(
                        details.reason === "escape-key"
                            ? "escapeKeyDown"
                            : details.reason === "outside-press"
                              ? "backdropClick"
                              : "other",
                    );
                }
            }}
            onOpenChangeComplete={(next) => (next ? onEntered : onExited)?.()}
        >
            <BaseDialog.Portal>
                <BaseDialog.Backdrop className={cx(theme.theme, styles.backdrop, fmClasses.dialogBackdrop)} />
                <BaseDialog.Viewport dir={dir} className={cx(theme.theme, styles.viewport)}>
                    <BaseDialog.Popup
                        ref={popupRef}
                        initialFocus={popupRef}
                        finalFocus={disableRestoreFocus ? false : undefined}
                        className={cx(fmClasses.dialog, styles.popup, maxWidth && styles[maxWidth], fullWidth && styles.fullWidth, className)}
                        {...props}
                    >
                        {children}
                    </BaseDialog.Popup>
                </BaseDialog.Viewport>
            </BaseDialog.Portal>
        </BaseDialog.Root>
    );
};

/** The dialog's heading, which names it for screen readers. */
export const DialogTitle = ({ className, ...props }: ComponentProps<typeof BaseDialog.Title>) => (
    <BaseDialog.Title className={cx(fmClasses.dialogTitle, styles.title, typeof className === "string" && className)} {...props} />
);

/** What the dialog holds, scrolling when it's taller than the dialog can be. */
export const DialogContent = ({ className, ...props }: ComponentProps<"div">) => (
    <div className={cx(fmClasses.dialogContent, styles.content, className)} {...props} />
);

/** The dialog's buttons, at its bottom, lined up at the end. */
export const DialogActions = ({ className, ...props }: ComponentProps<"div">) => (
    <div className={cx(fmClasses.dialogActions, styles.actions, className)} {...props} />
);

export default Dialog;
