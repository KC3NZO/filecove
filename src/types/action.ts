import type { FileEntry } from "./adapter";
import type { IconSource } from "./icon";
import type { FolderRef, Section } from "./section";

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
    /**
     * Only offer the action when a single entry is targeted, for actions such as rename. Without
     * it the action is offered for any number of selected entries, as copy, move or delete are.
     */
    single?: boolean;
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
