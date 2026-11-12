import { useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode, Ref } from "react";

import { useLocale } from "../../hooks/use-locale";
import { useVirtualLines } from "../../hooks/use-virtual-lines";
import { TILE_LAYOUTS } from "../../styles/media-layout";
import { isRtl } from "../../utils/dom";
import { KIND_ICONS } from "../../utils/media";
import Icon from "../icons/icon";
import Button from "../ui/button";
import CircularProgress from "../ui/circular-progress";
import LinearProgress from "../ui/linear-progress";
import Text from "../ui/text";
import AssetOption from "./asset-option";
import { fmClasses } from "../../styles/classes";
import { cx } from "../../utils/cx";
import styles from "./media-grid.module.css";
import UploadTile from "./upload-tile";

import type {
    AssetHold,
    FileAdapter,
    FileEntry,
    FileUploadItem,
    FolderRef,
    MediaAssetDraw,
    MediaGridHandle,
    MediaKind,
    MediaLayout,
    MediaPickerSlotProps,
    MediaPickerSlots,
    MediaSection,
} from "../../types";

interface MediaGridProps {
    /** The open level's assets and groups the search leaves, or what it found below, in the order shown. */
    entries: readonly FileEntry[];
    /** Where those from further down than the open level are, by their ids. */
    trails?: ReadonlyMap<string, readonly FolderRef[]>;
    /** Files being uploaded into the library, shown before its assets until they're listed. */
    uploads: readonly FileUploadItem[];
    /** The library's kind, whose tiles' shape they take, and its icon. */
    kind: MediaKind;
    /** How they're shown: as tiles, or as rows. */
    layout: MediaLayout;
    adapter: FileAdapter;
    /** What the app draws the assets with, the library's `renderAsset` or the media manager's. */
    drawAsset: MediaAssetDraw | undefined;
    /** What the app draws the groups with, the library's `renderGroup` or the media manager's. */
    drawGroup: MediaAssetDraw | undefined;
    /** Whether a group has details to open, which puts the Open button on it. */
    opensGroups: boolean;
    /** Whether an asset has a view to open, which puts the Open button on it; the picker's have none. */
    opensAssets?: boolean;
    /** What the app draws above an open group's contents. */
    header: ReactNode;
    /** The name of the library or group open, which the grid is named by for screen readers. */
    label: string;
    selectedIds: ReadonlySet<string>;
    /** Why assets can't be chosen now, by their ids, which their tiles show. */
    holds: ReadonlyMap<string, AssetHold>;
    /** The backend's work on assets that can be chosen all the same, by their ids. */
    works: ReadonlyMap<string, AssetHold>;
    /** The groups that can be selected, each with a check of its own, as a click on one goes in. */
    groupChecks?: ReadonlySet<string>;
    /** Whether as many as may be are selected (`maxChoices`), so there's no room for the others. */
    full: boolean;
    multiple: boolean;
    status: "loading" | "ready" | "error";
    /** Whether the open level has anything at all, whatever the search leaves. */
    hasMedia: boolean;
    /** Whether more of the library is still coming, page by page, or it's listed again. */
    busy: boolean;
    /** Why it couldn't be listed, as the adapter said it, or nothing. */
    error: string | undefined;
    onRetry: () => void;
    /** A click on a tile, or Space on it, with the keys held, by its index in `entries`. */
    onPress: (index: number, keys: { toggle: boolean; range: boolean }) => void;
    /** Choosing a tile on its own: a double click, or Enter, which goes into a group. */
    onActivate: (index: number) => void;
    /** Going into a group, from a click on it. */
    onEnterGroup: (index: number) => void;
    /** Going up a level, by Alt+Up; missing at the library's root. */
    onLevelUp: (() => void) | undefined;
    /** Opening an asset in the library's place: its button, or Alt+Enter. */
    onOpen: (index: number) => void;
    onSelectAll: () => void;
    /** Takes an asset or group to focus, by its index, wherever it is in the grid. */
    ref?: Ref<MediaGridHandle>;
    /** The library shown, which the app's states and attributes are handed. */
    section: MediaSection;
    /** The group open, or null at the library's root. */
    group: FileEntry | null;
    /** What's typed in the search field, for the app's `noResults`. */
    query: string;
    /** Uploads into the level as its Upload button does, for the app's `empty`; missing where it takes no files. */
    onUpload?: () => void;
    /** The app's own states, drawn in their boxes in place of the media manager's (`slots`). */
    slots: MediaPickerSlots;
    /** The app's attributes for each asset (`slotProps.asset`). */
    assetSlot: MediaPickerSlotProps["asset"];
}

