import { memo } from "react";
import type { CSSProperties } from "react";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../../hooks/use-locale";
import { viewMedium, viewWide } from "../../../styles/layout";
import {
    arrivedMarker,
    cutMarker,
    dragMarkers,
    focusRing,
    focusVisibleRing,
    forcedArrived,
    forcedColors,
    forcedSelected,
    hoverBackground,
    movingMarker,
    selectedBackground,
    selectedHoverBackground,
    stripeBackground,
    visuallyHiddenSx,
} from "../../../styles/mixins";
import { joinIsolated } from "../../../utils/bidi";
import { drawnState } from "../../../utils/permissions";
import { belowElement, pointerPosition } from "../../../utils/menu-position";
import { selectModifiers } from "../../../utils/selection";
import { SORT_LABELS, toggleSortKey } from "../../../utils/sort";
import { listIconSize } from "../../../utils/zoom";
import Icon from "../../icons/icon";
import ItemIcon from "./item-icon";

import type { EntryOrigin, FileEntry, FileViewProps, SortKey, SortOrder } from "../../../types";

interface ColumnHeaderProps {
    sortKey: SortKey;
    sort: SortOrder;
    sx?: SxProps<Theme>;
    onSortChange: (sort: SortOrder) => void;
}

interface FileRowProps
    extends Pick<FileViewProps, "adapter" | "draggable" | "hasActions" | "onSelect" | "onOpen" | "onMenu"> {
    entry: FileEntry;
    /** Where a search everywhere's result comes from, which the row shows in its Location column. */
    origin?: EntryOrigin;
    /** Where the entry is listed, from 0. */
    index: number;
    /** How many entries the folder lists. */
    count: number;
    /** The side of the icon or thumbnail beside the name, in rem, as the zoom has it. */
    iconSize: number;
    /** How far down the listbox the row sits, in px. */
    top: number;
    /** Whether the row has the view's Tab stop. */
    focused: boolean;
    selected: boolean;
    cut: boolean;
    /** Being moved by a move under way, itself or with a folder it's in. */
    moving: boolean;
    /** Whether the entry was just uploaded, and is highlighted for a moment. */
    arrived: boolean;
    dragged: boolean;
    /** Whether the dragged entries would be dropped into this folder now. */
    dropTarget: boolean;
}

// `--columns` holds the tracks shared by the header and every row. It grows with the view:
// name and menu button, then size and modified, then type as well. A search everywhere's results
// have a Location column after the name, sharing its room. `--icon-size`, set in `style`, is the
// icon's side as the zoom has it, which the rows grow with.
// Text can't be selected anywhere in the list, or Shift-click would select it across rows.
const listSx: SxProps<Theme> = {
    "--columns": "minmax(0, 1fr) 2.5rem",
    userSelect: "none",
    px: 1,
    pt: 1,
    pb: 2,
    [viewMedium]: {
        "--columns": "minmax(0, 1fr) 6rem 9.5rem 2.5rem",
        px: 3,
        // The sticky column header takes over the top spacing.
        pt: 0,
        '&[data-located="true"]': { "--columns": "minmax(0, 3fr) minmax(0, 2fr) 6rem 9.5rem 2.5rem" },
    },
    [viewWide]: {
        "--columns": "minmax(0, 1fr) 6rem 6rem 9.5rem 2.5rem",
        '&[data-located="true"]': { "--columns": "minmax(0, 3fr) minmax(0, 2fr) 6rem 6rem 9.5rem 2.5rem" },
    },
};

const headerRowSx: SxProps<Theme> = {
    display: "none",
    gridTemplateColumns: "var(--columns)",
    alignItems: "center",
    columnGap: 2,
    position: "sticky",
    top: 0,
    zIndex: 1,
    minHeight: 40,
    px: 1.5,
    mb: 0.5,
    bgcolor: "background.paper",
    color: "text.secondary",
    fontSize: "0.75rem",
    fontWeight: 600,
    [viewMedium]: { display: "grid" },
};

// Only the rows in or near view are rendered, each placed at its line, and the listbox is as tall
// as all of them (`useVirtualLines`). It's a grid of one track for the hook to read, with the row
// gap that spaces the lines.
const rowsSx: SxProps<Theme> = {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    rowGap: 0.5,
    [viewMedium]: { rowGap: 1 },
};

