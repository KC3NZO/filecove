import { Component, Suspense, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useLocale } from "../../hooks/use-locale";
import { useThumbnail } from "../../hooks/use-thumbnail";
import { ASSET_PICTURE, ROW_PICTURE, TILE_LAYOUTS } from "../../styles/media-layout";
import { sameEntry } from "../../store/folder-store";
import { focusLost } from "../../utils/dom";
import { KIND_ICONS } from "../../utils/media";
import { readText } from "../../utils/preview";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import { FileTypeIcon } from "../icons/file-icon";
import Icon from "../icons/icon";
import PropertiesPanel from "../properties/properties-panel";
import Button from "../ui/button";
import CircularProgress from "../ui/circular-progress";
import Text from "../ui/text";
import AssetDelete from "./asset-delete";
import { HoldBar } from "./asset-hold";
import { fmClasses } from "../../styles/classes";
import { cx } from "../../utils/cx";
import styles from "./media-asset.module.css";

import type { PropertiesCache } from "../../store/properties-cache";
import type {
    AssetHold,
    FileAdapter,
    FileEntry,
    FilePreviewer,
    MediaLayout,
    MediaSection,
    PropertiesItem,
    PropertyDefinitionGroup,
} from "../../types";

interface MediaAssetProps {
    entry: FileEntry;
    section: MediaSection;
    /** How its library shows it, whose smaller picture stands in while its own loads. */
    layout: MediaLayout;
    /** The library's adapter, its own or the media manager's. */
    adapter: FileAdapter;
    /** The name of the library or group it's in, which its back button goes to. */
    backTo: string;
    /** Whether it can be chosen here, which shows the Select toggle: an asset, or a group that can be selected. */
    choosing: boolean;
    selected: boolean;
    /** Why it can't be chosen now, shown under the header, with Select held unless it's selected. */
    hold: AssetHold | undefined;
    /** The backend's work on it while it can be chosen all the same, shown as a hold is. */
    work: AssetHold | undefined;
    /** What shows assets of its library: the library's own previewers, then the media manager's. */
    previewers: readonly FilePreviewer[];
    /** What it shows: the library's own definitions, or the media manager's; the adapter's groups without. */
    definitions: readonly PropertyDefinitionGroup[] | undefined;
    onBack: () => void;
    /** Goes to the asset before or after it in the library as shown; missing at either end. */
    onPrevious: (() => void) | undefined;
    onNext: (() => void) | undefined;
    onToggleSelected: () => void;
    /** Opens what can be asked of it, while there's anything. */
    onProcess: (() => void) | undefined;
    /** Opens a group's form, while it has one. */
    onEdit: (() => void) | undefined;
    /** Opens where it can be moved to, while it can be. */
    onMove: (() => void) | undefined;
    /** Whether any of those is shown over it: it's hidden, but stays as it was, and takes the focus back. */
    covered: boolean;
    /** Whether it can be deleted, which shows the Delete button. */
    deletable: boolean;
    onDeleted: () => void;
    /** Left while its delete was being asked for, which the backend may have done by then. */
    onDeleteLeft: () => void;
    /** Lists the library again once a field of the asset's is saved. */
    onUpdated: () => void;
    propertiesCache: PropertiesCache;
}

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

/** The first previewer that accepts an entry, of those that can get what they read. */
const previewerOf = (previewers: readonly FilePreviewer[], entry: FileEntry, adapter: FileAdapter) =>
    previewers.find((each) => ((each.reads ?? "content") === "none" || !!adapter.content) && each.accepts(entry));

// An asset without its backend's work on it, or with only whether there's any and how it ended.
const withoutWork = (entry: FileEntry): FileEntry => ({ ...entry, processing: undefined });
const withWorkStatus = (entry: FileEntry): FileEntry => ({
    ...entry,
    processing: entry.processing && { status: entry.processing.status },
});

/**
 * An asset as it was until it's changed by more than `shape` leaves out, so a bit of progress doesn't
 * load again what's made from it: a video playing while it's processed would start over.
 */
const useSteadyEntry = (entry: FileEntry, shape: (entry: FileEntry) => FileEntry) => {
    const [steady, setSteady] = useState(entry);

    if (steady !== entry && !sameEntry(shape(steady), shape(entry))) {
        setSteady(entry);

        return entry;
    }

    return steady;
};

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
            <div className={styles.preview}>
                <div role="alert" className={styles.previewState}>
                    <bdi>{messageOf(loaded.error) ?? text.mediaPreviewFailed}</bdi>
                    <Button size="small" onClick={retry}>
                        {text.tryAgain}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.preview}>
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
        </div>
    );
};

