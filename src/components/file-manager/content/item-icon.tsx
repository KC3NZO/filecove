import { FileTypeIcon, FolderTypeIcon } from "../../icons";

import type { FileEntry } from "../adapter";

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