// Placed at its line by `top`, set in `style`. Every row is as tall, since the list measures one
// for them all: room for the icon, or narrow, for the size and date folded under the name too.
const rowSx: SxProps<Theme> = (theme) => ({
    position: "absolute",
    insetInline: 0,
    display: "grid",
    gridTemplateColumns: "var(--columns)",
    alignItems: "center",
    columnGap: 2,
    minHeight: "max(52px, calc(var(--icon-size) + 16px))",
    px: 1.5,
    borderRadius: 2,
    cursor: "default",
    // By the entry's place in the folder, since the rows rendered don't all follow each other.
    '&[data-striped="true"]': { bgcolor: stripeBackground(theme) },
    "&:hover": { bgcolor: hoverBackground(theme) },
    '&[data-selected="true"]': { bgcolor: selectedBackground(theme) },
    '&[data-selected="true"]:hover': { bgcolor: selectedHoverBackground(theme) },
    // The menu button shows on hover, for the selected row and the row with keyboard focus; always
    // on touch screens.
    "& [data-menu-button]": { opacity: 0 },
    '&:hover [data-menu-button], &[data-selected="true"] [data-menu-button], &:focus-visible [data-menu-button]': {
        opacity: 1,
    },
    "@media (hover: none)": { "& [data-menu-button]": { opacity: 1 } },
    // A row scrolled into view stops below the sticky column header rather than under it.
    [viewMedium]: { minHeight: "calc(var(--icon-size) + 16px)", scrollMarginTop: "3rem" },
    ...cutMarker,
    ...movingMarker,
    ...arrivedMarker(theme),
    ...focusVisibleRing,
    ...dragMarkers(theme),
    [forcedColors]: { ...forcedSelected, ...forcedArrived },
});

// Only as wide as the icon and name, so a long name truncates within the column.
const nameCellSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    justifySelf: "start",
    maxWidth: "100%",
    minWidth: 0,
    "& > svg": { flexShrink: 0 },
};

// Lines the label up with the file names: the icon plus the 12px gap.
const nameHeaderSx: SxProps<Theme> = {
    paddingInlineStart: "calc(var(--icon-size) + 12px)",
};

// The arrow goes before the label here, so the label stays flush with the dates, aligned to the end.
const modifiedHeaderSx: SxProps<Theme> = {
    textAlign: "end",
    "& > button": { flexDirection: "row-reverse" },
};

// Padded for the focus ring and hover area, and pulled back by as much so the label stays in line.
const columnButtonSx: SxProps<Theme> = {
    gap: 0.5,
    mx: -0.75,
    px: 0.75,
    py: 0.25,
    borderRadius: 1,
    font: "inherit",
    color: "inherit",
    '&:hover, &[data-active="true"]': { color: "text.primary" },
    ...focusRing,
};

const sortIconSx: SxProps<Theme> = {
    fontSize: "0.875rem",
};

const nameTextSx: SxProps<Theme> = {
    minWidth: 0,
};

/** Size and date folded under the name while there is no room for their columns. */
const secondaryLineSx: SxProps<Theme> = {
    display: "block",
    color: "text.secondary",
    [viewMedium]: { display: "none" },
};

const locationCellSx: SxProps<Theme> = {
    display: "none",
    [viewMedium]: { display: "block" },
};

const sizeCellSx: SxProps<Theme> = {
    display: "none",
    [viewMedium]: { display: "block" },
};

const typeCellSx: SxProps<Theme> = {
    display: "none",
    [viewWide]: { display: "block" },
};

const modifiedCellSx: SxProps<Theme> = {
    display: "none",
    textAlign: "end",
    [viewMedium]: { display: "block" },
};

const menuCellSx: SxProps<Theme> = {
    display: "flex",
    justifyContent: "center",
};

const menuButtonSx: SxProps<Theme> = {
    color: "text.secondary",
};

/**
 * A sortable column label: picks its key, or reverses the order when it already sorts by it. The
 * column sorting the list tells screen readers its direction, which the arrow only shows.
 */
const ColumnHeader = ({ sortKey, sort, sx, onSortChange }: ColumnHeaderProps) => {
    const { text } = useLocale();
    const labels = SORT_LABELS[sortKey](text);
    const active = sortKey === sort.key;

    return (
        <Box sx={sx}>
            <ButtonBase
                sx={columnButtonSx}
                data-active={active}
                onClick={(event) => {
                    // The surface behind the list would take the click as one on empty space and clear the selection.
                    event.stopPropagation();
                    onSortChange(toggleSortKey(sort, sortKey));
                }}
            >
                {labels.label}
                {active && (
                    <Box component="span" sx={visuallyHiddenSx}>
                        {text.sortedColumn(labels[sort.direction])}
                    </Box>
                )}
                {active && <Icon name={sort.direction === "asc" ? "arrowUp" : "arrowDown"} sx={sortIconSx} />}
            </ButtonBase>
        </Box>
    );
};

/**
 * One entry's row. Memoized, so scrolling only renders the rows coming into view.
 */
