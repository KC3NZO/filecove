import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import { useThumbnail } from "../../../hooks/use-thumbnail";
import { lockedFolder } from "../../../utils/permissions";
import CheckBadge from "../../icons/check-badge";
import { FileTypeIcon, FolderTypeIcon } from "../../icons/file-icon";
import LockedIcon from "../../icons/locked-icon";

import type { FileAdapter, FileEntry, ViewMode } from "../../../types";

interface ItemIconProps {
    entry: FileEntry;
    /** The icon's width and height, in rem. */
    size: number;
    /** The entry's adapter, which may give the file a thumbnail. */
    adapter?: FileAdapter;
    /** The view the entry is shown in, which its thumbnail is asked for; without it, the icon always shows. */
    view?: ViewMode;
}

const wrapperSx: SxProps<Theme> = {
    position: "relative",
    display: "inline-flex",
    flexShrink: 0,
};

// The picture fits the icon's square, shrunk but never stretched. The row or tile takes presses,
// right-clicks and drags, not the picture.
const thumbnailSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    "& > img": {
        display: "block",
        maxWidth: "100%",
        maxHeight: "100%",
        borderRadius: 0.5,
        pointerEvents: "none",
    },
};

/**
 * An entry's type icon, or its file's thumbnail once one has loaded, with the check badge of touch
 * selection, and a lock on a folder nothing can be put in.
 */
const ItemIcon = ({ entry, size, adapter, view }: ItemIconProps) => {
    const thumbnail = useThumbnail(entry, adapter, view, size);
    const length = `${size}rem`;
    let icon: ReactNode;

    if (thumbnail) {
        icon = (
            <Box sx={thumbnailSx} style={{ width: length, height: length }}>
                <img src={thumbnail} alt="" draggable={false} />
            </Box>
        );
    } else if (entry.kind === "folder") {
        icon = (
            <LockedIcon locked={lockedFolder(entry)}>
                <FolderTypeIcon folderName={entry.name} size={length} />
            </LockedIcon>
        );
    } else {
        icon = <FileTypeIcon fileName={entry.name} size={length} />;
    }

    return (
        <Box sx={wrapperSx}>
            {icon}
            <CheckBadge />
        </Box>
    );
};

export default ItemIcon;
