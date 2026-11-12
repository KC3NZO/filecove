import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, RefObject } from "react";

import { useLocale } from "../../../hooks/use-locale";
import { fmClasses } from "../../../styles/classes";
import headerField from "../../../styles/header-field.module.css";
import { cx } from "../../../utils/cx";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";
import CircularProgress from "../../ui/circular-progress";
import styles from "./path-field.module.css";

interface PathFieldProps {
    /** The path it starts with, the open folder's. */
    initial: string;
    inputRef: RefObject<HTMLInputElement | null>;
    /**
     * Goes where a typed path leads. Resolves with why it can't, or null once it has gone, which
     * ends the field. The signal aborts when the field goes first.
     */
    onGo: (typed: string, signal: AbortSignal) => Promise<string | null>;
    /** Escape, or ✕, which give the focus back. */
    onClose: () => void;
    /** The focus going elsewhere, where it stays. */
    onDismiss: () => void;
}

/**
 * The path field, shown in the path bar's place to type a path in and go there. It starts with the
 * open folder's path selected, and Enter looks for where the path leads, shown by a spinner while
 * the adapters' listings are asked, then closes the field once there, or says why it can't under the
 * field, keeping what's typed to put right. It goes when the focus leaves it.
 */
const PathField = ({ initial, inputRef, onGo, onClose, onDismiss }: PathFieldProps) => {
    const { text } = useLocale();
    const [typed, setTyped] = useState(initial);
    const [problem, setProblem] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const pending = useRef<AbortController | null>(null);
    const problemId = useId();

    useLayoutEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, [inputRef]);

    // Closing the field gives up on a path being looked for.
    useEffect(() => () => pending.current?.abort(), []);

    const go = async () => {
        if (pending.current) {
            return;
        }

        const controller = new AbortController();

        pending.current = controller;
        setBusy(true);
        setProblem(null);

        const message = await onGo(typed, controller.signal);

        // Closed meanwhile, the field is gone and has nothing to show.
        if (pending.current === controller) {
            pending.current = null;
            setBusy(false);
            setProblem(message);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;

        if (event.key === "Enter" && plain && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void go();
        }
    };

    // Escape closes the field from any part of it, and cancels a path being looked for with it.
    const handleFieldKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;

        if (
            event.key === "Escape" &&
            plain &&
            !event.defaultPrevented &&
            !event.nativeEvent.isComposing &&
            event.target instanceof Node &&
            event.currentTarget.contains(event.target)
        ) {
            event.preventDefault();
            onClose();
        }
    };

    // Checked once the focus has gone, so the window losing it, which leaves it in the field, doesn't count.
    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
        const field = event.currentTarget;

        setTimeout(() => {
            if (field.isConnected && !field.contains(document.activeElement)) {
                onDismiss();
            }
        });
    };

    return (
        <div className={styles.wrapper}>
            <div
                className={cx(styles.field, headerField.field, fmClasses.pathField)}
                data-invalid={problem !== null}
                aria-busy={busy || undefined}
                onKeyDown={handleFieldKeyDown}
                onBlur={handleBlur}
            >
                <Icon name="folderOpen" fontSize="small" />
                <input
                    ref={inputRef}
                    value={typed}
                    placeholder={text.pathPlaceholder}
                    autoComplete="off"
                    spellCheck={false}
                    readOnly={busy}
                    className={headerField.input}
                    aria-label={text.editPath}
                    aria-invalid={problem !== null}
                    aria-describedby={problem === null ? undefined : problemId}
                    autoCapitalize="off"
                    onChange={(event) => {
                        setTyped(event.target.value);
                        setProblem(null);
                    }}
                    onKeyDown={handleKeyDown}
                />
                {busy && <CircularProgress size={16} aria-label={text.loading} />}
                {/* Keeps the focus in the field as it's pressed, so the press closes it with the field
                    as the place to go back from. */}
                <TooltipIconButton
                    size="small"
                    label={text.cancel}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={onClose}
                >
                    <Icon name="close" fontSize="small" />
                </TooltipIconButton>
            </div>
            {problem !== null && (
                <div id={problemId} role="alert" className={styles.problem}>
                    {problem}
                </div>
            )}
        </div>
    );
};

export default PathField;