const FileRow = memo(
    ({
        entry,
        origin,
        index,
        count,
        iconSize,
        top,
        focused,
        selected,
        cut,
        moving,
        arrived,
        adapter,
        draggable,
        dragged,
        dropTarget,
        hasActions,
        onSelect,
        onOpen,
        onMenu,
    }: FileRowProps) => {
        const { text, describeDate, describeSize, describeType } = useLocale();

        return (
            <Box
                sx={rowSx}
                style={{ top }}
                role="option"
                aria-selected={selected}
                // Only some rows are rendered, so each says where it is among all of them.
                aria-setsize={count}
                aria-posinset={index + 1}
                // Its lock and its fading while it's moved are only drawn.
                aria-description={drawnState(text, origin?.entry ?? entry, moving)}
                tabIndex={focused ? 0 : -1}
                // The whole row is the entry's: it's dragged by any part, and a marquee only starts from
                // the empty space around the rows.
                draggable={draggable}
                data-entry-id={entry.id}
                data-no-marquee
                data-striped={index % 2 === 0}
                data-selected={selected}
                data-cut={cut}
                data-moving={moving}
                data-arrived={arrived}
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
                <Box sx={nameCellSx}>
                    <ItemIcon
                        entry={origin?.entry ?? entry}
                        size={iconSize}
                        adapter={origin?.adapter ?? adapter}
                        view="list"
                    />
                    <Box sx={nameTextSx}>
                        <Typography variant="body2" noWrap>
                            <bdi>{entry.name}</bdi>
                        </Typography>
                        {/* A result says where it is here, rather than its size and date. */}
                        <Typography variant="caption" noWrap sx={secondaryLineSx}>
                            {origin?.location ?? joinIsolated([describeSize(entry), describeDate(entry)])}
                        </Typography>
                    </Box>
                </Box>
                {origin && (
                    <Typography variant="body2" color="text.secondary" noWrap sx={locationCellSx}>
                        {origin.location}
                    </Typography>
                )}
                <Typography variant="body2" color="text.secondary" noWrap sx={sizeCellSx}>
                    {describeSize(entry)}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap sx={typeCellSx}>
                    {describeType(entry)}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap sx={modifiedCellSx}>
                    {describeDate(entry)}
                </Typography>
                <Box sx={menuCellSx}>
                    {hasActions && (
                        <IconButton
                            size="small"
                            tabIndex={-1}
                            aria-hidden
                            data-menu-button
                            sx={menuButtonSx}
                            // Like a right-click: the menu decides whether it acts on the whole selection.
                            onClick={(event) => {
                                event.stopPropagation();
                                onMenu(belowElement(event.currentTarget), entry);
                            }}
                            onDoubleClick={(event) => event.stopPropagation()}
                        >
                            <Icon name="more" fontSize="small" />
                        </IconButton>
                    )}
                </Box>
            </Box>
        );
    },
);

/**
 * The entries as rows, a listbox with one option per entry, of which only those in or near view
 * are rendered (`lines`), one to a line. Only the focused row is in the tab order; the folder view
 * moves the focus between rows with the arrow keys. The menu buttons are for pointers alone, since
 * the Menu key or Shift+F10 opens the same menu from the focused row.
 */
const FileList = ({
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
    adapter,
    draggable,
    draggedIds,
    dropTargetId,
    hasActions,
    sort,
    onSelect,
    onOpen,
    onMenu,
    onSortChange,
}: FileViewProps) => {
    const { text } = useLocale();
    const iconSize = listIconSize(zoom);

    return (
        <Box sx={listSx} style={{ "--icon-size": `${iconSize}rem` } as CSSProperties} data-located={!!origins}>
            <Box sx={headerRowSx} role="group" aria-label={text.sortBy}>
                <ColumnHeader sortKey="name" sort={sort} sx={nameHeaderSx} onSortChange={onSortChange} />
                {origins && <Box>{text.searchLocation}</Box>}
                <ColumnHeader sortKey="size" sort={sort} onSortChange={onSortChange} />
                <ColumnHeader sortKey="type" sort={sort} sx={typeCellSx} onSortChange={onSortChange} />
                <ColumnHeader sortKey="modified" sort={sort} sx={modifiedHeaderSx} onSortChange={onSortChange} />
                <Box />
            </Box>
            <Box
                ref={lines.ref}
                sx={rowsSx}
                style={{ height: lines.height }}
                role="listbox"
                aria-label={label}
                aria-multiselectable
            >
                {lines.indexes.map((index) => {
                    const entry = entries[index];

                    return (
                        <FileRow
                            key={entry.id}
                            entry={entry}
                            origin={origins?.[index]}
                            index={index}
                            count={entries.length}
                            iconSize={iconSize}
                            top={index * lines.pitch}
                            focused={entry.id === focusId}
                            selected={selectedIds.has(entry.id)}
                            cut={cutIds.has(entry.id)}
                            moving={movingIds.has(entry.id)}
                            arrived={!!arrivedIds?.has(entry.id)}
                            adapter={adapter}
                            draggable={draggable}
                            dragged={draggedIds.has(entry.id)}
                            dropTarget={dropTargetId === entry.id}
                            hasActions={hasActions}
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

export default FileList;