/**
 * How long a level is only looked at once it's shown, in ms: the second click of a double click on a
 * group, which went in on the first, would otherwise land on whatever came under the pointer.
 */
const SETTLING = 400;

// The least width of each kind's tiles, for the grid's columns (`--tile-min`), made once.
const TILE_MIN = Object.fromEntries(
    (Object.keys(TILE_LAYOUTS) as MediaKind[]).map((kind) => [kind, `${TILE_LAYOUTS[kind].min}rem`]),
) as Record<MediaKind, string>;

const UPLOADS_STYLES = Object.fromEntries(
    (Object.keys(TILE_LAYOUTS) as MediaKind[]).map((kind) => [kind, { "--tile-min": TILE_MIN[kind] } as CSSProperties]),
) as Record<MediaKind, CSSProperties>;

// The arrow keys move the focus by a tile, or by a line; Left and Right swap right to left.
const stepOf = (event: KeyboardEvent<HTMLElement>, columns: number) => {
    const rtl = isRtl(event.currentTarget);

    switch (event.key) {
        case "ArrowRight":
            return rtl ? -1 : 1;
        case "ArrowLeft":
            return rtl ? 1 : -1;
        case "ArrowDown":
            return columns;
        case "ArrowUp":
            return -columns;
        default:
            return 0;
    }
};

/**
 * The open level's assets and groups as a grid of tiles, or a list of rows, a `listbox` of `option`s with one Tab
 * stop, which the arrow keys, Home and End move. Space selects, Enter chooses, Alt+Enter opens one in the
 * library's place, Ctrl+A selects them all. A click or Enter goes into a group, and Alt+Up back out.
 *
 * Only the assets in or near view are rendered, in lines as tall as the first one rendered, as the file
 * manager's content is (`useVirtualLines`, see `virtualization.md`), and the one with the Tab stop
 * wherever it is. So every asset is drawn as tall, and the frames focus one through `ref`'s `focusAt`
 * rather than finding it in the page.
 */
