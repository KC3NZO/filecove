import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import { useThumbnail } from "../../../hooks/use-thumbnail";
import { lockedFolder } from "../../../utils/permissions";
import { FileTypeIcon, FolderTypeIcon } from "../../icons/file-icon";
import Icon from "../../icons/icon";
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

// Only shown in touch selection mode, set as `data-selecting` on the folder view: an empty ring,
// filled with a check once the entry's row or tile is `data-selected`.
const badgeSx: SxProps<Theme> = {
    display: "none",
    position: "absolute",
    insetInlineEnd: -2,
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
            <Box sx={badgeSx} aria-hidden>
                <Icon name="check" />
            </Box>
        </Box>
    );
};

export default ItemIcon;
