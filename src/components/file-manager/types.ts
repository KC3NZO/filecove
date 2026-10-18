import type { ReactElement } from "react";

import type { IconName } from "../icons";
import type { FileAdapter, FileEntry } from "./adapter";

/**
 * A semantic name from the icon set, which follows the consumer's icon variant, or any element
 * such as `<CloudOutlined />`, which is fitted to the same box.
 */
export type IconSource = IconName | ReactElement;

/**
 * A sidebar entry with its own root folder. Sections are independent of each other, even when
 * they share an adapter: "/server/project/a" and "/server/project/b" can be two sections.
 */
export interface Section {
    id: string;
    label: string;
    icon?: IconSource;
    /** Folder the section opens at, as an id its adapter understands. */
    rootId: string;
    /** Backend for this section; the file manager's `adapter` when omitted. */
    adapter?: FileAdapter;
}

/** Sections shown together in the sidebar, divided from the next group by a rule. */
export interface SectionGroup {
    id: string;
    /** Optional heading above the group. */
    title?: string;
    sections: Section[];
}

/** A folder known by id and name, e.g. one step of the current path. */
export interface FolderRef {
    id: string;
    name: string;
}

/**
 * What a context menu was opened on: "selection" for entries, "folder" for a folder's empty
 * space, the path bar menu, or a section in the sidebar.
 */
export type ActionTarget = "selection" | "folder";

export interface ActionContext {
    target: ActionTarget;
    /** The entries acted on; empty when `target` is "folder". */
    entries: FileEntry[];
    /** The folder the action happens in: the one right-clicked, or the parent of `entries`. */
    folder: FolderRef;
    section: Section;
    /** Lists `folder` again, e.g. after the action changed its contents. */
    refresh: () => void;
    /** Opens a folder entry of `folder` in the file manager. */
    openFolder: (entry: FileEntry) => void;
}

export interface FileAction {
    id: string;
    label: string;
    icon?: IconSource;
    /** Only offer the action for this kind of target; offered for both when omitted. */
    target?: ActionTarget;
    /** Narrows when it is offered, e.g. to files only or to a single entry. */
    visible?: (context: ActionContext) => boolean;
    disabled?: (context: ActionContext) => boolean;
    /** Hint shown beside the label, e.g. "Ctrl+C". Display only; it is not bound to the keyboard. */
    shortcut?: string;
    /** Styles the item as destructive, for actions such as delete. */
    destructive?: boolean;
    onSelect: (context: ActionContext) => void;
}

/** Actions shown together in the context menu, divided from the next group by a rule. */
export interface ActionGroup {
    id: string;
    actions: FileAction[];
}

export type ViewMode = "list" | "grid";

// Internal types, not exported from the package entry.

/** Where the file manager is: a section, and the folders opened below its root. */
export interface Place {
    sectionId: string;
    /** Folders below the section root, outermost first; empty at the root. */
    trail: FolderRef[];
}

export interface MenuPosition {
    top: number;
    left: number;
}

/** A context menu request from the sidebar or the content, turned into an `ActionContext` by the file manager. */
export interface MenuRequest {
    target: ActionTarget;
    section: Section;
    /** Trail to the folder the action happens in. */
    trail: FolderRef[];
    entries: FileEntry[];
}

/** Opens the context menu. Returns false when no action applies, so the browser's own menu can show instead. */
export type OpenMenu = (position: MenuPosition, request: MenuRequest) => boolean;

/** Props shared by the list and grid views. */
export interface FileViewProps {
    entries: FileEntry[];
    selectedId: string | null;
    hasActions: boolean;
    onSelect: (id: string) => void;
    onOpen: (entry: FileEntry) => void;
    onMenu: (position: MenuPosition, entry: FileEntry) => boolean;
}
