import { FileTypeIcon, FolderTypeIcon } from "../../icons/file-icon";

import type { FileEntry } from "../../../types";

interface ItemIconProps {
    entry: FileEntry;
    size: string;
}

const ItemIcon = ({ entry, size }: ItemIconProps) =>
    entry.kind === "folder" ? (
        <FolderTypeIcon folderName={entry.name} size={size} />
    ) : (
        <FileTypeIcon fileName={entry.name} size={size} />
    );

export default ItemIcon;
