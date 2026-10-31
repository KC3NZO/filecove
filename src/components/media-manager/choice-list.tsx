import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { useThumbnail } from "../../hooks/use-thumbnail";
import { CHOICE_THUMBNAIL } from "../../styles/media-layout";
import { focusOutline, forcedColors, hoverBackground, visuallyHiddenSx } from "../../styles/mixins";
import { isolate } from "../../utils/bidi";
import { KIND_ICONS } from "../../utils/media";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import { FileTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";

import type { FileAdapter, MediaChoice } from "../../types";

interface ChoiceListProps {
    /** What's selected, in every library, in the order it's handed over in. */
    choices: readonly MediaChoice[];
    /** Serves the libraries that don't bring their own adapter, for the thumbnails. */
    adapter: FileAdapter;
    /** Whether the app has details for each pick, which a row's button, a click and Enter open. */
    hasDetails: boolean;
    /** The one whose details were open, to take the focus back as they close. */
    returnFocusTo: string | null;
    onRemove: (choice: MediaChoice) => void;
    /** Moves the one at `from` to `to`, the others making room. */
    onMove: (from: number, to: number) => void;
    onOpenDetails: (choice: MediaChoice) => void;
    /** How much of a pick the app's `errors` have to fix: its fields with one, and its own as one more. */
    problemsOf: ((choice: MediaChoice) => number) | undefined;
}

interface ChoiceRowProps {
    choice: MediaChoice;
    adapter: FileAdapter;
    index: number;
    count: number;
    /** Whether it has the list's Tab stop. */
    tabStop: boolean;
    /** Whether it's picked up from the keyboard, to be moved with the arrow keys. */
    lifted: boolean;
    /** Whether it's being dragged. */
    dragged: boolean;
    /** How far it's moved up or down while one is dragged, in px: the one dragged, or one making room. */
    shift: number;
    hasDetails: boolean;
    /** How many of its fields have an error, shown in place of its library. */
    problems: number;
    describedBy: string;
    onKeyDown: (event: KeyboardEvent<HTMLElement>, index: number) => void;
    onFocus: (index: number) => void;
    onBlur: (index: number) => void;
    onClick: (event: MouseEvent, index: number) => void;
    onRemove: (index: number) => void;
}

/** A pointer pressed on one of them, which drags it once it has moved, or been held on a touch screen. */
interface Press {
    pointerId: number;
    key: string;
    from: number;
    startX: number;
    startY: number;
    startScroll: number;
    /** The distance from one to the next, in px; they're all the same height. */
    slot: number;
    touch: boolean;
    started: boolean;
    timer: number | undefined;
}

interface Drag {
    key: string;
    from: number;
    to: number;
    /** How far the one dragged has moved, in px, scrolling included. */
    offset: number;
    /** The press's `slot`, which the others make room by. */
    slot: number;
}

interface Said {
    id: number;
    message: string;
}

// A pointer moving this far before a drag starts is a click or a scroll, in px.
const MOUSE_SLOP = 4;
const TOUCH_SLOP = 8;
// How long a finger is held still before a drag starts, so a swipe still scrolls the list, in ms.
const LONG_PRESS = 350;
// How near its top and bottom a drag scrolls the list, and by how much each move, in px.
const EDGE = 32;
const SCROLL_STEP = 10;

export const choiceKey = ({ asset, section }: MediaChoice) => `${section.id}\u0000${asset.id}`;

// One under the other, scrolling once they're taller than the column. While one is dragged, the
// others slide to make room for it; with no drag, they don't, so the order changing as it's
// dropped doesn't slide.
const listSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 0.25,
    flex: 1,
    minHeight: 0,
    m: 0,
    px: 1,
    py: 0.5,
    listStyle: "none",
    overflowY: "auto",
    '&[data-dragging="true"]': { cursor: "grabbing" },
    '&[data-dragging="true"] > li:not([data-dragged="true"])': { transition: "transform 150ms ease-out" },
    "@media (prefers-reduced-motion: reduce)": { "& > li": { transition: "none !important" } },
};

const rowSx: SxProps<Theme> = (theme) => ({
    position: "relative",
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    gap: 0.25,
    borderRadius: 2,
    bgcolor: "background.paper",
    "&:hover": { bgcolor: hoverBackground(theme) },
    '&[data-dragged="true"]': { zIndex: 1, boxShadow: 6 },
    '&[data-dragged="true"], &[data-dragged="true"]:hover': { bgcolor: "background.paper" },
    [forcedColors]: { '&[data-dragged="true"]': { outline: "2px solid Highlight" } },
});

