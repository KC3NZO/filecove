import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent, Ref, SyntheticEvent } from "react";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../../hooks/use-locale";
import { PREVIEW_IMAGE_CONTAINER, previewImageWide } from "../../../styles/layout";
import { pressedKeys } from "../../../utils/shortcut";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";

import type { Room } from "../../../hooks/use-swipe";

/** What the preview hands the image it shows. */
export interface ImageViewerHandle {
    /** Takes a key pressed anywhere in the preview, and says whether it did anything with it. */
    keyDown: (event: KeyboardEvent) => boolean;
    /**
     * How far the zoomed image pans with a finger moving left and right before a swipe takes over
     * the rest of the way, to step to another file; null while it fits the view.
     */
    room: () => Room | null;
}

interface ImageViewerProps {
    ref?: Ref<ImageViewerHandle>;
    src: string;
    alt: string;
    /** A small picture of it, the grid's thumbnail, shown in its place until it has loaded. */
    placeholder?: string | null;
    /** Its own size, when the listing says (`FileEntry.media`), so the placeholder takes its place exactly. */
    expected?: { width: number; height: number };
    /** Called with the image's own size once it has loaded. */
    onLoad: (width: number, height: number) => void;
    onError: () => void;
}

interface Size {
    width: number;
    height: number;
}

/** A point in the view, in px from its top left corner. */
interface Point {
    x: number;
    y: number;
}

/** How the zoomed image is shown: its scale, and where its top left corner is in the view. */
interface Zoom extends Point {
    scale: number;
}

/** Where the image is drawn: its centre in the view, its scale, and how far it's turned, in degrees. */
interface Placement {
    cx: number;
    cy: number;
    scale: number;
    angle: number;
}

/** The pointers pressed on the image, as they were when the last one went down or up. */
interface Gesture {
    /** The zoom they started from, the fitted one when the image wasn't zoomed. */
    from: Zoom;
    /** The point between them. */
    centre: Point;
    /** How far apart the first two were, or 0 for one pointer, which only pans. */
    spread: number;
}

/** A press that may turn out to be a tap, or the tap that came before one. */
interface Tap {
    /** Where it was in the view, to zoom at. */
    point: Point;
    /** And on the screen, which the view moves across while it's swiped. */
    screen: Point;
    time: number;
}

/** Where a finger was on the screen, and when, for its speed as it lifts. */
interface Sample extends Point {
    time: number;
}

/**
 * A pinch on a Mac's touchpad in Safari, which sends it as gesture events rather than as Ctrl+wheel.
 * `scale` is how far the fingers have spread since it began. Not in TypeScript's DOM types.
 */
interface GestureLike extends UIEvent {
    scale: number;
    clientX: number;
    clientY: number;
}

/** Such a pinch under way: the zoom it started from, and where. */
interface Pinch {
    from: Zoom;
    anchor: Point;
}

/** The room left around an image fitted to the view, on every side, in px. */
const GAP = 16;
/** What a step zooms in or out by: two steps double or halve the image. */
const STEP = Math.SQRT2;
/** How far in the image zooms, unless filling the view with a small one takes more. */
const MAX_SCALE = 16;
/** From this scale up the image's pixels show as squares, as image editors show them, rather than blurred together. */
const PIXELATED_SCALE = 4;
/** How much of the view an arrow key pans the zoomed image by. */
const PAN_FRACTION = 0.125;
/** A wheel's line, for browsers that count its turns in lines, in px. */
const LINE_HEIGHT = 40;
/** How far a press may move and still be a tap, in px. */
const TAP_TOLERANCE = 10;
/** How soon after a tap, and how near it, a second tap makes a double tap, in ms and px. */
const DOUBLE_TAP_TIME = 300;
const DOUBLE_TAP_DISTANCE = 30;
/** How long a zoom step, a turn or a pan by a key takes to get there, in ms. */
const DURATION = 200;
/** How the image glides on after a flick: its speed falls by e every this many ms. */
const FRICTION = 325;
/** How fast a finger lifting has to be going for the image to glide on, and how slow it stops at, in px per ms. */
const GLIDE_SPEED = 0.2;
const STOP_SPEED = 0.02;
/** How far back the finger's speed is measured from as it lifts, in ms. */
const SPEED_WINDOW = 100;
/** The longest a frame of a glide counts for, in ms, so a stall doesn't throw the image across. */
const MAX_FRAME = 32;

