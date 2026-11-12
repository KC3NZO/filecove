import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, MouseEvent } from "react";

import { useLocale } from "../../hooks/use-locale";
import { isRtl } from "../../utils/dom";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import Icon from "../icons/icon";
import IconSlot from "../icons/icon-slot";
import Button from "../ui/button";
import Menu, { MenuIcon, MenuItem, MenuText } from "../ui/menu";
import { fmClasses } from "../../styles/classes";
import { cx } from "../../utils/cx";
import styles from "./notice-bar.module.css";

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

/** How long a notice takes to shrink away, in ms, as its stylesheet has it (`.content`). */
const LEAVE_FOR = 195;

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

    // Once it has shrunk away it's gone, and no longer under the pointer, which leaves no
    // `mouseleave` behind. Timed rather than waited for, so it goes where nothing animates too.
    useEffect(() => {
        if (notice || !shown) {
            return;
        }

        const timer = window.setTimeout(() => {
            setShown(null);
            setHovered(false);
            setFocused(false);
        }, LEAVE_FOR);

        return () => window.clearTimeout(timer);
    }, [notice, shown]);

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
        <div className={styles.area} data-raised={raised}>
            <div
                ref={rootRef}
                className={cx(styles.content, fmClasses.notice)}
                data-leaving={!notice}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
            >
                <div className={styles.message}>
                    <div>{shown.message}</div>
                    {shown.detail && <div className={styles.detail}>{shown.detail}</div>}
                </div>
                <div className={styles.action}>
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
                    <TooltipIconButton ref={closeRef} label={text.close} color="inherit" size="small" onClick={onClose}>
                        <Icon name="close" fontSize="small" />
                    </TooltipIconButton>
                </div>
            </div>
            {/* Above the notice, which sits at the bottom of the content, hanging from Show's end edge. */}
            {showPlaces && list && (
                <Menu
                    open={listOpen}
                    anchor={list.from}
                    rtl={isRtl(list.from)}
                    side="top"
                    align="end"
                    label={showLabel}
                    onClose={closeList}
                    onExited={() => setList(null)}
                >
                    {showPlaces.map(({ label, location, icon }, index) => (
                        <MenuItem
                            key={index}
                            className={styles.place}
                            divider={index < showPlaces.length - 1}
                            onClick={() => showPlace(index)}
                        >
                            <MenuIcon>
                                <IconSlot icon={icon} />
                            </MenuIcon>
                            <MenuText noWrap secondary={location ? <bdi>{location}</bdi> : undefined}>
                                <bdi>{label}</bdi>
                            </MenuText>
                        </MenuItem>
                    ))}
                </Menu>
            )}
        </div>
    );
};

export default NoticeBar;
