import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent, Ref, SyntheticEvent } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../../hooks/use-locale";
import { pressedKeys } from "../../../utils/shortcut";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";

/** What the preview hands the image it shows. */
export interface ImageViewerHandle {
    /** Takes a key pressed anywhere in the preview, and says whether it did anything with it. */
    keyDown: (event: KeyboardEvent) => boolean;
    /** Whether the image is zoomed in, when a swipe pans it rather than stepping to another file. */
    zoomed: () => boolean;
}

interface ImageViewerProps {
    ref?: Ref<ImageViewerHandle>;
    src: string;
    alt: string;
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

/** How the arrow keys pan the zoomed image: Left shows more of its left side, and so on. */
const PAN_KEYS: Partial<Record<string, Point>> = {
    ArrowLeft: { x: 1, y: 0 },
    ArrowRight: { x: -1, y: 0 },
    ArrowUp: { x: 0, y: 1 },
    ArrowDown: { x: 0, y: -1 },
};

/** The keys that zoom: in ("+", or "=" beside it on a US layout), out, to fit and to the image's own size. */
const ZOOM_KEYS = ["+", "=", "-", "0", "1"];

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

const viewerSx: SxProps<Theme> = {
    position: "relative",
    alignSelf: "stretch",
    flex: 1,
    minWidth: 0,
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

// Placed, sized and moved through `style`, from the zoom.
const zoomedImageSx: SxProps<Theme> = {
    display: "block",
    position: "absolute",
    maxWidth: "none",
    maxHeight: "none",
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

const percentSx: SxProps<Theme> = {
    minWidth: "3.5em",
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
};

/**
 * An image in the preview, which zooms and pans: Ctrl+wheel or a touchpad pinch zooms at the
 * pointer, a pinch on a touch screen between the fingers, and a double click or double tap toggles
 * between fitting the view and a closer look. Zoomed in, it pans by dragging, the wheel and the
 * arrow keys. The buttons in the corner zoom around the view's centre, as do +, -, 0 (fit) and 1
 * (the image's own size), which the preview hands over through `ref`. Fitted, a swipe is left to
 * the preview, to step to another file.
 *
 * Unzoomed, the image is laid out to fit by CSS alone, so it follows the view's size without
 * waiting on a measure; zoomed, it's placed from its own size and the view's.
 */
const ImageViewer = ({ ref, src, alt, onLoad, onError }: ImageViewerProps) => {
    const { text, formatPercent } = useLocale();
    const stageRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    // The image's own size once it has loaded, and the view's, for rendering. Handlers read both
    // afresh from the elements.
    const [image, setImage] = useState<Size | null>(null);
    const [view, setView] = useState<Size | null>(null);
    // Null while the image fits the view. Changed only through `commit`, which keeps the ref in
    // step at once, so pointer moves between renders build on the latest zoom.
    const [zoom, setZoom] = useState<Zoom | null>(null);
    const zoomRef = useRef<Zoom | null>(null);
    const pointers = useRef(new Map<number, Point>());
    const gesture = useRef<Gesture | null>(null);
    const press = useRef<Tap | null>(null);
    const lastTap = useRef<Tap | null>(null);
    const pointerType = useRef("");

    const commit = (next: Zoom | null) => {
        zoomRef.current = next;
        setZoom(next);
    };

    const sizes = () => {
        const stage = stageRef.current;
        const img = imageRef.current;

        if (!stage || !img?.complete || !img.naturalWidth || !img.naturalHeight) {
            return null;
        }

        return {
            image: { width: img.naturalWidth, height: img.naturalHeight },
            view: { width: stage.clientWidth, height: stage.clientHeight },
        };
    };

    /** Zooms to the scale `pick` picks, keeping the image's point at `anchor` where it is, the view's centre by default. */
    const zoomAround = (pick: (scale: number, fit: number) => number, anchor?: Point) => {
        const measured = sizes();

        if (!measured) {
            return;
        }

        const { image: own, view: room } = measured;
        const from = zoomRef.current ?? fitted(own, room);
        const point = anchor ?? { x: room.width / 2, y: room.height / 2 };

        commit(zoomTo(from, pick(from.scale, fitScale(own, room)), point, point, own, room));
    };

    const toggle = (anchor: Point) =>
        zoomAround((scale, fit) => (scale > fit ? fit : Math.max(1, 2 * fit)), anchor);

    const panBy = (dx: number, dy: number) => {
        const measured = sizes();
        const current = zoomRef.current;

        if (measured && current) {
            commit(settle({ ...current, x: current.x + dx, y: current.y + dy }, measured.image, measured.view));
        }
    };

    useImperativeHandle(ref, () => ({
        keyDown: (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey) {
                return false;
            }

            // The first key the press stands for that zooms, so AZERTY's 1 key counts without Shift,
            // as it types "&", and Czech's still zooms in, as it types "+".
            switch (pressedKeys(event).find((key) => ZOOM_KEYS.includes(key))) {
                case "+":
                case "=":
                    zoomAround((scale) => stepScale(scale, 1));
                    return true;
                case "-":
                    zoomAround((scale) => stepScale(scale, -1));
                    return true;
                case "0":
                    zoomAround((_, fit) => fit);
                    return true;
                case "1":
                    zoomAround(() => 1);
                    return true;
            }

            // Zoomed in, the arrows pan rather than step to another file.
            const pan = PAN_KEYS[event.key];
            const room = stageRef.current;

            if (!pan || event.shiftKey || !zoomRef.current || !room) {
                return false;
            }

            panBy(pan.x * room.clientWidth * PAN_FRACTION, pan.y * room.clientHeight * PAN_FRACTION);

            return true;
        },
        zoomed: () => zoomRef.current !== null,
    }));

    // Browsers send a pinch on a touchpad as Ctrl+wheel. A mouse's notch zooms by a step at most,
    // and a pinch's many small events zoom smoothly.
    const handleWheel = (event: WheelEvent) => {
        const stage = stageRef.current;

        if (!stage) {
            return;
        }

        const unit =
            event.deltaMode === WheelEvent.DOM_DELTA_LINE
                ? LINE_HEIGHT
                : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                  ? stage.clientHeight
                  : 1;

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

    // A zoomed image keeps its scale as the view resizes, as far as the new size allows.
    const handleResize = () => {
        const stage = stageRef.current;

        if (!stage) {
            return;
        }

        setView({ width: stage.clientWidth, height: stage.clientHeight });

        const measured = sizes();
        const current = zoomRef.current;

        if (measured && current) {
            commit(zoomTo(current, current.scale, ORIGIN, ORIGIN, measured.image, measured.view));
        }
    };

    const listeners = useRef({ handleWheel, handleResize });

    useEffect(() => {
        listeners.current = { handleWheel, handleResize };
    });

    useEffect(() => {
        const stage = stageRef.current;

        if (!stage) {
            return;
        }

        // Not passive, so Ctrl+wheel zooms the image rather than the page.
        const handleWheelEvent = (event: WheelEvent) => listeners.current.handleWheel(event);
        const observer = new ResizeObserver(() => listeners.current.handleResize());

        stage.addEventListener("wheel", handleWheelEvent, { passive: false });
        observer.observe(stage);

        return () => {
            stage.removeEventListener("wheel", handleWheelEvent);
            observer.disconnect();
        };
    }, []);

    // Starts the gesture afresh from where the pointers are, each time one goes down or up.
    const regroup = () => {
        const measured = sizes();
        const points = [...pointers.current.values()].slice(0, 2);

        gesture.current =
            measured && points.length > 0
                ? {
                      from: zoomRef.current ?? fitted(measured.image, measured.view),
                      centre: centreOf(points),
                      spread: points.length > 1 ? distance(points[0], points[1]) : 0,
                  }
                : null;
    };

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        pointerType.current = event.pointerType;

        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        const point = pointIn(event.currentTarget, event);

        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, point);
        // Double taps are caught here, as not every browser sends `dblclick` for them; a mouse's
        // double click comes through `dblclick`, at the system's speed.
        press.current =
            event.pointerType !== "mouse" && pointers.current.size === 1
                ? { point, screen: screenPoint(event), time: event.timeStamp }
                : null;
        regroup();
    };

    // One pointer pans the zoomed image; two also zoom it, by how much they spread or close.
    const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (!pointers.current.has(event.pointerId)) {
            return;
        }

        const point = pointIn(event.currentTarget, event);

        pointers.current.set(event.pointerId, point);

        if (press.current && distance(press.current.screen, screenPoint(event)) > TAP_TOLERANCE) {
            press.current = null;
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

        commit(zoomTo(current.from, scale, current.centre, centreOf(points), measured.image, measured.view));
    };

    const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
        if (!pointers.current.delete(event.pointerId)) {
            return;
        }

        const tap = press.current;

        press.current = null;

        if (event.type === "pointerup" && tap && pointers.current.size === 0) {
            const last = lastTap.current;

            if (last && tap.time - last.time < DOUBLE_TAP_TIME && distance(tap.screen, last.screen) < DOUBLE_TAP_DISTANCE) {
                lastTap.current = null;
                toggle(tap.point);
            } else {
                lastTap.current = { ...tap, time: event.timeStamp };
            }
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

        onLoad(width, height);
    };

    const fit = image && view ? fitScale(image, view) : 1;
    const scale = zoom?.scale ?? fit;

    const placed: CSSProperties | undefined =
        zoom && image
            ? {
                  // From the view's top left, right to left too: the zoom is worked out from the
                  // pointer's place on the screen, and a style set inline isn't flipped by Emotion's
                  // RTL plugin.
                  top: 0,
                  left: 0,
                  width: image.width * zoom.scale,
                  height: image.height * zoom.scale,
                  transform: `translate(${zoom.x}px, ${zoom.y}px)`,
                  imageRendering: zoom.scale >= PIXELATED_SCALE ? "pixelated" : undefined,
              }
            : undefined;

    return (
        <Box sx={viewerSx}>
            <Box
                ref={stageRef}
                sx={stageSx}
                data-zoomed={!!placed}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onLostPointerCapture={handlePointerUp}
                onDoubleClick={handleDoubleClick}
            >
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
            </Box>
            {image && view && (
                <Box sx={toolbarSx}>
                    <TooltipIconButton
                        size="small"
                        label={text.zoomOut}
                        aria-keyshortcuts="-"
                        disabled={!zoom}
                        onClick={() => zoomAround((current) => stepScale(current, -1))}
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
                        disabled={scale >= maxScale(image, view) - 1e-9}
                        onClick={() => zoomAround((current) => stepScale(current, 1))}
                    >
                        <Icon name="zoomIn" fontSize="small" />
                    </TooltipIconButton>
                    <TooltipIconButton
                        size="small"
                        label={text.zoomFit}
                        aria-keyshortcuts="0"
                        disabled={!zoom}
                        onClick={() => zoomAround((_, best) => best)}
                    >
                        <Icon name="zoomFit" fontSize="small" />
                    </TooltipIconButton>
                </Box>
            )}
        </Box>
    );
};

export default ImageViewer;