const MediaGrid = ({
    entries,
    trails,
    uploads,
    kind,
    layout,
    adapter,
    drawAsset,
    drawGroup,
    opensGroups,
    opensAssets = true,
    header,
    label,
    selectedIds,
    holds,
    works,
    groupChecks,
    full,
    multiple,
    status,
    hasMedia,
    busy,
    error,
    onRetry,
    onPress,
    onActivate,
    onEnterGroup,
    onLevelUp,
    onOpen,
    onSelectAll,
    ref,
    section,
    group,
    query,
    onUpload,
    slots,
    assetSlot,
}: MediaGridProps) => {
    const { text } = useLocale();
    const row = layout === "list";
    const listRef = useRef<HTMLElement | null>(null);
    const [focusIndex, setFocusIndex] = useState(0);
    // Set as the focus is moved, by a key or a frame, so the asset it went to takes it once it's
    // rendered in its place as the Tab stop; `asks` renders again for one asked for twice.
    const pendingFocus = useRef(false);
    const [, setAsks] = useState(0);
    const tabStop = Math.min(focusIndex, Math.max(entries.length - 1, 0));
    const [shownAt] = useState(() => performance.now());
    // The asset with the Tab stop stays rendered however far the grid is scrolled, so it keeps it.
    const { lines, settled, reveal } = useVirtualLines(entries.length, [entries.length > 0 ? tabStop : -1]);
    const setList = useCallback(
        (list: HTMLElement | null) => {
            listRef.current = list;
            lines.ref(list);
        },
        [lines.ref],
    );
    // Whether any asset shown says where a search found it, or can't be chosen now, so all keep the
    // room it takes and every one is as tall.
    const trailed = useMemo(() => !!trails && entries.some(({ id }) => trails.has(id)), [entries, trails]);
    const held = useMemo(() => entries.some(({ id }) => holds.has(id) || works.has(id)), [entries, holds, works]);

    // Once the lines are where the latest measure puts them, the asset the focus went to takes it,
    // scrolled to by the least that shows it.
    useLayoutEffect(() => {
        if (!pendingFocus.current || !settled()) {
            return;
        }

        const element = listRef.current?.querySelector<HTMLElement>(`[data-index="${tabStop}"]`);

        if (element) {
            pendingFocus.current = false;
            element.focus({ preventScroll: true });
            reveal(tabStop, element);
        }
    });

    const moveTo = useCallback((index: number) => {
        pendingFocus.current = true;
        setFocusIndex(index);
        setAsks((count) => count + 1);
    }, []);

    useImperativeHandle(
        ref,
        () => ({
            focusAt: (index) => {
                if (index < 0 || index >= entries.length) {
                    return false;
                }

                moveTo(index);

                return true;
            },
        }),
        [entries.length, moveTo],
    );

    const handlePress = useCallback(
        (index: number, event: MouseEvent) => {
            if (performance.now() - shownAt < SETTLING) {
                return;
            }

            setFocusIndex(index);

            if (entries[index]?.kind === "folder") {
                onEnterGroup(index);
            } else {
                onPress(index, { toggle: event.ctrlKey || event.metaKey, range: event.shiftKey });
            }
        },
        [shownAt, entries, onEnterGroup, onPress],
    );

    // A group's own check, which selects it as a click selects an asset.
    const handleCheck = useCallback(
        (index: number, event: MouseEvent) => {
            if (performance.now() - shownAt >= SETTLING) {
                setFocusIndex(index);
                onPress(index, { toggle: event.ctrlKey || event.metaKey, range: event.shiftKey });
            }
        },
        [shownAt, onPress],
    );

    const handleDoubleClick = useCallback(
        (index: number) => {
            if (performance.now() - shownAt >= SETTLING) {
                onActivate(index);
            }
        },
        [shownAt, onActivate],
    );

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLElement>) => {
            const index = Number(event.currentTarget.dataset.index);
            const last = entries.length - 1;

            if (event.altKey && event.key === "ArrowUp") {
                event.preventDefault();
                onLevelUp?.();

                return;
            }

            const step = stepOf(event, lines.columns);

            if (step !== 0) {
                event.preventDefault();

                const next = index + step;

                if (next >= 0 && next <= last) {
                    moveTo(next);

                    if (event.shiftKey && multiple) {
                        onPress(next, { toggle: false, range: true });
                    }
                }

                return;
            }

            if (event.key === "Home" || event.key === "End") {
                event.preventDefault();
                moveTo(event.key === "Home" ? 0 : last);

                return;
            }

            if (event.key === " ") {
                event.preventDefault();

                // A group is only one to select where it has a check.
                if (entries[index]?.kind === "folder" && !groupChecks?.has(entries[index].id)) {
                    return;
                }

                onPress(index, { toggle: multiple || event.ctrlKey || event.metaKey, range: event.shiftKey });

                return;
            }

            if (event.key === "Enter") {
                event.preventDefault();

                if (event.altKey) {
                    onOpen(index);
                } else {
                    onActivate(index);
                }

                return;
            }

            if (multiple && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
                event.preventDefault();
                onSelectAll();
            }
        },
        [entries, groupChecks, multiple, lines.columns, moveTo, onPress, onActivate, onLevelUp, onOpen, onSelectAll],
    );

    if (status === "error") {
        const Failed = slots.error;

        return (
            <div className={cx(styles.root, fmClasses.mediaGrid)}>
                {header}
                <div role="alert" className={cx(styles.state, fmClasses.state)}>
                    {Failed ? (
                        <Failed section={section} group={group} message={error} retry={onRetry} />
                    ) : (
                        <>
                            <Icon name={KIND_ICONS[kind]} />
                            <Text variant="body1">{error ?? text.mediaLoadFailed}</Text>
                            <Button color="inherit" variant="outlined" onClick={onRetry}>
                                {text.tryAgain}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    if (status === "loading" && entries.length === 0 && uploads.length === 0) {
        const Loading = slots.loading;

        return (
            <div className={cx(styles.root, fmClasses.mediaGrid)}>
                {header}
                <div className={cx(styles.state, fmClasses.state)}>
                    {Loading ? <Loading label={text.loading} /> : <CircularProgress aria-label={text.loading} />}
                </div>
            </div>
        );
    }

    if (entries.length === 0 && uploads.length === 0) {
        const NoResults = slots.noResults;
        const Empty = slots.empty;
        let drawn: ReactNode = null;

        if (hasMedia && NoResults) {
            drawn = <NoResults section={section} group={group} query={query} />;
        } else if (!hasMedia && Empty) {
            drawn = <Empty section={section} group={group} upload={onUpload} />;
        }

        return (
            <div className={cx(styles.root, fmClasses.mediaGrid)}>
                {header}
                <div role="status" className={cx(styles.state, fmClasses.state)}>
                    {drawn ?? (
                        <>
                            <Icon name={hasMedia ? "search" : KIND_ICONS[kind]} />
                            <Text variant="body1">{hasMedia ? text.mediaNoMatches : text.mediaEmpty}</Text>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={cx(styles.root, fmClasses.mediaGrid)}>
            {busy && <LinearProgress className={styles.bar} aria-label={text.loading} />}
            {header}
            {uploads.length > 0 && (
                <ul
                    aria-label={text.mediaUploading}
                    data-part="uploads"
                    className={row ? styles.rowUploads : styles.tileUploads}
                    style={row ? undefined : UPLOADS_STYLES[kind]}
                >
                    {uploads.map((item) => (
                        <UploadTile key={item.id} item={item} kind={kind} layout={layout} />
                    ))}
                </ul>
            )}
            <div hidden={entries.length === 0} data-after-uploads={uploads.length > 0} className={row ? styles.rowsClip : styles.clip}>
                <div
                    ref={setList}
                    role="listbox"
                    aria-label={label}
                    aria-multiselectable={multiple}
                    aria-busy={busy}
                    data-trails={trailed}
                    data-holds={held}
                    className={row ? styles.rowListbox : styles.tileListbox}
                    style={{ height: lines.height, "--tile-min": row ? undefined : TILE_MIN[kind] } as CSSProperties}
                >
                    {lines.indexes.map((index) => {
                        const entry = entries[index];

                        return (
                            <AssetOption
                                key={entry.id}
                                entry={entry}
                                kind={kind}
                                layout={layout}
                                adapter={adapter}
                                index={index}
                                count={entries.length}
                                top={Math.floor(index / lines.columns) * lines.pitch - lines.offset}
                                column={index % lines.columns}
                                selected={selectedIds.has(entry.id)}
                                hold={holds.get(entry.id)}
                                work={works.get(entry.id)}
                                trail={trails?.get(entry.id)}
                                limited={full && !selectedIds.has(entry.id) && entry.kind !== "folder"}
                                checkable={!!groupChecks?.has(entry.id)}
                                focused={index === tabStop}
                                draw={drawAsset}
                                drawGroup={drawGroup}
                                opensGroups={opensGroups}
                                opensAssets={opensAssets}
                                onPress={handlePress}
                                onCheck={handleCheck}
                                onActivate={handleDoubleClick}
                                onOpen={onOpen}
                                onFocus={setFocusIndex}
                                onKeyDown={handleKeyDown}
                                section={section}
                                assetSlot={assetSlot}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MediaGrid;
