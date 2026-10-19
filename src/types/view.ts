import type { FileEntry } from "./adapter";
import type { MenuPosition } from "./menu";
import type { SelectModifiers } from "./selection";

export type ViewMode = "list" | "grid";

/** Props shared by the list and grid views. Internal, not exported from the package entry. */
export interface FileViewProps {
    entries: FileEntry[];
    selectedIds: ReadonlySet<string>;
    hasActions: boolean;
    onSelect: (id: string, modifiers: SelectModifiers) => void;
    onOpen: (entry: FileEntry) => void;
    onMenu: (position: MenuPosition, entry: FileEntry) => boolean;
}
