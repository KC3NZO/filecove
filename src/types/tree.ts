// Internal to the package, not exported from the package entry.

import type { FileEntry } from "./adapter";
import type { FolderRef, Section } from "./section";

/** Where a row of the sidebar tree sits. The tree is flattened, so it renders only the rows in or near view. */
interface PlacedRow {
    /** Unique among the rows: a folder's or a section root's `folderKey`, or what else the row is for. */
    id: string;
    /** How far down the tree the row is, in px. */
    top: number;
    height: number;
    /** Index of the section group the row is in, 0 for a single section. */
    group: number;
}

/** A `treeitem` row, which says where it is in the tree, since screen readers only hear the rows rendered. */
interface ItemRow extends PlacedRow {
    /** 0 for a section, and for the top folders of a single section's tree. */
    depth: number;
    /** Where the row is among its siblings, from 1. */
    position: number;
    /** How many siblings it has, itself included. */
    siblingCount: number;
    /** Its name, which screen readers read and typing finds it by. */
    label: string;
    section: Section;
}

/** A section, or a folder, that can be expanded to show the folders below it. */
interface ExpandableRow extends ItemRow {
    /** Whether there are folders below it, or may be, until it's listed. */
    expandable: boolean;
    expanded: boolean;
    /** Being listed for the first time. */
    loading: boolean;
}

export interface SectionRow extends ExpandableRow {
    kind: "section";
}

export interface FolderRow extends ExpandableRow {
    kind: "folder";
    entry: FileEntry;
    /** Trail to the folder the row is in. */
    parentTrail: FolderRef[];
    /** Trail to the row's own folder. */
    trail: FolderRef[];
    /** The row and its sibling folders, in display order. */
    siblings: FileEntry[];
    /** `folderKey`s of `siblings`. */
    siblingKeys: string[];
}

/** In place of the folders below a folder that couldn't be listed. */
export interface ErrorRow extends ItemRow {
    kind: "error";
    /** The folder that couldn't be listed. */
    folderId: string;
}

/** In place of a single section's folders while its root is listed, or when it has none. */
export interface StatusRow extends PlacedRow {
    kind: "status";
    loading: boolean;
}

/** A section group's heading. */
export interface CaptionRow extends PlacedRow {
    kind: "caption";
    title: string;
}

/** The rule between section groups. */
export interface DividerRow extends PlacedRow {
    kind: "divider";
}

/** A row of the tree that takes the focus. */
export type TreeItemRow = SectionRow | FolderRow | ErrorRow;

export type TreeRow = TreeItemRow | StatusRow | CaptionRow | DividerRow;

/**
 * A folder just created, whose row the sidebar tree is to scroll to once it has one, which is
 * after the folder it was made in has been listed again.
 */
export interface TreeReveal {
    /** `folderKey` of the new folder in every section showing it; the first row found is scrolled to. */
    keys: string[];
    /** `folderKey` of the folder it was made in, in every section showing it. */
    parentKeys: string[];
}

/** The guide line along the folders below an expanded row, from the first of them to the last. */
export interface TreeGuide {
    /** Depth of the expanded row. */
    depth: number;
    top: number;
    bottom: number;
}

/** The sidebar tree as the rows it shows, in order, with their guide lines. */
export interface FlatTree {
    rows: TreeRow[];
    guides: TreeGuide[];
    /** How tall the rows are together, in px. */
    height: number;
}
