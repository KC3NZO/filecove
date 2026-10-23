import { memo } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { viewMedium } from "../../../styles/layout";
import {
    cutMarker,
    dragMarkers,
    focusVisibleRing,
    hoverBackground,
    selectedBackground,
    selectedHoverBackground,
} from "../../../styles/mixins";
import { pointerPosition } from "../../../utils/menu-position";
import { selectModifiers } from "../../../utils/selection";
import ItemIcon from "./item-icon";

import type { EntryOrigin, FileEntry, FileViewProps } from "../../../types";

interface FileTileProps extends Pick<FileViewProps, "adapter" | "draggable" | "onSelect" | "onOpen" | "onMenu"> {
    entry: FileEntry;
    /** Where a search everywhere's result comes from, whose own entry and adapter give its icon. */
    origin?: EntryOrigin;
    /** Where the entry is listed, from 0. */
    index: number;
    /** How many entries the folder lists. */
    count: number;
    /** How far down the listbox the tile's line sits, in px. */
    top: number;
    /** The grid column the tile goes in, from 0. */
    column: number;
    /** Whether the tile has the view's Tab stop. */
    focused: boolean;
    selected: boolean;
    cut: boolean;
    dragged: boolean;
    /** Whether the dragged entries would be dropped into this folder now. */
    dropTarget: boolean;
}

// Text can't be selected anywhere in the grid, or Shift-click would select it across tiles.
const gridSx: SxProps<Theme> = {
    userSelect: "none",
    p: 1,
    [viewMedium]: { p: 3 },
};

// Only the tiles in or near view are rendered, each placed at its line and in its column, and the
// listbox is as tall as all the lines (`useVirtualLines`). The columns are still the grid's own,
// as many as fit, which the hook reads.
const tilesSx: SxProps<Theme> = {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(6.5rem, 1fr))",
    gap: 0.5,
    [viewMedium]: {
        gridTemplateColumns: "repeat(auto-fill, minmax(7.5rem, 1fr))",
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
    ...focusVisibleRing,
    ...dragMarkers(theme),
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

/**
 * One entry's tile. Memoized, so scrolling only renders the tiles coming into view.
 */
const FileTile = memo(
    ({
        entry,
        origin,
        index,
        count,
        top,
        column,
        focused,
        selected,
        cut,
        adapter,
        draggable,
        dragged,
        dropTarget,
        onSelect,
        onOpen,
        onMenu,
    }: FileTileProps) => (
        <Box
            sx={tileSx}
            // The span ends the tile's box at its column's far side, not at the grid's.
            style={{ top, gridColumn: `${column + 1} / span 1` }}
            role="option"
            aria-selected={selected}
            // Only some tiles are rendered, so each says where it is among all of them.
            aria-setsize={count}
            aria-posinset={index + 1}
            tabIndex={focused ? 0 : -1}
            draggable={draggable}
            data-entry-id={entry.id}
            data-no-marquee
            data-selected={selected}
            data-cut={cut}
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
            <ItemIcon entry={origin?.entry ?? entry} size={3.5} adapter={origin?.adapter ?? adapter} view="grid" />
            <Typography variant="body2" sx={nameSx}>
                <bdi>{entry.name}</bdi>
            </Typography>
        </Box>
    ),
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
    label,
    focusId,
    selectedIds,
    cutIds,
    adapter,
    draggable,
    draggedIds,
    dropTargetId,
    onSelect,
    onOpen,
    onMenu,
}: FileViewProps) => (
    <Box sx={gridSx}>
        <Box
            ref={lines.ref}
            sx={tilesSx}
            style={{ height: lines.height }}
            role="listbox"
            aria-label={label}
            aria-multiselectable
        >
            {lines.indexes.map((index) => {
                const entry = entries[index];

                return (
                    <FileTile
                        key={entry.id}
                        entry={entry}
                        origin={origins?.[index]}
                        index={index}
                        count={entries.length}
                        top={Math.floor(index / lines.columns) * lines.pitch}
                        column={index % lines.columns}
                        focused={entry.id === focusId}
                        selected={selectedIds.has(entry.id)}
                        cut={cutIds.has(entry.id)}
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

export default FileGrid;
