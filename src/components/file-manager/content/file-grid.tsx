import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { pointerPosition } from "../context-menu/position";
import { viewMedium } from "../layout";
import { selectedBackground } from "../styles";
import ItemIcon from "./item-icon";

import type { FileViewProps } from "../types";

const gridSx: SxProps<Theme> = {
    display: "grid",
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
    userSelect: "none",
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

const FileGrid = ({ entries, selectedId, onSelect, onOpen, onMenu }: FileViewProps) => (
    <Box sx={gridSx}>
        {entries.map((entry) => (
            <Box
                key={entry.id}
                sx={tileSx}
                data-selected={entry.id === selectedId}
                onClick={(event) => {
                    event.stopPropagation();
                    onSelect(entry.id);
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