/**
 * The asset's picture, as large as the view has room for, the tile's smaller one standing in while it
 * loads, or its type's icon: what's shown of an asset no previewer shows.
 */
const Picture = ({
    entry,
    section,
    layout,
    adapter,
}: Pick<MediaAssetProps, "entry" | "section" | "layout" | "adapter">) => {
    const { kind } = section;
    const large = useThumbnail(entry, adapter, "grid", ASSET_PICTURE);
    const small = useThumbnail(
        entry,
        adapter,
        layout,
        layout === "list" ? ROW_PICTURE : TILE_LAYOUTS[kind].thumbnail,
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
    listed,
    section,
    layout,
    adapter,
    previewers,
}: Pick<MediaAssetProps, "entry" | "section" | "layout" | "adapter" | "previewers"> & {
    /** The asset as it is now, for its picture, asked for again only as its work ends. */
    listed: FileEntry;
}) => {
    const previewer = previewerOf(previewers, entry, adapter);

    return (
        <div className={styles.stage} data-previewer={!!previewer}>
            {previewer ? (
                <Preview key={previewer.id} entry={entry} adapter={adapter} previewer={previewer} />
            ) : (
                <Picture entry={listed} section={section} layout={layout} adapter={adapter} />
            )}
        </div>
    );
};

/**
 * One asset in the library's place: shown by the app's previewers, or its picture, with the
 * properties its adapter hands over, editable where the library is, a way back to the library, to
 * the assets before and after it, and, while the app takes a choice, a toggle selecting it. A group
 * opens here for its fields, to be edited, moved or deleted, with what the app's previewers show of it and nothing
 * else of an asset's.
 */