/** How the arrow keys pan the zoomed image: Left shows more of its left side, and so on. */
const PAN_KEYS: Partial<Record<string, Point>> = {
    ArrowLeft: { x: 1, y: 0 },
    ArrowRight: { x: -1, y: 0 },
    ArrowUp: { x: 0, y: 1 },
    ArrowDown: { x: 0, y: -1 },
};

/**
 * The keys that zoom and turn: in ("+", or "=" beside it on a US layout), out, to fit, to the
 * image's own size, and R to turn it clockwise, or with Shift, counterclockwise.
 */
const IMAGE_KEYS = ["+", "=", "-", "0", "1", "r"];

const ORIGIN: Point = { x: 0, y: 0 };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const centreOf = (points: Point[]) => ({
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
});

/** Where an event happened in `element`, in px from its top left corner. */
const pointIn = (element: Element, { clientX, clientY }: { clientX: number; clientY: number }) => {
    const rect = element.getBoundingClientRect();

    return { x: clientX - rect.left, y: clientY - rect.top };
};

const screenPoint = ({ clientX, clientY }: { clientX: number; clientY: number }) => ({ x: clientX, y: clientY });

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Decelerating, as something settling into place does.
const easeOut = (progress: number) => 1 - (1 - progress) ** 3;

const recent = (samples: Sample[], now: number) => samples.filter(({ time }) => now - time <= SPEED_WINDOW);

/** The image's own size as it's shown turned: its sides swapped by a quarter or three quarters of a turn. */
const turned = (image: Size, turns: number): Size =>
    Math.abs(turns) % 2 === 1 ? { width: image.height, height: image.width } : image;

/** The scale that fits the image into the view, as large as it goes without stretching it past its own size. */
const fitScale = (image: Size, view: Size) =>
    Math.min(1, (view.width - 2 * GAP) / image.width, (view.height - 2 * GAP) / image.height);

const maxScale = (image: Size, view: Size) =>
    Math.max(MAX_SCALE, Math.min((view.width - 2 * GAP) / image.width, (view.height - 2 * GAP) / image.height));

/** One step in or out from `scale`, stopping at the image's own size on the way past it. */
const stepScale = (scale: number, direction: 1 | -1) => {
    const next = direction > 0 ? scale * STEP : scale / STEP;

    return (scale - 1) * (next - 1) < 0 ? 1 : next;
};

/**
 * Where an image `length` long goes along an axis of the view `extent` long: centred where it
 * fits, and otherwise as near `offset` as it goes while still covering the view.
 */
const placeAlong = (offset: number, length: number, extent: number) =>
    length <= extent ? (extent - length) / 2 : clamp(offset, extent - length, 0);

const settle = (zoom: Zoom, image: Size, view: Size): Zoom => ({
    scale: zoom.scale,
    x: placeAlong(zoom.x, image.width * zoom.scale, view.width),
    y: placeAlong(zoom.y, image.height * zoom.scale, view.height),
});

/** The image fitted to the view, as it shows unzoomed. */
const fitted = (image: Size, view: Size) => settle({ scale: fitScale(image, view), ...ORIGIN }, image, view);

/**
 * `from` zoomed to `scale`, as far as the view allows, with the point of the image that was at
 * `anchor` moved to `target`, or null once the image is back to fitting the view.
 */
const zoomTo = (from: Zoom, scale: number, anchor: Point, target: Point, image: Size, view: Size): Zoom | null => {
    const fit = fitScale(image, view);
    const next = clamp(scale, fit, maxScale(image, view));

    // Rounding can leave a step back down a hair above the fit.
    if (next - fit < 1e-9) {
        return null;
    }

    const ratio = next / from.scale;

    return settle(
        { scale: next, x: target.x - (anchor.x - from.x) * ratio, y: target.y - (anchor.y - from.y) * ratio },
        image,
        view,
    );
};

/** Where a zoom draws the image, `box` being its own size as turned. */
const placementOf = (zoom: Zoom, box: Size, turns: number): Placement => ({
    cx: zoom.x + (box.width * zoom.scale) / 2,
    cy: zoom.y + (box.height * zoom.scale) / 2,
    scale: zoom.scale,
    angle: turns * 90,
});

const samePlacement = (a: Placement, b: Placement) =>
    Math.abs(a.cx - b.cx) < 0.5 &&
    Math.abs(a.cy - b.cy) < 0.5 &&
    Math.abs(a.scale - b.scale) < 1e-6 &&
    a.angle === b.angle;

