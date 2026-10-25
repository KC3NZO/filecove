import {
    Component,
    Suspense,
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import type { KeyboardEvent, ReactNode } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog, { dialogClasses } from "@mui/material/Dialog";
import type { DialogProps } from "@mui/material/Dialog";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../../contexts/direction-context";
import { useData } from "../../../hooks/use-folder";
import { useLocale } from "../../../hooks/use-locale";
import { usePreviewContents } from "../../../hooks/use-preview-contents";
import { useSwipe } from "../../../hooks/use-swipe";
import { useThumbnail } from "../../../hooks/use-thumbnail";
import { folderKey } from "../../../store/folder-store";
import {
    GRID_SIZES,
    GRID_START,
    PREVIEW_HEADER_CONTAINER,
    previewHeaderMedium,
    previewHeaderWide,
} from "../../../styles/layout";
import { dialogPaperSx, focusOutline, visuallyHiddenSx } from "../../../styles/mixins";
import { runToolbarShortcut } from "../../../utils/action-groups";
import { isolate, joinIsolated } from "../../../utils/bidi";
import {
    FULLSCREEN_EVENTS,
    enterFullscreen,
    exitFullscreen,
    fullscreenElement,
    fullscreenEnabled,
    isRtl,
} from "../../../utils/dom";
import { canDownload } from "../../../utils/download";
import { folderOf } from "../../../utils/navigation";
import { ResponseError, TEXT_LIMIT, planPreview, previewKey } from "../../../utils/preview";
import { pressesKey, typesInField } from "../../../utils/shortcut";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import ToolbarActions from "../../buttons/toolbar-actions";
import { FileTypeIcon } from "../../icons/file-icon";
import Icon from "../../icons/icon";
import Announcer from "../announcer";
import ImageViewer from "./image-viewer";

import type { Announcement } from "../../../hooks/use-announcer";
import type {
    FileAdapter,
    FileEntry,
    FileManagerLocaleText,
    FilePreviewer,
    FolderRef,
    PreviewerProps,
    Section,
    ToolbarGroup,
} from "../../../types";
import type { ImageViewerHandle } from "./image-viewer";

export interface PreviewRequest {
    section: Section;
    /** The section's adapter. */
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
    /** The files are results of a search everywhere, whose folder isn't the open one. */
    inResults?: boolean;
}

export interface PreviewDialogState {
    /** False while the dialog plays its closing transition; the rest is kept so it doesn't empty mid-fade. */
    open: boolean;
    /** Counts requests, so each one starts afresh. */
    id: number;
    request: PreviewRequest;
    /** Whether it was opened from the content, which takes the focus back once it has closed. */
    fromContent: boolean;
    /** Whether it closed for something else that takes the focus, such as the properties. */
    handedOff?: boolean;
}

interface PreviewDialogProps {
    open: boolean;
    request: PreviewRequest;
    /** Leaves the focus to `onClosed` rather than handing it back to what had it. */
    disableRestoreFocus: boolean;
    /** The app's own previewers, tried before the file manager's previews. */
    previewers: readonly FilePreviewer[];
    /** The app's actions for the header (`previewActions`), bound to the file shown. */
    actionsFor: (request: PreviewRequest, entry: FileEntry) => ToolbarGroup[];
    /**
     * What the file manager tells screen readers while the preview is open, said from inside it,
     * since the modal hides the rest of the page from them.
     */
    announcement: Announcement | null;
    onClose: () => void;
    /** Called once the dialog has faded out. */
    onClosed: () => void;
    /** Called as the dialog steps to another file, or shows another as the one shown goes. */
    onStep: (request: PreviewRequest, entry: FileEntry) => void;
    /** Called to save the file shown, from the header's Download button. */
    onDownload: (request: PreviewRequest, entry: FileEntry) => void;
}

/** An image's or a video's own size, once it has loaded: 0 for a picture with none, such as some SVGs. */
interface Dimensions {
    id: string;
    width: number;
    height: number;
}

/** The file shown, by its id, and where it was, so the one taking its place shows if it goes. */
interface Shown {
    id: string;
    index: number;
}

/** The listing the files were last taken as, so only a newer one changes them. */
interface Baseline {
    entries: FileEntry[];
    listing: FileEntry[] | undefined;
}

interface BoundaryProps {
    onError: (error: unknown) => void;
    children: ReactNode;
}

interface OutputProps extends PreviewerProps {
    previewer: FilePreviewer;
}

// The size the grid asks thumbnails for at its start, in rem, so the preview shows the one the grid
// has, or a larger one it kept zoomed in.
const GRID_THUMBNAIL = GRID_SIZES[GRID_START].icon;

/** The sizes a font's sample is shown at, in px. */
const FONT_SIZES = [12, 18, 24, 36, 48, 72];

/** How many of the app's actions with icons show as buttons, while the header has room. */
const INLINE_ACTIONS = 4;

/**
 * A previewer of the app's own that throws as it renders shows the file as failed, with Try again,
 * rather than taking the file manager down.
 */
class PreviewerBoundary extends Component<BoundaryProps, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: unknown) {
        this.props.onError(error);
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}

