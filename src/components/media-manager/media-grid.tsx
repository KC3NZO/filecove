import { useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode, Ref } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { useVirtualLines } from "../../hooks/use-virtual-lines";
import { TILE_LAYOUTS } from "../../styles/media-layout";
import { forcedBarSx } from "../../styles/mixins";
import { isRtl } from "../../utils/dom";
import { KIND_ICONS } from "../../utils/media";
import Icon from "../icons/icon";
import AssetOption from "./asset-option";
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
}

// A column, so a state fills what a group's header leaves it.
const rootSx: SxProps<Theme> = {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    "& > *": { flexShrink: 0 },
};

/**
 * How long a level is only looked at once it's shown, in ms: the second click of a double click on a
 * group, which went in on the first, would otherwise land on whatever came under the pointer.
 */
const SETTLING = 400;

// How the assets are laid out: tiles in as many columns as fit, or rows in one, which the arrow keys
// move along as the tiles' do. The uploads under way are laid out the same, before them, with no more
// room between the two than the grid's gap. The listbox is as tall as all the lines, its assets placed
// in them.
const tilesOf = (min: number) =>
    ({
        display: "grid",
        alignContent: "start",
        gap: 0.5,
        gridTemplateColumns: `repeat(auto-fill, minmax(${min}rem, 1fr))`,
    }) as const;

const rowsOf = { display: "grid", alignContent: "start", gap: 0.25, gridTemplateColumns: "minmax(0, 1fr)" } as const;
const uploadsOf = { m: 0, pb: 0, listStyle: "none" } as const;
const listboxOf = { position: "relative", outline: "none" } as const;

const TILE_UPLOADS_SX = {} as Record<MediaKind, SxProps<Theme>>;
const TILE_LISTBOX_SX = {} as Record<MediaKind, SxProps<Theme>>;

for (const kind of Object.keys(TILE_LAYOUTS) as MediaKind[]) {
    TILE_UPLOADS_SX[kind] = { ...tilesOf(TILE_LAYOUTS[kind].min), ...uploadsOf, p: 1.5, pb: 0 };
    TILE_LISTBOX_SX[kind] = { ...tilesOf(TILE_LAYOUTS[kind].min), ...listboxOf };
}

const ROW_UPLOADS_SX: SxProps<Theme> = { ...rowsOf, ...uploadsOf, p: 1, pb: 0 };
const ROW_LISTBOX_SX: SxProps<Theme> = { ...rowsOf, ...listboxOf };

// Around the listbox, its padding, and cutting off what's placed below its end, as an asset kept
// rendered far from view in a squeezed list is, which would stretch the scroll (see
// `virtualization.md`), without being a scroll container itself.
const clipSx: SxProps<Theme> = {
    overflowY: "clip",
    p: 1.5,
    '&[data-after-uploads="true"]': { pt: 0.5 },
    // Kept while only uploads show, so the grid keeps its Tab stop, but not shown.
    "&[hidden]": { display: "none" },
};
const rowsClipSx: SxProps<Theme> = { ...clipSx, p: 1, '&[data-after-uploads="true"]': { pt: 0.5 } };


const barSx: SxProps<Theme> = {
    position: "sticky",
    top: 0,
    zIndex: 1,
    height: 2,
    mb: "-2px",
    ...forcedBarSx,
};

const stateSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1.5,
    flexGrow: 1,
    p: 3,
    color: "text.secondary",
    textAlign: "center",
    "& > svg": { fontSize: 56, opacity: 0.6 },
};

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
        return (
            <Box sx={rootSx}>
                {header}
                <Box role="alert" sx={stateSx}>
                    <Icon name={KIND_ICONS[kind]} />
                    <Typography variant="body1">{error ?? text.mediaLoadFailed}</Typography>
                    <Button color="inherit" variant="outlined" onClick={onRetry}>
                        {text.tryAgain}
                    </Button>
                </Box>
            </Box>
        );
    }

    if (status === "loading" && entries.length === 0 && uploads.length === 0) {
        return (
            <Box sx={rootSx}>
                {header}
                <Box sx={stateSx}>
                    <CircularProgress aria-label={text.loading} />
                </Box>
            </Box>
        );
    }

    if (entries.length === 0 && uploads.length === 0) {
        return (
            <Box sx={rootSx}>
                {header}
                <Box role="status" sx={stateSx}>
                    <Icon name={hasMedia ? "search" : KIND_ICONS[kind]} />
                    <Typography variant="body1">{hasMedia ? text.mediaNoMatches : text.mediaEmpty}</Typography>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={rootSx}>
            {busy && <LinearProgress sx={barSx} aria-label={text.loading} />}
            {header}
            {uploads.length > 0 && (
                <Box
                    component="ul"
                    aria-label={text.mediaUploading}
                    data-part="uploads"
                    sx={row ? ROW_UPLOADS_SX : TILE_UPLOADS_SX[kind]}
                >
                    {uploads.map((item) => (
                        <UploadTile key={item.id} item={item} kind={kind} layout={layout} />
                    ))}
                </Box>
            )}
            <Box hidden={entries.length === 0} data-after-uploads={uploads.length > 0} sx={row ? rowsClipSx : clipSx}>
                <Box
                    ref={setList}
                    role="listbox"
                    aria-label={label}
                    aria-multiselectable={multiple}
                    aria-busy={busy}
                    data-trails={trailed}
                    data-holds={held}
                    sx={row ? ROW_LISTBOX_SX : TILE_LISTBOX_SX[kind]}
                    style={{ height: lines.height }}
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
                            />
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
};

export default MediaGrid;