/**
 * Part of the way from one placement to another: the scale by equal ratios, so each frame zooms
 * by as much, and the turn evenly. Zooming at `anchor`, the point of the image under it stays
 * there, and what keeping the image over the view moves it by is made up along the way.
 */
const between = (from: Placement, to: Placement, progress: number, anchor?: Point): Placement => {
    const scale = from.scale * (to.scale / from.scale) ** progress;
    const angle = from.angle + (to.angle - from.angle) * progress;

    if (!anchor) {
        return {
            cx: from.cx + (to.cx - from.cx) * progress,
            cy: from.cy + (to.cy - from.cy) * progress,
            scale,
            angle,
        };
    }

    const grown = scale / from.scale;
    const full = to.scale / from.scale;

    return {
        cx: anchor.x + (from.cx - anchor.x) * grown + (to.cx - (anchor.x + (from.cx - anchor.x) * full)) * progress,
        cy: anchor.y + (from.cy - anchor.y) * grown + (to.cy - (anchor.y + (from.cy - anchor.y) * full)) * progress,
        scale,
        angle,
    };
};

// A container, so the toolbar fits its buttons to the room the image has.
const viewerSx: SxProps<Theme> = {
    position: "relative",
    alignSelf: "stretch",
    flex: 1,
    minWidth: 0,
    containerType: "inline-size",
    containerName: PREVIEW_IMAGE_CONTAINER,
};

// The browser's own touch gestures are off, so a pinch zooms the image rather than the page.
const stageSx: SxProps<Theme> = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    touchAction: "none",
    userSelect: "none",
    '&[data-zoomed="true"]': { cursor: "grab" },
    '&[data-zoomed="true"]:active': { cursor: "grabbing" },
};

// Shrunk to fit, never stretched past its own size.
const fittedImageSx: SxProps<Theme> = {
    display: "block",
    maxWidth: `calc(100% - ${2 * GAP}px)`,
    maxHeight: `calc(100% - ${2 * GAP}px)`,
};

// Placed, sized, moved and turned through `style`, from the zoom.
const zoomedImageSx: SxProps<Theme> = {
    display: "block",
    position: "absolute",
    maxWidth: "none",
    maxHeight: "none",
};

// Where the image will be once it has loaded: fitted the same way, its own size when that's known,
// with the small picture drawn into that box, or else as large as the view allows.
const placeholderSx: SxProps<Theme> = {
    position: "absolute",
    inset: 0,
    m: "auto",
    width: "100%",
    height: "100%",
    maxWidth: `calc(100% - ${2 * GAP}px)`,
    maxHeight: `calc(100% - ${2 * GAP}px)`,
    objectFit: "contain",
    pointerEvents: "none",
};

const spinnerSx: SxProps<Theme> = {
    position: "absolute",
    inset: 0,
    m: "auto",
};

const toolbarSx: SxProps<Theme> = {
    position: "absolute",
    bottom: 12,
    insetInlineEnd: 12,
    display: "flex",
    alignItems: "center",
    gap: 0.25,
    p: 0.5,
    border: 1,
    borderColor: "divider",
    borderRadius: "999px",
    bgcolor: "background.default",
    boxShadow: 2,
};

const ruleSx: SxProps<Theme> = {
    alignSelf: "stretch",
    width: "1px",
    my: 0.5,
    mx: 0.25,
    bgcolor: "divider",
};

// Left out where the image has little room, so the buttons still fit on a phone.
const percentSx: SxProps<Theme> = {
    display: "none",
    minWidth: "3.5em",
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    [previewImageWide]: { display: "block" },
};

/**
 * An image in the preview, which zooms, pans and turns: Ctrl+wheel or a touchpad pinch zooms at the
 * pointer (Safari's gesture events too), a pinch on a touch screen between the fingers, and a double
 * click or double tap toggles between fitting the view and a closer look. Zoomed in, it pans by
 * dragging, gliding on after a flick on touch, with the wheel and with the arrow keys. The buttons in
 * the corner zoom around the view's centre, as do +, -, 0 (fit) and 1 (the image's own size), and
 * turn it a quarter, as do R and Shift+R, which the preview hands over through `ref`. Steps by a
 * button or a key are animated, unless motion is reduced. Fitted, a swipe is left to the preview, to
 * step to another file; zoomed, it takes over once the image has panned to its edge.
 *
 * Unzoomed and unturned, the image is laid out to fit by CSS alone, so it follows the view's size
 * without waiting on a measure; otherwise it's placed from its own size and the view's.
 */
