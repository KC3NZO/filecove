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

import { DirectionContext } from "../../../contexts/direction-context";
import { useData } from "../../../hooks/use-folder";
import { useLocale } from "../../../hooks/use-locale";
import { usePreviewContents } from "../../../hooks/use-preview-contents";
import { useSwipe } from "../../../hooks/use-swipe";
import { useThumbnail } from "../../../hooks/use-thumbnail";
import { folderKey } from "../../../store/folder-store";
import { GRID_SIZES, GRID_START } from "../../../styles/layout";
import { fmClasses } from "../../../styles/classes";
import { cx } from "../../../utils/cx";
import util from "../../../styles/util.module.css";
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
import Button from "../../ui/button";
import CircularProgress from "../../ui/circular-progress";
import Dialog from "../../ui/dialog";
import type { DialogCloseReason } from "../../ui/dialog";
import Text from "../../ui/text";
import Announcer from "../announcer";
import ImageViewer from "./image-viewer";
import styles from "./preview-dialog.module.css";

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

/** A file the preview steps through, with where it is. */
export interface PreviewFile {
    entry: FileEntry;
    section: Section;
    /** The section's adapter. */
    adapter: FileAdapter;
    /** Trail to the folder the file is in. */
    trail: FolderRef[];
}

export interface PreviewRequest {
    /**
     * The files to step through, in order: those of one folder, or for a search's results, of
     * several, of one section or more.
     */
    files: PreviewFile[];
    /** Where in `files` to start. */
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
    actionsFor: (request: PreviewRequest, file: PreviewFile) => ToolbarGroup[];
    /**
     * What the file manager tells screen readers while the preview is open, said from inside it,
     * since the modal hides the rest of the page from them.
     */
    announcement: Announcement | null;
    onClose: () => void;
    /** Called once the dialog has faded out. */
    onClosed: () => void;
    /** Called as the dialog steps to another file, or shows another as the one shown goes. */
    onStep: (request: PreviewRequest, file: PreviewFile) => void;
    /** Called to save the file shown, from the header's Download button. */
    onDownload: (file: PreviewFile) => void;
}

/** An image's or a video's own size, once it has loaded: 0 for a picture with none, such as some SVGs. */
interface Dimensions {
    id: string;
    width: number;
    height: number;
}

/** The file shown, by its id and adapter, and where it was, so the one taking its place shows if it goes. */
interface Shown {
    id: string;
    adapter: FileAdapter;
    index: number;
}

