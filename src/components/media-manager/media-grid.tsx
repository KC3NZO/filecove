import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

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
import MediaRow from "./media-row";
import MediaTile from "./media-tile";
import UploadTile from "./upload-tile";

import type { AssetHold, FileAdapter, FileEntry, FileUploadItem, MediaKind } from "../../types";

interface MediaGridProps {
    /** The library's assets the search leaves, in the order shown. */
    entries: readonly FileEntry[];
    /** Files being uploaded into the library, shown before its assets until they're listed. */
    uploads: readonly FileUploadItem[];
    /** The library's kind, which shows them as tiles of its shape, or audio as rows. */
    kind: MediaKind;
    adapter: FileAdapter;
    /** The library's name, which the grid is named by for screen readers. */
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
    /** Whether the library has assets at all, whatever the search leaves. */
    hasMedia: boolean;
    /** Whether more of the library is still coming, page by page, or it's listed again. */
    busy: boolean;
    /** Why it couldn't be listed, as the adapter said it, or nothing. */
    error: string | undefined;
    onRetry: () => void;
    /** A click on a tile, or Space on it, with the keys held, by its index in `entries`. */
    onPress: (index: number, keys: { toggle: boolean; range: boolean }) => void;
    /** Choosing a tile on its own: a double click, or Enter. */
    onActivate: (index: number) => void;
    /** Opening an asset in the library's place: its button, or Alt+Enter. */
    onOpen: (index: number) => void;
    onSelectAll: () => void;
}

const rootSx: SxProps<Theme> = {
    position: "relative",
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
};

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

// Audio is a list of rows, one column, which the arrow keys move along as the tiles' do.
const GRID_SX: Record<MediaKind, SxProps<Theme>> = {
    image: tilesSx(TILE_LAYOUTS.image.min),
    video: tilesSx(TILE_LAYOUTS.video.min),
    document: tilesSx(TILE_LAYOUTS.document.min),
    audio: { ...gridSx, gridTemplateColumns: "minmax(0, 1fr)", gap: 0.25, p: 1 },
};

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
    height: "100%",
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
 * The library's assets as a grid of tiles, or rows for audio, a `listbox` of `option`s with one Tab stop, which the
 * arrow keys, Home and End move. Space selects, Enter chooses, Alt+Enter opens one in the
 * library's place, Ctrl+A selects them all.
 */
const MediaGrid = ({
    entries,
    uploads,
    kind,
    adapter,
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
    onOpen,
    onSelectAll,
}: MediaGridProps) => {
    const { text } = useLocale();
    const gridRef = useRef<HTMLDivElement>(null);
    const [focusIndex, setFocusIndex] = useState(0);
    // Set as a key moves the focus, so the tile it went to takes it once it renders as the Tab stop.
    const movedRef = useRef(false);
    const tabStop = Math.min(focusIndex, Math.max(entries.length - 1, 0));

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
            setFocusIndex(index);
            onPress(index, { toggle: event.ctrlKey || event.metaKey, range: event.shiftKey });
        },
        [onPress],
    );

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLElement>) => {
            const index = Number(event.currentTarget.dataset.index);
            const last = entries.length - 1;
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
        [entries.length, multiple, moveTo, onPress, onActivate, onOpen, onSelectAll],
    );

    if (status === "error") {
        return (
            <Box sx={rootSx}>
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
                <Box sx={stateSx}>
                    <CircularProgress aria-label={text.loading} />
                </Box>
            </Box>
        );
    }

    if (entries.length === 0 && uploads.length === 0) {
        return (
            <Box sx={rootSx}>
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
            {uploads.length > 0 && (
                <Box component="ul" aria-label={text.mediaUploading} data-part="uploads" sx={GRID_SX[kind]}>
                    {uploads.map((item) => (
                        <UploadTile key={item.id} item={item} kind={kind} />
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
                sx={GRID_SX[kind]}
            >
                {entries.map((entry, index) =>
                    kind === "audio" ? (
                        <MediaRow
                            key={entry.id}
                            entry={entry}
                            adapter={adapter}
                            index={index}
                            selected={selectedIds.has(entry.id)}
                            hold={holds.get(entry.id)}
                            work={works.get(entry.id)}
                            limited={full && !selectedIds.has(entry.id)}
                            focused={index === tabStop}
                            onPress={handlePress}
                            onActivate={onActivate}
                            onOpen={onOpen}
                            onFocus={setFocusIndex}
                            onKeyDown={handleKeyDown}
                        />
                    ) : (
                        <MediaTile
                            key={entry.id}
                            entry={entry}
                            kind={kind}
                            adapter={adapter}
                            index={index}
                            selected={selectedIds.has(entry.id)}
                            hold={holds.get(entry.id)}
                            work={works.get(entry.id)}
                            limited={full && !selectedIds.has(entry.id)}
                            focused={index === tabStop}
                            onPress={handlePress}
                            onActivate={onActivate}
                            onOpen={onOpen}
                            onFocus={setFocusIndex}
                            onKeyDown={handleKeyDown}
                        />
                    ),
                )}
            </Box>
        </Box>
    );
};

export default MediaGrid;