// A component of its own, so a `render` that calls hooks keeps them to itself.
const PreviewerOutput = ({ previewer, ...props }: OutputProps) => <>{previewer.render(props)}</>;

// Why a file couldn't be shown: the adapter's message, the server's answer, or else a general one.
const errorMessage = (error: unknown, text: FileManagerLocaleText) => {
    if (error instanceof ResponseError) {
        return text.serverError(error.status, error.statusText && isolate(error.statusText));
    }

    return error instanceof Error && error.message ? isolate(error.message) : text.previewLoadFailed;
};

// Some phones' browsers have no PDF viewer, and a frame would show nothing; older ones don't say.
const showsPdf = () => typeof navigator === "undefined" || navigator.pdfViewerEnabled !== false;

const sameEntries = (a: FileEntry[], b: FileEntry[]) =>
    a.length === b.length && a.every((entry, index) => entry === b[index]);

// As large as the page allows, up to a size that still reads as a dialog, or all of it while it
// fills the screen.
const dialogSx: SxProps<Theme> = {
    [`& .${dialogClasses.paper}`]: {
        width: "min(72rem, 100% - 2rem)",
        height: "min(54rem, 100% - 2rem)",
        maxWidth: "none",
        maxHeight: "none",
        m: 2,
    },
    [`&[data-maximized="true"] .${dialogClasses.paper}`]: {
        width: "100%",
        height: "100%",
        m: 0,
        border: 0,
        borderRadius: 0,
    },
};

// A container, so its buttons fit the room the dialog has.
const headerSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    minHeight: 56,
    py: 1,
    paddingInlineStart: 2,
    paddingInlineEnd: 1,
    containerType: "inline-size",
    containerName: PREVIEW_HEADER_CONTAINER,
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
    display: "none",
    minWidth: "4.5em",
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    [previewHeaderMedium]: { display: "block" },
};

const buttonsSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
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

const columnSx: SxProps<Theme> = {
    alignSelf: "stretch",
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
};

// A previewer of the app's own fills the body, scrolling as it needs to.
const customSx: SxProps<Theme> = {
    position: "relative",
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "auto",
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
    // Each line runs, and lines up, the way its own letters do, as in a text editor, so code reads
    // left to right in a right-to-left file manager, and Arabic or Hebrew lines right to left.
    unicodeBidi: "plaintext",
    tabSize: 4,
    touchAction: "pan-y pinch-zoom",
    outline: "none",
    "&:focus-visible": focusOutline,
};

const noteSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 1,
    px: 2,
    py: 0.5,
    borderTop: 1,
    borderColor: "divider",
    color: "text.secondary",
};

// A font's characters and its sample at several sizes, each line running the way its letters do.
const specimenSx: SxProps<Theme> = {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    p: 3,
    display: "flex",
    flexDirection: "column",
    gap: 2.5,
    touchAction: "pan-y pinch-zoom",
    outline: "none",
    "&:focus-visible": focusOutline,
};

const charactersSx: SxProps<Theme> = {
    fontSize: "2rem",
    lineHeight: 1.35,
    whiteSpace: "pre-line",
    overflowWrap: "anywhere",
    unicodeBidi: "plaintext",
};

const sampleSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 0.25,
    minWidth: 0,
};

