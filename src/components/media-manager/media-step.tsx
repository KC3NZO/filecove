import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

import TooltipIconButton from "../buttons/tooltip-icon-button";
import Icon from "../icons/icon";
import Button from "../ui/button";
import Text from "../ui/text";
import { fmClasses } from "../../styles/classes";
import { cx } from "../../utils/cx";
import styles from "./media-step.module.css";

interface MediaStepProps {
    title: string;
    /** The back button's name. */
    backLabel: string;
    /** Back, or Escape. */
    onBack: () => void;
    /** Its buttons, at its foot. */
    footer: ReactNode;
    /** Why its main button is held back, beside them. */
    note?: string;
    /** The note's id, which that button is described by. */
    noteId?: string;
    children: ReactNode;
}

interface StepSendProps {
    /** While it's being sent, or its form isn't ready. */
    held: boolean;
    /** The note saying why, when there's one. */
    describedBy: string | undefined;
    onClick: () => void;
    children: ReactNode;
}

/** A step's main button, held back while it's being sent or its form isn't ready. */
export const StepSend = ({ held, describedBy, onClick, children }: StepSendProps) => (
    <Button
        variant="contained"
        disableElevation
        aria-disabled={held}
        aria-describedby={describedBy}
        className={styles.send}
        onClick={held ? undefined : onClick}
    >
        {children}
    </Button>
);

/**
 * A step in the library's place, as a picker is often in the app's own dialog already: back, a title,
 * a column of a form's width and its buttons at the foot. It takes the focus as it opens, so it's read
 * out by its title, and Escape goes back. In a form's fields Escape only leaves them, the step taking
 * the focus, and a second goes back, as going back loses what's been filled in.
 */
const MediaStep = ({ title, backLabel, onBack, footer, note, noteId, children }: MediaStepProps) => {
    const titleId = useId();
    const rootRef = useRef<HTMLElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);

    useEffect(() => rootRef.current?.focus(), []);

    return (
        <section
            ref={rootRef}
            tabIndex={-1}
            aria-labelledby={titleId}
            className={cx(styles.root, fmClasses.mediaStep)}
            onKeyDown={(event) => {
                if (event.key === "Escape" && !event.defaultPrevented) {
                    event.preventDefault();
                    event.stopPropagation();

                    if (event.target instanceof Node && bodyRef.current?.contains(event.target)) {
                        rootRef.current?.focus();
                    } else {
                        onBack();
                    }
                }
            }}
        >
            <div className={styles.header}>
                <TooltipIconButton label={backLabel} onClick={onBack}>
                    <Icon name="arrowBack" fontSize="small" />
                </TooltipIconButton>
                <Text id={titleId} component="h2" noWrap className={styles.title}>
                    {title}
                </Text>
            </div>
            <div ref={bodyRef} className={styles.body}>
                <div className={styles.column}>{children}</div>
            </div>
            <div className={styles.footer}>
                {note && (
                    <Text id={noteId} variant="body2" className={styles.note}>
                        <bdi>{note}</bdi>
                    </Text>
                )}
                {footer}
            </div>
        </section>
    );
};

export default MediaStep;
