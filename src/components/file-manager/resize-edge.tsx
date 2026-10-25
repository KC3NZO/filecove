import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent, RefObject } from "react";

import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import { forcedColors } from "../../styles/mixins";
import { isRtl } from "../../utils/dom";
import { clampWidth } from "../../utils/resize";

interface ResizeEdgeProps {
    /**
     * The docked panel it resizes. While the edge is dragged the panel's width is set on it
     * through `cssVar`, without rendering, and its width as shown is what screen readers are told.
     */
    target: RefObject<HTMLElement | null>;
    /** Names the edge for screen readers. */
    label: string;
    /** The id of the panel. */
    controls: string;
    /** Which side of the panel the edge is on, the start or the end, as the panel's text runs. */
    placement: "start" | "end";
    /** The width asked for, in px, within `min` and `max`. */
    width: number;
    /** The width a double click puts back. */
    defaultWidth: number;
    min: number;
    max: number;
    /** How far an arrow key moves the edge, in px. */
    step: number;
    /** The custom property on the panel that its width is read from, such as `--sidebar-width`. */
    cssVar: string;
    /**
     * How wide the panel can be made now, in px: what the room around it leaves it beside the
     * least the content keeps. Asked as a drag or a key needs it, and as the layout changes.
     */
    widest: () => number;
    /** The user resized the panel to `width`: as a drag ends, with a key, or with a double click. */
    onChange: (width: number) => void;
}

/** A drag of the edge under way. */
interface EdgeDrag {
    pointerId: number;
    /** Where the pointer went down, from the viewport's left. */
    startX: number;
    /** The width shown as it went down. */
    from: number;
    /** The widest it can go, as of the press. */
    widest: number;
    /** Whether moving the pointer left, rather than right, widens the panel. */
    leftWidens: boolean;
    /** The width it's dragged to so far. */
    width: number;
}

// The edge of a docked panel, which resizes it: a strip along the panel's side, wider on a touch
// screen, showing a grip as it's pointed at, held, dragged or focused. It sits over the gap beside
// the panel, or on the boundary where there's none, so it hardly takes a scrollbar's place.
const edgeStyle = {
    position: "absolute",
    zIndex: 1,
    top: 0,
    bottom: 0,
    width: 10,
    cursor: "col-resize",
    touchAction: "none",
    userSelect: "none",
    outline: "none",
    "&::after": {
        content: '""',
        position: "absolute",
        top: "50%",
        insetInlineStart: "calc(50% - 2px)",
        width: 4,
        height: 48,
        translate: "0 -50%",
        borderRadius: 2,
        bgcolor: "text.disabled",
        opacity: 0,
        transition: "opacity 150ms, height 150ms",
    },
    "&:hover::after": { opacity: 1 },
    '&:focus-visible::after, &[data-dragging="true"]::after': {
        opacity: 1,
        height: 72,
        bgcolor: "primary.main",
    },
    [forcedColors]: {
        "&::after": { backgroundColor: "CanvasText" },
        '&:focus-visible::after, &[data-dragging="true"]::after': { backgroundColor: "Highlight" },
    },
} satisfies SxProps<Theme>;

const startSx: SxProps<Theme> = {
    ...edgeStyle,
    insetInlineStart: -6,
    "@media (hover: none)": { width: 22 },
};

// Centred on the boundary with the content, which touches the panel, a little over each side, so
// it takes only a few pixels of the tree's scrollbar.
const endSx: SxProps<Theme> = {
    ...edgeStyle,
    insetInlineEnd: -4,
    width: 8,
    "@media (hover: none)": { insetInlineEnd: -10, width: 20 },
};

/**
 * The edge that resizes a docked panel, the sidebar's or the properties': dragged with a mouse, a
 * pen or a finger, or moved with the arrow keys, Home and End, as a window splitter is, and put
 * back with a double click. A drag moves the panel without rendering and asks for the width once,
 * as it ends. It never takes the room the content needs, or the other panel's (`widest`).
 */
