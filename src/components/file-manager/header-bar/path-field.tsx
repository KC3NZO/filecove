import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, RefObject } from "react";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import InputBase from "@mui/material/InputBase";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../../hooks/use-locale";
import { headerFieldSx, headerInputSx } from "../../../styles/header-field";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";

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

// The message hangs under the pill, over the content, rather than making the header taller.
const wrapperSx: SxProps<Theme> = {
    position: "relative",
    minWidth: 0,
};

// The error outline wins over the focus ring, which the field has whenever it shows one: the second
// selector is as specific as the ring's `:has()` and comes after it.
const fieldSx: SxProps<Theme> = {
    ...headerFieldSx,
    '&[data-invalid="true"], &[data-invalid="true"]:has(input:focus)': {
        outline: "2px solid",
        outlineColor: "error.main",
        outlineOffset: "-2px",
    },
};

// Its border keeps it apart from the content under it where forced colors drop the background.
const problemSx: SxProps<Theme> = {
    position: "absolute",
    top: "100%",
    insetInline: 0,
    zIndex: 2,
    mt: 0.5,
    px: 1.5,
    py: 0.75,
    border: 1,
    borderColor: "error.main",
    borderRadius: 2,
    bgcolor: "background.paper",
    color: "error.main",
    fontSize: "0.8125rem",
    boxShadow: 3,
    pointerEvents: "none",
};

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
        <Box sx={wrapperSx}>
            <Box
                sx={fieldSx}
                data-invalid={problem !== null}
                aria-busy={busy || undefined}
                onKeyDown={handleFieldKeyDown}
                onBlur={handleBlur}
            >
                <Icon name="folderOpen" fontSize="small" />
                <InputBase
                    inputRef={inputRef}
                    value={typed}
                    placeholder={text.pathPlaceholder}
                    autoComplete="off"
                    spellCheck={false}
                    readOnly={busy}
                    sx={headerInputSx}
                    slotProps={{
                        input: {
                            "aria-label": text.editPath,
                            "aria-invalid": problem !== null,
                            "aria-describedby": problem === null ? undefined : problemId,
                            autoCapitalize: "off",
                        },
                    }}
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
            </Box>
            {problem !== null && (
                <Box id={problemId} role="alert" sx={problemSx}>
                    {problem}
                </Box>
            )}
        </Box>
    );
};

export default PathField;
