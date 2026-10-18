import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { Icon } from "../../icons";
import { viewMedium, viewWide } from "../layout";
import { selectedBackground, stripeBackground } from "../styles";
import ItemIcon from "./item-icon";

import type { FileViewProps } from "../types";

// `--columns` holds the tracks shared by the header and every row. It grows with the view:
// name only, then size, modified and star, then type as well.
const listSx: SxProps<Theme> = {
    "--columns": "minmax(0, 1fr)",
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
    userSelect: "none",
    "&:nth-of-type(odd)": { bgcolor: stripeBackground(theme) },
    "&:hover": { bgcolor: "action.hover" },
    '&[data-selected="true"]': { bgcolor: selectedBackground(theme) },
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

const starCellSx: SxProps<Theme> = {
    display: "none",
    justifyContent: "center",
    [viewMedium]: { display: "flex" },
};

const starSx: SxProps<Theme> = {
    color: "text.secondary",
};

const starredSx: SxProps<Theme> = {
    color: "primary.main",
};

const FileList = ({ items, selectedId, onSelect }: FileViewProps) => (
    <Box sx={listSx}>
        <Box sx={headerRowSx}>
            <Box sx={nameHeaderSx}>
                Name
                <Icon name="arrowUp" sx={sortIconSx} />
            </Box>
            <Box sx={sizeCellSx}>Size</Box>
            <Box sx={typeCellSx}>Type</Box>
            <Box sx={modifiedCellSx}>Modified</Box>
            <Box sx={starCellSx} />
        </Box>
        <Box sx={rowsSx}>
            {items.map((item) => (
                <Box
                    key={item.id}
                    sx={rowSx}
                    data-selected={item.id === selectedId}
                    onClick={() => onSelect(item.id)}
                >
                    <Box sx={nameCellSx}>
                        <ItemIcon item={item} size="1.75rem" />
                        <Box sx={nameTextSx}>
                            <Typography variant="body2" noWrap>
                                {item.name}
                            </Typography>
                            <Typography variant="caption" noWrap sx={secondaryLineSx}>
                                {item.size} · {item.modified}
                            </Typography>
                        </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary" noWrap sx={sizeCellSx}>
                        {item.size}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap sx={typeCellSx}>
                        {item.type}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap sx={modifiedCellSx}>
                        {item.modified}
                    </Typography>
                    <Box sx={starCellSx}>
                        <IconButton
                            size="small"
                            aria-label={item.starred ? "Unstar" : "Star"}
                            aria-pressed={!!item.starred}
                            sx={item.starred ? starredSx : starSx}
                        >
                            <Icon name={item.starred ? "star" : "starBorder"} fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>
            ))}
        </Box>
    </Box>
);

export default FileList;
