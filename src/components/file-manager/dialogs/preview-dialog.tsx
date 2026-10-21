import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog, { dialogClasses } from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { usePreviewContents } from "../../../hooks/use-preview-contents";
import { useSwipe } from "../../../hooks/use-swipe";
import { dialogPaperSx, focusOutline, visuallyHiddenSx } from "../../../styles/mixins";
import { describeDate, describeSize, describeType, formatSize } from "../../../utils/format";
import { isRtl } from "../../../utils/keyboard";
import { TEXT_LIMIT, previewKind } from "../../../utils/preview";
import { FileTypeIcon } from "../../icons/file-icon";
import Icon from "../../icons/icon";
import ImageViewer from "./image-viewer";
import type { ImageViewerHandle } from "./image-viewer";

import type { FileAdapter, FileEntry, FolderRef, Section } from "../../../types";

export interface PreviewRequest {
    section: Section;
    /** The section's adapter, already known to have `content`. */
    adapter: FileAdapter;
    /** Trail to the folder the files are in. */
    trail: FolderRef[];
    /** The files to step through, in order. */
    entries: FileEntry[];
    /** Where in `entries` to start. */
    index: number;
    /**
     * Whether the content's selection follows the file shown, as it does when a single file steps
     * through its folder.
     */
    follow: boolean;
}

export interface PreviewDialogState {
    /** False while the dialog plays its closing transition; the rest is kept so it doesn't empty mid-fade. */
    open: boolean;
    /** Counts requests, so each one starts afresh. */
    id: number;
    request: PreviewRequest;
    /** Whether it was opened from the content, which takes the focus back once it has closed. */
    fromContent: boolean;
}

interface PreviewDialogProps {
    open: boolean;
    request: PreviewRequest;
    /** Leaves the focus to `onClosed` rather than handing it back to what had it. */
    disableRestoreFocus: boolean;
    onClose: () => void;
    /** Called once the dialog has faded out. */
    onClosed: () => void;
    /** Called as the dialog steps to another file. */
    onStep: (request: PreviewRequest, entry: FileEntry) => void;
}

/** An image's or a video's own size, once it has loaded: 0 for a picture with none, such as some SVGs. */
interface Dimensions {
    id: string;
    width: number;
    height: number;
}

const MEDIA_ERROR = "The browser couldn't load it, or can't show this kind of file.";

// As large as the page allows, up to a size that still reads as a dialog.
const dialogSx: SxProps<Theme> = {
    [`& .${dialogClasses.paper}`]: {
        width: "min(72rem, 100% - 2rem)",
        height: "min(54rem, 100% - 2rem)",
        maxWidth: "none",
        maxHeight: "none",
        m: 2,
    },
};

const headerSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    minHeight: 56,
    py: 1,
    pl: 2,
    pr: 1,
};

const titleSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
};

const nameSx: SxProps<Theme> = {
    fontWeight: 600,
};

const stepperSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
};

const counterSx: SxProps<Theme> = {
    minWidth: "4.5em",
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
};

// The file sits on the content panel's surface, as the window lays out the folder view: chrome on
// the window's background, the view on paper. Sideways moves of a finger are left to the page, to
// swipe to another file.
const bodySx: SxProps<Theme> = {
    flex: 1,
    minHeight: 0,
    display: "flex",
    mx: 1,
    mb: 1,
    overflow: "hidden",
    border: 1,
    borderColor: "divider",
    borderRadius: 2,
    bgcolor: "background.paper",
    touchAction: "pan-y pinch-zoom",
};

// What follows the finger as it swipes.
const slideSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

// Shrunk to fit, never stretched past its own size.
const mediaSx: SxProps<Theme> = {
    display: "block",
    maxWidth: "calc(100% - 2rem)",
    maxHeight: "calc(100% - 2rem)",
    objectFit: "contain",
};

const frameSx: SxProps<Theme> = {
    alignSelf: "stretch",
    flex: 1,
    minWidth: 0,
    border: 0,
};

const textFrameSx: SxProps<Theme> = {
    alignSelf: "stretch",
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
};

// Long lines wrap, so Left and Right, and a sideways swipe, stay free for stepping between files.
const textSx: SxProps<Theme> = {
    flex: 1,
    minHeight: 0,
    m: 0,
    p: 2,
    overflow: "auto",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
    fontSize: "0.8125rem",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    tabSize: 4,
    touchAction: "pan-y pinch-zoom",
    outline: "none",
    "&:focus-visible": focusOutline,
};