const ResizeEdge = ({
    target,
    label,
    controls,
    placement,
    width,
    defaultWidth,
    min,
    max,
    step,
    cssVar,
    widest,
    onChange,
}: ResizeEdgeProps) => {
    const edgeRef = useRef<HTMLDivElement>(null);
    const drag = useRef<EdgeDrag | null>(null);
    // The panel's width as it's shown, which the room around it can make narrower than asked, and
    // how wide it can go, for screen readers.
    const [shown, setShown] = useState(width);
    const [most, setMost] = useState(max);
    const latest = useRef({ width, defaultWidth, widest, onChange });

    useLayoutEffect(() => {
        latest.current = { width, defaultWidth, widest, onChange };
    });

    const measure = () => {
        const element = target.current;

        // While it's dragged, the width is set directly, and the attributes with it.
        if (!element || drag.current) {
            return;
        }

        setShown(Math.round(element.getBoundingClientRect().width));
        setMost(clampWidth(latest.current.widest(), min, max));
    };
    const measureRef = useRef(measure);

    useLayoutEffect(() => {
        measureRef.current = measure;
    });

    // The room around the panel changes with the panels' own widths and the file manager's.
    useEffect(() => {
        const element = target.current;

        if (!element) {
            return;
        }

        const observer = new ResizeObserver(() => measureRef.current());

        observer.observe(element);

        if (element.parentElement) {
            observer.observe(element.parentElement);
        }

        measureRef.current();

        return () => observer.disconnect();
    }, [target]);

    // The edge going while it's dragged, as the panel hides or stops docking, calls the drag off,
    // putting back the width, which React wouldn't, since what it renders didn't change.
    useEffect(
        () => () => {
            if (drag.current) {
                drag.current = null;
                target.current?.style.setProperty(cssVar, `${latest.current.width}px`);
            }
        },
        [target, cssVar],
    );

    // Shows the panel at `next` while the edge is dragged, without rendering anything.
    const showWidth = (next: number) => {
        target.current?.style.setProperty(cssVar, `${next}px`);
        edgeRef.current?.setAttribute("aria-valuenow", String(next));
    };

    // Ends a drag: the width it was dragged to is asked for, and the width given shows again at
    // once, so a width the consumer refuses snaps back, and one they take comes in the same commit.
    const endDrag = (commit: boolean) => {
        const current = drag.current;

        if (!current) {
            return;
        }

        drag.current = null;

        const edge = edgeRef.current;

        if (edge) {
            delete edge.dataset.dragging;

            if (edge.hasPointerCapture(current.pointerId)) {
                edge.releasePointerCapture(current.pointerId);
            }
        }

        const { width: asked, onChange: report } = latest.current;

        target.current?.style.setProperty(cssVar, `${asked}px`);
        edge?.setAttribute("aria-valuenow", String(shown));

        if (commit && current.width !== Math.round(current.from)) {
            report(current.width);
        }

        // The width the panel has now, once the change is made or refused.
        measureRef.current();
    };

    const wideningKey = (element: HTMLElement) =>
        (placement === "start") === !isRtl(element) ? "ArrowLeft" : "ArrowRight";

    // A press on the edge doesn't take the focus from where it is, nor select text.
    const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => event.preventDefault();

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        const element = target.current;

        if (!element || event.button !== 0 || drag.current) {
            return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.dataset.dragging = "true";

        const from = element.getBoundingClientRect().width;

        drag.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            from,
            widest: clampWidth(latest.current.widest(), min, max),
            leftWidens: wideningKey(element) === "ArrowLeft",
            width: Math.round(from),
        };
    };

    // The panel follows the pointer, widening as it goes away from the panel.
    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const current = drag.current;

        if (!current || current.pointerId !== event.pointerId) {
            return;
        }

        const moved = event.clientX - current.startX;

        current.width = clampWidth(current.from + (current.leftWidens ? -moved : moved), min, current.widest);
        showWidth(current.width);
    };

    const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
        if (drag.current?.pointerId === event.pointerId) {
            endDrag(true);
        }
    };

    // A drag the browser takes over, as for a gesture of its own, is called off.
    const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
        if (drag.current?.pointerId === event.pointerId) {
            endDrag(false);
        }
    };

    // The arrow keys move the edge the way they point, a step at a time, and Home and End make the
    // panel as narrow and as wide as it goes, each asked for at once. Escape calls a drag off, and
    // otherwise is the panel's.
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const element = target.current;

        if (event.key === "Escape" && drag.current) {
            event.preventDefault();
            endDrag(false);

            return;
        }

        if (!element || drag.current || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
            return;
        }

        const widestNow = clampWidth(latest.current.widest(), min, max);
        const now = clampWidth(element.getBoundingClientRect().width, min, widestNow);
        const widening = wideningKey(element);
        let next: number;

        if (event.key === widening) {
            next = now + step;
        } else if (event.key === (widening === "ArrowLeft" ? "ArrowRight" : "ArrowLeft")) {
            next = now - step;
        } else if (event.key === "Home") {
            next = min;
        } else if (event.key === "End") {
            next = widestNow;
        } else {
            return;
        }

        event.preventDefault();
        next = clampWidth(next, min, widestNow);

        if (next !== now) {
            latest.current.onChange(next);
        }
    };

    // A double click puts the width back to where it started.
    const handleDoubleClick = () => latest.current.onChange(clampWidth(latest.current.defaultWidth, min, max));

    return (
        <Box
            ref={edgeRef}
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label={label}
            aria-controls={controls}
            aria-valuenow={shown}
            aria-valuemin={min}
            aria-valuemax={most}
            sx={placement === "start" ? startSx : endSx}
            onMouseDown={handleMouseDown}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onLostPointerCapture={handlePointerCancel}
            // What can be moved to changes with the room around the panel.
            onFocus={() => measureRef.current()}
            onKeyDown={handleKeyDown}
            onDoubleClick={handleDoubleClick}
        />
    );
};

export default ResizeEdge;
