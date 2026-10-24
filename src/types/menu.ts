// Internal to the package, not exported from the package entry.

import type { ClipboardEvent, KeyboardEvent } from "react";

import type { ActionTarget } from "./action";
import type { FileEntry } from "./adapter";
import type { IconSource } from "./icon";
import type { FolderRef, Section } from "./section";

/** A point on the page the menu hangs from, as `Popover`'s `anchorPosition` takes it. */
export interface MenuPosition {
    top: number;
    left: number;
    /** It was opened in a right-to-left part, so it opens leftwards from the point. */
    rtl: boolean;
}

/** A context menu request from the sidebar or the content, turned into an `ActionContext` by the file manager. */
export interface MenuRequest {
    target: ActionTarget;
    section: Section;
    /** Trail to the folder the action happens in. */
    trail: FolderRef[];
    entries: FileEntry[];
    /**
     * Every entry of the view the request came from, in its order, which the preview of a single
     * file steps through. Only the content has one.
     */
    listing?: FileEntry[];
    /** The entries are results of a search everywhere, whose folder isn't the open one. */
    inResults?: boolean;
}

/** Opens the context menu. Returns false when no action applies, so the browser's own menu can show instead. */
export type OpenMenu = (position: MenuPosition, request: MenuRequest) => boolean;

/**
 * Runs the action whose `shortcut` matches a key press, trying each request in turn, e.g. the
 * selection and then the open folder. Returns false when none matched.
 */
export type RunShortcut = (event: KeyboardEvent, requests: MenuRequest[]) => boolean;

/**
 * Uploads the files a paste carries (files copied on the desktop, a copied picture) into the
 * folder at `trail`, when it takes uploads, and leaves any other paste to the browser.
 */
export type PasteFiles = (event: ClipboardEvent, section: Section, trail: FolderRef[]) => void;

/**
 * One of the app's actions as a header shows it, the preview's or the properties panel's, with what
 * it acts on already bound: an icon button, or an item of the header's "More actions" menu.
 */
export interface ToolbarAction {
    id: string;
    label: string;
    icon?: IconSource;
    /** Written as menus show it, e.g. "F2"; bound while the focus is where the header is. */
    shortcut?: string;
    disabled: boolean;
    destructive: boolean;
    /** The header's own, such as the preview's Download, which shows as a button wherever buttons do. */
    keep?: boolean;
    run: () => void;
}

/** Toolbar actions shown together, divided from the next group. */
export interface ToolbarGroup {
    id: string;
    actions: ToolbarAction[];
}