const MediaAsset = ({
    entry,
    section,
    layout,
    adapter,
    backTo,
    choosing,
    selected,
    hold,
    work,
    previewers,
    definitions,
    onBack,
    onPrevious,
    onNext,
    onToggleSelected,
    onProcess,
    onEdit,
    onMove,
    covered,
    deletable,
    onDeleted,
    onDeleteLeft,
    onUpdated,
    propertiesCache,
}: MediaAssetProps) => {
    const { text } = useLocale();
    const nameId = useId();
    const holdId = useId();
    const rootRef = useRef<HTMLElement>(null);
    const opened = useRef(false);
    // The button that opened what's shown over it.
    const openerRef = useRef<HTMLElement | null>(null);
    const deleteRef = useRef<HTMLButtonElement>(null);
    const wasCovered = useRef(covered);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [confirmingFor, setConfirmingFor] = useState(entry.id);
    const standing = hold ?? work;
    const group = entry.kind === "folder";
    // What plays stays as it is while the asset's work goes on, and its details are asked for again
    // only as that starts and ends, which is when there's more of them to show.
    const staged = useSteadyEntry(entry, withoutWork);
    const detailed = useSteadyEntry(entry, withWorkStatus);
    const alone = group && !previewerOf(previewers, staged, adapter);

    // Asking about one asset says nothing of the next one gone to.
    if (confirmingFor !== entry.id) {
        setConfirmingFor(entry.id);
        setConfirmingDelete(false);
    }

    const cancelDelete = () => {
        setConfirmingDelete(false);
        deleteRef.current?.focus();
    };

    // Takes the focus as it opens, so it's read out by its name, and again when going to the next
    // one took it away, as Previous does at the first, disabled as it gets there.
    useEffect(() => {
        if (opened.current && !focusLost()) {
            return;
        }

        opened.current = true;
        rootRef.current?.focus();
    }, [entry.id]);

    // Back from what's shown over it, the focus goes to the button that opened it, or else to the view.
    useLayoutEffect(() => {
        if (wasCovered.current && !covered && focusLost()) {
            (openerRef.current?.isConnected ? openerRef.current : rootRef.current)?.focus();
        }

        wasCovered.current = covered;
    }, [covered]);

    // The button going with the focus on it, as the backend takes the work on and there's nothing more
    // to ask, the view takes the focus, so Escape still goes back.
    const offered = !!onProcess || !!onEdit || !!onMove;

    useEffect(() => {
        if (!offered && !covered && focusLost()) {
            rootRef.current?.focus();
        }
    }, [offered, deletable, covered]);

    const items = useMemo<PropertiesItem[]>(
        () => [
            {
                entry: detailed,
                adapter,
                readOnly: section.readOnly,
                onUpdated,
            },
        ],
        [detailed, adapter, section.readOnly, onUpdated],
    );

    return (
        <section
            ref={rootRef}
            tabIndex={-1}
            aria-labelledby={nameId}
            data-covered={covered}
            className={cx(styles.root, fmClasses.mediaAsset)}
            onKeyDown={(event) => {
                if (event.key === "Escape" && !event.defaultPrevented) {
                    event.preventDefault();
                    event.stopPropagation();
                    onBack();
                }
            }}
        >
            <div className={styles.header}>
                <TooltipIconButton label={text.mediaBackToLibrary(backTo)} onClick={onBack}>
                    <Icon name="arrowBack" fontSize="small" />
                </TooltipIconButton>
                <Text id={nameId} component="h2" noWrap className={styles.title}>
                    <bdi>{entry.name}</bdi>
                </Text>
                {!group && (
                    <>
                        <TooltipIconButton label={text.mediaPreviousAsset} disabled={!onPrevious} onClick={onPrevious}>
                            <Icon name="chevronLeft" fontSize="small" />
                        </TooltipIconButton>
                        <TooltipIconButton label={text.mediaNextAsset} disabled={!onNext} onClick={onNext}>
                            <Icon name="chevronRight" fontSize="small" />
                        </TooltipIconButton>
                    </>
                )}
                {onMove && (
                    <TooltipIconButton
                        label={text.mediaMove}
                        onClick={(event) => {
                            openerRef.current = event.currentTarget;
                            onMove();
                        }}
                    >
                        <Icon name="move" fontSize="small" />
                    </TooltipIconButton>
                )}
                {deletable && (
                    <TooltipIconButton
                        ref={deleteRef}
                        label={text.delete}
                        aria-expanded={confirmingDelete}
                        onClick={() => setConfirmingDelete((confirming) => !confirming)}
                    >
                        <Icon name="delete" fontSize="small" />
                    </TooltipIconButton>
                )}
                {onEdit && (
                    <Button
                        color="inherit"
                        className={styles.process}
                        onClick={(event) => {
                            openerRef.current = event.currentTarget;
                            onEdit();
                        }}
                    >
                        {text.mediaEditGroup}
                    </Button>
                )}
                {onProcess && (
                    <Button
                        color="inherit"
                        className={styles.process}
                        onClick={(event) => {
                            openerRef.current = event.currentTarget;
                            onProcess();
                        }}
                    >
                        {text.mediaProcess}
                    </Button>
                )}
                {choosing && (
                    <Button
                        variant={selected ? "contained" : "outlined"}
                        color={selected ? "primary" : "inherit"}
                        disableElevation
                        aria-pressed={selected}
                        disabled={!!hold && !selected}
                        aria-describedby={hold ? holdId : undefined}
                        startIcon={selected ? <Icon name="check" fontSize="small" /> : undefined}
                        className={styles.select}
                        onClick={onToggleSelected}
                    >
                        {text.mediaSelectAsset}
                    </Button>
                )}
            </div>
            {deletable && confirmingDelete && (
                <AssetDelete
                    key={entry.id}
                    entry={entry}
                    adapter={adapter}
                    onCancel={cancelDelete}
                    onDeleted={onDeleted}
                    onLeft={onDeleteLeft}
                />
            )}
            {standing && (
                <div id={holdId} className={styles.notice}>
                    <Text data-status={standing.status} className={styles.noticeText}>
                        <bdi>{standing.text}</bdi>
                    </Text>
                    {standing.detail && (
                        <Text className={styles.noticeDetail}>
                            <bdi>{standing.detail}</bdi>
                        </Text>
                    )}
                    <HoldBar hold={standing} place="view" />
                </div>
            )}
            <div className={styles.body}>
                {!alone && (
                    <Stage
                        key={entry.id}
                        entry={staged}
                        listed={entry}
                        section={section}
                        layout={layout}
                        adapter={adapter}
                        previewers={previewers}
                    />
                )}
                <div className={styles.details} data-alone={alone}>
                    <PropertiesPanel
                        items={items}
                        changes={0}
                        showHidden={false}
                        cache={propertiesCache}
                        embedded
                        ownRows={false}
                        definitions={definitions}
                    />
                </div>
            </div>
        </section>
    );
};

export default MediaAsset;
