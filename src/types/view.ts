import type { FileEntry } from "./adapter";
import type { MenuPosition } from "./menu";

export type ViewMode = "list" | "grid";

/** Props shared by the list and grid views. Internal, not exported from the package entry. */
export interface FileViewProps {
    entries: FileEntry[];
    selectedId: string | null;
    hasActions: boolean;
    onSelect: (id: string) => void;
    onOpen: (entry: FileEntry) => void;
    onMenu: (position: MenuPosition, entry: FileEntry) => boolean;
}
