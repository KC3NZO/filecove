import { FileTypeIcon, FolderTypeIcon } from "../../icons";

import type { FileItem } from "../types";

interface ItemIconProps {
    item: FileItem;
    size: string;
}

const ItemIcon = ({ item, size }: ItemIconProps) =>
    item.kind === "folder" ? (
        <FolderTypeIcon folderName={item.name} size={size} />
    ) : (
        <FileTypeIcon fileName={item.name} size={size} />
    );

export default ItemIcon;
