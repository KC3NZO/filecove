import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { viewMedium, viewWide } from "../../../styles/layout";
import { selectedBackground, stripeBackground } from "../../../styles/mixins";
import { describeDate, describeSize, describeType } from "../../../utils/format";
import { belowElement, pointerPosition } from "../../../utils/menu-position";
import { selectModifiers } from "../../../utils/selection";
import Icon from "../../icons/icon";
import ItemIcon from "./item-icon";

import type { FileViewProps } from "../../../types";

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
    "&:hover": { bgcolor: "action.hover" },
    '&[data-selected="true"]': { bgcolor: selectedBackground(theme) },
    // The menu button shows on hover, on focus and for the selected row; always on touch screens.
    "& [data-menu-button]": { opacity: 0 },
    '&:hover [data-menu-button], &[data-selected="true"] [data-menu-button], & [data-menu-button].Mui-focusVisible':
        { opacity: 1 },
    "@media (hover: none)": { "& [data-menu-button]": { opacity: 1 } },
    [viewMedium]: { minHeight: 44 },
});

const nameCellSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    minWidth: 0,
    "& > svg": { flexShrink: 0 },
};

const nameHeaderSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    // Lines the label up with the file names: 1.75rem icon plus the 12px gap.
    pl: 5,
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

const FileList = ({ entries, selectedIds, hasActions, onSelect, onOpen, onMenu }: FileViewProps) => (
    <Box sx={listSx}>
        <Box sx={headerRowSx}>
            <Box sx={nameHeaderSx}>
                Name
                <Icon name="arrowUp" sx={sortIconSx} />
            </Box>
            <Box sx={sizeCellSx}>Size</Box>
            <Box sx={typeCellSx}>Type</Box>
            <Box sx={modifiedCellSx}>Modified</Box>
            <Box />
        </Box>
        <Box sx={rowsSx}>
            {entries.map((entry) => (
                <Box
                    key={entry.id}
                    sx={rowSx}
                    data-selected={selectedIds.has(entry.id)}
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
                                aria-label={`Actions for ${entry.name}`}
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
