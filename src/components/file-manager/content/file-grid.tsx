import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { viewMedium } from "../../../styles/layout";
import { selectedBackground } from "../../../styles/mixins";
import { pointerPosition } from "../../../utils/menu-position";
import { selectModifiers } from "../../../utils/selection";
import ItemIcon from "./item-icon";

import type { FileViewProps } from "../../../types";

// Text can't be selected anywhere in the grid, or Shift-click would select it across tiles.
const gridSx: SxProps<Theme> = {
    display: "grid",
    userSelect: "none",
    gridTemplateColumns: "repeat(auto-fill, minmax(6.5rem, 1fr))",
    gap: 0.5,
    p: 1,
    [viewMedium]: {
        gridTemplateColumns: "repeat(auto-fill, minmax(7.5rem, 1fr))",
        gap: 1,
        p: 3,
    },
};

const tileSx: SxProps<Theme> = (theme) => ({
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
    "&:hover": { bgcolor: "action.hover" },
    '&[data-selected="true"]': { bgcolor: selectedBackground(theme) },
    "& > svg": { flexShrink: 0 },
});

const nameSx: SxProps<Theme> = {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    overflowWrap: "anywhere",
    fontSize: "0.8125rem",
    lineHeight: 1.35,
};

const FileGrid = ({ entries, selectedIds, onSelect, onOpen, onMenu }: FileViewProps) => (
    <Box sx={gridSx}>
        {entries.map((entry) => (
            <Box
                key={entry.id}
                sx={tileSx}
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
                <ItemIcon entry={entry} size="3.5rem" />
                <Typography variant="body2" sx={nameSx}>
                    {entry.name}
                </Typography>
            </Box>
        ))}
    </Box>
);

export default FileGrid;
