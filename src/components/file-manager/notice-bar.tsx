import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grow from "@mui/material/Grow";
import SnackbarContent from "@mui/material/SnackbarContent";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { forcedColors, forcedEdge } from "../../styles/mixins";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import Icon from "../icons/icon";

/** What the notice under the content says. */
export interface Notice {
    /** Counts notices, so each one shows for its whole time, even with the same text. */
    id: number;
    message: string;
    /** Under the message, such as why an undo did nothing. */
    detail?: string;
}

interface NoticeBarProps {
    /** What to say, or null for nothing. */
    notice: Notice | null;
    /** The label of its button (Undo, Redo, Try again), when it has one. */
    actionLabel?: string;
    onAction: () => void;
    /** The label of a button before that one, showing where a change put something (Show), when it has one. */
    showLabel?: string;
    onShow: () => void;
    onClose: () => void;
    /** Whether it sits above the touch selection bar, which has the panel's bottom. */
    raised: boolean;
    /** Called as it goes with the focus in it, for the content to take it. */
    onFocusLost: () => void;
}

/** How long a notice shows, in ms, counted while the pointer isn't over it and the focus isn't in it. */
const SHOW_FOR = 8000;

// Over the bottom of the content, in the middle, clear of the touch selection bar while that shows,
// letting presses through beside it.
const areaSx: SxProps<Theme> = {
    position: "absolute",
    insetInline: 0,
    bottom: 12,
    zIndex: 3,
    display: "flex",
    justifyContent: "center",
    px: 1.5,
    pointerEvents: "none",
    '&[data-raised="true"]': { bottom: 72 },
};

// MUI spaces the action with physical margins and a padding, which only its RTL plugin flips, and
// sizes the notice by the viewport, not the content.
const contentSx: SxProps<Theme> = {
    pointerEvents: "auto",
    flexWrap: "nowrap",
    flexGrow: 0,
    minWidth: "min(288px, 100%)",
    maxWidth: "36rem",
    borderRadius: 2,
    "& .MuiSnackbarContent-message": { minWidth: 0 },
    "& .MuiSnackbarContent-action": {
        flexShrink: 0,
        marginLeft: 0,
        marginRight: 0,
        paddingLeft: 0,
        marginInlineStart: "auto",
        marginInlineEnd: -1,
        paddingInlineStart: 2,
        gap: 0.5,
    },
    [forcedColors]: forcedEdge,
};

const detailSx: SxProps<Theme> = {
    opacity: 0.8,
};

/**
 * A notice over the bottom of the content, as a snackbar is: what a change did, with Undo, and Show
 * for what a restore put back, or why an undo did nothing. It goes after `SHOW_FOR`, which waits
 * while the pointer is over it or the focus in it, or with its ✕ or Escape. Screen readers hear its
 * message from the file manager's live region, so it isn't one itself.
 */
const NoticeBar = ({
    notice,
    actionLabel,
    onAction,
    showLabel,
    onShow,
    onClose,
    raised,
    onFocusLost,
}: NoticeBarProps) => {
    const { text } = useLocale();
    // A notice going keeps saying what it said while it shrinks away.
    const [shown, setShown] = useState(notice);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    // Whether the focus was in it, which React isn't told is lost when the button that had it goes.
    const focusInside = useRef(false);
    const latest = useRef({ onClose, onFocusLost });

    useLayoutEffect(() => {
        latest.current = { onClose, onFocusLost };
    });

    if (notice && notice !== shown) {
        setShown(notice);
    }

    const held = hovered || focused;

    useEffect(() => {
        if (!notice || held) {
            return;
        }

        const timer = window.setTimeout(() => latest.current.onClose(), SHOW_FOR);

        return () => window.clearTimeout(timer);
    }, [notice, held]);

    // Going with the focus in it, it hands the focus to the content; losing the button that had it,
    // as a notice without one takes its place, to its ✕.
    useLayoutEffect(() => {
        if (!focusInside.current) {
            return;
        }

        if (!notice) {
            focusInside.current = false;
            latest.current.onFocusLost();
        } else if (!rootRef.current?.contains(document.activeElement)) {
            closeRef.current?.focus();
        }
    });

    const handleFocus = () => {
        focusInside.current = true;
        setFocused(true);
    };

    const handleBlur = (event: FocusEvent) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
            focusInside.current = false;
            setFocused(false);
        }
    };

    // Gone, it's no longer under the pointer, which leaves no `mouseleave` behind.
    const handleExited = () => {
        setShown(null);
        setHovered(false);
        setFocused(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
        }
    };

    if (!shown) {
        return null;
    }

    return (
        <Box sx={areaSx} data-raised={raised}>
            <Grow in={!!notice} appear onExited={handleExited}>
                <SnackbarContent
                    ref={rootRef}
                    role="none"
                    sx={contentSx}
                    message={
                        <>
                            <div>{shown.message}</div>
                            {shown.detail && <Box sx={detailSx}>{shown.detail}</Box>}
                        </>
                    }
                    action={
                        <>
                            {showLabel && (
                                <Button color="inherit" size="small" onClick={onShow}>
                                    {showLabel}
                                </Button>
                            )}
                            {actionLabel && (
                                <Button color="inherit" size="small" onClick={onAction}>
                                    {actionLabel}
                                </Button>
                            )}
                            <TooltipIconButton
                                ref={closeRef}
                                label={text.close}
                                color="inherit"
                                size="small"
                                onClick={onClose}
                            >
                                <Icon name="close" fontSize="small" />
                            </TooltipIconButton>
                        </>
                    }
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                />
            </Grow>
        </Box>
    );
};

export default NoticeBar;
