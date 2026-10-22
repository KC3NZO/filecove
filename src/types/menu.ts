// Internal to the package, not exported from the package entry.

import type { KeyboardEvent } from "react";

import type { ActionTarget } from "./action";
import type { FileEntry } from "./adapter";
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
}

/** Opens the context menu. Returns false when no action applies, so the browser's own menu can show instead. */
export type OpenMenu = (position: MenuPosition, request: MenuRequest) => boolean;

/**
 * Runs the action whose `shortcut` matches a key press, trying each request in turn, e.g. the
 * selection and then the open folder. Returns false when none matched.
 */
export type RunShortcut = (event: KeyboardEvent, requests: MenuRequest[]) => boolean;