const ImageViewer = ({ ref, src, alt, placeholder, expected, onLoad, onError }: ImageViewerProps) => {
    const { text, formatPercent } = useLocale();
    const stageRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    // The image's own size once it has loaded, unturned, and the view's, for rendering. Handlers
    // read both afresh from the elements.
    const [image, setImage] = useState<Size | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [view, setView] = useState<Size | null>(null);
    // Null while the image fits the view. Changed only through `commit`, which keeps the ref in
    // step at once, so pointer moves between renders build on the latest zoom.
    const [zoom, setZoom] = useState<Zoom | null>(null);
    const zoomRef = useRef<Zoom | null>(null);
    // Quarter turns clockwise, counted on rather than wrapped round, so each turn animates the short way.
    const [turns, setTurns] = useState(0);
    const turnsRef = useRef(0);
    // While a step animates, where the image is drawn meanwhile; the zoom and the turns are already
    // where it's going, so a key pressed meanwhile steps on from there.
    const [frame, setFrame] = useState<Placement | null>(null);
    const frameRef = useRef<Placement | null>(null);
    const animation = useRef(0);
    const glide = useRef(0);
    // Where each pointer is on the screen.
    const pointers = useRef(new Map<number, Point>());
    // Where the view was on the screen as the pointers last changed. Points are taken from there
    // while they move, as the preview's swipe moves the view once the image has panned to its edge.
    const origin = useRef<Point>(ORIGIN);
    const gesture = useRef<Gesture | null>(null);
    const press = useRef<Tap | null>(null);
    const lastTap = useRef<Tap | null>(null);
    const pointerType = useRef("");
    const samples = useRef<Sample[]>([]);
    const pinch = useRef<Pinch | null>(null);

    const commit = (next: Zoom | null) => {
        zoomRef.current = next;
        setZoom(next);
    };

    const turn = (next: number) => {
        turnsRef.current = next;
        setTurns(next);
    };

    const showFrame = (next: Placement | null) => {
        frameRef.current = next;
        setFrame(next);
    };

    // The image's own size and as it's shown turned, and the view's.
    const sizes = () => {
        const stage = stageRef.current;
        const img = imageRef.current;

        if (!stage || !img?.complete || !img.naturalWidth || !img.naturalHeight) {
            return null;
        }

        const own = { width: img.naturalWidth, height: img.naturalHeight };

        return {
            own,
            image: turned(own, turnsRef.current),
            view: { width: stage.clientWidth, height: stage.clientHeight },
        };
    };

    // Ends a step's animation where it was going, as the image is taken in hand.
    const finish = () => {
        if (animation.current) {
            cancelAnimationFrame(animation.current);
            animation.current = 0;
            showFrame(null);
        }
    };

    const stopGlide = () => {
        if (glide.current) {
            cancelAnimationFrame(glide.current);
            glide.current = 0;
        }
    };

    useEffect(
        () => () => {
            cancelAnimationFrame(animation.current);
            cancelAnimationFrame(glide.current);
        },
        [],
    );

    /** Goes to a zoom and a turn, animated from where the image is drawn now, zooming at `anchor`. */
    const moveTo = (next: Zoom | null, nextTurns: number, anchor?: Point) => {
        const measured = sizes();

        stopGlide();
        cancelAnimationFrame(animation.current);
        animation.current = 0;

        if (!measured) {
            commit(next);
            turn(nextTurns);

            return;
        }

        const { own, view: room } = measured;
        const box = turned(own, nextTurns);
        const from =
            frameRef.current ??
            placementOf(zoomRef.current ?? fitted(measured.image, room), measured.image, turnsRef.current);
        const to = placementOf(next ?? fitted(box, room), box, nextTurns);

        commit(next);
        turn(nextTurns);

        if (reducedMotion() || samePlacement(from, to)) {
            showFrame(null);

            return;
        }

        const start = performance.now();
        const step = (now: number) => {
            const progress = (now - start) / DURATION;

            if (progress >= 1) {
                animation.current = 0;
                showFrame(null);

                return;
            }

            showFrame(between(from, to, easeOut(progress), anchor));
            animation.current = requestAnimationFrame(step);
        };

        showFrame(from);
        animation.current = requestAnimationFrame(step);
    };

    /**
     * Zooms to the scale `pick` picks, keeping the image's point at `anchor` where it is, the view's
     * centre by default, animated for a step made by a key, a button or a double click.
     */
    const zoomAround = (pick: (scale: number, fit: number) => number, anchor?: Point, animated = false) => {
        const measured = sizes();

        if (!measured) {
            return;
        }

        const { image: own, view: room } = measured;
        const from = zoomRef.current ?? fitted(own, room);
        const point = anchor ?? { x: room.width / 2, y: room.height / 2 };
        const next = zoomTo(from, pick(from.scale, fitScale(own, room)), point, point, own, room);

        if (animated) {
            moveTo(next, turnsRef.current, point);
        } else {
            finish();
            commit(next);
        }
    };

    const toggle = (anchor: Point) =>
        zoomAround((scale, fit) => (scale > fit ? fit : Math.max(1, 2 * fit)), anchor, true);

    // A quarter turn, clockwise or not. Fitted, it fits again; zoomed, it keeps its scale, as far as
    // the view allows, with the part of the image at the view's centre still there.
    const rotate = (direction: 1 | -1) => {
        const measured = sizes();

        if (!measured) {
            return;
        }

        const { image: box, view: room } = measured;
        const current = zoomRef.current;
        let next: Zoom | null = null;

        if (current) {
            const centre = { x: room.width / 2, y: room.height / 2 };
            const u = (centre.x - current.x) / current.scale;
            const v = (centre.y - current.y) / current.scale;
            const [x, y] = direction > 0 ? [box.height - v, u] : [v, box.width - u];
            const swapped = { width: box.height, height: box.width };
            const from = { scale: current.scale, x: centre.x - x * current.scale, y: centre.y - y * current.scale };

            next = zoomTo(from, current.scale, centre, centre, swapped, room);
        }

        moveTo(next, turnsRef.current + direction);
    };

    const panBy = (dx: number, dy: number, animated = false) => {
        const measured = sizes();
        const current = zoomRef.current;

        if (!measured || !current) {
            return;
        }

        const next = settle({ ...current, x: current.x + dx, y: current.y + dy }, measured.image, measured.view);

        if (animated) {
            moveTo(next, turnsRef.current);
        } else {
            finish();
            commit(next);
        }
    };

    useImperativeHandle(ref, () => ({
        keyDown: (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey) {
                return false;
            }

            // The first key the press stands for that zooms or turns, so AZERTY's 1 key counts
            // without Shift, as it types "&", and Czech's still zooms in, as it types "+".
            switch (pressedKeys(event).find((key) => IMAGE_KEYS.includes(key))) {
                case "+":
                case "=":
                    zoomAround((scale) => stepScale(scale, 1), undefined, true);
                    return true;
                case "-":
                    zoomAround((scale) => stepScale(scale, -1), undefined, true);
                    return true;
                case "0":
                    zoomAround((_, fit) => fit, undefined, true);
                    return true;
                case "1":
                    zoomAround(() => 1, undefined, true);
                    return true;
                case "r":
                    rotate(event.shiftKey ? -1 : 1);
                    return true;
            }

            // Zoomed in, the arrows pan rather than step to another file.
            const pan = PAN_KEYS[event.key];
            const room = stageRef.current;

            if (!pan || event.shiftKey || !zoomRef.current || !room) {
                return false;
            }

            panBy(pan.x * room.clientWidth * PAN_FRACTION, pan.y * room.clientHeight * PAN_FRACTION, true);

            return true;
        },
        room: () => {
            const measured = sizes();
            const current = zoomRef.current;

            if (!measured || !current) {
                return null;
            }

            const width = measured.image.width * current.scale;
            const extent = measured.view.width;

            return width <= extent ? { left: 0, right: 0 } : { left: current.x - (extent - width), right: -current.x };
        },
    }));

    // Browsers send a pinch on a touchpad as Ctrl+wheel. A mouse's notch zooms by a step at most,
    // and a pinch's many small events zoom smoothly.
    const handleWheel = (event: WheelEvent) => {
        const stage = stageRef.current;

        if (!stage) {
            return;
        }

        // Safari's pinch comes as gesture events, which zoom it already.
        if (pinch.current && event.ctrlKey) {
            event.preventDefault();
            return;
        }

        const unit =
            event.deltaMode === WheelEvent.DOM_DELTA_LINE
                ? LINE_HEIGHT
                : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                  ? stage.clientHeight
                  : 1;

        stopGlide();

        if (event.ctrlKey) {
            event.preventDefault();

            const factor = clamp(Math.exp((-event.deltaY * unit) / 100), 1 / STEP, STEP);

            zoomAround((scale) => scale * factor, pointIn(stage, event));
        } else if (zoomRef.current) {
            event.preventDefault();

            // Some systems turn a mouse wheel sideways with Shift, others leave it to the page.
            const [dx, dy] = event.shiftKey && !event.deltaX ? [event.deltaY, 0] : [event.deltaX, event.deltaY];

            panBy(-dx * unit, -dy * unit);
        }
    };

    // Safari on a Mac sends a touchpad's pinch as gesture events, `scale` growing from 1 as the
    // fingers spread. On a touch screen it sends them alongside the pointers', which zoom already.
    const handleGestureStart = (event: GestureLike) => {
        const stage = stageRef.current;
        const measured = sizes();

        event.preventDefault();

        if (pointers.current.size > 0 || !stage || !measured) {
            return;
        }

        finish();
        stopGlide();
        pinch.current = { from: zoomRef.current ?? fitted(measured.image, measured.view), anchor: pointIn(stage, event) };
    };

    const handleGestureChange = (event: GestureLike) => {
        const current = pinch.current;
        const measured = sizes();

        event.preventDefault();

        if (current && measured) {
            commit(
                zoomTo(
                    current.from,
                    current.from.scale * event.scale,
                    current.anchor,
                    current.anchor,
                    measured.image,
                    measured.view,
                ),
            );
        }
    };

    const handleGestureEnd = (event: GestureLike) => {
        event.preventDefault();
        pinch.current = null;
    };

    // A zoomed image keeps its scale as the view resizes, as far as the new size allows.
    const handleResize = () => {
        const stage = stageRef.current;

        if (!stage) {
            return;
        }

        finish();
        setView({ width: stage.clientWidth, height: stage.clientHeight });

        const measured = sizes();
        const current = zoomRef.current;

        if (measured && current) {
            commit(zoomTo(current, current.scale, ORIGIN, ORIGIN, measured.image, measured.view));
        }
    };

    const listeners = useRef({ handleWheel, handleResize, handleGestureStart, handleGestureChange, handleGestureEnd });

    useEffect(() => {
        listeners.current = { handleWheel, handleResize, handleGestureStart, handleGestureChange, handleGestureEnd };
    });

    useEffect(() => {
        const stage = stageRef.current;

        if (!stage) {
            return;
        }

        // Not passive, so Ctrl+wheel and Safari's pinch zoom the image rather than the page.
        const handleWheelEvent = (event: WheelEvent) => listeners.current.handleWheel(event);
        const handleGestureStartEvent = (event: Event) => listeners.current.handleGestureStart(event as GestureLike);
        const handleGestureChangeEvent = (event: Event) => listeners.current.handleGestureChange(event as GestureLike);
        const handleGestureEndEvent = (event: Event) => listeners.current.handleGestureEnd(event as GestureLike);
        const observer = new ResizeObserver(() => listeners.current.handleResize());

        stage.addEventListener("wheel", handleWheelEvent, { passive: false });
        stage.addEventListener("gesturestart", handleGestureStartEvent, { passive: false });
        stage.addEventListener("gesturechange", handleGestureChangeEvent, { passive: false });
        stage.addEventListener("gestureend", handleGestureEndEvent, { passive: false });
        observer.observe(stage);

        return () => {
            stage.removeEventListener("wheel", handleWheelEvent);
            stage.removeEventListener("gesturestart", handleGestureStartEvent);
            stage.removeEventListener("gesturechange", handleGestureChangeEvent);
            stage.removeEventListener("gestureend", handleGestureEndEvent);
            observer.disconnect();
        };
    }, []);

    /** A point on the screen in the view, as the view was when the pointers last changed. */
    const inView = (point: Point) => ({ x: point.x - origin.current.x, y: point.y - origin.current.y });

    // Starts the gesture afresh from where the pointers are, each time one goes down or up.
    const regroup = () => {
        const stage = stageRef.current;
        const measured = sizes();
        const points = [...pointers.current.values()].slice(0, 2);

        if (stage) {
            const rect = stage.getBoundingClientRect();

            origin.current = { x: rect.left, y: rect.top };
        }

        gesture.current =
            measured && points.length > 0
                ? {
                      from: zoomRef.current ?? fitted(measured.image, measured.view),
                      centre: inView(centreOf(points)),
                      spread: points.length > 1 ? distance(points[0], points[1]) : 0,
                  }
                : null;
    };

    // After a flick on touch, the zoomed image glides on, slowing as it goes, until it stops or meets
    // an edge, as a photo viewer's does.
    const glideOn = (event: PointerEvent<HTMLDivElement>) => {
        const moves = [...recent(samples.current, event.timeStamp), { ...screenPoint(event), time: event.timeStamp }];
        const [first] = moves;
        const last = moves[moves.length - 1];
        const elapsed = last.time - first.time;

        if (elapsed <= 0 || reducedMotion()) {
            return;
        }

        let vx = (last.x - first.x) / elapsed;
        let vy = (last.y - first.y) / elapsed;

        if (Math.hypot(vx, vy) < GLIDE_SPEED) {
            return;
        }

        let before = performance.now();
        const step = (now: number) => {
            const measured = sizes();
            const current = zoomRef.current;
            const elapsedFrame = Math.min(now - before, MAX_FRAME);

            before = now;

            if (!measured || !current) {
                glide.current = 0;
                return;
            }

            const wanted = { ...current, x: current.x + vx * elapsedFrame, y: current.y + vy * elapsedFrame };
            const next = settle(wanted, measured.image, measured.view);

            // Meeting an edge stops it going that way.
            if (Math.abs(next.x - wanted.x) > 0.5) {
                vx = 0;
            }

            if (Math.abs(next.y - wanted.y) > 0.5) {
                vy = 0;
            }

            commit(next);

            const decay = Math.exp(-elapsedFrame / FRICTION);

            vx *= decay;
            vy *= decay;
            glide.current = Math.hypot(vx, vy) < STOP_SPEED ? 0 : requestAnimationFrame(step);
        };

        glide.current = requestAnimationFrame(step);
    };

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        pointerType.current = event.pointerType;

        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        finish();
        stopGlide();
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, screenPoint(event));
        // Double taps are caught here, as not every browser sends `dblclick` for them; a mouse's
        // double click comes through `dblclick`, at the system's speed.
        press.current =
            event.pointerType !== "mouse" && pointers.current.size === 1
                ? { point: pointIn(event.currentTarget, event), screen: screenPoint(event), time: event.timeStamp }
                : null;
        samples.current = [{ ...screenPoint(event), time: event.timeStamp }];
        regroup();
    };

    // One pointer pans the zoomed image; two also zoom it, by how much they spread or close.
    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (!pointers.current.has(event.pointerId)) {
            return;
        }

        pointers.current.set(event.pointerId, screenPoint(event));

        if (press.current && distance(press.current.screen, screenPoint(event)) > TAP_TOLERANCE) {
            press.current = null;
        }

        if (pointers.current.size === 1) {
            samples.current = [
                ...recent(samples.current, event.timeStamp),
                { ...screenPoint(event), time: event.timeStamp },
            ];
        }

        const measured = sizes();
        const current = gesture.current;

        if (!measured || !current) {
            return;
        }

        const points = [...pointers.current.values()].slice(0, 2);
        const scale =
            current.spread > 0 && points.length > 1
                ? (current.from.scale * distance(points[0], points[1])) / current.spread
                : current.from.scale;

        commit(zoomTo(current.from, scale, current.centre, inView(centreOf(points)), measured.image, measured.view));
    };

    const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
        if (!pointers.current.delete(event.pointerId)) {
            return;
        }

        const tap = press.current;
        const panned = gesture.current?.spread === 0;

        press.current = null;

        if (event.type === "pointerup" && tap && pointers.current.size === 0) {
            const last = lastTap.current;

            if (last && tap.time - last.time < DOUBLE_TAP_TIME && distance(tap.screen, last.screen) < DOUBLE_TAP_DISTANCE) {
                lastTap.current = null;
                toggle(tap.point);
            } else {
                lastTap.current = { ...tap, time: event.timeStamp };
            }
        } else if (
            event.type === "pointerup" &&
            event.pointerType !== "mouse" &&
            panned &&
            pointers.current.size === 0 &&
            zoomRef.current
        ) {
            glideOn(event);
        }

        regroup();
    };

    const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
        if (pointerType.current === "mouse") {
            toggle(pointIn(event.currentTarget, event));
        }
    };

    const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth: width, naturalHeight: height } = event.currentTarget;

        if (width > 0 && height > 0) {
            setImage({ width, height });
        }

        setLoaded(true);
        onLoad(width, height);
    };

    const box = image && turned(image, turns);
    const fit = box && view ? fitScale(box, view) : 1;
    const scale = frame?.scale ?? zoom?.scale ?? fit;
    // Laid out by CSS while it's fitted and unturned; placed from the sizes otherwise.
    const placement =
        frame ?? (box && view && (zoom || turns % 4 !== 0) ? placementOf(zoom ?? fitted(box, view), box, turns) : null);

    const placed: CSSProperties | undefined =
        placement && image
            ? {
                  // From the view's top left, right to left too: the zoom is worked out from the
                  // pointer's place on the screen, and a style set inline isn't flipped by Emotion's
                  // RTL plugin. Turned about its centre, which the translation puts in place.
                  top: 0,
                  left: 0,
                  width: image.width * placement.scale,
                  height: image.height * placement.scale,
                  transform:
                      `translate(${placement.cx - (image.width * placement.scale) / 2}px, ` +
                      `${placement.cy - (image.height * placement.scale) / 2}px) rotate(${placement.angle}deg)`,
                  imageRendering: placement.scale >= PIXELATED_SCALE ? "pixelated" : undefined,
              }
            : undefined;

    return (
        <Box sx={viewerSx}>
            <Box
                ref={stageRef}
                sx={stageSx}
                data-zoomed={!!zoom}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onLostPointerCapture={handlePointerUp}
                onDoubleClick={handleDoubleClick}
            >
                {!loaded && placeholder && (
                    <Box
                        component="img"
                        src={placeholder}
                        alt=""
                        draggable={false}
                        sx={placeholderSx}
                        style={expected}
                    />
                )}
                <Box
                    ref={imageRef}
                    component="img"
                    src={src}
                    alt={alt}
                    draggable={false}
                    sx={placed ? zoomedImageSx : fittedImageSx}
                    style={placed}
                    onLoad={handleLoad}
                    onError={onError}
                />
                {!loaded && <CircularProgress size={28} aria-label={text.loading} sx={spinnerSx} />}
            </Box>
            {box && view && (
                <Box sx={toolbarSx}>
                    <TooltipIconButton
                        size="small"
                        label={text.zoomOut}
                        aria-keyshortcuts="-"
                        disabled={!zoom}
                        onClick={() => zoomAround((current) => stepScale(current, -1), undefined, true)}
                    >
                        <Icon name="zoomOut" fontSize="small" />
                    </TooltipIconButton>
                    <Typography variant="body2" color="text.secondary" sx={percentSx}>
                        {formatPercent(scale)}
                    </Typography>
                    <TooltipIconButton
                        size="small"
                        label={text.zoomIn}
                        aria-keyshortcuts="Plus"
                        disabled={(zoom?.scale ?? fit) >= maxScale(box, view) - 1e-9}
                        onClick={() => zoomAround((current) => stepScale(current, 1), undefined, true)}
                    >
                        <Icon name="zoomIn" fontSize="small" />
                    </TooltipIconButton>
                    <TooltipIconButton
                        size="small"
                        label={text.zoomFit}
                        aria-keyshortcuts="0"
                        disabled={!zoom}
                        onClick={() => zoomAround((_, best) => best, undefined, true)}
                    >
                        <Icon name="zoomFit" fontSize="small" />
                    </TooltipIconButton>
                    <Box sx={ruleSx} />
                    {/* Turning is the same either way the page runs, so the icons aren't mirrored. */}
                    <TooltipIconButton
                        size="small"
                        label={text.rotateCounterclockwise}
                        aria-keyshortcuts="Shift+R"
                        onClick={() => rotate(-1)}
                    >
                        <Icon name="rotateLeft" fontSize="small" />
                    </TooltipIconButton>
                    <TooltipIconButton
                        size="small"
                        label={text.rotateClockwise}
                        aria-keyshortcuts="R"
                        onClick={() => rotate(1)}
                    >
                        <Icon name="rotateRight" fontSize="small" />
                    </TooltipIconButton>
                </Box>
            )}
        </Box>
    );
};

export default ImageViewer;
