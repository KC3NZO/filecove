import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { viewMedium, viewWide } from "../../../styles/layout";
import {
    cutMarker,
    dragMarkers,
    focusRing,
    focusVisibleRing,
    hoverBackground,
    selectedBackground,
    selectedHoverBackground,
    stripeBackground,
    visuallyHiddenSx,
} from "../../../styles/mixins";
import { describeDate, describeSize, describeType } from "../../../utils/format";
import { belowElement, pointerPosition } from "../../../utils/menu-position";
import { selectModifiers } from "../../../utils/selection";
import { SORT_KEY_INFO, toggleSortKey } from "../../../utils/sort";
import Icon from "../../icons/icon";
import ItemIcon from "./item-icon";

import type { FileViewProps, SortKey, SortOrder } from "../../../types";

interface ColumnHeaderProps {
    sortKey: SortKey;
    sort: SortOrder;
    sx?: SxProps<Theme>;
    onSortChange: (sort: SortOrder) => void;
}

// `--columns` holds the tracks shared by the header and every row. It grows with the view:
// name and menu button, then size and modified, then type as well.
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
    },
    [viewWide]: {
        "--columns": "minmax(0, 1fr) 6rem 6rem 9.5rem 2.5rem",
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

const rowsSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 0.5,
    [viewMedium]: { gap: 1 },
};

const rowSx: SxProps<Theme> = (theme) => ({
    display: "grid",
    gridTemplateColumns: "var(--columns)",
    alignItems: "center",
    columnGap: 2,
    minHeight: 52,
    px: 1.5,
    borderRadius: 2,
    cursor: "default",
    "&:nth-of-type(odd)": { bgcolor: stripeBackground(theme) },
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
    [viewMedium]: { minHeight: 44, scrollMarginTop: "3rem" },
    ...cutMarker,
    ...focusVisibleRing,
    ...dragMarkers(theme),
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

// Lines the label up with the file names: 1.75rem icon plus the 12px gap.
const nameHeaderSx: SxProps<Theme> = {
    pl: 5,
};

// The arrow goes before the label here, so the label stays flush with the right-aligned dates.
const modifiedHeaderSx: SxProps<Theme> = {
    textAlign: "right",
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
    textAlign: "right",
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
    const info = SORT_KEY_INFO[sortKey];
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
                {info.label}
                {active && (
                    <Box component="span" sx={visuallyHiddenSx}>
                        , sorted {info[sort.direction]}
                    </Box>
                )}
                {active && <Icon name={sort.direction === "asc" ? "arrowUp" : "arrowDown"} sx={sortIconSx} />}
            </ButtonBase>
        </Box>
    );
};

/**
 * The entries as rows, a listbox with one option per entry. Only the focused row is in the tab
 * order; the folder view moves the focus between rows with the arrow keys. The menu buttons are
 * for pointers alone, since the Menu key or Shift+F10 opens the same menu from the focused row.
 */
const FileList = ({
    entries,
    label,
    focusId,
    selectedIds,
    cutIds,
    draggable,
    draggedIds,
    dropTargetId,
    hasActions,
    sort,
    onSelect,
    onOpen,
    onMenu,
    onSortChange,
}: FileViewProps) => (
    <Box sx={listSx}>
        <Box sx={headerRowSx} role="group" aria-label="Sort by">
            <ColumnHeader sortKey="name" sort={sort} sx={nameHeaderSx} onSortChange={onSortChange} />
            <ColumnHeader sortKey="size" sort={sort} onSortChange={onSortChange} />
            <ColumnHeader sortKey="type" sort={sort} sx={typeCellSx} onSortChange={onSortChange} />
            <ColumnHeader sortKey="modified" sort={sort} sx={modifiedHeaderSx} onSortChange={onSortChange} />
            <Box />
        </Box>
        <Box sx={rowsSx} role="listbox" aria-label={label} aria-multiselectable>
            {entries.map((entry) => (
                <Box
                    key={entry.id}
                    sx={rowSx}
                    role="option"
                    aria-selected={selectedIds.has(entry.id)}
                    tabIndex={entry.id === focusId ? 0 : -1}
                    // The whole row is the entry's: it's dragged by any part, and a marquee only
                    // starts from the empty space around the rows.
                    draggable={draggable}
                    data-entry-id={entry.id}
                    data-no-marquee
                    data-selected={selectedIds.has(entry.id)}
                    data-cut={cutIds.has(entry.id)}
                    data-dragged={draggedIds.has(entry.id)}
                    data-drop-target={dropTargetId === entry.id}
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
                        <ItemIcon entry={entry} size="1.75rem" />
                        <Box sx={nameTextSx}>
                            <Typography variant="body2" noWrap>
                                {entry.name}
                            </Typography>
                            <Typography variant="caption" noWrap sx={secondaryLineSx}>
                                {describeSize(entry)} · {describeDate(entry)}
                            </Typography>
                        </Box>
                    </Box>
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
            ))}
        </Box>
    </Box>
);

export default FileList;
