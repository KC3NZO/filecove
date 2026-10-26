import { memo } from "react";
import type { CSSProperties } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../../hooks/use-locale";
import { viewMedium } from "../../../styles/layout";
import {
    arrivedMarker,
    cutMarker,
    dragMarkers,
    focusVisibleRing,
    forcedArrived,
    forcedColors,
    forcedSelected,
    hoverBackground,
    movingMarker,
    selectedBackground,
    selectedHoverBackground,
} from "../../../styles/mixins";
import { pointerPosition } from "../../../utils/menu-position";
import { drawnState } from "../../../utils/permissions";
import { selectModifiers } from "../../../utils/selection";
import { gridSize } from "../../../utils/zoom";
import Icon from "../../icons/icon";
import { DrawnName } from "../find-layer";
import ItemIcon from "./item-icon";

import type { EntryOrigin, FileEntry, FileViewProps, MovingKind } from "../../../types";

interface FileTileProps extends Pick<FileViewProps, "adapter" | "draggable" | "onSelect" | "onOpen" | "onMenu"> {
    entry: FileEntry;
    /** Where a search everywhere's result comes from: its own entry and adapter give its icon, and its location is shown under the name. */
    origin?: EntryOrigin;
    /** Where the entry is listed, from 0. */
    index: number;
    /** How many entries the folder lists. */
    count: number;
    /** The side of the icon or thumbnail, in rem, as the zoom has it. */
    iconSize: number;
    /** How far down the listbox the tile's line sits, in px, as the lines place it. */
    top: number;
    /** The grid column the tile goes in, from 0. */
    column: number;
    /** Whether the tile has the view's Tab stop. */
    focused: boolean;
    selected: boolean;
    cut: boolean;
    /**
     * What holds it, a move under way or the trash's work, itself or with a folder it's in; missing
     * while nothing does.
     */
    moving: MovingKind | undefined;
    /** Whether the entry was just uploaded, and is highlighted for a moment. */
    arrived: boolean;
    /** Whether the browser's find in page just came to it, and it's highlighted for a moment. */
    found: boolean;
    dragged: boolean;
    /** Whether the dragged entries would be dropped into this folder now. */
    dropTarget: boolean;
}

// Text can't be selected anywhere in the grid, or Shift-click would select it across tiles.
// Clipped down its length, as the list is, so a tile kept rendered far from view in a squeezed
// listbox doesn't lengthen what the panel scrolls.
const gridSx: SxProps<Theme> = {
    userSelect: "none",
    overflowY: "clip",
    p: 1,
    [viewMedium]: { p: 3 },
};

// Only the tiles in or near view are rendered, each placed at its line and in its column, and the
// listbox is as tall as all the lines (`useVirtualLines`). The columns are still the grid's own,
// as many as fit, which the hook reads, as narrow as the zoom lets them be (`--column` and
// `--wide-column`, set in `style`).
const tilesSx: SxProps<Theme> = {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(var(--column), 1fr))",
    gap: 0.5,
    [viewMedium]: {
        gridTemplateColumns: "repeat(auto-fill, minmax(var(--wide-column), 1fr))",
        gap: 1,
    },
};

// Placed by `top` and `gridColumn`, set in `style`: an absolutely positioned child of a grid takes
// the grid area it's placed in as its box, so it fills its column's width.
const tileSx: SxProps<Theme> = (theme) => ({
    position: "absolute",
    insetInline: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
    px: 1,
    pt: 1.5,
    pb: 1,
    borderRadius: 2,
    textAlign: "center",
    cursor: "default",
    "&:hover": { bgcolor: hoverBackground(theme) },
    '&[data-selected="true"]': { bgcolor: selectedBackground(theme) },
    '&[data-selected="true"]:hover': { bgcolor: selectedHoverBackground(theme) },
    "& > svg": { flexShrink: 0 },
    ...cutMarker,
    ...movingMarker,
    ...arrivedMarker(theme),
    ...focusVisibleRing,
    ...dragMarkers(theme),
    [forcedColors]: { ...forcedSelected, ...forcedArrived },
});

// Two lines tall even for a short name, so every tile is as tall, since the grid measures one for
// them all.
const nameSx: SxProps<Theme> = {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    overflowWrap: "anywhere",
    fontSize: "0.8125rem",
    lineHeight: 1.35,
    minHeight: "2.7em",
};

// A search everywhere's result says where it is in an outlined pill under its name, a folder icon
// and the location in smaller, fainter text, so it reads as where the entry is rather than as more
// of its name. The text takes two lines as the name does, and the pill is as tall with one, so
// every tile is still as tall. An outline rather than a fill, which forced colors would drop.
const locationSx: SxProps<Theme> = {
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    maxWidth: "100%",
    minHeight: "calc(2.6em + 10px)",
    px: 1,
    py: 0.5,
    border: 1,
    borderColor: "divider",
    borderRadius: 2,
    color: "text.secondary",
    fontSize: "0.6875rem",
    lineHeight: 1.3,
};