// The row's main part: what it is, which drags it, and opens its details.
const handleSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1.25,
    flex: 1,
    minWidth: 0,
    p: 0.75,
    borderRadius: 2,
    cursor: "grab",
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
    WebkitTapHighlightColor: "transparent",
    outline: "none",
    "&:focus-visible": focusOutline,
    '&[data-lifted="true"]': { outline: "2px solid", outlineColor: "primary.main", outlineOffset: "-2px" },
    '[data-dragged="true"] > &': { cursor: "grabbing" },
    [forcedColors]: { '&[data-lifted="true"]': { outline: "2px solid Highlight" } },
};

const thumbnailSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: `${CHOICE_THUMBNAIL}rem`,
    height: `${CHOICE_THUMBNAIL}rem`,
    borderRadius: 1.5,
    overflow: "hidden",
    bgcolor: "action.hover",
    color: "text.secondary",
    "& > img": { width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" },
    [forcedColors]: { outline: "1px solid CanvasText" },
};

const textSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
};

const nameSx: SxProps<Theme> = {
    fontSize: "0.8125rem",
};

const librarySx: SxProps<Theme> = {
    color: "text.secondary",
    fontSize: "0.75rem",
};

const problemsSx: SxProps<Theme> = {
    ...librarySx,
    color: "error.main",
};

// Out of the Tab order: Enter opens the details, Delete takes one out.
const buttonSx: SxProps<Theme> = {
    flexShrink: 0,
    "& svg": { fontSize: 18 },
    '[data-dragging="true"] &': { visibility: "hidden" },
};

const lastButtonSx: SxProps<Theme> = {
    ...buttonSx,
    marginInlineEnd: 0.25,
};

/** One asset selected: its thumbnail, or its type's icon, its name and library, to drag or move, its details and a button taking it out. */
const ChoiceRow = ({
    choice,
    adapter,
    index,
    count,
    tabStop,
    lifted,
    dragged,
    shift,
    hasDetails,
    problems,
    describedBy,
    onKeyDown,
    onFocus,
    onBlur,
    onClick,
    onRemove,
}: ChoiceRowProps) => {
    const { text, formatNumber } = useLocale();
    const problemsId = useId();
    const { asset, section } = choice;
    const thumbnail = useThumbnail(asset, section.adapter ?? adapter, "list", CHOICE_THUMBNAIL);
    const name = isolate(asset.name);

    return (
        <Box
            component="li"
            data-choice-index={index}
            data-dragged={dragged}
            sx={rowSx}
            style={shift ? { transform: `translateY(${shift}px)` } : undefined}
        >
            <Box
                role="button"
                tabIndex={tabStop ? 0 : -1}
                data-handle
                data-key={choiceKey(choice)}
                data-lifted={lifted}
                aria-label={text.mediaChoiceItem(name, formatNumber(index + 1), formatNumber(count))}
                aria-describedby={problems > 0 ? `${problemsId} ${describedBy}` : describedBy}
                sx={handleSx}
                onKeyDown={(event) => onKeyDown(event, index)}
                onFocus={() => onFocus(index)}
                onBlur={() => onBlur(index)}
                onClick={(event) => onClick(event, index)}
                onContextMenu={(event) => event.preventDefault()}
            >
                <Box sx={thumbnailSx}>
                    {thumbnail ? (
                        <img src={thumbnail} alt="" draggable={false} />
                    ) : section.kind === "audio" ? (
                        <Icon name={KIND_ICONS.audio} fontSize="small" />
                    ) : (
                        <FileTypeIcon fileName={asset.name} size="60%" />
                    )}
                </Box>
                <Box sx={textSx} aria-hidden>
                    <Typography variant="body2" noWrap sx={nameSx}>
                        {asset.name}
                    </Typography>
                    {problems > 0 ? (
                        <Typography id={problemsId} variant="caption" noWrap sx={problemsSx}>
                            {text.mediaChoiceProblems(problems)}
                        </Typography>
                    ) : (
                        <Typography variant="caption" noWrap sx={librarySx}>
                            {section.label}
                        </Typography>
                    )}
                </Box>
            </Box>
            {hasDetails && (
                <TooltipIconButton
                    size="small"
                    tabIndex={-1}
                    label={text.mediaChoiceDetails(name)}
                    sx={buttonSx}
                    onClick={(event) => onClick(event, index)}
                >
                    <Icon name="edit" />
                </TooltipIconButton>
            )}
            <TooltipIconButton
                size="small"
                tabIndex={-1}
                label={text.mediaRemoveChoice(name)}
                sx={lastButtonSx}
                data-remove
                onClick={() => onRemove(index)}
            >
                <Icon name="close" />
            </TooltipIconButton>
        </Box>
    );
};