const sampleTextSx: SxProps<Theme> = {
    lineHeight: 1.25,
    overflowWrap: "anywhere",
    unicodeBidi: "plaintext",
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

// The file's thumbnail, larger than the grid shows it, for a file there's nothing else to show of.
const pictureSx: SxProps<Theme> = {
    display: "block",
    width: "16rem",
    height: "16rem",
    maxWidth: "100%",
    objectFit: "contain",
    borderRadius: 1,
};

// While a file loads, its thumbnail stands where it will be, with the spinner over it.
const loadingSx: SxProps<Theme> = {
    position: "relative",
    alignSelf: "stretch",
    flex: 1,
    minWidth: 0,
};

const placeholderSx: SxProps<Theme> = {
    position: "absolute",
    inset: 0,
    m: "auto",
    width: "100%",
    height: "100%",
    maxWidth: "calc(100% - 2rem)",
    maxHeight: "calc(100% - 2rem)",
    objectFit: "contain",
    pointerEvents: "none",
};

const spinnerSx: SxProps<Theme> = {
    position: "absolute",
    inset: 0,
    m: "auto",
};

const audioSx: SxProps<Theme> = {
    width: "min(100%, 28rem)",
    mt: 2,
};

/**
 * The files to step through as their folder's listing has them now, once a listing newer than the
 * one they were taken from has come, so a file renamed, changed, deleted or moved meanwhile, there
 * or by an action in the header, shows as it is or goes. Files a listing hasn't caught up with, as
 * a search everywhere may find, aren't dropped for it.
 */
const useLiveEntries = (request: PreviewRequest) => {
    const { store } = useData();
    const version = useSyncExternalStore(store.subscribe, store.version);
    const state = store.get(folderKey(request.section.id, folderOf(request.section, request.trail).id));
    const listing = state?.status === "ready" && !state.partial ? state.entries : undefined;
    const [baseline, setBaseline] = useState<Baseline>(() => ({ entries: request.entries, listing }));

    if (baseline.entries !== request.entries) {
        setBaseline({ entries: request.entries, listing });
    }

    return useMemo(() => {
        if (!listing || listing === baseline.listing) {
            return request.entries;
        }

        const byId = new Map(listing.map((entry) => [entry.id, entry]));
        const now = request.entries.flatMap((entry) => {
            const listed = byId.get(entry.id);

            return listed?.kind === "file" ? [listed] : [];
        });

        return sameEntries(now, request.entries) ? request.entries : now;
        // `version` stands for the listings read through the store.
    }, [request.entries, listing, baseline.listing, version]);
};

/**
 * Shows files one at a time, as GNOME's and macOS's previewers do: images, videos, audio and PDFs
 * as the browser shows them, the start of text files, a font's specimen, the app's own previewers
 * for the kinds they take, and an icon or the thumbnail with the file's details for the rest. The
 * arrows, Home and End, the buttons, or a swipe on touch step through the files it was given, F
 * fills the screen with it, and Space or Escape closes it. The header has the app's actions for the
 * file shown, Download and Full screen.
 *
 * The adapter's `content` says where each file's contents are. A URL is used as it is; a `Blob` is
 * shown through an object URL. The next file loads once the one shown has, so stepping on shows
 * it at once (see `usePreviewContents`). The files follow their folder's listing, so one renamed or
 * deleted meanwhile shows as it is, or makes way for the next.
 */
const PreviewDialog = ({
    open,
    request,
    disableRestoreFocus,
    previewers,
    actionsFor,
    announcement,
    onClose,
    onClosed,
    onStep,
    onDownload,
}: PreviewDialogProps) => {
    const { adapter } = request;
    const { text, formatNumber, formatSize, describeDate, describeSize, describeType } = useLocale();
    const dir = useContext(DirectionContext);

    // The files as they're listed now, or as they were last, while the preview fades out once
    // none is left.
    const live = useLiveEntries(request);
    const [kept, setKept] = useState(live);

    if (live.length > 0 && live !== kept) {
        setKept(live);
    }

    const entries = live.length > 0 ? live : kept;
    const count = entries.length;

    const [shown, setShown] = useState<Shown>(() => {
        const index = Math.min(Math.max(request.index, 0), request.entries.length - 1);

        return { id: request.entries[index].id, index };
    });
    const found = entries.findIndex((candidate) => candidate.id === shown.id);
    const index = found >= 0 ? found : Math.min(shown.index, count - 1);
    // The way the last step went, where the file loaded ahead lies.
    const [direction, setDirection] = useState<1 | -1>(1);
    const [dimensions, setDimensions] = useState<Dimensions | null>(null);
    const [maximized, setMaximized] = useState(false);
    const maximizedRef = useRef(false);
    // Whether the page fills the screen because the preview asked, so it leaves it as it closes.
    const ownsScreen = useRef(false);
    const viewerRef = useRef<ImageViewerHandle>(null);
    const slideRef = useRef<HTMLDivElement>(null);
    const titleId = useId();

    const entry = entries[index];
    const planOf = useCallback((file: FileEntry) => planPreview(file, adapter, previewers), [adapter, previewers]);
    const plan = planOf(entry);
    const { kind } = plan;
    const size = dimensions?.id === entry.id ? dimensions : null;
    const {
        content: loaded,
        attempt,
        fail,
        retry,
        more,
    } = usePreviewContents({
        adapter,
        entries,
        index,
        // Nothing more is loaded while the preview fades out.
        ahead: open ? direction : null,
        // A picture or a video is still coming until the browser has measured it.
        pending: (kind === "image" || kind === "video") && !size,
        planOf,
    });
    // The thumbnail stands in while a picture, a video or a PDF loads, and for a file there's
    // nothing else to show of.
    const thumbnail = useThumbnail(
        entry,
        kind === "text" || kind === "font" || kind === "audio" ? undefined : adapter,
        "grid",
        GRID_THUMBNAIL,
    );

    // The file shown went, deleted, moved or renamed away, and the one now in its place shows;
    // with none left, the preview closes.
    useEffect(() => {
        if (entry.id !== shown.id) {
            onStep(request, entry);
        }

        if (entry.id !== shown.id || index !== shown.index) {
            setShown({ id: entry.id, index });
        }
    }, [entry, index, shown, request, onStep]);

    useEffect(() => {
        if (open && live.length === 0) {
            onClose();
        }
    }, [open, live.length, onClose]);

    const fill = useCallback((next: boolean) => {
        maximizedRef.current = next;
        setMaximized(next);
    }, []);

    // Fills the screen, through the Fullscreen API where the browser has it, with the whole page so
    // the menus and dialogs opened over the preview still show, and the preview over all of it.
    // Where it hasn't, as on an iPhone, the preview still fills the window.
    const toggleFullScreen = useCallback(() => {
        if (maximizedRef.current) {
            fill(false);

            if (ownsScreen.current) {
                ownsScreen.current = false;
                exitFullscreen();
            }

            return;
        }

        fill(true);

        if (fullscreenEnabled() && !fullscreenElement()) {
            ownsScreen.current = true;
            enterFullscreen(document.documentElement).then(
                () => {
                    // Left again before the browser had filled the screen.
                    if (!maximizedRef.current && ownsScreen.current) {
                        ownsScreen.current = false;
                        exitFullscreen();
                    }
                },
                () => {
                    ownsScreen.current = false;
                },
            );
        }
    }, [fill]);

    // Leaving full screen the browser's way, with Escape or its own controls, leaves it here too.
    useEffect(() => {
        const handleChange = () => {
            if (ownsScreen.current && !fullscreenElement()) {
                ownsScreen.current = false;
                fill(false);
            }
        };

        FULLSCREEN_EVENTS.forEach((name) => document.addEventListener(name, handleChange));

        return () => {
            FULLSCREEN_EVENTS.forEach((name) => document.removeEventListener(name, handleChange));

            if (ownsScreen.current) {
                ownsScreen.current = false;
                exitFullscreen();
            }
        };
    }, [fill]);

    // Closing leaves the screen to the page as it was.
    useEffect(() => {
        if (!open && ownsScreen.current) {
            ownsScreen.current = false;
            exitFullscreen();
        }
    }, [open]);

    // Escape first leaves full screen, as it does a browser's; a second one closes.
    const handleClose: DialogProps["onClose"] = (_event, reason) => {
        if (reason === "escapeKeyDown" && maximizedRef.current) {
            toggleFullScreen();
        } else {
            onClose();
        }
    };

    const slotProps = useMemo(
        () => ({
            paper: { sx: dialogPaperSx },
            transition: { onExited: onClosed },
        }),
        [onClosed],
    );

    const canStep = (delta: 1 | -1) => index + delta >= 0 && index + delta < count;

    const show = (target: number) => {
        setShown({ id: entries[target].id, index: target });
        onStep(request, entries[target]);
    };

    // A step by a button or a key slides the file in, as a swipe does.
    const step = (delta: 1 | -1, slide = true) => {
        if (canStep(delta)) {
            show(index + delta);
            setDirection(delta);

            if (slide) {
                swipe.slide(delta);
            }
        }
    };

    const showEnd = (last: boolean) => {
        const target = last ? count - 1 : 0;

        if (target !== index) {
            const delta = target > index ? 1 : -1;

            show(target);
            setDirection(delta);
            swipe.slide(delta);
        }
    };

    const swipe = useSwipe({
        ref: slideRef,
        canStep,
        onStep: (delta) => step(delta, false),
        // Zoomed in, a picture pans with the finger up to its edge, and the swipe takes it on from there.
        room: () => viewerRef.current?.room() ?? null,
    });

    // The app's actions for the file shown, and the header's own: Download and Full screen.
    const appActions = useMemo(() => actionsFor(request, entry), [actionsFor, request, entry]);
    const headerActions = useMemo((): ToolbarGroup[] => {
        const own: ToolbarGroup = {
            id: "preview",
            actions: [
                ...(canDownload(adapter, [entry])
                    ? [
                          {
                              id: "download",
                              label: text.download,
                              icon: "download" as const,
                              disabled: false,
                              destructive: false,
                              keep: true,
                              run: () => onDownload(request, entry),
                          },
                      ]
                    : []),
                {
                    id: "fullScreen",
                    label: maximized ? text.exitFullScreen : text.fullScreen,
                    icon: maximized ? ("fullScreenExit" as const) : ("fullScreen" as const),
                    shortcut: "F",
                    disabled: false,
                    destructive: false,
                    keep: true,
                    run: toggleFullScreen,
                },
            ],
        };

        return [...appActions, own];
    }, [appActions, adapter, entry, maximized, text, toggleFullScreen, onDownload, request]);

    // The browser couldn't load the URL, or can't show what it holds.
    const handleMediaError = () => fail(entry, new Error(text.previewMediaFailed));

    // What a previewer of the app's own is handed, the same objects while they're the same, so one
    // that loads more itself as they change doesn't load again for every render.
    const failShown = useCallback((error: unknown) => fail(entry, error), [fail, entry]);
    const handed = useMemo(
        () => (loaded?.status === "url" ? { url: loaded.url, blob: loaded.blob } : undefined),
        [loaded],
    );

    const measure = (width: number, height: number) => setDimensions({ id: entry.id, width, height });

    // An image takes its zoom and turn keys first, and the arrows while it's zoomed in, to pan it.
    // Left and Right step through the files, swapped when the page runs right to left, except in a
    // player, which seeks with them, and Home and End go to the first and last, except where they
    // scroll. Space closes, as in GNOME's and macOS's previewers, except on what Space presses or
    // plays; a key held down from opening it doesn't close it again. F fills the screen. The app's
    // actions' shortcuts come last, and none of these is taken from a field a previewer types in.
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        // A menu opened from the header portals out of the dialog, though its keys bubble here.
        if (
            event.defaultPrevented ||
            typesInField(event) ||
            !(event.target instanceof Node && event.currentTarget.contains(event.target))
        ) {
            return;
        }

        if (viewerRef.current?.keyDown(event)) {
            event.preventDefault();
            return;
        }

        const target = event.target instanceof Element ? event.target : null;
        const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
        let handled = plain;

        if (!plain) {
            // Not one of the preview's own keys.
        } else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !target?.closest("video, audio")) {
            step((event.key === "ArrowRight") !== isRtl(event.currentTarget) ? 1 : -1);
        } else if (
            (event.key === "Home" || event.key === "End") &&
            !target?.closest("video, audio, [data-preview-scroll]")
        ) {
            showEnd(event.key === "End");
        } else if (event.key === " " && !event.repeat && !target?.closest("button, a, video, audio")) {
            onClose();
        } else if (pressesKey(event, "f") && !event.repeat) {
            toggleFullScreen();
        } else {
            handled = false;
        }

        if (handled || runToolbarShortcut(event, appActions)) {
            event.preventDefault();
        }
    };

    const details = joinIsolated(
        [
            describeType(entry),
            entry.size === undefined ? null : describeSize(entry),
            size && size.width > 0 && size.height > 0
                ? joinIsolated([formatNumber(size.width), formatNumber(size.height)], " × ")
                : null,
        ].filter((part): part is string => part !== null),
    );

    const media = entry.media;
    const expected =
        media?.width && media.height && kind === "image" ? { width: media.width, height: media.height } : undefined;

    // "Showing the first 256 kB", with Show more, under a text file cut short.
    const truncatedNote = (excerpt: { truncated: boolean; limit: number }, reading: boolean | undefined) =>
        excerpt.truncated && (
            <Box sx={noteSx}>
                <Typography variant="caption">{text.previewTruncated(isolate(formatSize(excerpt.limit)))}</Typography>
                <Button
                    size="small"
                    color="inherit"
                    disabled={reading}
                    onClick={() => more(entry, excerpt.limit + TEXT_LIMIT)}
                >
                    {text.previewShowMore}
                </Button>
                {reading && <CircularProgress size={14} aria-label={text.loading} />}
            </Box>
        );

    const unavailable = (message = text.previewUnavailable, extra?: ReactNode) => (
        <Box sx={stateSx}>
            {thumbnail ? (
                <Box component="img" src={thumbnail} alt="" draggable={false} sx={pictureSx} />
            ) : (
                <FileTypeIcon fileName={entry.name} size="5rem" />
            )}
            <Typography sx={stateTitleSx}>{message}</Typography>
            {entry.modifiedAt && (
                <Typography variant="body2">{text.modifiedOn(isolate(describeDate(entry)))}</Typography>
            )}
            {extra}
        </Box>
    );

    let body: ReactNode;

    if (loaded?.status === "error") {
        body = (
            <Box sx={stateSx} role="alert">
                <Icon name="info" sx={stateIconSx} />
                <Typography sx={stateTitleSx}>{text.previewFailed}</Typography>
                <Typography variant="body2">{errorMessage(loaded.error, text)}</Typography>
                <Button size="small" variant="outlined" onClick={() => retry(entry)}>
                    {text.tryAgain}
                </Button>
            </Box>
        );
    } else if (kind === "none" || loaded?.status === "binary") {
        body = unavailable();
    } else if (!loaded && plan.reads !== "none") {
        body = (
            <Box sx={loadingSx}>
                {thumbnail && (
                    <Box component="img" src={thumbnail} alt="" draggable={false} sx={placeholderSx} style={expected} />
                )}
                <CircularProgress size={28} aria-label={text.loading} sx={spinnerSx} />
            </Box>
        );
    } else if (kind === "custom" && plan.previewer) {
        const excerpt = loaded?.status === "text" ? loaded.excerpt : undefined;

        body = (
            <Box sx={columnSx}>
                <Box sx={customSx}>
                    <PreviewerBoundary key={`${previewKey(entry)}:${attempt}`} onError={failShown}>
                        <Suspense fallback={<CircularProgress size={28} aria-label={text.loading} sx={spinnerSx} />}>
                            <PreviewerOutput
                                previewer={plan.previewer}
                                entry={entry}
                                adapter={adapter}
                                content={handed}
                                text={excerpt?.text}
                                truncated={!!excerpt?.truncated}
                                onError={failShown}
                            />
                        </Suspense>
                    </PreviewerBoundary>
                </Box>
                {loaded?.status === "text" && truncatedNote(loaded.excerpt, loaded.more)}
            </Box>
        );
    } else if (loaded?.status === "text") {
        body = loaded.excerpt.text ? (
            <Box sx={columnSx}>
                {/* Tabbable, so it scrolls from the keyboard too. */}
                <Box component="pre" sx={textSx} tabIndex={0} aria-label={entry.name} data-preview-scroll>
                    {loaded.excerpt.text}
                </Box>
                {truncatedNote(loaded.excerpt, loaded.more)}
            </Box>
        ) : (
            <Box sx={stateSx}>
                <FileTypeIcon fileName={entry.name} size="5rem" />
                <Typography sx={stateTitleSx}>{text.fileEmpty}</Typography>
            </Box>
        );
    } else if (loaded?.status === "font") {
        const family = { fontFamily: `"${loaded.family}"` };

        body = (
            <Box sx={columnSx}>
                {/* Tabbable, so it scrolls from the keyboard too. */}
                <Box sx={specimenSx} tabIndex={0} aria-label={entry.name} data-preview-scroll>
                    <Box sx={charactersSx} style={family}>
                        {text.previewFontCharacters}
                    </Box>
                    {FONT_SIZES.map((fontSize) => (
                        <Box key={fontSize} sx={sampleSx}>
                            <Typography variant="caption" color="text.secondary">
                                {text.previewFontSize(formatNumber(fontSize))}
                            </Typography>
                            <Box sx={sampleTextSx} style={{ ...family, fontSize }}>
                                {text.previewFontSample}
                            </Box>
                        </Box>
                    ))}
                </Box>
            </Box>
        );
    } else if (loaded?.status !== "url") {
        body = unavailable();
    } else if (kind === "image") {
        body = (
            <ImageViewer
                key={previewKey(entry)}
                ref={viewerRef}
                src={loaded.url}
                alt={entry.name}
                placeholder={thumbnail}
                expected={expected}
                onLoad={measure}
                onError={handleMediaError}
            />
        );
    } else if (kind === "video") {
        body = (
            <Box
                key={previewKey(entry)}
                component="video"
                src={loaded.url}
                poster={thumbnail ?? undefined}
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
                    key={previewKey(entry)}
                    component="audio"
                    src={loaded.url}
                    controls
                    preload="metadata"
                    sx={audioSx}
                    onError={handleMediaError}
                />
            </Box>
        );
    } else if (!showsPdf()) {
        // The browser has no viewer of its own to show it in a frame, so it's left to the browser
        // in a tab, which hands it to the system's viewer, or saves it.
        body = unavailable(
            text.previewPdfUnavailable,
            <Button
                size="small"
                variant="outlined"
                onClick={() => window.open(loaded.url, "_blank", "noopener,noreferrer")}
            >
                {text.previewOpenInTab}
            </Button>,
        );
    } else {
        body = <Box key={previewKey(entry)} component="iframe" src={loaded.url} title={entry.name} sx={frameSx} />;
    }

    return (
        <Dialog
            dir={dir}
            open={open}
            maxWidth={false}
            sx={dialogSx}
            slotProps={slotProps}
            disableRestoreFocus={disableRestoreFocus}
            aria-labelledby={titleId}
            data-maximized={maximized}
            onClose={handleClose}
            onKeyDown={handleKeyDown}
        >
            <Box sx={headerSx}>
                <FileTypeIcon fileName={entry.name} size="1.75rem" />
                <Box sx={titleSx}>
                    <Typography id={titleId} component="h2" variant="body1" noWrap sx={nameSx}>
                        <bdi>{entry.name}</bdi>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                        {details}
                    </Typography>
                </Box>
                {count > 1 && (
                    <Box sx={stepperSx}>
                        <TooltipIconButton label={text.previous} disabled={index === 0} onClick={() => step(-1)}>
                            <Icon name="chevronLeft" />
                        </TooltipIconButton>
                        <Typography variant="body2" color="text.secondary" sx={counterSx} aria-hidden>
                            {joinIsolated([formatNumber(index + 1), formatNumber(count)], " / ")}
                        </Typography>
                        <TooltipIconButton label={text.next} disabled={index === count - 1} onClick={() => step(1)}>
                            <Icon name="chevronRight" />
                        </TooltipIconButton>
                    </Box>
                )}
                <Box sx={buttonsSx}>
                    <ToolbarActions
                        groups={headerActions}
                        moreLabel={text.moreActions}
                        inline={INLINE_ACTIONS}
                        wide={previewHeaderWide}
                    />
                    <TooltipIconButton label={text.close} onClick={onClose}>
                        <Icon name="close" />
                    </TooltipIconButton>
                </Box>
            </Box>
            <Box sx={bodySx} {...swipe.handlers}>
                <Box ref={slideRef} sx={slideSx}>
                    {body}
                </Box>
            </Box>
            {/* Screen readers hear which file the arrows stepped to. */}
            <Box sx={visuallyHiddenSx} role="status">
                {count > 1 ? text.previewPosition(isolate(entry.name), index + 1, count) : ""}
            </Box>
            <Announcer announcement={announcement} />
        </Dialog>
    );
};

export default PreviewDialog;