const locationIconSx: SxProps<Theme> = {
    flexShrink: 0,
    fontSize: "0.875rem",
};

const locationTextSx: SxProps<Theme> = {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    overflowWrap: "anywhere",
    minWidth: 0,
};

/**
 * One entry's tile. Memoized, so scrolling only renders the tiles coming into view.
 */
const FileTile = memo(
    ({
        entry,
        origin,
        index,
        count,
        iconSize,
        top,
        column,
        focused,
        selected,
        cut,
        moving,
        arrived,
        found,
        adapter,
        draggable,
        dragged,
        dropTarget,
        onSelect,
        onOpen,
        onMenu,
    }: FileTileProps) => {
        const { text } = useLocale();

        return (
            <Box
                sx={tileSx}
                // The span ends the tile's box at its column's far side, not at the grid's.
                style={{ top, gridColumn: `${column + 1} / span 1` }}
                role="option"
                aria-selected={selected}
                // Only some tiles are rendered, so each says where it is among all of them.
                aria-setsize={count}
                aria-posinset={index + 1}
                // Its lock and its fading while it's moved are only drawn.
                aria-description={drawnState(text, origin?.entry ?? entry, moving)}
                tabIndex={focused ? 0 : -1}
                draggable={draggable}
                data-entry-id={entry.id}
                data-no-marquee
                data-selected={selected}
                data-cut={cut}
                data-moving={!!moving}
                data-arrived={arrived}
                data-found={found}
                data-dragged={dragged}
                data-drop-target={dropTarget}
                onClick={(event) => {
                    event.stopPropagation();
                    onSelect(entry.id, selectModifiers(event));
                }}
                onDoubleClick={() => onOpen(entry)}
                onContextMenu={(event) => {
                    event.stopPropagation();

                    if (onMenu(pointerPosition(event), entry)) {
                        event.preventDefault();
                    }
                }}
            >
                <ItemIcon
                    entry={origin?.entry ?? entry}
                    size={iconSize}
                    adapter={origin?.adapter ?? adapter}
                    view="grid"
                />
                <Typography variant="body2" sx={nameSx}>
                    <DrawnName name={entry.name} />
                </Typography>
                {origin && (
                    <Box sx={locationSx}>
                        <Icon name="folder" sx={locationIconSx} />
                        <Box component="span" sx={locationTextSx}>
                            {origin.location}
                        </Box>
                    </Box>
                )}
            </Box>
        );
    },
);

/**
 * The entries as tiles, a listbox with one option per entry, of which only those in or near view
 * are rendered (`lines`), as many to a line as fit. The arrow keys move through them in two
 * directions. Only the focused tile is in the tab order.
 */
const FileGrid = ({
    entries,
    origins,
    lines,
    zoom,
    label,
    focusId,
    selectedIds,
    cutIds,
    movingIds,
    arrivedIds,
    foundId,
    adapter,
    draggable,
    draggedIds,
    dropTargetId,
    onSelect,
    onOpen,
    onMenu,
}: FileViewProps) => {
    const size = gridSize(zoom);
    const style = {
        height: lines.height,
        "--column": `${size.column}rem`,
        "--wide-column": `${size.wideColumn}rem`,
    } as CSSProperties;

    return (
        <Box sx={gridSx}>
            <Box ref={lines.ref} sx={tilesSx} style={style} role="listbox" aria-label={label} aria-multiselectable>
                {lines.indexes.map((index) => {
                    const entry = entries[index];

                    return (
                        <FileTile
                            key={entry.id}
                            entry={entry}
                            origin={origins?.[index]}
                            index={index}
                            count={entries.length}
                            iconSize={size.icon}
                            top={Math.floor(index / lines.columns) * lines.pitch - lines.offset}
                            column={index % lines.columns}
                            focused={entry.id === focusId}
                            selected={selectedIds.has(entry.id)}
                            cut={cutIds.has(entry.id)}
                            moving={movingIds.get(entry.id)}
                            arrived={!!arrivedIds?.has(entry.id)}
                            found={entry.id === foundId}
                            adapter={adapter}
                            draggable={draggable}
                            dragged={draggedIds.has(entry.id)}
                            dropTarget={dropTargetId === entry.id}
                            onSelect={onSelect}
                            onOpen={onOpen}
                            onMenu={onMenu}
                        />
                    );
                })}
            </Box>
        </Box>
    );
};

export default FileGrid;
