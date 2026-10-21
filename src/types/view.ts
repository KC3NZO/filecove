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

/** How a view lays out its entries, for moving through them with the arrow keys. Internal. */
export interface EntryLayout {
    /** Entries per row: 1 in the list, as many as fit in the grid. */
    columns: number;
    /** Whether Left and Right move between entries, as they do in the grid. */
    horizontal: boolean;
    /** Rows that PageUp and PageDown move by. */
    page: number;
    /** Whether the view runs right to left, which swaps Left and Right. */
    rtl: boolean;
}

/** Props shared by the list and grid views. Internal, not exported from the package entry. */
export interface FileViewProps {
    entries: FileEntry[];
    /** Names the list of entries for screen readers: the folder's name. */
    label: string;
    /** The entry that takes focus when the view is tabbed to, and that the arrow keys move from. */
    focusId: string | null;
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
