import type { IconName } from "../icons";

/** A sidebar location. Its `children` render as a folder tree beneath it. */
export interface LocationNode {
    id: string;
    label: string;
    /** Symbolic icon, meant for top-level places; nodes without one get a folder-type icon. */
    icon?: IconName;
    children?: LocationNode[];
}

/** A group of sidebar locations, divided from the next group by a rule. */
export interface LocationSection {
    id: string;
    title?: string;
    locations: LocationNode[];
}

/** One step of the path bar, root first. */
export type PathSegment = Pick<LocationNode, "id" | "label" | "icon">;

/**
 * An entry of the open folder. Size, type and date are display strings for now, while the
 * frame is a design mock-up with no data layer behind it.
 */
export interface FileItem {
    id: string;
    name: string;
    kind: "folder" | "file";
    size: string;
    type: string;
    modified: string;
    starred?: boolean;
}

export type ViewMode = "list" | "grid";

/** Props shared by the list and grid views. */
export interface FileViewProps {
    items: FileItem[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}
