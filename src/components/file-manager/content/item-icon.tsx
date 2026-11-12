import type { ReactNode } from "react";

import { useThumbnail } from "../../../hooks/use-thumbnail";
import { lockedFolder } from "../../../utils/permissions";
import CheckBadge from "../../icons/check-badge";
import { FileTypeIcon, FolderTypeIcon } from "../../icons/file-icon";
import LockedIcon from "../../icons/locked-icon";
import { fmClasses } from "../../../styles/classes";
import { cx } from "../../../utils/cx";
import styles from "./item-icon.module.css";

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
            <div className={styles.thumbnail} style={{ width: length, height: length }}>
                <img src={thumbnail} alt="" draggable={false} />
            </div>
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
        <div className={cx(styles.wrapper, fmClasses.entryIcon)}>
            {icon}
            <CheckBadge />
        </div>
    );
};

export default ItemIcon;