/**
 * The list of what's selected, in every library, in the order it's handed over in. Each is
 * dragged to another place, by the mouse or, held a moment, a finger, or picked up from the
 * keyboard with Space, moved with the arrow keys, and put down again, or put back with Escape. One
 * Tab stop, the arrow keys going from one to the next, Enter opening one's details and Delete
 * taking one out.
 */
const ChoiceList = ({
    choices,
    adapter,
    hasDetails,
    returnFocusTo,
    onRemove,
    onMove,
    onOpenDetails,
    problemsOf,
}: ChoiceListProps) => {
    const { text, formatNumber } = useLocale();
    const hintId = useId();
    const detailsHintId = useId();
    const listRef = useRef<HTMLUListElement>(null);
    const pressRef = useRef<Press | null>(null);
    const countRef = useRef(choices.length);
    // The one to have the focus once the choices have changed, as moving one may move its element.
    const focusRef = useRef<string | null>(returnFocusTo);
    const [focusKey, setFocusKey] = useState<string | null>(returnFocusTo);
    const [lifted, setLifted] = useState<{ key: string; from: number } | null>(null);
    const [drag, setDragState] = useState<Drag | null>(null);
    // The drag as it is now, for the pointer's handlers, which may come before a render.
    const dragRef = useRef<Drag | null>(null);
    // A drag just dropped, whose click isn't one.
    const draggedRef = useRef(false);
    const [said, setSaid] = useState<Said | null>(null);
    const keys = choices.map(choiceKey);
    const count = keys.length;
    const tabStop = focusKey !== null && keys.includes(focusKey) ? focusKey : keys[0];

    const setDrag = useCallback((next: Drag | null) => {
        dragRef.current = next;
        setDragState(next);
    }, []);

    const say = useCallback((message: string) => setSaid((last) => ({ id: (last?.id ?? 0) + 1, message })), []);

    // One's name and where it is, as the list's texts take them.
    const where = useCallback(
        (index: number) =>
            [isolate(choices[index]?.asset.name ?? ""), formatNumber(index + 1), formatNumber(count)] as const,
        [choices, formatNumber, count],
    );

    // Brings one just added into view, at the end.
    useEffect(() => {
        if (count > countRef.current) {
            listRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
        }

        countRef.current = count;
    }, [count]);

    // Gives the focus back to the one moved, whose element React may have moved and so blurred, to
    // the one after one taken out, or to the one whose details just closed.
    useLayoutEffect(() => {
        const key = focusRef.current;

        focusRef.current = null;

        if (key === null) {
            return;
        }

        const handle = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-handle]") ?? [])].find(
            (element) => element.dataset.key === key,
        );

        if (handle && document.activeElement !== handle) {
            handle.focus();
            handle.scrollIntoView({ block: "nearest" });
        }
    }, [choices]);

    // A finger dragging one would scroll the list too; once the drag has started, it doesn't.
    useEffect(() => {
        const list = listRef.current;

        if (!list) {
            return;
        }

        const hold = (event: TouchEvent) => {
            if (pressRef.current?.started) {
                event.preventDefault();
            }
        };

        list.addEventListener("touchmove", hold, { passive: false });

        return () => list.removeEventListener("touchmove", hold);
    }, []);

    useEffect(() => () => window.clearTimeout(pressRef.current?.timer), []);

    const moveTo = useCallback(
        (from: number, to: number) => {
            const key = keys[from];

            if (key === undefined || to === from || to < 0 || to >= count) {
                return false;
            }

            // The focus stays with it, when it was in the list.
            if (listRef.current?.contains(document.activeElement)) {
                focusRef.current = key;
            }

            setFocusKey(key);
            onMove(from, to);

            return true;
        },
        [keys, count, onMove],
    );

    const remove = useCallback(
        (index: number) => {
            const choice = choices[index];

            if (!choice) {
                return;
            }

            // The focus in the list goes to the next one, or the one before at the end.
            if (listRef.current?.contains(document.activeElement)) {
                const next = keys[index + 1] ?? keys[index - 1] ?? null;

                focusRef.current = next;
                setFocusKey(next);
            }

            if (lifted?.key === keys[index]) {
                setLifted(null);
            }

            onRemove(choice);
        },
        [choices, keys, lifted, onRemove],
    );

    const openDetails = useCallback(
        (index: number) => {
            const choice = choices[index];

            if (choice && hasDetails) {
                setLifted(null);
                onOpenDetails(choice);
            }
        },
        [choices, hasDetails, onOpenDetails],
    );

    const handleClick = useCallback(
        (event: MouseEvent, index: number) => {
            if (draggedRef.current) {
                draggedRef.current = false;

                return;
            }

            event.stopPropagation();
            openDetails(index);
        },
        [openDetails],
    );

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLElement>, index: number) => {
            const key = keys[index];
            const target =
                event.key === "ArrowUp"
                    ? index - 1
                    : event.key === "ArrowDown"
                      ? index + 1
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? count - 1
                          : undefined;
            // Space picks one up and puts it down; Enter does too while there are no details to open.
            const lifts = event.key === " " || (event.key === "Enter" && !hasDetails);

            if (key === undefined || event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }

            if (lifted?.key === key) {
                if (target !== undefined) {
                    event.preventDefault();

                    const to = Math.max(0, Math.min(count - 1, target));

                    if (moveTo(index, to)) {
                        say(text.mediaChoiceMoved(where(index)[0], formatNumber(to + 1), formatNumber(count)));
                    }
                } else if (lifts || event.key === "Enter") {
                    event.preventDefault();
                    setLifted(null);
                    say(text.mediaChoiceDropped(...where(index)));
                } else if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    setLifted(null);
                    moveTo(index, lifted.from);
                    say(text.mediaChoiceCancelled(where(index)[0], formatNumber(lifted.from + 1), formatNumber(count)));
                }

                return;
            }

            if (target !== undefined) {
                event.preventDefault();

                const to = Math.max(0, Math.min(count - 1, target));
                const handle = listRef.current?.querySelectorAll<HTMLElement>("[data-handle]")[to];

                handle?.focus();
                handle?.scrollIntoView({ block: "nearest" });
            } else if (lifts) {
                event.preventDefault();

                if (count > 1) {
                    setLifted({ key, from: index });
                    say(text.mediaChoicePickedUp(...where(index)));
                }
            } else if (event.key === "Enter") {
                event.preventDefault();
                openDetails(index);
            } else if (event.key === "Delete" || event.key === "Backspace") {
                event.preventDefault();
                remove(index);
            }
        },
        [keys, count, hasDetails, lifted, moveTo, say, text, where, formatNumber, remove, openDetails],
    );

    const handleFocus = useCallback((index: number) => setFocusKey(keys[index] ?? null), [keys]);

    // Leaving it puts what's picked up down where it is, unless the focus comes straight back, as it
    // does when moving it moved its element.
    const handleBlur = useCallback(
        (index: number) => {
            const key = keys[index];

            queueMicrotask(() => {
                const active = document.activeElement;
                const focused = active instanceof HTMLElement ? active.dataset.key : undefined;

                setLifted((current) => (current?.key === key && focused !== key ? null : current));
            });
        },
        [keys],
    );

    const endPress = useCallback(
        (commit: boolean) => {
            const press = pressRef.current;

            pressRef.current = null;
            window.clearTimeout(press?.timer);

            if (press?.started && listRef.current?.hasPointerCapture(press.pointerId)) {
                listRef.current.releasePointerCapture(press.pointerId);
            }

            const current = dragRef.current;

            setDrag(null);

            if (press?.started) {
                // The click that may follow is the drag's end, not a click on the row.
                draggedRef.current = true;
                window.setTimeout(() => {
                    draggedRef.current = false;
                });
            }

            if (commit && current) {
                const from = keys.indexOf(current.key);

                if (from !== -1 && current.to !== from && moveTo(from, current.to)) {
                    say(text.mediaChoiceMoved(where(from)[0], formatNumber(current.to + 1), formatNumber(count)));
                }
            }
        },
        [keys, moveTo, say, text, where, formatNumber, count, setDrag],
    );

    const start = useCallback(() => {
        const press = pressRef.current;
        const list = listRef.current;

        if (!press || !list) {
            return;
        }

        press.started = true;

        try {
            list.setPointerCapture(press.pointerId);
        } catch {
            // The pointer has gone already; its `pointerup` or `pointercancel` ends the press.
        }

        setLifted(null);
        setDrag({ key: press.key, from: press.from, to: press.from, offset: 0, slot: press.slot });
    }, [setDrag]);

    const handlePointerDown = (event: PointerEvent<HTMLUListElement>) => {
        const list = listRef.current;
        const target = event.target as Element;
        const row = target.closest<HTMLElement>("[data-choice-index]");

        // Only the row's main part drags it; its buttons are buttons.
        if (!list || !row || event.button !== 0 || count < 2 || !target.closest("[data-handle]")) {
            return;
        }

        const index = Number(row.dataset.choiceIndex);
        const key = keys[index];
        const [first, second] = list.children as HTMLCollectionOf<HTMLElement>;
        const touch = event.pointerType === "touch";

        if (key === undefined || !first || !second) {
            return;
        }

        window.clearTimeout(pressRef.current?.timer);
        pressRef.current = {
            pointerId: event.pointerId,
            key,
            from: index,
            startX: event.clientX,
            startY: event.clientY,
            startScroll: list.scrollTop,
            slot: second.offsetTop - first.offsetTop,
            touch,
            started: false,
            timer: touch ? window.setTimeout(start, LONG_PRESS) : undefined,
        };
    };

    const handlePointerMove = (event: PointerEvent<HTMLUListElement>) => {
        const press = pressRef.current;
        const list = listRef.current;

        if (!press || !list || event.pointerId !== press.pointerId) {
            return;
        }

        const dx = event.clientX - press.startX;
        const dy = event.clientY - press.startY;

        if (!press.started) {
            const moved = Math.max(Math.abs(dx), Math.abs(dy));

            if (press.touch) {
                // Moved before the long press: it's a swipe, which the browser scrolls.
                if (moved > TOUCH_SLOP) {
                    endPress(false);
                }
            } else if (moved > MOUSE_SLOP) {
                start();
            }

            return;
        }

        const bounds = list.getBoundingClientRect();

        if (event.clientY < bounds.top + EDGE) {
            list.scrollTop -= SCROLL_STEP;
        } else if (event.clientY > bounds.bottom - EDGE) {
            list.scrollTop += SCROLL_STEP;
        }

        const offset = dy + (list.scrollTop - press.startScroll);
        const to = Math.max(0, Math.min(count - 1, press.from + Math.round(offset / press.slot)));

        setDrag({ key: press.key, from: press.from, to, offset, slot: press.slot });
    };

    // While one is dragged, those between where it was and where it's going move a place towards
    // where it was, to make room.
    const shiftOf = (index: number) => {
        if (!drag) {
            return 0;
        }

        if (index === drag.from) {
            return drag.offset;
        }

        if (drag.from < drag.to && index > drag.from && index <= drag.to) {
            return -drag.slot;
        }

        if (drag.to < drag.from && index >= drag.to && index < drag.from) {
            return drag.slot;
        }

        return 0;
    };

    const describedBy = hasDetails ? `${hintId} ${detailsHintId}` : hintId;

    return (
        <>
            <Box
                component="ul"
                ref={listRef}
                aria-label={text.mediaChosen}
                data-dragging={!!drag}
                sx={listSx}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={() => endPress(true)}
                onPointerCancel={() => endPress(false)}
                onLostPointerCapture={() => pressRef.current?.started && endPress(true)}
            >
                {choices.map((choice, index) => (
                    <ChoiceRow
                        key={keys[index]}
                        choice={choice}
                        adapter={adapter}
                        index={index}
                        count={count}
                        tabStop={keys[index] === tabStop}
                        lifted={lifted?.key === keys[index]}
                        dragged={drag?.key === keys[index]}
                        shift={shiftOf(index)}
                        hasDetails={hasDetails}
                        problems={problemsOf?.(choice) ?? 0}
                        describedBy={describedBy}
                        onKeyDown={handleKeyDown}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onClick={handleClick}
                        onRemove={remove}
                    />
                ))}
            </Box>
            <Box component="span" id={hintId} sx={visuallyHiddenSx}>
                {text.mediaChoicesHint}
            </Box>
            <Box component="span" id={detailsHintId} sx={visuallyHiddenSx}>
                {text.mediaChoicesDetailsHint}
            </Box>
            <Box component="span" role="status" sx={visuallyHiddenSx}>
                {said && <span key={said.id}>{said.message}</span>}
            </Box>
        </>
    );
};

export default ChoiceList;
