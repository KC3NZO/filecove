import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, MouseEvent } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grow from "@mui/material/Grow";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import type { MenuProps } from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import SnackbarContent from "@mui/material/SnackbarContent";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../contexts/direction-context";
import { useLocale } from "../../hooks/use-locale";
import { forcedColors, forcedEdge, menuPaperSx } from "../../styles/mixins";
import { isRtl } from "../../utils/dom";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import Icon from "../icons/icon";
import IconSlot from "../icons/icon-slot";

import type { PlaceName } from "../../types";

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
    /** The folders it shows, when there are several, which it lists to choose from. */
    showPlaces?: PlaceName[];
    /** Shows the folder at `index` of `showPlaces`, or the one there is. */
    onShow: (index: number) => void;
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

// Long names are cut short rather than widening the list.
const placeSx: SxProps<Theme> = { maxWidth: "min(24rem, 90vw)" };

const placeTextSx: SxProps<Theme> = { minWidth: 0 };

// Above the notice, which sits at the bottom of the content, hanging from Show's end edge.
const ORIGINS: Record<"ltr" | "rtl", Pick<MenuProps, "anchorOrigin" | "transformOrigin">> = {
    ltr: {
        anchorOrigin: { vertical: "top", horizontal: "right" },
        transformOrigin: { vertical: "bottom", horizontal: "right" },
    },
    rtl: {
        anchorOrigin: { vertical: "top", horizontal: "left" },
        transformOrigin: { vertical: "bottom", horizontal: "left" },
    },
};

/**
 * A notice over the bottom of the content, as a snackbar is: what a change did, with Undo, and Show
 * for what a restore put back, listing the folders it went back to when there are several, or why
 * an undo did nothing. It goes after `SHOW_FOR`, which waits while the pointer is over it, the focus
 * in it or its list open, or with its ✕ or Escape. Screen readers hear its message from the file
 * manager's live region, so it isn't one itself.
 */
const NoticeBar = ({
    notice,
    actionLabel,
    onAction,
    showLabel,
    showPlaces,
    onShow,
    onClose,
    raised,
    onFocusLost,
}: NoticeBarProps) => {
    const { text } = useLocale();
    const dir = useContext(DirectionContext);
    // A notice going keeps saying what it said while it shrinks away.
    const [shown, setShown] = useState(notice);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    // Show's list of folders, from the button it hangs from, kept while it fades out, and gone as
    // another notice comes.
    const [list, setList] = useState<{ from: HTMLElement; open: boolean } | null>(null);
    const listOpen = !!list?.open && !!notice && !!showPlaces;
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
        setList(null);
    }

    const held = hovered || focused || !!list;

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
        } else if (!list && !rootRef.current?.contains(document.activeElement)) {
            // The list portals out of it, so the focus in it, or there as it fades out, isn't inside.
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

    // With one folder, Show opens it; with several, it lists them.
    const handleShow = (event: MouseEvent<HTMLElement>) => {
        if (showPlaces) {
            setList({ from: event.currentTarget, open: true });
        } else {
            onShow(0);
        }
    };

    const closeList = () => setList((prev) => prev && { ...prev, open: false });

    // The list closes as the folder picked opens, which takes the focus.
    const showPlace = (index: number) => {
        closeList();
        onShow(index);
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
                                <Button
                                    color="inherit"
                                    size="small"
                                    aria-haspopup={showPlaces ? "menu" : undefined}
                                    aria-expanded={showPlaces ? listOpen : undefined}
                                    onClick={handleShow}
                                >
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
            {showPlaces && list && (
                <Menu
                    dir={dir}
                    open={listOpen}
                    anchorEl={list.from}
                    {...ORIGINS[isRtl(list.from) ? "rtl" : "ltr"]}
                    slotProps={{
                        paper: { sx: menuPaperSx },
                        list: { dense: true, "aria-label": showLabel },
                        transition: { onExited: () => setList(null) },
                    }}
                    onClose={closeList}
                >
                    {showPlaces.map(({ label, location, icon }, index) => (
                        <MenuItem
                            key={index}
                            sx={placeSx}
                            divider={index < showPlaces.length - 1}
                            onClick={() => showPlace(index)}
                        >
                            <ListItemIcon>
                                <IconSlot icon={icon} />
                            </ListItemIcon>
                            <ListItemText
                                sx={placeTextSx}
                                primary={<bdi>{label}</bdi>}
                                secondary={location ? <bdi>{location}</bdi> : undefined}
                                slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
                            />
                        </MenuItem>
                    ))}
                </Menu>
            )}
        </Box>
    );
};

export default NoticeBar;
