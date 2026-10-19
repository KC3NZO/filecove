// Internal to the package, not exported from the package entry.

import type { KeyboardEvent } from "react";

import type { ActionTarget } from "./action";
import type { FileEntry } from "./adapter";
import type { FolderRef, Section } from "./section";

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

/**
 * Runs the action whose `shortcut` matches a key press, trying each request in turn, e.g. the
 * selection and then the open folder. Returns false when none matched.
 */
export type RunShortcut = (event: KeyboardEvent, requests: MenuRequest[]) => boolean;