const noteSx: SxProps<Theme> = {
    px: 2,
    py: 0.75,
    borderTop: 1,
    borderColor: "divider",
    color: "text.secondary",
};

const stateSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    p: 3,
    textAlign: "center",
    color: "text.secondary",
};

const stateIconSx: SxProps<Theme> = {
    fontSize: "3rem",
    opacity: 0.6,
};

const stateTitleSx: SxProps<Theme> = {
    color: "text.primary",
    fontWeight: 600,
};

const audioSx: SxProps<Theme> = {
    width: "min(100%, 28rem)",
    mt: 2,
};

/**
 * Shows files one at a time, as GNOME's and macOS's previewers do: images, videos, audio and PDFs
 * as the browser shows them, the start of text files, and an icon with the file's details for the
 * rest. The arrows, the buttons, or a swipe on touch step through the files it was given, and
 * Space or Escape closes it.
 *
 * The adapter's `content` says where each file's contents are. A URL is used as it is; a `Blob` is
 * shown through an object URL. The next file loads once the one shown has, so stepping on shows
 * it at once (see `usePreviewContents`).
 */
const PreviewDialog = ({ open, request, disableRestoreFocus, onClose, onClosed, onStep }: PreviewDialogProps) => {
    const { adapter, entries } = request;
    const count = entries.length;

    const [index, setIndex] = useState(() => Math.min(Math.max(request.index, 0), count - 1));
    // The way the last step went, where the file loaded ahead lies.
    const [direction, setDirection] = useState<1 | -1>(1);
    const [dimensions, setDimensions] = useState<Dimensions | null>(null);
    const viewerRef = useRef<ImageViewerHandle>(null);
    const slideRef = useRef<HTMLDivElement>(null);
    const titleId = useId();

    const entry = entries[index];
    const kind = previewKind(entry);
    const size = dimensions?.id === entry.id ? dimensions : null;
    const { content: shown, fail, retry } = usePreviewContents({
        adapter,
        entries,
        index,
        // Nothing more is loaded while the preview fades out.
        ahead: open ? direction : null,
        // A picture or a video is still coming until the browser has measured it.
        pending: (kind === "image" || kind === "video") && !size,
    });

    const slotProps = useMemo(
        () => ({
            paper: { sx: dialogPaperSx },
            transition: { onExited: onClosed },
        }),
        [onClosed],
    );

    const canStep = (delta: 1 | -1) => index + delta >= 0 && index + delta < count;

    const step = (delta: 1 | -1) => {
        if (canStep(delta)) {
            setIndex(index + delta);
            setDirection(delta);
            onStep(request, entries[index + delta]);
        }
    };

    const swipe = useSwipe({
        ref: slideRef,
        canStep,
        onStep: step,
        // Zoomed in, a picture pans with the finger instead.
        ignore: () => viewerRef.current?.zoomed() ?? false,
    });

    // The browser couldn't load the URL, or can't show what it holds.
    const handleMediaError = () => fail(entry.id, MEDIA_ERROR);

    const measure = (width: number, height: number) => setDimensions({ id: entry.id, width, height });

    // An image takes its zoom keys first, and the arrows while it's zoomed in, to pan it. Left and
    // Right step through the files, swapped when the page runs right to left, except in a player,
    // which seeks with them. Space closes, as in GNOME's and macOS's previewers, except on what
    // Space presses or plays; a key held down from opening it doesn't close it again.
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.defaultPrevented) {
            return;
        }

        if (viewerRef.current?.keyDown(event)) {
            event.preventDefault();
            return;
        }

        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
            return;
        }

        const target = event.target instanceof Element ? event.target : null;
        let handled = true;

        if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !target?.closest("video, audio")) {
            step((event.key === "ArrowRight") !== isRtl(event.currentTarget) ? 1 : -1);
        } else if (event.key === " " && !event.repeat && !target?.closest("button, a, video, audio")) {
            onClose();
        } else {
            handled = false;
        }

        if (handled) {
            event.preventDefault();
        }
    };

    const details = [
        describeType(entry),
        entry.size === undefined ? null : describeSize(entry),
        size && size.width > 0 && size.height > 0 ? `${size.width} × ${size.height}` : null,
    ]
        .filter(Boolean)
        .join(" · ");

    let body: ReactNode;

    if (!shown && kind !== "none") {
        body = <CircularProgress size={28} aria-label="Loading" />;
    } else if (kind === "none" || !shown || shown.status === "binary") {
        body = (
            <Box sx={stateSx}>
                <FileTypeIcon fileName={entry.name} size="5rem" />
                <Typography sx={stateTitleSx}>No preview available</Typography>
                {entry.modifiedAt && <Typography variant="body2">Modified {describeDate(entry)}</Typography>}
            </Box>
        );
    } else if (shown.status === "error") {
        body = (
            <Box sx={stateSx} role="alert">
                <Icon name="info" sx={stateIconSx} />
                <Typography sx={stateTitleSx}>Couldn't preview this file</Typography>
                <Typography variant="body2">{shown.message}</Typography>
                <Button size="small" variant="outlined" onClick={() => retry(entry.id)}>
                    Try again
                </Button>
            </Box>
        );
    } else if (shown.status === "text") {
        body = shown.excerpt.text ? (
            <Box sx={textFrameSx}>
                {/* Tabbable, so it scrolls from the keyboard too. */}
                <Box component="pre" sx={textSx} tabIndex={0} aria-label={entry.name}>
                    {shown.excerpt.text}
                </Box>
                {shown.excerpt.truncated && (
                    <Typography variant="caption" sx={noteSx}>
                        Showing the first {formatSize(TEXT_LIMIT)}
                    </Typography>
                )}
            </Box>
        ) : (
            <Box sx={stateSx}>
                <FileTypeIcon fileName={entry.name} size="5rem" />
                <Typography sx={stateTitleSx}>File is empty</Typography>
            </Box>
        );
    } else if (kind === "image") {
        body = (
            <ImageViewer
                key={entry.id}
                ref={viewerRef}
                src={shown.url}
                alt={entry.name}
                onLoad={measure}
                onError={handleMediaError}
            />
        );
    } else if (kind === "video") {
        body = (
            <Box
                key={entry.id}
                component="video"
                src={shown.url}
                controls
                preload="metadata"
                sx={mediaSx}
                onLoadedMetadata={(event) => measure(event.currentTarget.videoWidth, event.currentTarget.videoHeight)}
                onError={handleMediaError}
            />
        );
    } else if (kind === "audio") {
        body = (
            <Box sx={stateSx}>
                <FileTypeIcon fileName={entry.name} size="5rem" />
                <Box
                    key={entry.id}
                    component="audio"
                    src={shown.url}
                    controls
                    preload="metadata"
                    sx={audioSx}
                    onError={handleMediaError}
                />
            </Box>
        );
    } else {
        body = <Box key={entry.id} component="iframe" src={shown.url} title={entry.name} sx={frameSx} />;
    }

    return (
        <Dialog
            open={open}
            maxWidth={false}
            sx={dialogSx}
            slotProps={slotProps}
            disableRestoreFocus={disableRestoreFocus}
            aria-labelledby={titleId}
            onClose={onClose}
            onKeyDown={handleKeyDown}
        >
            <Box sx={headerSx}>
                <FileTypeIcon fileName={entry.name} size="1.75rem" />
                <Box sx={titleSx}>
                    <Typography id={titleId} component="h2" variant="body1" noWrap sx={nameSx}>
                        {entry.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                        {details}
                    </Typography>
                </Box>
                {count > 1 && (
                    <Box sx={stepperSx}>
                        <IconButton aria-label="Previous" disabled={index === 0} onClick={() => step(-1)}>
                            <Icon name="chevronLeft" />
                        </IconButton>
                        <Typography variant="body2" color="text.secondary" sx={counterSx} aria-hidden>
                            {index + 1} / {count}
                        </Typography>
                        <IconButton aria-label="Next" disabled={index === count - 1} onClick={() => step(1)}>
                            <Icon name="chevronRight" />
                        </IconButton>
                    </Box>
                )}
                <IconButton aria-label="Close" onClick={onClose}>
                    <Icon name="close" />
                </IconButton>
            </Box>
            <Box sx={bodySx} {...swipe}>
                <Box ref={slideRef} sx={slideSx}>
                    {body}
                </Box>
            </Box>
            {/* Screen readers hear which file the arrows stepped to. */}
            <Box sx={visuallyHiddenSx} role="status">
                {count > 1 ? `${entry.name}, ${index + 1} of ${count}` : ""}
            </Box>
        </Dialog>
    );
};

export default PreviewDialog;