/** The listings, by folder key, the files were last taken as, so only a newer one changes them. */
interface Baseline {
    files: PreviewFile[];
    listings: ReadonlyMap<string, FileEntry[] | undefined>;
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

const sameFiles = (a: PreviewFile[], b: PreviewFile[]) =>
    a.length === b.length && a.every((file, index) => file === b[index]);

/** The store's key of the folder a file is in. */
const folderKeyOf = ({ section, trail }: PreviewFile) => folderKey(section.id, folderOf(section, trail).id);

/**
 * The files to step through as their folders' listings have them now, once a listing of a folder
 * newer than the one they were taken from has come, so a file renamed, changed, deleted or moved
 * meanwhile, there or by an action in the header, shows as it is or goes. Files a listing hasn't
 * caught up with, as a search everywhere may find, aren't dropped for it.
 */
const useLiveFiles = (request: PreviewRequest) => {
    const { store } = useData();
    const version = useSyncExternalStore(store.subscribe, store.version, store.version);
    // Each folder's listing, once all of it has come.
    const listings = useMemo(() => {
        const found = new Map<string, FileEntry[] | undefined>();

        request.files.forEach((file) => {
            const key = folderKeyOf(file);

            if (!found.has(key)) {
                const state = store.get(key);

                found.set(key, state?.status === "ready" && !state.partial ? state.entries : undefined);
            }
        });

        return found;
        // `version` stands for the listings read through the store.
    }, [request.files, store, version]);
    const [baseline, setBaseline] = useState<Baseline>(() => ({ files: request.files, listings }));

    if (baseline.files !== request.files) {
        setBaseline({ files: request.files, listings });
    }

    return useMemo(() => {
        const byListing = new Map<FileEntry[], Map<string, FileEntry>>();
        const now = request.files.flatMap((file) => {
            const key = folderKeyOf(file);
            const listing = listings.get(key);

            if (!listing || listing === baseline.listings.get(key)) {
                return [file];
            }

            const byId = byListing.get(listing) ?? new Map(listing.map((entry) => [entry.id, entry]));
            const listed = byId.get(file.entry.id);

            byListing.set(listing, byId);

            if (listed?.kind !== "file") {
                return [];
            }

            return [listed === file.entry ? file : { ...file, entry: listed }];
        });

        return sameFiles(now, request.files) ? request.files : now;
    }, [request.files, listings, baseline.listings]);
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
    const { text, formatNumber, formatSize, describeDate, describeSize, describeType } = useLocale();
    const dir = useContext(DirectionContext);

    // The files as they're listed now, or as they were last, while the preview fades out once
    // none is left.
    const live = useLiveFiles(request);
    const [kept, setKept] = useState(live);

    if (live.length > 0 && live !== kept) {
        setKept(live);
    }

    const files = live.length > 0 ? live : kept;
    const entries = useMemo(() => files.map((file) => file.entry), [files]);
    // Each file's adapter, as the files may come from several sections.
    const adapters = useMemo(() => new Map(files.map((file) => [file.entry, file.adapter])), [files]);
    const count = entries.length;

    const [shown, setShown] = useState<Shown>(() => {
        const index = Math.min(Math.max(request.index, 0), request.files.length - 1);
        const { entry, adapter } = request.files[index];

        return { id: entry.id, adapter, index };
    });
    const found = files.findIndex(({ entry, adapter }) => entry.id === shown.id && adapter === shown.adapter);
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

    const file = files[index];
    const { entry, adapter } = file;
    const adapterOf = useCallback((one: FileEntry) => adapters.get(one) ?? adapter, [adapters, adapter]);
    const planOf = useCallback(
        (one: FileEntry) => planPreview(one, adapterOf(one), previewers),
        [adapterOf, previewers],
    );
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
        adapterOf,
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
        const other = entry.id !== shown.id || adapter !== shown.adapter;

        if (other) {
            onStep(request, file);
        }

        if (other || index !== shown.index) {
            setShown({ id: entry.id, adapter, index });
        }
    }, [file, entry, adapter, index, shown, request, onStep]);

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
    const handleClose = (reason: DialogCloseReason) => {
        if (reason === "escapeKeyDown" && maximizedRef.current) {
            toggleFullScreen();
        } else {
            onClose();
        }
    };

    const canStep = (delta: 1 | -1) => index + delta >= 0 && index + delta < count;

    const show = (target: number) => {
        setShown({ id: files[target].entry.id, adapter: files[target].adapter, index: target });
        onStep(request, files[target]);
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
    const appActions = useMemo(() => actionsFor(request, file), [actionsFor, request, file]);
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
                              run: () => onDownload(file),
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
    }, [appActions, adapter, entry, file, maximized, text, toggleFullScreen, onDownload]);

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
            <div className={styles.note}>
                <Text variant="caption">{text.previewTruncated(isolate(formatSize(excerpt.limit)))}</Text>
                <Button
                    size="small"
                    color="inherit"
                    disabled={reading}
                    onClick={() => more(entry, excerpt.limit + TEXT_LIMIT)}
                >
                    {text.previewShowMore}
                </Button>
                {reading && <CircularProgress size={14} aria-label={text.loading} />}
            </div>
        );

    const unavailable = (message = text.previewUnavailable, extra?: ReactNode) => (
        <div className={cx(styles.state, fmClasses.state)}>
            {thumbnail ? (
                <img src={thumbnail} alt="" draggable={false} className={styles.picture} />
            ) : (
                <FileTypeIcon fileName={entry.name} size="5rem" />
            )}
            <Text className={styles.stateTitle}>{message}</Text>
            {entry.modifiedAt && (
                <Text variant="body2">{text.modifiedOn(isolate(describeDate(entry)))}</Text>
            )}
            {extra}
        </div>
    );

    let body: ReactNode;

    if (loaded?.status === "error") {
        body = (
            <div className={cx(styles.state, fmClasses.state)} role="alert">
                <Icon name="info" className={styles.stateIcon} />
                <Text className={styles.stateTitle}>{text.previewFailed}</Text>
                <Text variant="body2">{errorMessage(loaded.error, text)}</Text>
                <Button size="small" variant="outlined" onClick={() => retry(entry)}>
                    {text.tryAgain}
                </Button>
            </div>
        );
    } else if (kind === "none" || loaded?.status === "binary") {
        body = unavailable();
    } else if (!loaded && plan.reads !== "none") {
        body = (
            <div className={styles.loading}>
                {thumbnail && (
                    <img src={thumbnail} alt="" draggable={false} className={styles.placeholder} style={expected} />
                )}
                <CircularProgress size={28} aria-label={text.loading} className={styles.spinner} />
            </div>
        );
    } else if (kind === "custom" && plan.previewer) {
        const excerpt = loaded?.status === "text" ? loaded.excerpt : undefined;

        body = (
            <div className={styles.column}>
                <div className={styles.custom}>
                    <PreviewerBoundary key={`${previewKey(entry)}:${attempt}`} onError={failShown}>
                        <Suspense fallback={<CircularProgress size={28} aria-label={text.loading} className={styles.spinner} />}>
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
                </div>
                {loaded?.status === "text" && truncatedNote(loaded.excerpt, loaded.more)}
            </div>
        );
    } else if (loaded?.status === "text") {
        body = loaded.excerpt.text ? (
            <div className={styles.column}>
                {/* Tabbable, so it scrolls from the keyboard too. */}
                <pre className={styles.text} tabIndex={0} aria-label={entry.name} data-preview-scroll>
                    {loaded.excerpt.text}
                </pre>
                {truncatedNote(loaded.excerpt, loaded.more)}
            </div>
        ) : (
            <div className={cx(styles.state, fmClasses.state)}>
                <FileTypeIcon fileName={entry.name} size="5rem" />
                <Text className={styles.stateTitle}>{text.fileEmpty}</Text>
            </div>
        );
    } else if (loaded?.status === "font") {
        const family = { fontFamily: `"${loaded.family}"` };

        body = (
            <div className={styles.column}>
                {/* Tabbable, so it scrolls from the keyboard too. */}
                <div className={styles.specimen} tabIndex={0} aria-label={entry.name} data-preview-scroll>
                    <div className={styles.characters} style={family}>
                        {text.previewFontCharacters}
                    </div>
                    {FONT_SIZES.map((fontSize) => (
                        <div key={fontSize} className={styles.sample}>
                            <Text variant="caption" color="secondary">
                                {text.previewFontSize(formatNumber(fontSize))}
                            </Text>
                            <div className={styles.sampleText} style={{ ...family, fontSize }}>
                                {text.previewFontSample}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
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
            <video
                key={previewKey(entry)}
                src={loaded.url}
                poster={thumbnail ?? undefined}
                controls
                preload="metadata"
                className={styles.media}
                onLoadedMetadata={(event) => measure(event.currentTarget.videoWidth, event.currentTarget.videoHeight)}
                onError={handleMediaError}
            />
        );
    } else if (kind === "audio") {
        body = (
            <div className={cx(styles.state, fmClasses.state)}>
                <FileTypeIcon fileName={entry.name} size="5rem" />
                <audio
                    key={previewKey(entry)}
                    src={loaded.url}
                    controls
                    preload="metadata"
                    className={styles.audio}
                    onError={handleMediaError}
                />
            </div>
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
        body = <iframe key={previewKey(entry)} src={loaded.url} title={entry.name} className={styles.frame} />;
    }

    return (
        <Dialog
            dir={dir}
            open={open}
            maxWidth={false}
            className={cx(styles.dialog, fmClasses.preview)}
            disableRestoreFocus={disableRestoreFocus}
            aria-labelledby={titleId}
            data-maximized={maximized}
            onClose={handleClose}
            onExited={onClosed}
            onKeyDown={handleKeyDown}
        >
            <div className={cx(styles.header, fmClasses.previewHeader)}>
                <FileTypeIcon fileName={entry.name} size="1.75rem" />
                <div className={styles.title}>
                    <Text id={titleId} component="h2" variant="body1" noWrap className={styles.name}>
                        <bdi>{entry.name}</bdi>
                    </Text>
                    <Text variant="caption" color="secondary" noWrap>
                        {details}
                    </Text>
                </div>
                {count > 1 && (
                    <div className={styles.stepper}>
                        <TooltipIconButton label={text.previous} disabled={index === 0} onClick={() => step(-1)}>
                            <Icon name="chevronLeft" />
                        </TooltipIconButton>
                        <Text variant="body2" color="secondary" className={styles.counter} aria-hidden>
                            {joinIsolated([formatNumber(index + 1), formatNumber(count)], " / ")}
                        </Text>
                        <TooltipIconButton label={text.next} disabled={index === count - 1} onClick={() => step(1)}>
                            <Icon name="chevronRight" />
                        </TooltipIconButton>
                    </div>
                )}
                <div className={styles.buttons}>
                    <ToolbarActions
                        groups={headerActions}
                        moreLabel={text.moreActions}
                        inline={INLINE_ACTIONS}
                        collapses
                    />
                    <TooltipIconButton label={text.close} onClick={onClose}>
                        <Icon name="close" />
                    </TooltipIconButton>
                </div>
            </div>
            <div className={styles.body} {...swipe.handlers}>
                <div ref={slideRef} className={styles.slide}>
                    {body}
                </div>
            </div>
            {/* Screen readers hear which file the arrows stepped to. */}
            <div className={util.visuallyHidden} role="status">
                {count > 1 ? text.previewPosition(isolate(entry.name), index + 1, count) : ""}
            </div>
            <Announcer announcement={announcement} />
        </Dialog>
    );
};

export default PreviewDialog;
