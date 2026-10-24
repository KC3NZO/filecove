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
    /**
     * Opens the one entry in `entries` as double-clicking it does: a folder in the file manager, and
     * a file with the file manager's `onOpenFile`, or in the preview when that declines it. Missing
     * unless there's exactly one entry, and for files when the file manager has no `onOpenFile`,
     * since opening one would only preview it, as `preview` does.
     */
    open?: () => void;
    /**
     * Opens `folder` and shows the one entry in it, selected, for an "Open item location" action on
     * a search's results, which come from anywhere. Missing unless there's exactly one entry and it
     * was found by a search everywhere.
     */
    openLocation?: () => void;
    /**
     * Shows the files among `entries` in the file manager's preview, one at a time. A single file
     * steps through the files of the folder it's listed in, in the content's order. Missing when the
     * section's adapter has no `content`, or `entries` holds no files.
     */
    preview?: () => void;
    /**
     * Saves `entries` on the user's device, or with none, `folder` itself: a single file from the
     * section's adapter's `content`, and folders or several entries as the one file its `download`
     * hands over, such as a zip. It's prepared in the background, the file manager's download panel
     * shows it if it takes a moment, and the browser's own downloads show it from there. Missing
     * when the adapter has no `download` and `entries` isn't a single file it has `content` for.
     */
    download?: () => void;
    /**
     * Asks for a name and creates a folder in `folder`. Missing when the section's adapter has no
     * `createFolder`, so an action can hide with `visible: (context) => !!context.createFolder`.
     */
    createFolder?: () => void;
    /**
     * Asks for a name and creates a folder in the one folder in `entries`, for a "New folder inside"
     * action on a folder's menu, in the content and the sidebar tree alike. Missing unless `entries`
     * is a single folder, and, as with `createFolder`, when the section's adapter has no `createFolder`.
     */
    createFolderInto?: () => void;
    /**
     * Asks for a new name for the one entry in `entries`. Missing when the section's adapter has no
     * `rename`, or when there isn't exactly one entry.
     */
    rename?: () => void;
    /**
     * Asks for a destination folder and copies `entries` there. Missing when the section's adapter
     * has no `copy`, or there are no entries.
     */
    copyTo?: () => void;
    /**
     * Asks for a destination folder and moves `entries` there. Missing when the section's adapter
     * has no `move`, or there are no entries.
     */
    moveTo?: () => void;
    /**
     * Puts `entries` on the file manager's clipboard to be moved where they're pasted, and shows
     * them as cut meanwhile. Missing when the section's adapter has no `move`, or there are no entries.
     */
    cut?: () => void;
    /**
     * Puts `entries` on the file manager's clipboard to be copied where they're pasted. Missing when
     * the section's adapter has no `copy`, or there are no entries.
     */
    copy?: () => void;
    /**
     * Asks to confirm, then deletes `entries` for good. Missing when the section's adapter has no
     * `delete`, or there are no entries.
     */
    delete?: () => void;
    /**
     * Uploads `files` into `folder`, or, without them, asks for some with the browser's file picker,
     * which only opens from a click or key press and offers the types the section's `acceptUploads`
     * takes. Names `folder` already has are asked about first, and files of other types are left
     * out. Missing when the section's adapter has no `upload`, its `acceptUploads` is false, or
     * while another upload is being checked.
     */
    upload?: (files?: File[]) => void;
    /**
     * Moves or copies what was cut or copied into `folder`. Missing when there is nothing to paste
     * here: the clipboard is empty, its entries came from another adapter, `folder` is one of them
     * or inside one, cut entries are already in `folder`, or a paste is still running. An action
     * can stay in the menu, greyed out, with `disabled: (context) => !context.paste`.
     */
    paste?: () => void;
    /**
     * Moves or copies what was cut or copied into the one folder in `entries`, for a "Paste into
     * folder" action on a folder's menu. Missing unless `entries` is a single folder, and, as with
     * `paste`, when there is nothing to paste there.
     */
    pasteInto?: () => void;
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
    /**
     * Shown beside the label, e.g. "Ctrl+C" or "Shift+Ctrl+N", and bound to the keyboard while the
     * content has focus. A press runs the action for the selection if it applies there, or else for
     * the open folder. Ctrl also matches ⌘. A letter or digit is the key printed with it, on any
     * layout: the one that types it on a Latin layout (Ctrl+Z is Z on AZERTY too), and the one
     * marked with it beside the layout's own letter on another script's, such as Russian or Arabic.
     */
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
