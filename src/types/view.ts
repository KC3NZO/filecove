import type { FileEntry } from "./adapter";
import type { MenuPosition } from "./menu";
import type { SelectModifiers } from "./selection";

export type ViewMode = "list" | "grid";

export type SortKey = "name" | "size" | "type" | "modified";

export type SortDirection = "asc" | "desc";

/** How the content view orders a folder. Folders always come before files, in either direction. */
export interface SortOrder {
    key: SortKey;
    direction: SortDirection;
}

/** Props shared by the list and grid views. Internal, not exported from the package entry. */
export interface FileViewProps {
    entries: FileEntry[];
    selectedIds: ReadonlySet<string>;
    /** Entries cut to the clipboard, shown faded until they're pasted. */
    cutIds: ReadonlySet<string>;
    /** Entries can be dragged onto a folder, to be moved or copied into it. */
    draggable: boolean;
    /** Entries being dragged, shown faded until the drag ends. */
    draggedIds: ReadonlySet<string>;
    /** The folder the dragged entries would be dropped into at this moment. */
    dropTargetId: string | null;
    hasActions: boolean;
    sort: SortOrder;
    onSelect: (id: string, modifiers: SelectModifiers) => void;
    onOpen: (entry: FileEntry) => void;
    onMenu: (position: MenuPosition, entry: FileEntry) => boolean;
    onSortChange: (sort: SortOrder) => void;
}
