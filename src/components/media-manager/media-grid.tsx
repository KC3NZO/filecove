import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { TILE_LAYOUTS } from "../../styles/media-layout";
import { forcedBarSx } from "../../styles/mixins";
import { gridColumns, isRtl } from "../../utils/dom";
import { KIND_ICONS } from "../../utils/media";
import Icon from "../icons/icon";
import AssetOption from "./asset-option";
import UploadTile from "./upload-tile";

import type {
    AssetHold,
    FileAdapter,
    FileEntry,
    FileUploadItem,
    MediaAssetDraw,
    MediaKind,
    MediaLayout,
} from "../../types";

interface MediaGridProps {
    /** The open level's assets and groups the search leaves, in the order shown. */
    entries: readonly FileEntry[];
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

// The uploads under way are laid out as the assets are, before them, with no more room between the
// two than the grid's gap.
const gridSx: SxProps<Theme> = {
    display: "grid",
    alignContent: "start",
    gap: 0.5,
    p: 1.5,
    outline: "none",
    '&[data-part="uploads"]': { m: 0, pb: 0, listStyle: "none" },
    '&[data-after-uploads="true"]': { pt: 0.5 },
    // Kept while only uploads show, so it keeps its Tab stop, but not shown.
    "&[hidden]": { display: "none" },
};

const tilesSx = (min: number): SxProps<Theme> => ({
    ...gridSx,
    gridTemplateColumns: `repeat(auto-fill, minmax(${min}rem, 1fr))`,
});

const TILES_SX: Record<MediaKind, SxProps<Theme>> = {
    image: tilesSx(TILE_LAYOUTS.image.min),
    video: tilesSx(TILE_LAYOUTS.video.min),
    document: tilesSx(TILE_LAYOUTS.document.min),
    audio: tilesSx(TILE_LAYOUTS.audio.min),
};

// A list of rows, one column, which the arrow keys move along as the tiles' do.
const rowsSx: SxProps<Theme> = { ...gridSx, gridTemplateColumns: "minmax(0, 1fr)", gap: 0.25, p: 1 };

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
 */
const MediaGrid = ({
    entries,
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
}: MediaGridProps) => {
    const { text } = useLocale();
    const shownSx = layout === "list" ? rowsSx : TILES_SX[kind];
    const gridRef = useRef<HTMLDivElement>(null);
    const [focusIndex, setFocusIndex] = useState(0);
    // Set as a key moves the focus, so the tile it went to takes it once it renders as the Tab stop.
    const movedRef = useRef(false);
    const tabStop = Math.min(focusIndex, Math.max(entries.length - 1, 0));
    const [shownAt] = useState(() => performance.now());

    useLayoutEffect(() => {
        if (!movedRef.current) {
            return;
        }

        movedRef.current = false;
        gridRef.current?.querySelector<HTMLElement>(`[data-index="${tabStop}"]`)?.focus();
    }, [tabStop]);

    const moveTo = useCallback((index: number) => {
        movedRef.current = true;
        setFocusIndex(index);
    }, []);

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

            const step = gridRef.current ? stepOf(event, gridColumns(gridRef.current)) : 0;

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

                // A group isn't one to select.
                if (entries[index]?.kind === "folder") {
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
        [entries, multiple, moveTo, onPress, onActivate, onLevelUp, onOpen, onSelectAll],
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
                <Box component="ul" aria-label={text.mediaUploading} data-part="uploads" sx={shownSx}>
                    {uploads.map((item) => (
                        <UploadTile key={item.id} item={item} kind={kind} layout={layout} />
                    ))}
                </Box>
            )}
            <Box
                ref={gridRef}
                role="listbox"
                aria-label={label}
                aria-multiselectable={multiple}
                aria-busy={busy}
                hidden={entries.length === 0}
                data-after-uploads={uploads.length > 0}
                sx={shownSx}
            >
                {entries.map((entry, index) => (
                    <AssetOption
                        key={entry.id}
                        entry={entry}
                        kind={kind}
                        layout={layout}
                        adapter={adapter}
                        index={index}
                        selected={selectedIds.has(entry.id)}
                        hold={holds.get(entry.id)}
                        work={works.get(entry.id)}
                        limited={full && !selectedIds.has(entry.id) && entry.kind !== "folder"}
                        focused={index === tabStop}
                        draw={drawAsset}
                        drawGroup={drawGroup}
                        opensGroups={opensGroups}
                        opensAssets={opensAssets}
                        onPress={handlePress}
                        onActivate={handleDoubleClick}
                        onOpen={onOpen}
                        onFocus={setFocusIndex}
                        onKeyDown={handleKeyDown}
                    />
                ))}
            </Box>
        </Box>
    );
};

export default MediaGrid;
