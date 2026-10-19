import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import { FileTypeIcon, FolderTypeIcon } from "../../icons/file-icon";
import Icon from "../../icons/icon";

import type { FileEntry } from "../../../types";

interface ItemIconProps {
    entry: FileEntry;
    size: string;
}

const wrapperSx: SxProps<Theme> = {
    position: "relative",
    display: "inline-flex",
    flexShrink: 0,
};

// Only shown in touch selection mode, set as `data-selecting` on the folder view: an empty ring,
// filled with a check once the entry's row or tile is `data-selected`.
const badgeSx: SxProps<Theme> = {
    display: "none",
    position: "absolute",
    right: -2,
    bottom: -2,
    width: "max(0.875rem, 36%)",
    aspectRatio: "1",
    alignItems: "center",
    justifyContent: "center",
    border: 2,
    borderColor: "text.secondary",
    borderRadius: "50%",
    bgcolor: "background.paper",
    color: "primary.contrastText",
    "& > svg": { width: "80%", height: "80%", visibility: "hidden" },
    '[data-selecting="true"] &': { display: "flex" },
    '[data-selected="true"] &': { borderColor: "primary.main", bgcolor: "primary.main" },
    '[data-selected="true"] & > svg': { visibility: "visible" },
};

const ItemIcon = ({ entry, size }: ItemIconProps) => (
    <Box sx={wrapperSx}>
        {entry.kind === "folder" ? (
            <FolderTypeIcon folderName={entry.name} size={size} />
        ) : (
            <FileTypeIcon fileName={entry.name} size={size} />
        )}
        <Box sx={badgeSx} aria-hidden>
            <Icon name="check" />
        </Box>
    </Box>
);

export default ItemIcon;
