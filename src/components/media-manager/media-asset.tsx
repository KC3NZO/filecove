import { Component, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { useThumbnail } from "../../hooks/use-thumbnail";
import { startIconSx } from "../../styles/direction";
import {
    ASSET_DETAILS_WIDTH,
    ASSET_PICTURE,
    AUDIO_ROW,
    MEDIA_ASSET_CONTAINER,
    TILE_LAYOUTS,
    assetWide,
} from "../../styles/media-layout";
import { focusOutline, forcedColors, forcedPressed } from "../../styles/mixins";
import { focusLost } from "../../utils/dom";
import { KIND_ICONS } from "../../utils/media";
import { readText } from "../../utils/preview";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import { FileTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";
import PropertiesPanel from "../properties/properties-panel";

import type { PropertiesCache } from "../../store/properties-cache";
import type {
    FileAdapter,
    FileEntry,
    FilePreviewer,
    MediaSection,
    PropertiesItem,
    PropertyDefinitionGroup,
} from "../../types";

interface MediaAssetProps {
    entry: FileEntry;
    section: MediaSection;
    /** The library's adapter, its own or the media manager's. */
    adapter: FileAdapter;
    /** Whether something can be chosen, which shows the Select toggle. */
    choosing: boolean;
    selected: boolean;
    /** What shows assets of its library: the library's own previewers, then the media manager's. */
    previewers: readonly FilePreviewer[];
    /** What it shows: the library's own definitions, or the media manager's; the adapter's groups without. */
    definitions: readonly PropertyDefinitionGroup[] | undefined;
    onBack: () => void;
    /** Goes to the asset before or after it in the library as shown; missing at either end. */
    onPrevious: (() => void) | undefined;
    onNext: (() => void) | undefined;
    onToggleSelected: () => void;
    /** Lists the library again once a field of the asset's is saved. */
    onUpdated: () => void;
    propertiesCache: PropertiesCache;
}

// Over the library, in its place, its grid kept underneath as it was, scrolled where it was.
const rootSx: SxProps<Theme> = {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    bgcolor: "background.paper",
    containerType: "inline-size",
    containerName: MEDIA_ASSET_CONTAINER,
    outline: "none",
    "&:focus-visible": { ...focusOutline, borderRadius: "inherit" },
};

const headerSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    flexShrink: 0,
    minHeight: 52,
    paddingInlineStart: 0.5,
    paddingInlineEnd: 1.5,
    borderBottom: 1,
    borderColor: "divider",
};

const titleSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    px: 0.5,
    fontSize: "0.9375rem",
    fontWeight: 700,
};

const selectSx: SxProps<Theme> = {
    flexShrink: 0,
    marginInlineStart: 1,
    ...startIconSx,
    [forcedColors]: { '&[aria-pressed="true"]': forcedPressed },
};

// Stacked, scrolling together, where it's narrow; the picture beside the details where there's
// room, each scrolling on its own.
const bodySx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    [assetWide]: { flexDirection: "row", overflowY: "hidden" },
};

const stageSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    height: "min(60cqi, 22rem)",
    m: 1.5,
    borderRadius: 2,
    overflow: "hidden",
    bgcolor: "action.hover",
    color: "text.secondary",
    "& > img": { width: "100%", height: "100%", objectFit: "contain" },
    "& > svg": { fontSize: `${AUDIO_ROW * 2}rem`, opacity: 0.6 },
    [assetWide]: { flex: 1, flexShrink: 1, height: "auto", minWidth: 0 },
    '&[data-previewer="true"]': { position: "relative", bgcolor: "transparent" },
    [forcedColors]: { outline: "1px solid CanvasText" },
};

// A previewer of the app's own fills the stage, as the preview's body is filled.
const previewSx: SxProps<Theme> = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const previewStateSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
    px: 3,
    color: "text.secondary",
    fontSize: "0.875rem",
    textAlign: "center",
};

const detailsSx: SxProps<Theme> = {
    flexShrink: 0,
    px: 2,
    pb: 2,
    [assetWide]: {
        width: ASSET_DETAILS_WIDTH,
        overflowY: "auto",
        pt: 1.5,
        borderInlineStart: 1,
        borderColor: "divider",
    },
};

