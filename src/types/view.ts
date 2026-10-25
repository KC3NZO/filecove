import type { FileAdapter, FileEntry } from "./adapter";
import type { MenuPosition } from "./menu";
import type { SelectModifiers } from "./selection";

export type ViewMode = "list" | "grid";

/**
 * How far each view is zoomed, in steps from the size it starts at: 1 is a step larger, with
 * bigger icons and thumbnails, and -1 a step smaller. The list goes from -1 to 2 and the grid from
 * -1 to 3; a value beyond that is taken as the nearest end.
 */
export interface ViewZoom {
    list: number;
    grid: number;
}

/** A step of zooming: in (1), out (-1), or back to the size a view starts at (0). Internal. */
export type ZoomStep = -1 | 0 | 1;

/** The grid's sizes at one zoom step, in rem. Internal. */
export interface GridSize {
    /** The side of an entry's icon or thumbnail. */
    icon: number;
    /** The narrowest a column may be, and from `viewMedium` up. */
    column: number;
    wideColumn: number;
}

/** Which way the file manager's text runs, as the `dir` on or above it sets it. Internal. */
export type TextDirection = "ltr" | "rtl";

/**
 * What an order goes by. "relevance" ranks a search everywhere's results by how well their names
 * answer what's typed, best first (its direction is ignored); anywhere else it stands for name,
 * A to Z.
 */
export type SortKey = "name" | "size" | "type" | "modified" | "relevance";

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

/** A list that renders only what's in or near view, and the panel it scrolls in. Internal. */
export interface ScrollTarget {
    list: HTMLElement;
    /** Null when nothing around the list scrolls. */
    scroller: HTMLElement | null;
}

/**
 * The entries a view renders, only those in or near the scroll panel, and how they're laid out in
 * lines. Internal, from `useVirtualLines`.
 */
export interface VirtualLines {
    /** Takes the listbox, a grid container whose column tracks and row gap lay out the lines. */
    ref: (list: HTMLElement | null) => void;
    /** Indexes of the entries to render, in order. */
    indexes: number[];
    /** Entries per line: 1 in the list, as many tiles as fit in the grid. */
    columns: number;
    /** From one line's top to the next one's, in px. */
    pitch: number;
    /** How tall the lines are together, in px, which the listbox takes so the panel scrolls as far. */
    height: number;
}

/**
 * Where an entry shown among the results of a search everywhere comes from, which the view's
 * entry stands for under a key of its own. Internal.
 */
export interface EntryOrigin {
    /** The entry as its adapter gave it, which is what's handed back to the adapter. */
    entry: FileEntry;
    adapter: FileAdapter;
    /** Where it is, for the list's Location column: the section and the folders below its root. */
    location: string;
}

/**
 * What an upload just put in a folder, for the folder view to highlight for a moment once it lists
 * it: found by its id, when that's known, or else by its name. Internal.
 */
export interface Arrival {
    /** Counts arrivals, so each is told apart. */
    key: number;
    adapter: FileAdapter;
    /** The folder it went into. */
    folderId: string;
    entryId?: string;
    /** Missing when it may have been kept under another name, and the adapter didn't say which. */
    name?: string;
    /** Asked for with "Show in folder": also scrolled to, and given the view's Tab stop. */
    show: boolean;
}

/** Props shared by the list and grid views. Internal, not exported from the package entry. */
export interface FileViewProps {
    /**
     * Every entry of the folder, in display order. Among a search's results, each is a copy whose
     * `id` is the result's key, and `origins` holds the entry itself.
     */
    entries: FileEntry[];
    /**
     * For results from many folders, as a search everywhere's, where each of `entries` comes from,
     * by index: its own entry and adapter, for its icon, and its location, which the list shows in
     * a column of its own.
     */
    origins?: readonly EntryOrigin[];
    /** Which of them to render, and where. */
    lines: VirtualLines;
    /** How far the view is zoomed, in steps from the size it starts at (see `ViewZoom`). */
    zoom: number;
    /** Names the list of entries for screen readers: the folder's name. */
    label: string;
    /** The entry that takes focus when the view is tabbed to, and that the arrow keys move from. */
    focusId: string | null;
    selectedIds: ReadonlySet<string>;
    /** Entries cut to the clipboard, shown faded until they're pasted. */
    cutIds: ReadonlySet<string>;
    /**
     * Entries a move under way is moving, themselves or with a folder they're in, shown faded until
     * it ends.
     */
    movingIds: ReadonlySet<string>;
    /** Entries just uploaded, highlighted for a moment; none among a search's results. */
    arrivedIds?: ReadonlySet<string>;
    /** The folder's adapter, which may give its files thumbnails. */
    adapter: FileAdapter | undefined;
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