/** What a previewer is handed as it's rendered, once it has loaded, or that it failed. */
type Loaded =
    | { status: "loading" }
    | { status: "ready"; content?: { url: string; blob?: Blob }; text?: string; truncated: boolean }
    | { status: "error"; error: unknown };

interface PreviewProps {
    entry: FileEntry;
    adapter: FileAdapter;
    previewer: FilePreviewer;
}

interface BoundaryProps {
    children: ReactNode;
    onError: (error: unknown) => void;
}

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : undefined);

// Nothing comes of the progress of what the preview loads, which it shows no figure for.
const ignoreProgress = () => {};

/** Tells a previewer throwing as it renders, rather than taking the media manager down with it. */
class PreviewBoundary extends Component<BoundaryProps, { failed: boolean }> {
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

const Spinner = () => {
    const { text } = useLocale();

    return <CircularProgress size={28} aria-label={text.loading} />;
};

/**
 * An asset shown by a previewer of the app's own, the library's or the media manager's, handed what
 * it reads of the adapter as the file manager's preview hands it: nothing, its contents, or the
 * start of it as text. Failing, it says so, with Try again, which loads it afresh.
 */
const Preview = ({ entry, adapter, previewer }: PreviewProps) => {
    const { text } = useLocale();
    const reads = previewer.reads ?? "content";
    const [attempt, setAttempt] = useState(0);
    const [loaded, setLoaded] = useState<Loaded>(
        reads === "none" ? { status: "ready", truncated: false } : { status: "loading" },
    );

    useEffect(() => {
        if (reads === "none" || !adapter.content) {
            return;
        }

        const controller = new AbortController();
        const { signal } = controller;
        let objectUrl: string | undefined;

        adapter
            .content(entry, { signal, purpose: "preview", onProgress: ignoreProgress })
            .then(async (content) => {
                if (reads === "text") {
                    const excerpt = await readText(content, signal);

                    if (!excerpt) {
                        throw new Error();
                    }

                    if (!signal.aborted) {
                        setLoaded({ status: "ready", text: excerpt.text, truncated: excerpt.truncated });
                    }

                    return;
                }

                const url = content.url ?? (objectUrl = URL.createObjectURL(content.blob));

                if (!signal.aborted) {
                    setLoaded({ status: "ready", content: { url, blob: content.blob }, truncated: false });
                }
            })
            .catch((error: unknown) => {
                if (!signal.aborted) {
                    setLoaded({ status: "error", error });
                }
            });

        return () => {
            controller.abort();

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [entry, adapter, reads, attempt]);

    const fail = (error: unknown) => setLoaded({ status: "error", error });

    const retry = () => {
        setLoaded(reads === "none" ? { status: "ready", truncated: false } : { status: "loading" });
        setAttempt((count) => count + 1);
    };

    if (loaded.status === "error") {
        return (
            <Box sx={previewSx}>
                <Box role="alert" sx={previewStateSx}>
                    <bdi>{messageOf(loaded.error) ?? text.mediaPreviewFailed}</bdi>
                    <Button size="small" onClick={retry}>
                        {text.tryAgain}
                    </Button>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={previewSx}>
            {loaded.status === "loading" ? (
                <Spinner />
            ) : (
                <PreviewBoundary key={attempt} onError={fail}>
                    <Suspense fallback={<Spinner />}>
                        {previewer.render({
                            entry,
                            adapter,
                            content: loaded.content,
                            text: loaded.text,
                            truncated: loaded.truncated,
                            onError: fail,
                        })}
                    </Suspense>
                </PreviewBoundary>
            )}
        </Box>
    );
};

/**
 * The asset's picture, as large as the view has room for, the tile's smaller one standing in while it
 * loads, or its type's icon: what's shown of an asset no previewer shows.
 */
const Picture = ({ entry, section, adapter }: Pick<MediaAssetProps, "entry" | "section" | "adapter">) => {
    const { kind } = section;
    const large = useThumbnail(entry, adapter, "grid", ASSET_PICTURE);
    const small = useThumbnail(
        entry,
        adapter,
        kind === "audio" ? "list" : "grid",
        kind === "audio" ? AUDIO_ROW : TILE_LAYOUTS[kind].thumbnail,
    );
    const picture = large ?? small;

    return picture ? (
        <img src={picture} alt="" draggable={false} />
    ) : kind === "audio" ? (
        <Icon name={KIND_ICONS.audio} />
    ) : (
        <FileTypeIcon fileName={entry.name} size="5rem" />
    );
};

/**
 * What the asset view shows of an asset: the first previewer that accepts it, of those that can
 * get what they read (only those reading nothing, without the adapter's `content`), or else its
 * picture. The media manager plays and renders nothing itself.
 */
const Stage = ({
    entry,
    section,
    adapter,
    previewers,
}: Pick<MediaAssetProps, "entry" | "section" | "adapter" | "previewers">) => {
    const previewer = previewers.find(
        (each) => ((each.reads ?? "content") === "none" || !!adapter.content) && each.accepts(entry),
    );

    return (
        <Box sx={stageSx} data-previewer={!!previewer}>
            {previewer ? (
                <Preview key={previewer.id} entry={entry} adapter={adapter} previewer={previewer} />
            ) : (
                <Picture entry={entry} section={section} adapter={adapter} />
            )}
        </Box>
    );
};

/**
 * One asset in the library's place: shown by the app's previewers, or its picture, with the
 * properties its adapter hands over, editable where the library is, a way back to the library, to
 * the assets before and after it, and, while the app takes a choice, a toggle selecting it.
 */
const MediaAsset = ({
    entry,
    section,
    adapter,
    choosing,
    selected,
    previewers,
    definitions,
    onBack,
    onPrevious,
    onNext,
    onToggleSelected,
    onUpdated,
    propertiesCache,
}: MediaAssetProps) => {
    const { text } = useLocale();
    const nameId = useId();
    const rootRef = useRef<HTMLElement>(null);
    const opened = useRef(false);

    // Takes the focus as it opens, so it's read out by its name, and again when going to the next
    // one took it away, as Previous does at the first, disabled as it gets there.
    useEffect(() => {
        if (opened.current && !focusLost()) {
            return;
        }

        opened.current = true;
        rootRef.current?.focus();
    }, [entry.id]);

    const items = useMemo<PropertiesItem[]>(
        () => [
            {
                entry,
                adapter,
                readOnly: section.readOnly,
                onUpdated,
            },
        ],
        [entry, adapter, section.readOnly, onUpdated],
    );

    return (
        <Box
            component="section"
            ref={rootRef}
            tabIndex={-1}
            aria-labelledby={nameId}
            sx={rootSx}
            onKeyDown={(event) => {
                if (event.key === "Escape" && !event.defaultPrevented) {
                    event.preventDefault();
                    event.stopPropagation();
                    onBack();
                }
            }}
        >
            <Box sx={headerSx}>
                <TooltipIconButton label={text.mediaBackToLibrary(section.label)} onClick={onBack}>
                    <Icon name="arrowBack" fontSize="small" />
                </TooltipIconButton>
                <Typography id={nameId} component="h2" noWrap sx={titleSx}>
                    <bdi>{entry.name}</bdi>
                </Typography>
                <TooltipIconButton label={text.mediaPreviousAsset} disabled={!onPrevious} onClick={onPrevious}>
                    <Icon name="chevronLeft" fontSize="small" />
                </TooltipIconButton>
                <TooltipIconButton label={text.mediaNextAsset} disabled={!onNext} onClick={onNext}>
                    <Icon name="chevronRight" fontSize="small" />
                </TooltipIconButton>
                {choosing && (
                    <Button
                        variant={selected ? "contained" : "outlined"}
                        color={selected ? "primary" : "inherit"}
                        disableElevation
                        aria-pressed={selected}
                        startIcon={selected ? <Icon name="check" fontSize="small" /> : undefined}
                        sx={selectSx}
                        onClick={onToggleSelected}
                    >
                        {text.mediaSelectAsset}
                    </Button>
                )}
            </Box>
            <Box sx={bodySx}>
                <Stage key={entry.id} entry={entry} section={section} adapter={adapter} previewers={previewers} />
                <Box sx={detailsSx}>
                    <PropertiesPanel
                        items={items}
                        changes={0}
                        showHidden={false}
                        cache={propertiesCache}
                        embedded
                        ownRows={false}
                        definitions={definitions}
                    />
                </Box>
            </Box>
        </Box>
    );
};

export default MediaAsset;
