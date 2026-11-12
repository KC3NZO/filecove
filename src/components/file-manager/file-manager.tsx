import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ComponentPropsWithoutRef, CSSProperties, DragEvent, KeyboardEvent, Ref } from "react";
import { createPortal, flushSync } from "react-dom";

import { CutContext } from "../../contexts/cut-context";
import { DataContext } from "../../contexts/data-context";
import { DragContext } from "../../contexts/drag-context";
import { LocaleContext } from "../../contexts/locale-context";
import { MovingContext } from "../../contexts/moving-context";
import { useAnnouncer } from "../../hooks/use-announcer";
import { useClipboardFollow } from "../../hooks/use-clipboard-follow";
import { useControlled } from "../../hooks/use-controlled";
import { useDownloadQueue } from "../../hooks/use-download-queue";
import { useEntryDrag } from "../../hooks/use-entry-drag";
import { useForkRef } from "../../hooks/use-fork-ref";
import { useLocaleValue } from "../../hooks/use-locale";
import { useLocationHistory } from "../../hooks/use-location-history";
import type { ReviseLocation } from "../../hooks/use-location-history";
import { useSetting } from "../../hooks/use-setting";
import { useStableSet } from "../../hooks/use-stable-set";
import { useTextDirection } from "../../hooks/use-text-direction";
import { useTransferQueue } from "../../hooks/use-transfer-queue";
import { useUploadQueue } from "../../hooks/use-upload-queue";
import { useWheelZoom } from "../../hooks/use-wheel-zoom";
import { createFolderStore, folderKey, keyFolder, listingOf } from "../../store/folder-store";
import { watchKeyboardLayout } from "../../store/keyboard-layout";
import { createPropertiesCache } from "../../store/properties-cache";
import { createThumbnailCache } from "../../store/thumbnail-cache";
import { PROPERTIES_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH, SIDEBAR_WIDTH } from "../../styles/layout";
import { fmClasses } from "../../styles/classes";
import theme from "../../styles/theme.module.css";
import { toolbarGroups, visibleActionGroups } from "../../utils/action-groups";
import { isolate } from "../../utils/bidi";
import { canPaste, withRenamed, withoutEntries } from "../../utils/clipboard";
import { cx } from "../../utils/cx";
import { canDownload, downloadedEntries } from "../../utils/download";
import {
    acceptsFile,
    carriesFiles,
    filesIn,
    mayAccept,
    pickedFolder,
    picksFolders,
    takesUploads,
    uploadPatterns,
} from "../../utils/files";
import { groupedEntries, requestGroups, selectionRequest } from "../../utils/groups";
import { isHidden } from "../../utils/hidden";
import { countLimit, delayLimit } from "../../utils/limits";
import { folderLeft, folderOf, outsideDeleted, placeName, renameInPlace, samePlace } from "../../utils/navigation";
import { pathOf, pathProblemText, resolvePath } from "../../utils/path";
import {
    allows,
    entriesAllow,
    entriesMoving,
    folderMoving,
    folderPermits,
    folderWritable,
    replaceable,
} from "../../utils/permissions";
import { clampWidth } from "../../utils/resize";
import { importsFrom } from "../../utils/sections";
import { sameSearch } from "../../utils/search";
import { sameIds } from "../../utils/sets";
import {
    matchesShortcut,
    pastes,
    pressedKeys,
    pressesKey,
    showsShortcuts,
    typesInField,
    undoDirection,
    zoomStep,
} from "../../utils/shortcut";
import { previewable } from "../../utils/preview";
import { RELEVANCE_SORT, entryComparator, folderSort, sameSort } from "../../utils/sort";
import { carries, isMoving, movingIds, movingThrough, sharesNames } from "../../utils/transfer";
import { inTrashRoot, trashMade, trashOrigin, trashedLocation, trashesOf } from "../../utils/trash";
import {
    NO_HISTORY,
    UNDO_STEPS,
    asLeft,
    canUndoWith,
    changedFolders,
    heldHistory,
    joinActions,
    latestSteps,
    madePairs,
    otherWay,
    stepHolds,
    wentPairs,
} from "../../utils/undo";
import { DEFAULT_ZOOM, canZoom, sameZoom, zoomScale, zoomedBy } from "../../utils/zoom";
import RootProviders from "../ui/root-providers";
import DownloadPanel from "../downloads/download-panel";
import TransferPanel from "../transfers/transfer-panel";
import Backdrop from "../ui/backdrop";
import UploadPanel from "../uploads/upload-panel";
import Announcer from "./announcer";
import FolderView from "./content/folder-view";
import NoSections from "./content/no-sections";
import SearchResults from "./content/search-results";
import TrashBar from "./content/trash-bar";
import ContextMenu from "./context-menu/context-menu";
import DeleteDialog from "./dialogs/delete-dialog";
import NameDialog from "./dialogs/name-dialog";
import PasteDialog from "./dialogs/paste-dialog";
import PreviewDialog from "./dialogs/preview-dialog";
import RestoreDialog from "./dialogs/restore-dialog";
import ShortcutsDialog from "./dialogs/shortcuts-dialog";
import TransferDialog from "./dialogs/transfer-dialog";
import UploadDialog from "./dialogs/upload-dialog";
import DragPreview from "./drag-preview";
import styles from "./file-manager.module.css";
import HeaderBar from "./header-bar/header-bar";
import PathBar from "./header-bar/path-bar";
import PathField from "./header-bar/path-field";
import SearchField from "./header-bar/search-field";
import NoticeBar from "./notice-bar";
import PropertiesPane from "./properties-pane";
import Sidebar from "./sidebar/sidebar";

import type {
    ActionContext,
    ActionGroup,
    Arrival,
    Clipboard,
    ClipboardPart,
    ConflictPolicy,
    DraggedEntries,
    DroppedFiles,
    DropInto,
    DropTarget,
    EntryGroup,
    FileAdapter,
    FileEntry,
    FileManagerApi,
    FileManagerLimits,
    FileManagerLocaleText,
    FileManagerLocation,
    FileManagerSearch,
    FilePreviewer,
    FolderRef,
    FolderUpload,
    GoToPathResult,
    HistoryStop,
    LocationChangeReason,
    MadePair,
    MainMenuGroup,
    MenuRequest,
    MovingIds,
    OpenMenu,
    RefreshOptions,
    PasteFiles,
    PathResult,
    PropertiesSubject,
    RunShortcut,
    SearchHit,
    SearchScope,
    SearchTarget,
    Section,
    SectionFolder,
    SectionGroup,
    SelectionDetails,
    SortOrder,
    ToolbarGroup,
    TransferItem,
    TrashInfo,
    TreeReveal,
    UndoAction,
    UndoChange,
    UndoDirection,
    UndoFolder,
    UndoFolders,
    UndoGroup,
    UndoHistory,
    UndoMove,
    UndoRestore,
    UndoStep,
    UndoTarget,
    UploadItem,
    ViewMode,
    ViewZoom,
    ZoomStep,
} from "../../types";
import type { TransferEnded, TransferOutcome } from "../../store/transfer-queue";
import type { MenuState } from "./context-menu/context-menu";
import type { DeleteDialogState, DeleteRequest } from "./dialogs/delete-dialog";
import type { NameDialogState, NameRequest } from "./dialogs/name-dialog";
import type { PasteDialogState, PasteRequest } from "./dialogs/paste-dialog";
import type { PreviewDialogState, PreviewFile, PreviewRequest } from "./dialogs/preview-dialog";
import type { RestoreDialogState, RestoreRequest } from "./dialogs/restore-dialog";
import type { TransferDialogState, TransferRequest } from "./dialogs/transfer-dialog";
import type { UploadDialogState, UploadRequest } from "./dialogs/upload-dialog";
import type { Notice } from "./notice-bar";
import type { UndoItems } from "./sidebar/main-menu";

// The root element's own attributes, which go on it as on a component library's root, so an `id`,
// an `aria-label`, a `data-` attribute or a handler can be set there. `title` is the sidebar's.
type RootAttributes = Omit<ComponentPropsWithoutRef<"div">, "title" | "children">;

/*
 * The location, the view settings, the tree's expanded folders, the search and the selection below
 * can each be controlled, as MUI's props are: pass the value and change it in its `on…Change`
 * callback, or leave it to the file manager, starting from its `default…` prop. Which one is decided on
 * mounting, and a warning in development says so when it switches later. Controlled, the user's changes are
 * only asked for through the callback, and made once they're passed back.
 */
interface BaseProps extends RootAttributes {
    /** Backend for every section that doesn't bring its own. */
    adapter: FileAdapter;
    /** Context menu actions, in groups. */
    actions?: ActionGroup[];
    /**
     * Actions in the preview's header, in groups, for the file it shows: as an `ActionContext` for
     * that one file, in its folder, with `closePreview` for an action taking the user elsewhere,
     * such as an editor of the app's own. Those with an icon show as buttons, four at most, while
     * the header has room, and the rest in its "More actions" menu, as do all of them on a narrow
     * screen. A `shortcut` works while the preview is open, after its own keys. The same action
     * objects can be in `actions` too. Opening a dialog from one, to rename or delete the file,
     * opens it over the preview, which follows what it did.
     */
    previewActions?: ActionGroup[];
    /**
     * Actions in the properties panel's header, in groups, for what it shows: its entries, as in
     * the context menu, or with none, the folder it shows (`target` "folder"). Shown as the
     * preview's are, two as buttons at most. None show for a search's results from several folders.
     * A `shortcut` works while the focus is in the panel.
     */
    propertiesActions?: ActionGroup[];
    /**
     * Previewers of the app's own, for the kinds of files the preview doesn't show by itself, or
     * shows otherwise: highlighted code, rendered Markdown, office documents, what's in an archive,
     * formats the browser can't draw. Each says which files it takes, and is asked in order before
     * the file manager's own previews. The file manager builds none in, so an app only carries the
     * libraries it chooses.
     */
    previewers?: FilePreviewer[];
    /**
     * The sidebar's main menu, in groups, for what belongs to the app rather than to entries, such
     * as preferences, help or about. The file manager adds "Keyboard shortcuts" after them. An
     * item's `shortcut` works anywhere in the file manager, and shows in the keyboard shortcuts
     * window with the actions' shortcuts.
     */
    mainMenu?: MainMenuGroup[];
    /** Shown at the top of the sidebar; `localeText.sidebarTitle`, "Files" in English, when omitted. */
    title?: string;
    /**
     * How old, in ms, a folder's listing may be before opening the folder lists it again. Listings
     * are saved, so a folder opened again, in the content, the sidebar tree or the "Move to…" and
     * "Copy to…" picker, shows at once, and is listed again in the background meanwhile, so what
     * changed elsewhere, by another user or in another tab, shows without a refresh. A listing that
     * comes back as it was changes nothing on screen. 0, the default, lists a folder again every
     * time it opens; `Infinity` never does, for a backend where listing costs, leaving changes made
     * elsewhere to `apiRef.refresh`. Changes made through the file manager show either way.
     */
    relistAfter?: number;
    /**
     * How much the file manager does at once and keeps, for a backend that takes more, or less,
     * than the defaults: uploads, downloads, copies and moves, and thumbnails asked for at once,
     * thumbnails and listings kept while nothing shows them, and how long the typing stops before
     * a search everywhere. Each is left to its default when omitted, and a change takes effect at
     * once: more at once starts what's waiting, less lets what's under way finish, and fewer kept
     * drops what's beyond them.
     */
    limits?: FileManagerLimits;
    /**
     * Where the file manager is, for a consumer that keeps it, e.g. in the URL. Every change, the
     * user's and the file manager's own, is asked for through `onLocationChange`. A location in a
     * section the file manager doesn't have shows the first section's root, which is asked for as
     * "replace". The back and forward history stays the file manager's: a location that's where
     * back or forward leads counts as going there, so the two keep in step with a browser's whose
     * buttons set it.
     */
    location?: FileManagerLocation;
    /**
     * Where the file manager opens, when it keeps the location itself; the first section's root when
     * omitted. One in a section it doesn't have opens that root too, told as "replace".
     */
    defaultLocation?: FileManagerLocation;
    /**
     * Told every change of the location as it's made, or asked for with `location`, with why: the
     * user went somewhere, back or forward, or the place was rewritten in place, as when the folder
     * it was in was renamed or deleted, which a URL kept in step replaces rather than pushes.
     */
    onLocationChange?: (location: FileManagerLocation, reason: LocationChangeReason) => void;
    /** The content's view, for a consumer that keeps it, e.g. across reloads. */
    view?: ViewMode;
    /** The view at first, when the file manager keeps it; "list" when omitted. */
    defaultView?: ViewMode;
    /** Told the view the user switches to, with the header's button. */
    onViewChange?: (view: ViewMode) => void;
    /**
     * How far the list and the grid are each zoomed, in steps from the size they start at, for a
     * consumer that keeps it. Zooming in makes icons, thumbnails and rows or tiles larger, and the
     * text stays as it is.
     */
    zoom?: ViewZoom;
    /** The zoom at first, when the file manager keeps it; both views at their start (0) when omitted. */
    defaultZoom?: ViewZoom;
    /**
     * Told the zoom the user picks, with Ctrl+plus, Ctrl+minus and Ctrl+0 (⌘ on macOS) or Ctrl+wheel
     * in the content, which then zoom it rather than the page, or with the view options menu.
     */
    onZoomChange?: (zoom: ViewZoom) => void;
    /**
     * The content's order, for a consumer that keeps it. Kept across folders. The sidebar tree and
     * the "Move to…" and "Copy to…" picker always go by name.
     */
    sort?: SortOrder;
    /**
     * The order at first, when the file manager keeps it; relevance when omitted, which orders a
     * search everywhere's results by how well their names answer what's typed and folders by name,
     * A to Z.
     */
    defaultSort?: SortOrder;
    /** Told the order the user picks, in the view options menu or the list's column headers. */
    onSortChange?: (sort: SortOrder) => void;
    /**
     * Whether hidden entries show, in the content, the sidebar tree and the picker, for a consumer
     * that keeps it. What's hidden is `FileEntry.hidden`, or else a name starting with a dot.
     */
    showHidden?: boolean;
    /** Whether hidden entries show at first, when the file manager keeps it; false when omitted. */
    defaultShowHidden?: boolean;
    /** Told when the user shows or hides hidden entries, with Ctrl+H or the view options menu. */
    onShowHiddenChange?: (showHidden: boolean) => void;
    /**
     * Whether the sidebar is hidden while there's room to dock it, for a consumer that keeps it.
     * Narrower, it's an overlay the header's button opens either way.
     */
    sidebarHidden?: boolean;
    /** Whether the docked sidebar is hidden at first, when the file manager keeps it; false when omitted. */
    defaultSidebarHidden?: boolean;
    /**
     * Told when the user hides or shows the docked sidebar, with F9, the view options menu or, while
     * it's hidden, the header's "Show sidebar" button.
     */
    onSidebarHiddenChange?: (sidebarHidden: boolean) => void;
    /**
     * How wide the docked sidebar is, in px, for a consumer that keeps it, from 200 to 360. It's
     * narrower while the content beside it needs the room, and the overlay shown where there's no
     * room to dock it isn't resized.
     */
    sidebarWidth?: number;
    /** How wide the docked sidebar is at first, when the file manager keeps it; 248 when omitted. */
    defaultSidebarWidth?: number;
    /**
     * Told when the user resizes the docked sidebar by its edge: as a drag of it ends, a step at a
     * time with the arrow keys on it, with Home and End, or put back to `defaultSidebarWidth` (or
     * 248) with a double click.
     */
    onSidebarWidthChange?: (sidebarWidth: number) => void;
    /**
     * Whether the properties panel shows beside the content while there's room to dock it, for a
     * consumer that keeps it. It shows the content's selection, or the open folder while nothing is
     * selected, and follows the selection. Narrower, it opens over the content instead, with
     * Alt+Enter, the view options menu or `ActionContext.properties`, and closes as the user moves on.
     */
    propertiesOpen?: boolean;
    /** Whether the docked properties show at first, when the file manager keeps it; false when omitted. */
    defaultPropertiesOpen?: boolean;
    /**
     * Told when the user shows or hides the docked properties, with Alt+Enter, the view options menu,
     * the panel's close button or `ActionContext.properties`.
     */
    onPropertiesOpenChange?: (propertiesOpen: boolean) => void;
    /**
     * How wide the docked properties panel is, in px, for a consumer that keeps it, from 240 to 480.
     * It's narrower while the content beside it needs the room, and the overlay shown where there's
     * no room to dock isn't resized.
     */
    propertiesWidth?: number;
    /** How wide the docked properties are at first, when the file manager keeps it; 300 when omitted. */
    defaultPropertiesWidth?: number;
    /**
     * Told when the user resizes the docked properties by their edge: as a drag of it ends, a step at
     * a time with the arrow keys on it, with Home and End, or put back to `defaultPropertiesWidth` (or
     * 300) with a double click.
     */
    onPropertiesWidthChange?: (propertiesWidth: number) => void;
    /**
     * Folders expanded in the sidebar tree, for a consumer that keeps them, e.g. across reloads. A
     * section's own row is its root folder. Only the chevrons, Right and Left on a row, and a drag
     * resting on a collapsed row change them, never going somewhere. A folder the tree doesn't show,
     * below a collapsed one or in a section that's gone, stays as it is, to show expanded again.
     */
    expandedFolders?: readonly SectionFolder[];
    /**
     * Folders expanded at first, when the file manager keeps them; when omitted, the section the
     * file manager opens in, if it shows its folders.
     */
    defaultExpandedFolders?: readonly SectionFolder[];
    /** Told the folders expanded as the user expands or collapses one. */
    onExpandedFoldersChange?: (folders: SectionFolder[]) => void;
    /**
     * The search field, for a consumer that keeps it: what it searches and what's typed, or null
     * while it's closed. Every change the user makes is asked for through `onSearchChange`: opening
     * it, typing, switching between the open folder and every section, and closing it. Opening any
     * other folder ends the search, which is asked for as null, however the folder is opened,
     * including by a `location` the consumer changes. A `"everywhere"` scope with no section whose
     * adapter has `search` searches the open folder.
     */
    search?: FileManagerSearch | null;
    /** The search at first, when the file manager keeps it; null (closed) when omitted. */
    defaultSearch?: FileManagerSearch | null;
    /** Told every change of the search as it's made, or asked for with `search`; null when it closes. */
    onSearchChange?: (search: FileManagerSearch | null) => void;
    /**
     * Ids of the sections a search everywhere leaves out (the sections menu's unchecked ones), for a
     * consumer that keeps them. Ids of sections that are gone or can't be searched don't count, and
     * leaving out every section counts as leaving out none. A section added later is searched.
     */
    searchExcludedSections?: readonly string[];
    /** The sections left out at first, when the file manager keeps them; none when omitted. */
    defaultSearchExcludedSections?: readonly string[];
    /** Told the sections left out as the user checks or unchecks one in the sections menu. */
    onSearchExcludedSectionsChange?: (sectionIds: string[]) => void;
    /**
     * Ids of the entries selected in the open folder's content, for a consumer that keeps them.
     * Every folder opens with nothing selected: going somewhere from inside the file manager asks
     * for an empty selection, while a `location` changed by the consumer leaves the selection to them,
     * so they can open a folder with an entry selected. Ids the folder doesn't list drop out once all
     * of it has come. Ids set other than through `onSelectionChange` are revealed: the first of their
     * entries is scrolled to, and takes the content's focus, or its Tab stop when the focus is
     * elsewhere. The sidebar tree's selection is its own.
     */
    selectedIds?: readonly string[];
    /**
     * Ids selected in the folder the file manager opens in, when it keeps the selection, revealed as
     * `selectedIds` are, e.g. to show a file in its folder.
     */
    defaultSelectedIds?: readonly string[];
    /**
     * Told the content's selection as it changes: the ids, to pass back as `selectedIds`, and the
     * selected entries listed, which is what to act on. It also changes as the folder's listing
     * does, e.g. a selected entry deleted elsewhere, and empties as another folder opens.
     */
    onSelectionChange?: (ids: string[], details: SelectionDetails) => void;
    /**
     * What opening a file does, by double-clicking, tapping or pressing Enter on it, or with
     * `ActionContext.open`, e.g. opening it in an editor of the consumer's. Return false to leave a
     * file to the preview, e.g. one of a type there's no editor for. Without it, a file opens in the
     * preview, when the adapter has `content` or a previewer reading nothing takes it, and
     * `ActionContext.open` is missing for files, since it would only do what `preview` does. From
     * the preview's header, `open` closes the preview unless this returns false.
     */
    onOpenFile?: (entry: FileEntry, context: ActionContext) => boolean | void;
    /**
     * The component's own text, for another language or other wording. Keys left out stay in
     * English, as `enUS` has them. A new object with the same texts is fine, but functions written
     * inline are new each render and make every row render again, so keep those outside the
     * component or memoize the object.
     */
    localeText?: Partial<FileManagerLocaleText>;
    /**
     * The BCP 47 language tag, such as "de" or "fa-IR", that numbers, sizes and dates are written
     * in and names are sorted and matched by. The browser's language when omitted. It changes no
     * text: that's `localeText`.
     */
    locale?: string;
    /**
     * Takes the `FileManagerApi`, for going somewhere, listing folders again, showing an entry in
     * its folder, downloading, running the context menu's operations, searching or moving the focus
     * in, from outside.
     */
    apiRef?: Ref<FileManagerApi>;
    /** The root element, which fills the box it's placed in. */
    ref?: Ref<HTMLDivElement>;
    /**
     * Styles the root element, over its own, e.g. to size it. It fills its container by default,
     * and lays itself out by its own width (container queries), not the viewport's.
     */
    className?: string;
}

interface MultiSectionProps extends BaseProps {
    /** Sidebar sections, in groups. Each section is an independent root. */
    sections: SectionGroup[];
    section?: never;
}

interface SingleSectionProps extends BaseProps {
    /**
     * The one root to browse. The sidebar shows its folders as the tree itself, with no section
     * row above them, unless the section sets `showFolders: false`.
     */
    section: Section;
    sections?: never;
}

/**
 * Either `sections`, for a sidebar of independent roots, or a single `section`. Both may change
 * after mounting: a section that goes takes its places out of the history, the open one going to
 * the first section's root, and one rooted elsewhere or served by another adapter goes back to its
 * root, its listings dropped when the adapter changed. So does every section served by the
 * file manager's `adapter`, when that changes.
 */
export type FileManagerProps = MultiSectionProps | SingleSectionProps;

/** An entry to select in the open folder once its listing has it. */
interface Reveal {
    /** `folderKey` of the folder it was meant for. */
    key: string;
    id: string;
    /** Selected along with it, those the folder lists, as for entries restored together. */
    with?: string[];
    /** Said once the entry is revealed, unless it takes the focus, which says its name. */
    announce?: string;
}

/** Where an upload in the panel went, for "Show in folder". */
interface UploadPlace {
    location: FileManagerLocation;
    /**
     * Its name there, to find it by when the adapter doesn't say its id; missing for a file kept
     * beside one of its name, under a name the adapter chose.
     */
    name?: string;
}

/** What a copy or move in the transfer queue is of, and where it goes, for when it ends. */
interface TransferPlace {
    /**
     * The entries, where they are and where they go, as a paste: the entries cut for a move. The
     * trails are rewritten with the history's, to try it again where they are now.
     */
    request: PasteRequest;
    /** The entries the user chose to skip, as their names clashed. */
    skipped: FileEntry[];
    /** The folders a Replace or Merge merges others into, listed again all the way down as it ends. */
    merged: string[];
    /** Whether it can be tried again: false once a folder in either trail has gone (see `revise`). */
    retriable: boolean;
    /** The copies or moves started with it, a folder's entries each, which are said together. */
    batch: TransferBatch;
    /**
     * For a move undoing one, the name each entry had where it goes back to, in their order, taken
     * back once it's there when it was kept both on the way in under another.
     */
    names?: string[];
}

/** A copy or move of a batch as it ended, for the history. */
interface EndedTransfer {
    item: TransferItem;
    outcome: TransferOutcome;
    /** The entries as the adapter says it made them, once it's done, when it says. */
    made?: FileEntry[];
    place?: TransferPlace;
}

/**
 * The copies or moves one paste, drop or pick started, or one undo or redo: one, or one per folder
 * for a search's results from several, said together, and put in the history together, once the
 * last has ended.
 */
interface TransferBatch {
    /** How many haven't ended yet. */
    left: number;
    /** The entries of those done. */
    done: FileEntry[];
    ended: EndedTransfer[];
    /** The undo or redo it carries out; missing for a change of the user's own. */
    run?: UndoRun;
}

/** A copy or move of a batch done, and what the adapter says each of its entries became. */
interface SettledTransfer {
    end: EndedTransfer;
    place: TransferPlace;
    pairs: MadePair[];
}

/** What else a copy or move is started with: the batch it's part of, and for a move undoing one, `names`. */
interface TransferStart {
    batch?: TransferBatch;
    names?: string[];
}

/** An undo or redo under way, one at a time. */
interface UndoRun {
    /** The step taken off its list. */
    step: UndoStep;
    direction: UndoDirection;
    /**
     * The folders it changes itself, by adapter, which show the progress bar meanwhile, as a copy's
     * or move's do.
     */
    folders: UndoFolders[];
    /** The history's count of changes as it started (`historyEpoch`). */
    epoch: number;
    /** Aborted as the file manager unmounts. */
    controller: AbortController;
}

/**
 * Entries being moved to the trash or restored from it, which are held as a move's are, and whose
 * folders show the progress bar meanwhile.
 */
interface TrashWork {
    adapter: FileAdapter;
    /** Whether the entries are going to the trash or coming back from it, which their mark says. */
    kind: "trash" | "restore";
    /** The folders it changes: where the entries are, the trash, and where they go back to. */
    folderIds: string[];
    entries: FileEntry[];
}

/** What the notice under the content says, and the step its button undoes or redoes. */
interface UndoNotice extends Notice {
    /**
     * The step its button undoes or redoes, or tries again: the latest of `direction`'s list. The
     * notice shows while it is, or while it's under way.
     */
    offer?: { direction: UndoDirection; stepId: number; retry?: boolean };
    /**
     * The folders entries just restored went back to that aren't open, with them, which its Show
     * opens, them selected, offering a list of them when there are several.
     */
    show?: UndoGroup[];
}

/**
 * Why an undo or redo did nothing: what it acts on isn't as the change left it, so trying again
 * wouldn't help. The message, when there is one, says what.
 */
class UndoRefused extends Error {}

/** What an undo or redo goes on with once the adapter has answered, as it is by then. */
interface UndoTools {
    adapter: FileAdapter;
    sectionsById: ReadonlyMap<string, Section>;
    moving: MovingIds;
    text: FileManagerLocaleText;
    applyNamed: (request: NameRequest, entry: FileEntry, message: string | null, reveals?: boolean) => void;
    applyDeleted: (groups: DeleteRequest["groups"]) => void;
    applyTrashed: (adapter: FileAdapter, group: EntryGroup) => void;
    applyRestored: (
        adapter: FileAdapter,
        trashed: FileEntry[],
        made: FileEntry[] | undefined,
        folderIds: string[],
        merged: string[],
    ) => void;
    trashRootIds: (adapter: FileAdapter) => string[];
    startTrashWork: (work: TrashWork[]) => { signal: AbortSignal; end: () => void };
    revealRestored: (groups: UndoGroup[]) => UndoGroup[] | undefined;
    askDelete: (request: DeleteRequest) => void;
    relist: (adapter: FileAdapter, folderIds: string[]) => void;
    startTransfer: (
        request: PasteRequest,
        conflict: ConflictPolicy,
        skipped: FileEntry[],
        merged: string[],
        start?: TransferStart,
    ) => void;
}

/** `defaultSelectedIds`, for the folder the file manager opened in, until another opens. */
interface InitialSelection {
    key: string | null;
    ids: readonly string[];
}

/** What serves a section and where it's rooted, to tell when either changes. */
interface Served {
    rootId: string;
    adapter: FileAdapter;
}

/** The content's selection, as `onSelectionChange` was told it last. */
interface ToldSelection {
    ids: ReadonlySet<string>;
    entries: FileEntry[];
}

/** The content's selection as its folder view reports it, with the `folderKey` of its folder. */
interface ShownSelection {
    key: string | null;
    ids: ReadonlySet<string>;
    entries: FileEntry[];
}

const NO_ACTIONS: ActionGroup[] = [];
const NO_PREVIEWERS: FilePreviewer[] = [];
const NO_TOOLBAR: ToolbarGroup[] = [];
const NO_MAIN_MENU: MainMenuGroup[] = [];
const NO_TRAIL: FolderRef[] = [];
const NO_IDS: ReadonlySet<string> = new Set();
const NO_ENTRIES: FileEntry[] = [];
const NOTHING_TOLD: ToldSelection = { ids: NO_IDS, entries: NO_ENTRIES };
const NOTHING_SHOWN: ShownSelection = { key: null, ids: NO_IDS, entries: NO_ENTRIES };
const NO_ARRIVALS: readonly Arrival[] = [];
const NO_HITS: SearchHit[] = [];
const NO_SUBJECT: PropertiesSubject = { kind: "none" };

/**
 * How long what an upload just put in a folder waits for a folder view to show it, in ms, as the
 * folder may not be open, or be listed again only a moment later.
 */
const ARRIVAL_WAIT = 10_000;

const sameEntries = (a: FileEntry[], b: FileEntry[]) =>
    a === b || (a.length === b.length && a.every((entry, index) => entry === b[index]));

// Why the adapter failed, as its message says it, isolated, or nothing when it doesn't.
const errorDetail = (error: unknown) => (error instanceof Error && error.message ? isolate(error.message) : undefined);

const folderIdsOf = (entries: FileEntry[]) =>
    entries.filter((entry) => entry.kind === "folder").map((entry) => entry.id);

const sameKeys = (a: readonly SearchHit[], b: readonly SearchHit[]) =>
    a.length === b.length && a.every((hit, index) => hit.key === b[index].key);

/** What a menu was opened on, for the properties: its entries, by folder, or with none, its folder itself. */
const subjectOf = (request: MenuRequest): PropertiesSubject => {
    const { section, trail, entries, inResults } = request;

    return entries.length > 0
        ? {
              kind: "entries",
              inResults: !!inResults,
              entries: requestGroups(request).flatMap((group) =>
                  group.entries.map((entry) => ({ entry, section: group.section, trail: group.trail })),
              ),
          }
        : { kind: "folder", section, trail };
};

/** Whether the sections a subject names are still the file manager's, as they were. */
const subjectHolds = (subject: PropertiesSubject, sectionsById: ReadonlyMap<string, Section>) => {
    if (subject.kind === "folder") {
        return sectionsById.get(subject.section.id) === subject.section;
    }

    return subject.kind === "none" || subject.entries.every(({ section }) => sectionsById.get(section.id) === section);
};

// While entries are dragged, or the overlay sidebar opened for a drag, its backdrop lets drops
// through to the content, so a folder dragged out of the sidebar can land there, and files dragged
// in from outside can still go into the open folder.
const PASS_THROUGH: CSSProperties = { pointerEvents: "none" };

// Files dropped where nothing takes them would have the browser open them in place of the page, so
// the file manager refuses them anywhere its views don't take them.
const refuseFiles = (event: DragEvent) => {
    if (carriesFiles(event) && !event.defaultPrevented) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "none";
    }
};

const pickerStyle: CSSProperties = { display: "none" };

// Below `rootWide` the sidebar overlays the content. Container queries decide that, so it's read
// from the sidebar's style.
// The hidden docked sidebar shown over the content for a drag (`peek`) still docks.
const overlays = (sidebar: HTMLElement) =>
    getComputedStyle(sidebar).position === "absolute" && sidebar.dataset.peek !== "true";

const FileManager = ({
    adapter,
    sections: groups,
    section: singleSection,
    actions = NO_ACTIONS,
    previewActions = NO_ACTIONS,
    propertiesActions = NO_ACTIONS,
    previewers = NO_PREVIEWERS,
    mainMenu = NO_MAIN_MENU,
    title,
    relistAfter = 0,
    limits,
    location: locationProp,
    defaultLocation,
    onLocationChange,
    view: viewProp,
    defaultView = "list",
    onViewChange,
    zoom: zoomProp,
    defaultZoom = DEFAULT_ZOOM,
    onZoomChange,
    sort: sortProp,
    defaultSort = RELEVANCE_SORT,
    onSortChange,
    showHidden: showHiddenProp,
    defaultShowHidden = false,
    onShowHiddenChange,
    sidebarHidden: sidebarHiddenProp,
    defaultSidebarHidden = false,
    onSidebarHiddenChange,
    sidebarWidth: sidebarWidthProp,
    defaultSidebarWidth = SIDEBAR_WIDTH,
    onSidebarWidthChange,
    propertiesOpen: propertiesOpenProp,
    defaultPropertiesOpen = false,
    onPropertiesOpenChange,
    propertiesWidth: propertiesWidthProp,
    defaultPropertiesWidth = PROPERTIES_WIDTH,
    onPropertiesWidthChange,
    expandedFolders: expandedFoldersProp,
    defaultExpandedFolders,
    onExpandedFoldersChange,
    search: searchProp,
    defaultSearch = null,
    onSearchChange,
    searchExcludedSections: searchExcludedProp,
    defaultSearchExcludedSections,
    onSearchExcludedSectionsChange,
    selectedIds: selectedIdsProp,
    defaultSelectedIds,
    onSelectionChange,
    onOpenFile,
    localeText,
    locale,
    apiRef,
    ref,
    className,
    onKeyDown,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
    onPointerDownCapture,
    ...rootAttributes
}: FileManagerProps) => {
    const localeValue = useLocaleValue(localeText, locale);
    const [store] = useState(createFolderStore);
    const [thumbnails] = useState(createThumbnailCache);
    const [propertiesCache] = useState(createPropertiesCache);
    const data = useMemo(() => ({ store, adapter, thumbnails, relistAfter }), [store, adapter, thumbnails, relistAfter]);

    useEffect(() => () => store.abortAll(), [store]);
    useEffect(() => () => thumbnails.clear(), [thumbnails]);

    // The consumer's limits, each a number, so a new object of the same limits every render changes
    // nothing. They're set in layout effects, before the parts' own effects first ask for anything.
    const uploadLimit = countLimit(limits?.uploads, 1);
    const downloadLimit = countLimit(limits?.downloads, 1);
    const transferLimit = countLimit(limits?.transfers, 1);
    const thumbnailLimit = countLimit(limits?.thumbnails, 1);
    const keptThumbnails = countLimit(limits?.keptThumbnails, 0);
    const keptEntries = countLimit(limits?.keptEntries, 0);
    const searchDelay = delayLimit(limits?.searchDelay);
    const undoLimit = countLimit(limits?.undoSteps, 0) ?? UNDO_STEPS;

    useLayoutEffect(() => store.setMaxKept(keptEntries), [store, keptEntries]);
    useLayoutEffect(
        () => thumbnails.setLimits(thumbnailLimit, keptThumbnails),
        [thumbnails, thumbnailLimit, keptThumbnails],
    );

    // A single section is handled as one group of one, so only the sidebar needs to tell them apart.
    const sections = useMemo<SectionGroup[]>(
        () => (singleSection ? [{ id: singleSection.id, sections: [singleSection] }] : (groups ?? [])),
        [singleSection, groups],
    );

    const sectionsById = useMemo(
        () => new Map(sections.flatMap((group) => group.sections.map((section) => [section.id, section] as const))),
        [sections],
    );

    const firstSection = useMemo(
        () => sections.find((group) => group.sections.length > 0)?.sections[0],
        [sections],
    );

    // Where a place in a section the file manager doesn't have goes.
    const fallback = useMemo(
        () => (firstSection ? { sectionId: firstSection.id, trail: NO_TRAIL } : undefined),
        [firstSection],
    );

    // The location and the selection are kept by their own hooks, which can't use
    // `useControlled`, so it's called for its development warnings alone: about switching between
    // controlled and not, and about a default changing after mounting.
    useControlled({ controlled: locationProp, default: defaultLocation, name: "FileManager", state: "location" });
    useControlled({
        controlled: selectedIdsProp,
        default: defaultSelectedIds,
        name: "FileManager",
        state: "selectedIds",
    });

    const {
        place: requested,
        reason: placeReason,
        previous,
        next,
        places: historyPlaces,
        index: historyIndex,
        canGoBack,
        canGoForward,
        navigate,
        back,
        forward,
        go: goInHistory,
        revise: reviseHistory,
    } = useLocationHistory({
        location: locationProp,
        initial: () => defaultLocation ?? fallback ?? { sectionId: "", trail: NO_TRAIL },
        onChange: onLocationChange,
    });

    // Where each upload in the panel went, by its id, for "Show in folder". The places are rewritten
    // with the history's, so a folder renamed is followed, and one whose trail is cut short, as by a
    // folder deleted above it or its section gone back to its root, is gone, so the upload can't be
    // shown any more.
    const uploadPlaces = useRef(new Map<number, UploadPlace>());
    // What each copy and move in the transfer queue is of, by its id. Its places are rewritten the
    // same way, so one that fails can be tried again where its folders are now, until either trail
    // is cut short.
    const transferPlaces = useRef(new Map<number, TransferPlace>());

    const revise = useCallback(
        (update: ReviseLocation) => {
            // A place rewritten keeping each of its steps, or else null.
            const followed = (location: FileManagerLocation) => {
                const now = update(location, false);

                return now && now.trail.length === location.trail.length ? now : null;
            };

            reviseHistory(update);
            uploadPlaces.current.forEach((upload, id) => {
                const location = followed(upload.location);

                if (location) {
                    upload.location = location;
                } else {
                    uploadPlaces.current.delete(id);
                }
            });
            transferPlaces.current.forEach((transfer) => {
                const { clipboard, section: target, trail } = transfer.request;
                const parts = clipboard.parts.map((part) => {
                    const from = followed({ sectionId: part.section.id, trail: part.trail });

                    return from && { ...part, trail: from.trail };
                });
                const to = followed({ sectionId: target.id, trail });

                if (to && parts.every((part) => part !== null)) {
                    transfer.request = {
                        clipboard: { ...clipboard, parts },
                        section: target,
                        trail: to.trail,
                    };
                } else {
                    transfer.retriable = false;
                }
            });
        },
        [reviseHistory],
    );

    // A place in a section the file manager doesn't have, which a section removed, or a location
    // passed for one it never had, leaves, shows the first section's root while the history is put
    // right (below).
    const place = sectionsById.has(requested.sectionId) || !fallback ? requested : fallback;
    const section = sectionsById.get(place.sectionId);
    const folder = section && folderOf(section, place.trail);
    const openKey = section && folder ? folderKey(section.id, folder.id) : null;

    // Folders expanded in the sidebar tree, by `folderKey`, which the consumer may control as
    // `SectionFolder`s. Unless they say otherwise, only the first section shown starts expanded, if
    // it shows its folders at all; after that, only the chevrons change the tree.
    const [defaultExpanded] = useState<ReadonlySet<string>>(() => {
        if (defaultExpandedFolders) {
            return new Set(defaultExpandedFolders.map((shown) => folderKey(shown.sectionId, shown.folderId)));
        }

        return new Set(section && section.showFolders !== false ? [folderKey(section.id, section.rootId)] : []);
    });
    const expandedKeys = useStableSet(
        expandedFoldersProp?.map((shown) => folderKey(shown.sectionId, shown.folderId)),
    );
    const [expanded, setExpanded] = useSetting<ReadonlySet<string>>({
        name: "expandedFolders",
        value: expandedKeys,
        defaultValue: defaultExpanded,
        onChange: onExpandedFoldersChange && ((keys) => onExpandedFoldersChange([...keys].map(keyFolder))),
        equal: sameIds,
    });

    // With no section to open in at first, as while an app is still getting them, the one the file
    // manager first opens in starts expanded as it comes, when it keeps the expanded folders itself.
    const expandsFirst = useRef(!defaultExpandedFolders && expandedFoldersProp === undefined && !section);

    useLayoutEffect(() => {
        if (!expandsFirst.current || !section) {
            return;
        }

        expandsFirst.current = false;

        if (section.showFolders !== false) {
            setExpanded((prev) => new Set([...prev, folderKey(section.id, section.rootId)]));
        }
    }, [section, setExpanded]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    // The sidebar shown for a drag resting on the button that shows it, until the drag ends: the
    // overlay, while it's collapsed, or the hidden docked sidebar over the content (`peek`).
    const [sidebarForDrag, setSidebarForDrag] = useState<"overlay" | "peek" | null>(null);
    // Whether the docked sidebar is hidden, with F9 or the view menu. Collapsed, it shows as an
    // overlay instead, while `sidebarOpen`.
    const [sidebarHidden, setSidebarHidden] = useSetting({
        name: "sidebarHidden",
        value: sidebarHiddenProp,
        defaultValue: defaultSidebarHidden,
        onChange: onSidebarHiddenChange,
    });
    // How wide the docked sidebar is, as the user drags its edge.
    const [sidebarWidth, setSidebarWidth] = useSetting({
        name: "sidebarWidth",
        value: sidebarWidthProp,
        defaultValue: defaultSidebarWidth,
        onChange: onSidebarWidthChange,
    });
    // Whether the docked properties show, with Alt+Enter or the view menu. Collapsed, they show as an
    // overlay instead, while `propertiesOverlay`.
    const [propertiesOpen, setPropertiesOpen] = useSetting({
        name: "propertiesOpen",
        value: propertiesOpenProp,
        defaultValue: defaultPropertiesOpen,
        onChange: onPropertiesOpenChange,
    });
    // How wide the docked properties are, as the user drags their edge.
    const [propertiesWidth, setPropertiesWidth] = useSetting({
        name: "propertiesWidth",
        value: propertiesWidthProp,
        defaultValue: defaultPropertiesWidth,
        onChange: onPropertiesWidthChange,
    });
    const [propertiesOverlay, setPropertiesOverlay] = useState(false);
    // What the properties show in place of the selection, as `ActionContext.properties` asked, until
    // the selection or the location changes.
    const [pinned, setPinned] = useState<PropertiesSubject | null>(null);
    const [view, setView] = useSetting({
        name: "view",
        value: viewProp,
        defaultValue: defaultView,
        onChange: onViewChange,
    });
    // Each view's own, as in GNOME Files, kept across folders.
    const [zoom, setZoom] = useSetting({
        name: "zoom",
        value: zoomProp,
        defaultValue: defaultZoom,
        onChange: onZoomChange,
        equal: sameZoom,
    });
    // Kept across folders, as the view is.
    const [sort, setSort] = useSetting({
        name: "sort",
        value: sortProp,
        defaultValue: defaultSort,
        onChange: onSortChange,
        equal: sameSort,
    });
    // Kept across folders, as the sort is. Listings are filtered by it where they're shown, never in the store.
    const [showHidden, setShowHidden] = useSetting({
        name: "showHidden",
        value: showHiddenProp,
        defaultValue: defaultShowHidden,
        onChange: onShowHiddenChange,
    });
    const [menu, setMenu] = useState<MenuState | null>(null);
    const [naming, setNaming] = useState<NameDialogState | null>(null);
    const [transfer, setTransfer] = useState<TransferDialogState | null>(null);
    const [deleting, setDeleting] = useState<DeleteDialogState | null>(null);
    const [restoring, setRestoring] = useState<RestoreDialogState | null>(null);
    // Entries going to the trash or coming back from it, without a dialog, while the adapter works.
    const [trashWork, setTrashWork] = useState<readonly TrashWork[]>([]);
    // Aborted as the file manager unmounts.
    const trashControllers = useRef(new Set<AbortController>());
    const [clipboard, setClipboard] = useState<Clipboard | null>(null);
    const [pasting, setPasting] = useState<PasteDialogState | null>(null);
    const [uploadCheck, setUploadCheck] = useState<UploadDialogState | null>(null);
    const [previewing, setPreviewing] = useState<PreviewDialogState | null>(null);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    // What gets the focus back as the keyboard shortcuts close.
    const shortcutsOpener = useRef<HTMLElement | null>(null);
    const [reveal, setReveal] = useState<Reveal | null>(null);
    // Said from inside the preview while it's open, as it hides the rest from screen readers.
    const { announcement, announce } = useAnnouncer(() => (previewing?.open ? "preview" : "root"));

    // The changes made through the file manager that can be undone, and those undone that can be
    // done again, kept while it's mounted. The ref holds them as of now, for keys pressed in quick
    // succession, before a render.
    const [history, setHistory] = useState(NO_HISTORY);
    const historyNow = useRef(NO_HISTORY);
    // Counts the changes made and the history's ends, so an undo finishing after a change leaves
    // nothing to redo, as the change cleared that.
    const historyEpoch = useRef(0);
    const stepCount = useRef(0);
    const undoLimitNow = useRef(undoLimit);
    // The undo or redo under way; another waits for it to end.
    const [undoing, setUndoing] = useState<UndoRun | null>(null);
    const undoingNow = useRef<UndoRun | null>(null);
    const [notice, setNotice] = useState<UndoNotice | null>(null);
    const undoTools = useRef<UndoTools | null>(null);

    useEffect(() => () => undoingNow.current?.controller.abort(), []);
    useEffect(() => () => trashControllers.current.forEach((controller) => controller.abort()), []);

    const changeHistory = useCallback((change: (before: UndoHistory) => UndoHistory) => {
        const after = change(historyNow.current);

        if (after !== historyNow.current) {
            historyNow.current = after;
            setHistory(after);
        }
    }, []);

    // Fewer steps kept drops the oldest at once.
    useLayoutEffect(() => {
        undoLimitNow.current = undoLimit;
        changeHistory((before) => {
            const undo = latestSteps(before.undo, undoLimit);
            const redo = latestSteps(before.redo, undoLimit);

            return undo === before.undo && redo === before.redo ? before : { undo, redo };
        });
    }, [undoLimit, changeHistory]);

    const showNotice = useCallback(
        (shown: Omit<UndoNotice, "id">) => setNotice((prev) => ({ ...shown, id: (prev?.id ?? 0) + 1 })),
        [],
    );

    const closeNotice = useCallback(() => setNotice(null), []);

    // A step on top of a list, the oldest beyond the limit going.
    const pushStep = useCallback(
        (direction: UndoDirection, step: UndoStep) =>
            changeHistory((before) => ({
                ...before,
                [direction]: latestSteps([...before[direction], step], undoLimitNow.current),
            })),
        [changeHistory],
    );

    // A change made through the file manager goes on the undo list, and leaves nothing undone to
    // redo, as in any editor. The notice says what it did, with Undo, and Show for entries restored.
    const recordChange = useCallback(
        (change: UndoChange, served: FileAdapter, action: UndoAction, message: string, show?: UndoGroup[]) => {
            const step: UndoStep = { id: (stepCount.current += 1), change, adapter: served, action };

            historyEpoch.current += 1;
            changeHistory((before) => ({ undo: latestSteps([...before.undo, step], undoLimitNow.current), redo: [] }));
            showNotice({ message, offer: { direction: "undo", stepId: step.id }, show });
        },
        [changeHistory, showNotice],
    );

    // A change made through the file manager that can't be undone (a delete, an upload, a copy or
    // move that replaced something) ends the history, so undoing never goes back past it to an
    // older change, which would have to undo it first.
    const endHistory = useCallback(() => {
        historyEpoch.current += 1;
        changeHistory((before) => (before.undo.length > 0 || before.redo.length > 0 ? NO_HISTORY : before));
    }, [changeHistory]);

    // An undo or redo ending, done or not: the next can start.
    const leaveRun = useCallback((run: UndoRun) => {
        if (undoingNow.current !== run) {
            return false;
        }

        undoingNow.current = null;
        setUndoing(null);

        return true;
    }, []);

    // What an undo or redo did, as a step on the other list that goes back the other way. What's
    // left of one that failed partway, done at last, joins the step holding what it did then, while
    // that's still the latest there (`joins`), so the two are one change again.
    const putDone = useCallback(
        (run: UndoRun, back: UndoDirection, action: UndoAction) => {
            const top = historyNow.current[back].at(-1);
            const joined = top && run.step.joins === top.id ? joinActions(top.action, action) : null;
            const step: UndoStep = {
                id: (stepCount.current += 1),
                change: run.step.change,
                adapter: joined && top ? top.adapter : run.step.adapter,
                action: joined ?? action,
            };

            changeHistory((before) => ({
                ...before,
                [back]: latestSteps(
                    [...(joined ? before[back].slice(0, -1) : before[back]), step],
                    undoLimitNow.current,
                ),
            }));

            return step;
        },
        [changeHistory],
    );

    // An undo or redo done: what undoes or redoes it in turn goes on the other list, and the notice
    // says what it did, with that one's button, unless an undo ends after another change was made
    // meanwhile, which left nothing to redo.
    const endRun = useCallback(
        (run: UndoRun, done: { action: UndoAction; message: string; show?: UndoGroup[] }) => {
            if (!leaveRun(run)) {
                return;
            }

            const back = otherWay(run.direction);

            if (back === "redo" && historyEpoch.current !== run.epoch) {
                showNotice({ message: done.message, show: done.show });

                return;
            }

            const step = putDone(run, back, done.action);

            showNotice({ message: done.message, offer: { direction: back, stepId: step.id }, show: done.show });
        },
        [leaveRun, putDone, showNotice],
    );

    // A step put back on its list, to try again, as long as no change was made meanwhile, which it
    // would otherwise go back on top of.
    const putBack = useCallback(
        (run: UndoRun) => {
            const back = historyEpoch.current === run.epoch;

            if (back) {
                pushStep(run.direction, run.step);
            }

            return back;
        },
        [pushStep],
    );

    // An undo or redo that did nothing, or failed: the notice says so, and why when it's known, and
    // a step the adapter failed is put back, to try again with Try again or the same key.
    const failRun = useCallback(
        (run: UndoRun, detail: string | undefined, again: boolean) => {
            if (!leaveRun(run)) {
                return;
            }

            const { text } = localeValue;
            const message = (run.direction === "undo" ? text.undoFailed : text.redoFailed)(run.step.change);
            const retry = again && putBack(run);

            announce(detail ? `${message}: ${detail}` : message);
            showNotice({
                message,
                detail,
                offer: retry ? { direction: run.direction, stepId: run.step.id, retry } : undefined,
            });
        },
        [leaveRun, putBack, showNotice, announce, localeValue],
    );

    // An undo or redo of a move to the trash or a restore that failed partway, through several
    // folders or adapters: what it did goes on the other list, as a run done does, or ends the
    // history when it can't be undone in turn, and what's left (`rest`, through `restAdapter` first)
    // is put back to try again, as long as no change was made meanwhile, joining what it did once
    // it's done. The notice says it failed, and why, with Try again.
    const failRunPartway = useCallback(
        (run: UndoRun, done: UndoAction | null, rest: UndoAction, restAdapter: FileAdapter, detail?: string) => {
            if (!leaveRun(run)) {
                return;
            }

            const back = otherWay(run.direction);
            const current = historyEpoch.current === run.epoch;
            let joins: number | undefined;

            if (!done) {
                endHistory();
            } else if (back === "undo" || current) {
                joins = putDone(run, back, done).id;
            }

            const { text } = localeValue;
            const message = (run.direction === "undo" ? text.undoFailed : text.redoFailed)(run.step.change);
            const left: UndoStep = {
                id: (stepCount.current += 1),
                change: run.step.change,
                adapter: restAdapter,
                action: rest,
                joins,
            };

            if (current) {
                pushStep(run.direction, left);
            }

            announce(detail ? `${message}: ${detail}` : message);
            showNotice({
                message,
                detail,
                offer: current ? { direction: run.direction, stepId: left.id, retry: true } : undefined,
            });
        },
        [leaveRun, endHistory, putDone, pushStep, showNotice, announce, localeValue],
    );

    // An undo or redo the user called off, as the dialog confirming a copy's copies closed, is put back.
    const callOffRun = useCallback(
        (run: UndoRun) => {
            if (leaveRun(run)) {
                putBack(run);
            }
        },
        [leaveRun, putBack],
    );

    // A folder just created, which the sidebar tree scrolls to once it shows its row.
    const [treeReveal, setTreeReveal] = useState<TreeReveal | null>(null);
    // Copies and moves run in the background while the user browses, a few at once, and the panel
    // shows those that take a moment or failed. What one ending does needs much made further down
    // (`handleTransferEnded`), which it's handed once that's made. A copy into another adapter's
    // folder names folders kept both, and words a server's error, as the text has it.
    const transferEnded = useRef<TransferEnded | null>(null);
    const transfers = useTransferQueue(
        (item, outcome, items, made) => transferEnded.current?.(item, outcome, items, made),
        localeValue.text,
    );

    useLayoutEffect(() => transfers.queue.setMaxActive(transferLimit), [transfers.queue, transferLimit]);

    const shownTransfers = useMemo(() => transfers.items.filter((item) => item.shown), [transfers.items]);
    // The entries moves under way are moving, and those going to the trash or coming back from it,
    // which are marked and left alone until they end. Made afresh only as moves start and end, not
    // with every bit of progress.
    const movesKey = transfers.items
        .filter(isMoving)
        .map((item) => item.id)
        .join(" ");
    const moving = useMemo(() => movingIds(transfers.items, trashWork), [movesKey, trashWork]);
    // The browser's file picker, and where the files picked with it go.
    const pickerRef = useRef<HTMLInputElement>(null);
    const pickedInto = useRef<((dropped: DroppedFiles) => void) | null>(null);
    // The folder in which touch selection mode is on, so opening another folder turns it off.
    const [selectingKey, setSelectingKey] = useState<string | null>(null);
    const selecting = openKey !== null && selectingKey === openKey;
    const rootRef = useRef<HTMLDivElement>(null);
    const rootElementRef = useForkRef(rootRef, ref);
    // Handed to what portals out of the file manager, so it runs the same way (`DirectionContext`).
    const direction = useTextDirection(rootRef);
    const panelRef = useRef<HTMLDivElement>(null);
    const paneRef = useRef<HTMLDivElement>(null);
    // What had the focus when the properties' overlay opened, which gets it back as the overlay closes.
    const propertiesOpener = useRef<HTMLElement | null>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const columnRef = useRef<HTMLDivElement>(null);
    const sidebarButtonRef = useRef<HTMLButtonElement>(null);
    // What had the focus when the overlay sidebar opened, which gets it back as the overlay closes.
    const sidebarOpener = useRef<HTMLElement | null>(null);
    // What had the focus when the context menu opened, where an action picked in it counts as run from.
    const menuOpener = useRef<Element | null>(null);
    // Asks the folder view to take the focus, for one render, e.g. as another folder opens and the
    // view the focus was in goes away.
    const [focusContent, setFocusContent] = useState(false);

    useEffect(() => {
        if (focusContent) {
            setFocusContent(false);
        }
    }, [focusContent]);

    // Asks the properties to take the focus, for one render, as the context menu's Properties or F6 does.
    const [focusProperties, setFocusProperties] = useState(false);

    useEffect(() => {
        if (focusProperties) {
            setFocusProperties(false);
        }
    }, [focusProperties]);

    // What the search field in the path bar's place searches, the open folder or every section,
    // or null while it isn't there, and what's typed in it, which the consumer may control. A
    // folder search lists only the open folder's entries that match; a search everywhere asks the
    // sections' adapters.
    const [search, setSearch] = useSetting<FileManagerSearch | null>({
        name: "search",
        value: searchProp,
        defaultValue: defaultSearch,
        onChange: onSearchChange,
        equal: sameSearch,
    });
    const query = search?.query ?? "";

    // The sections a search everywhere can cover: those whose adapter has `search`, in the
    // sidebar's order, and their groups for the field's sections menu. Without any, there's no
    // search everywhere. The trash isn't searched, so what's in it doesn't turn up among the rest.
    const searchTargets = useMemo(
        () =>
            sections.flatMap((group) =>
                group.sections.flatMap((shown): SearchTarget[] => {
                    const served = shown.adapter ?? adapter;

                    return served.search && !shown.trash ? [{ section: shown, adapter: served }] : [];
                }),
            ),
        [sections, adapter],
    );
    const searchGroups = useMemo(() => {
        const searchable = new Set(searchTargets.map((target) => target.section.id));

        return sections.flatMap((group) => {
            const shown = group.sections.filter((candidate) => searchable.has(candidate.id));

            return shown.length > 0 ? [{ ...group, sections: shown }] : [];
        });
    }, [sections, searchTargets]);
    const canSearchEverywhere = searchTargets.length > 0;
    // Whether anything can be previewed, for the keyboard shortcuts to list the preview's keys.
    const canPreview = useMemo(
        () =>
            previewers.length > 0 ||
            sections.some((group) => group.sections.some((shown) => !!(shown.adapter ?? adapter).content)),
        [sections, adapter, previewers],
    );

    const canUpload = useMemo(
        () =>
            sections.some((group) =>
                group.sections.some((shown) => !!(shown.adapter ?? adapter).upload && takesUploads(shown)),
            ),
        [sections, adapter],
    );

    // Whether a property can be edited anywhere, for the keyboard shortcuts window.
    const canEditProperties = useMemo(
        () => sections.some((group) => group.sections.some((shown) => !!(shown.adapter ?? adapter).updateProperties)),
        [sections, adapter],
    );

    // Sections a search everywhere leaves out, kept while the file manager is mounted, so a section
    // added later is searched. Ids of sections gone, or that can't be searched, don't count, and
    // leaving out every section left counts as leaving out none.
    const [defaultExcluded] = useState<ReadonlySet<string>>(() => new Set(defaultSearchExcludedSections));
    const excludedIds = useStableSet(searchExcludedProp);
    const [searchExcluded, setSearchExcluded] = useSetting<ReadonlySet<string>>({
        name: "searchExcludedSections",
        value: excludedIds,
        defaultValue: defaultExcluded,
        onChange: onSearchExcludedSectionsChange && ((ids) => onSearchExcludedSectionsChange([...ids])),
        equal: sameIds,
    });
    const excludedSections = useMemo(() => {
        const left = new Set(
            searchTargets.filter((target) => searchExcluded.has(target.section.id)).map((target) => target.section.id),
        );

        return left.size === 0 || left.size >= searchTargets.length ? NO_IDS : left;
    }, [searchExcluded, searchTargets]);
    const searchedTargets = useMemo(
        () => searchTargets.filter((target) => !excludedSections.has(target.section.id)),
        [searchTargets, excludedSections],
    );
    // Counts the changes made through the file manager, which a search everywhere runs again for,
    // so its results show them.
    const [searchVersion, setSearchVersion] = useState(0);

    // A search everywhere left with no section to search, as when the sections changed, searches
    // the open folder instead.
    const searchScope: SearchScope | null =
        search && (search.scope === "everywhere" && !canSearchEverywhere ? "folder" : search.scope);

    const searchedFor = query.trim();
    const showsResults = searchScope === "everywhere" && searchedFor !== "" && searchedTargets.length > 0;

    // A search everywhere's selection, which the properties show while its results do. The results
    // showing or going, and a change of what's selected among them, end what `ActionContext.properties`
    // asked the properties to show instead.
    const [resultSelection, setResultSelection] = useState(NO_HITS);
    const resultsSelected = useRef(NO_HITS);
    const [resultsShown, setResultsShown] = useState(showsResults);

    if (resultsShown !== showsResults) {
        setResultsShown(showsResults);
        setResultSelection(NO_HITS);
        resultsSelected.current = NO_HITS;
        setPinned(null);
    }

    const handleResultSelection = useCallback((hits: SearchHit[]) => {
        const before = resultsSelected.current;

        if (!sameKeys(before, hits)) {
            setPinned(null);
        }

        if (!sameKeys(before, hits) || before.some((hit, index) => hit.entry !== hits[index].entry)) {
            resultsSelected.current = hits;
            setResultSelection(hits);
        }
    }, []);
    const searchInputRef = useRef<HTMLInputElement>(null);
    // What had the focus when the search opened, which gets it back as the search closes.
    const searchOpener = useRef<HTMLElement | null>(null);
    // Whether the path field, to type a path in, is in the path bar's place, as the search field is.
    const [pathEditing, setPathEditing] = useState(false);
    const pathInputRef = useRef<HTMLInputElement>(null);
    // What had the focus when the path field opened, which gets it back as the field closes.
    const pathOpener = useRef<HTMLElement | null>(null);

    // Going up to a folder the open one is in, however it's reached, the user's way or the
    // consumer's, selects the folder it was left through, as desktop file managers do. A place
    // rewritten in place, as after the folder it was in was deleted, doesn't count. An entry still
    // waiting to be selected is forgotten once another folder opens, unless it was meant for that
    // one, as `FileManagerApi.reveal` with a location asks.
    const [shownPlace, setShownPlace] = useState(place);

    if (shownPlace !== place) {
        const left = placeReason === "replace" ? undefined : folderLeft(shownPlace, place);

        setShownPlace(place);
        // The properties follow the selection again in the folder opened.
        setPinned(null);

        if (!(reveal && reveal.key === openKey)) {
            // A created or renamed entry the open folder no longer waits for is announced now.
            if (reveal?.announce) {
                announce(reveal.announce);
            }

            setReveal(left && openKey ? { key: openKey, id: left.id } : null);
        }
    }

    // Another folder ends the search, as in GNOME Files, however it's opened. A layout effect, since
    // a controlled search is only asked to close, which isn't done while rendering.
    const searchedPlace = useRef(place);

    useLayoutEffect(() => {
        if (!samePlace(searchedPlace.current, place)) {
            setSearch(null);
        }

        searchedPlace.current = place;
    }, [place, setSearch]);

    // Another folder ends the path field too, however it's opened, handing the focus on to the
    // content when it was in the field, which goes with it.
    const pathPlace = useRef(place);

    useLayoutEffect(() => {
        if (pathEditing && !samePlace(pathPlace.current, place)) {
            if (document.activeElement === pathInputRef.current) {
                setFocusContent(true);
            }

            pathOpener.current = null;
            setPathEditing(false);
        }

        pathPlace.current = place;
    }, [place, pathEditing]);

    // The consumer's selected ids, as a set that stays the same while they hold the same ids, so
    // passing a new array of them doesn't count as selecting them anew.
    const { current: selectionControlled } = useRef(selectedIdsProp !== undefined);
    const selectedIdSet = useStableSet(selectedIdsProp) ?? NO_IDS;

    // `defaultSelectedIds` are for the folder the file manager opens in, while it's open.
    const [initialSelection, setInitialSelection] = useState<InitialSelection | null>(() =>
        defaultSelectedIds?.length && !selectionControlled ? { key: openKey, ids: defaultSelectedIds } : null,
    );

    if (initialSelection && initialSelection.key !== openKey) {
        setInitialSelection(null);
    }

    // The consumer's callback is kept current, since the handlers calling it outlive renders.
    const callbacks = useRef({ onSelectionChange });

    useLayoutEffect(() => {
        callbacks.current = { onSelectionChange };
    });

    // The selection as `onSelectionChange` was told it last, so it's told only what changed, however
    // many times the folder view reports it.
    const toldSelection = useRef(NOTHING_TOLD);

    const tellSelection = useCallback(
        (ids: ReadonlySet<string>, entries: FileEntry[], location: FileManagerLocation) => {
            const before = toldSelection.current;

            if (sameIds(ids, before.ids) && sameEntries(entries, before.entries)) {
                return;
            }

            toldSelection.current = { ids, entries };
            callbacks.current.onSelectionChange?.([...ids], { entries, location });
        },
        [],
    );

    // The content's selection as its folder view reports it, which the properties show, and the ids
    // it had, by the folder, so a change of the selection there, not of its entries' listing, ends
    // what `ActionContext.properties` asked them to show instead.
    const [shownSelection, setShownSelection] = useState(NOTHING_SHOWN);
    const selectionShown = useRef(NOTHING_SHOWN);

    const handleSelectionChange = useCallback(
        (ids: ReadonlySet<string>, entries: FileEntry[], location: FileManagerLocation) => {
            const before = selectionShown.current;

            tellSelection(ids, entries, location);

            if (before.key === openKey && !sameIds(before.ids, ids)) {
                setPinned(null);
            }

            if (before.key !== openKey || !sameIds(before.ids, ids) || !sameEntries(before.entries, entries)) {
                selectionShown.current = { key: openKey, ids, entries };
                setShownSelection(selectionShown.current);
            }
        },
        [tellSelection, openKey],
    );

    // Places in sections the file manager no longer has leave the history, and the current one, if
    // it's among them, goes to the first section's root, which a controlled location is asked for
    // as "replace". So does a location passed for a section the file manager doesn't have.
    useLayoutEffect(() => {
        if (fallback) {
            revise((visited, current) => {
                if (sectionsById.has(visited.sectionId)) {
                    return visited;
                }

                return current ? fallback : null;
            });
        }
    }, [sectionsById, fallback, requested, revise]);

    // What served each section, and where it was rooted, as of the last time they changed.
    const servedBefore = useRef<ReadonlyMap<string, Served>>(new Map());

    // A section rooted elsewhere, or served by another adapter, as when the file manager's `adapter`
    // changes, goes back to its root, in the history too, since its trails lead nowhere now. Another
    // adapter's ids mean something else, so the section's listings are dropped and listed again by
    // what shows them, and entries on the clipboard that no section's adapter serves can't be pasted
    // any more, and leave it.
    useLayoutEffect(() => {
        const before = servedBefore.current;
        const now = new Map(
            [...sectionsById.values()].map(
                (shown) => [shown.id, { rootId: shown.rootId, adapter: shown.adapter ?? adapter }] as const,
            ),
        );
        const changed = [...now].flatMap(([id, served]) => {
            const was = before.get(id);

            return was && (was.rootId !== served.rootId || was.adapter !== served.adapter) ? [{ id, was, served }] : [];
        });

        servedBefore.current = now;

        changed.forEach(({ id, was, served }) => {
            if (was.adapter !== served.adapter) {
                store.forgetSection(id);
            }
        });

        if (changed.length > 0) {
            const reset = new Set(changed.map(({ id }) => id));

            revise((visited) =>
                reset.has(visited.sectionId) && visited.trail.length > 0 ? { ...visited, trail: NO_TRAIL } : visited,
            );

            // A section rooted elsewhere stays expanded or collapsed as it was.
            setExpanded((prev) => {
                const rerooted = changed.filter(
                    ({ id, was, served }) => was.rootId !== served.rootId && prev.has(folderKey(id, was.rootId)),
                );

                if (rerooted.length === 0) {
                    return prev;
                }

                const expandedNow = new Set(prev);

                rerooted.forEach(({ id, served }) => expandedNow.add(folderKey(id, served.rootId)));

                return expandedNow;
            });
        }

        const adapters = new Set([...now.values()].map((served) => served.adapter));

        setClipboard((prev) => {
            if (!prev || prev.parts.every((part) => adapters.has(part.adapter))) {
                return prev;
            }

            const parts = prev.parts.filter((part) => adapters.has(part.adapter));

            return parts.length > 0 ? { ...prev, parts } : null;
        });
    }, [sectionsById, adapter, store, revise]);

    // A step naming a section that's gone, rooted elsewhere or served by another adapter means
    // nothing now, and leaves the history.
    useLayoutEffect(
        () => changeHistory((before) => heldHistory(before, sectionsById, adapter)),
        [sectionsById, adapter, changeHistory],
    );

    const hasActions = useMemo(() => actions.some((group) => group.actions.length > 0), [actions]);

    // Entries on the clipboard that a change may have reached are looked for again.
    useClipboardFollow(clipboard, setClipboard, store);

    // Cut entries are marked by the adapter serving them. Those being found again by name aren't, as
    // their ids may name others meanwhile.
    const cut = useMemo(() => {
        if (clipboard?.kind !== "cut") {
            return null;
        }

        const ids = new Map<FileAdapter, Set<string>>();

        clipboard.parts.forEach((part) => {
            const own = ids.get(part.adapter) ?? new Set<string>();

            if (part.lookup?.by !== "name") {
                part.entries.forEach((entry) => own.add(entry.id));
            }

            ids.set(part.adapter, own);
        });

        return ids;
    }, [clipboard]);

    // Folders a paste being checked changes, whose view shows a progress bar meanwhile (`busy`), in
    // any section showing them, by the adapter serving them: the one it goes into, the one listing
    // that folder (where it was dropped onto, or pasted into from its menu), and, for a move, those
    // the entries leave, which may be another adapter's.
    const pasteIds = useMemo((): UndoFolders[] | null => {
        if (!pasting?.open) {
            return null;
        }

        const { clipboard: pasted, section: target, trail } = pasting.request;
        const into = {
            adapter: target.adapter ?? adapter,
            folderIds: [folderOf(target, trail).id, folderOf(target, trail.slice(0, -1)).id],
        };
        const left = pasted.parts.map((part) => ({
            adapter: part.adapter,
            folderIds: [folderOf(part.section, part.trail).id],
        }));

        return pasted.kind === "cut" ? [into, ...left] : [into];
    }, [pasting, adapter]);

    // A reveal may be waiting for its folder to open.
    const revealId = reveal?.key === openKey ? reveal.id : undefined;
    const revealWith = reveal?.key === openKey ? reveal.with : undefined;

    // Expands without ever collapsing, for a drag resting on a collapsed folder or section.
    const expand = useCallback(
        (key: string) => {
            setExpanded((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
        },
        [setExpanded],
    );

    const toggleExpanded = useCallback(
        (key: string) => {
            setExpanded((prev) => {
                const next = new Set(prev);

                if (next.has(key)) {
                    next.delete(key);
                } else {
                    next.add(key);
                }

                return next;
            });
        },
        [setExpanded],
    );

    // Whether the focus is in the content panel, or in the context menu opened from it, since an
    // action picked in the menu counts as run where the menu was opened.
    const focusInContent = useCallback(() => {
        const active = document.activeElement;
        const from = active?.closest('[role="menu"]') ? menuOpener.current : active;

        return !!from && !!panelRef.current?.contains(from);
    }, []);

    // Going somewhere from inside the file manager takes the focus along into the folder opened when
    // it was in the content, as the view it was in goes away. Each folder opens with nothing
    // selected, so a controlled selection is asked to empty.
    const leaveFor = useCallback(
        (target: FileManagerLocation) => {
            if (focusInContent()) {
                setFocusContent(true);
            }

            if (selectionControlled && !samePlace(target, place)) {
                tellSelection(NO_IDS, NO_ENTRIES, target);
            }
        },
        [focusInContent, selectionControlled, place, tellSelection],
    );

    // Going somewhere leaves the sidebar tree as the user left it; the path bar shows where it is.
    const goTo = useCallback(
        (target: FileManagerLocation) => {
            if (sectionsById.has(target.sectionId)) {
                leaveFor(target);
                navigate(target);
            }
        },
        [leaveFor, navigate, sectionsById],
    );

    const goBack = useCallback(() => {
        if (previous) {
            leaveFor(previous);
            back();
        }
    }, [previous, leaveFor, back]);

    const goForward = useCallback(() => {
        if (next) {
            leaveFor(next);
            forward();
        }
    }, [next, leaveFor, forward]);

    // The places back or forward lead to, nearest first, for the lists the header's buttons open,
    // named by the folder each is at, or by its section at the root.
    const historyStops = useCallback(
        (direction: "back" | "forward"): HistoryStop[] => {
            const sign = direction === "back" ? -1 : 1;
            const stops: HistoryStop[] = [];

            for (let by = sign; historyPlaces[historyIndex + by]; by += sign) {
                const { sectionId, trail } = historyPlaces[historyIndex + by];

                stops.push({ by, ...placeName(sectionsById.get(sectionId), trail) });
            }

            return stops;
        },
        [historyPlaces, historyIndex, sectionsById],
    );

    // Goes straight to a place of the history's lists, as back or forward would after as many steps.
    const goInHistoryBy = useCallback(
        (by: number) => {
            const target = historyPlaces[historyIndex + by];

            if (target) {
                leaveFor(target);
                goInHistory(by);
            }
        },
        [historyPlaces, historyIndex, leaveFor, goInHistory],
    );

    // The overlay closes on the place picked in it, so the focus goes on to the content.
    const navigateFromSidebar = useCallback(
        (target: FileManagerLocation) => {
            if (sidebarRef.current?.contains(document.activeElement) && overlays(sidebarRef.current)) {
                setFocusContent(true);
            }

            goTo(target);
        },
        [goTo],
    );

    const openSidebar = useCallback(() => {
        sidebarOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setSidebarOpen(true);
    }, []);

    // Closing the overlay with the focus in it gives the focus back to what had it before the
    // overlay opened, or else to the button that shows it. Docked, the focus stays where it is.
    const closeSidebar = useCallback(() => {
        const sidebar = sidebarRef.current;
        const opener = sidebarOpener.current;

        setSidebarOpen(false);
        sidebarOpener.current = null;

        if (sidebar && overlays(sidebar) && sidebar.contains(document.activeElement)) {
            const returnTo =
                opener && opener !== document.body && opener.isConnected ? opener : sidebarButtonRef.current;

            returnTo?.focus();
        }
    }, []);

    // The sidebar docking, or no longer, as the file manager's width changes. Docking closes the
    // overlay, so it doesn't open again as the width shrinks back. A sidebar that goes with the
    // change, the overlay docking while the docked sidebar is hidden, or the docked sidebar
    // collapsing, hands the focus it had to the content.
    const handleSidebarDocking = (docked: boolean) => {
        const shownBefore = docked ? sidebarOpen : !sidebarHidden;
        const shownNow = docked ? !sidebarHidden : sidebarOpen;

        if (docked) {
            setSidebarOpen(false);
            sidebarOpener.current = null;
        }

        if (shownBefore && !shownNow && sidebarRef.current?.contains(document.activeElement)) {
            setFocusContent(true);
        }
    };
    const handleSidebarDockingRef = useRef(handleSidebarDocking);

    useLayoutEffect(() => {
        handleSidebarDockingRef.current = handleSidebarDocking;
    });

    // Whether the sidebar docks, read from its style whenever the frame changes size, as the
    // properties' pane reads its own.
    useLayoutEffect(() => {
        const sidebar = sidebarRef.current;
        const frame = sidebar?.parentElement;

        if (!sidebar || !frame) {
            return;
        }

        let wasDocked = !overlays(sidebar);
        const observer = new ResizeObserver(() => {
            const docked = !overlays(sidebar);

            if (docked !== wasDocked) {
                wasDocked = docked;
                handleSidebarDockingRef.current(docked);
            }
        });

        observer.observe(frame);

        return () => observer.disconnect();
    }, []);

    // How wide the docked sidebar can be made: what the frame leaves it beside the content's least
    // width and the docked properties as they are, so dragging it never squeezes either. A sidebar
    // wider than that, as it was made when the properties were narrower, is made narrower by CSS.
    const widestSidebar = useCallback(() => {
        const frame = sidebarRef.current?.parentElement;
        const column = columnRef.current;
        const pane = paneRef.current;

        if (!frame || !column) {
            return SIDEBAR_MAX_WIDTH;
        }

        const docked = pane && !overlays(pane) && pane.offsetWidth > 0;
        const taken = docked ? pane.offsetWidth + (parseFloat(getComputedStyle(pane).marginInlineEnd) || 0) : 0;

        return clampWidth(
            frame.clientWidth - (parseFloat(getComputedStyle(column).minWidth) || 0) - taken,
            SIDEBAR_MIN_WIDTH,
            SIDEBAR_MAX_WIDTH,
        );
    }, []);

    // Asks the field to take the focus once it's there, when what opens it is applied by a later render.
    const focusSearchAsked = useRef(false);

    useLayoutEffect(() => {
        const input = searchInputRef.current;

        if (focusSearchAsked.current) {
            focusSearchAsked.current = false;
            input?.focus();
            input?.select();
        }
    });

    // Opens the search field with this scope and focuses it, or, open already, switches it to this
    // scope, keeping what's typed unless `typed` is given, and focuses it with that selected.
    // Returns whether it could be opened.
    const openSearch = useCallback(
        (scope: SearchScope, typed?: string) => {
            if (!section || (scope === "everywhere" && !canSearchEverywhere)) {
                return false;
            }

            // The path field has the search field's place, so it gives way, handing over what had
            // the focus before it.
            if (!searchScope) {
                searchOpener.current = pathEditing
                    ? pathOpener.current
                    : document.activeElement instanceof HTMLElement
                      ? document.activeElement
                      : null;
            }

            pathOpener.current = null;
            setPathEditing(false);
            focusSearchAsked.current = true;
            setSearch((before) => ({ scope, query: typed ?? before?.query ?? "" }));

            const input = searchInputRef.current;

            if (input) {
                focusSearchAsked.current = false;
                input.focus();
                input.select();
            }

            return true;
        },
        [section, canSearchEverywhere, searchScope, pathEditing, setSearch],
    );

    const stopSearching = useCallback(() => {
        setSearch(null);
        searchOpener.current = null;
    }, [setSearch]);

    const changeQuery = useCallback(
        (typed: string) => setSearch((before) => before && { ...before, query: typed }),
        [setSearch],
    );

    // Closing with the focus in the field, or on its own buttons, gives it back to what had it
    // before the search opened, or else to the content, as when that was a button the layout has
    // hidden since.
    const closeSearch = useCallback(() => {
        const opener = searchOpener.current;
        const field = searchInputRef.current?.closest('[role="search"]');

        if (field?.contains(document.activeElement)) {
            if (opener && opener !== document.body) {
                opener.focus();
            }

            if (document.activeElement !== opener) {
                setFocusContent(true);
            }
        }

        stopSearching();
    }, [stopSearching]);

    // A search button closes the search it opens, and opens or switches to it otherwise.
    const toggleSearch = useCallback(
        (scope: SearchScope) => (searchScope === scope ? closeSearch() : openSearch(scope)),
        [searchScope, closeSearch, openSearch],
    );

    const searchEverywhere = useCallback(() => toggleSearch("everywhere"), [toggleSearch]);

    const focusFromSearch = useCallback(() => setFocusContent(true), []);

    // Opens the path field in the path bar's place, with the open folder's path selected, or
    // focuses it again when it's open. It ends a search, which has the same place, and keeps what had
    // the focus before to give it back as the field closes. Returns whether it could be opened.
    const openPath = useCallback(() => {
        if (!section) {
            return false;
        }

        if (!pathEditing) {
            pathOpener.current = searchScope
                ? searchOpener.current
                : document.activeElement instanceof HTMLElement
                  ? document.activeElement
                  : null;
        }

        searchOpener.current = null;
        setSearch(null);
        setPathEditing(true);

        const input = pathInputRef.current;

        if (input) {
            input.focus();
            input.select();
        }

        return true;
    }, [section, pathEditing, searchScope, setSearch]);

    // Escape or the ✕, with the focus in the field, gives it back to what had it before the field
    // opened, or else to the content, as closing a search does.
    const closePath = useCallback(() => {
        const opener = pathOpener.current;

        pathOpener.current = null;
        setPathEditing(false);

        if (opener && opener !== document.body && opener !== rootRef.current && opener.isConnected) {
            opener.focus();
        }

        if (!opener || document.activeElement !== opener) {
            setFocusContent(true);
        }
    }, []);

    // The focus went elsewhere, where it stays.
    const dismissPath = useCallback(() => {
        pathOpener.current = null;
        setPathEditing(false);
    }, []);

    // F6 moves the focus between the sidebar tree, the content and the docked properties, as in
    // GNOME Files. While the sidebar is collapsed, it opens the overlay, which takes the focus.
    const switchPane = () => {
        const sidebar = sidebarRef.current;
        const pane = paneRef.current;

        if (pane && !overlays(pane) && propertiesOpen && panelRef.current?.contains(document.activeElement)) {
            setFocusProperties(true);

            return;
        }

        if (sidebar && !sidebar.contains(document.activeElement)) {
            if (overlays(sidebar) && !sidebarOpen) {
                openSidebar();

                return;
            }

            sidebar.querySelector<HTMLElement>('[role="tree"]')?.focus();

            if (sidebar.contains(document.activeElement)) {
                return;
            }
        }

        setFocusContent(true);
    };

    // Shows or hides the docked sidebar. Hidden with the focus in it, it hands the focus to the
    // content. Shown from the "Show sidebar" button, which only shows while it's hidden and so
    // goes, it takes the focus itself.
    const showDocked = useCallback((shown: boolean) => {
        const sidebar = sidebarRef.current;

        if (!shown && sidebar?.contains(document.activeElement)) {
            setFocusContent(true);
        }

        if (shown && document.activeElement === sidebarButtonRef.current) {
            flushSync(() => setSidebarHidden(false));
            sidebar?.querySelector<HTMLElement>('[role="tree"]')?.focus();

            return;
        }

        setSidebarHidden(!shown);
    }, [setSidebarHidden]);

    // Docked or not, as container queries decide; hidden, the docked sidebar still says it docks.
    const sidebarDocked = useCallback(() => !!sidebarRef.current && !overlays(sidebarRef.current), []);

    // The header's "Show sidebar" button, shown while the sidebar is collapsed or hidden.
    const showSidebar = useCallback(() => {
        if (sidebarDocked()) {
            showDocked(true);
        } else {
            openSidebar();
        }
    }, [sidebarDocked, showDocked, openSidebar]);

    const toggleDocked = useCallback(() => showDocked(sidebarHidden), [showDocked, sidebarHidden]);

    // F9 shows and hides the sidebar, as in GNOME Files: the overlay while it's collapsed, and
    // the docked sidebar otherwise.
    const toggleSidebar = () => {
        if (sidebarDocked()) {
            toggleDocked();
        } else if (sidebarOpen) {
            closeSidebar();
        } else {
            openSidebar();
        }
    };

    // The properties' overlay takes the focus as it opens, and keeps what had it, or `opener`, to
    // give it back to.
    const openPropertiesOverlay = useCallback((opener?: HTMLElement | null) => {
        propertiesOpener.current =
            opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        setPropertiesOverlay(true);
        setFocusProperties(true);
    }, []);

    // Closing the overlay with the focus in it gives the focus back to what had it before the
    // overlay opened, or else to the content. It shows the selection again when it next opens.
    const closePropertiesOverlay = useCallback(() => {
        const pane = paneRef.current;
        const opener = propertiesOpener.current;

        setPropertiesOverlay(false);
        setPinned(null);
        propertiesOpener.current = null;

        if (pane && overlays(pane) && pane.contains(document.activeElement)) {
            if (opener && opener !== document.body && opener.isConnected) {
                opener.focus();
            }

            if (document.activeElement !== opener) {
                setFocusContent(true);
            }
        }
    }, []);

    // Shows or hides the docked properties. Hidden with the focus in them, they hand the focus to the
    // content, and they show the selection again when they next show.
    const showDockedProperties = useCallback(
        (shown: boolean) => {
            if (!shown) {
                if (paneRef.current?.contains(document.activeElement)) {
                    setFocusContent(true);
                }

                setPinned(null);
            }

            setPropertiesOpen(shown);
        },
        [setPropertiesOpen],
    );

    // Docked or not, as container queries decide; hidden, the docked properties still say they dock.
    const propertiesDocked = useCallback(() => !!paneRef.current && !overlays(paneRef.current), []);

    const toggleDockedProperties = useCallback(
        () => showDockedProperties(!propertiesOpen),
        [showDockedProperties, propertiesOpen],
    );

    // Alt+Enter shows and hides the properties, as Windows and GNOME open them: the docked ones,
    // leaving the focus where it is, so the arrow keys still move through the content as they follow
    // it, or else the overlay, which takes the focus.
    const toggleProperties = () => {
        if (propertiesDocked()) {
            if (!paneRef.current?.contains(document.activeElement)) {
                announce(propertiesOpen ? localeValue.text.propertiesHidden : localeValue.text.propertiesShown);
            }

            toggleDockedProperties();
        } else if (propertiesOverlay) {
            closePropertiesOverlay();
        } else {
            openPropertiesOverlay();
        }
    };

    // `ActionContext.properties`: they show what the menu, or the consumer's toolbar, acted on, and
    // take the focus, once the menu has given it back to where it was opened from. The overlay gives
    // it back there as it closes.
    const showProperties = useCallback(
        (subject: PropertiesSubject) => {
            setPinned(subject);
            setFocusProperties(true);

            if (propertiesDocked()) {
                setPropertiesOpen(true);
            } else if (!propertiesOverlay) {
                const active = document.activeElement;
                const from = active?.closest('[role="menu"]') ? menuOpener.current : active;

                openPropertiesOverlay(from instanceof HTMLElement ? from : null);
            }
        },
        [propertiesDocked, setPropertiesOpen, propertiesOverlay, openPropertiesOverlay],
    );

    // The panel's close button.
    const closeProperties = useCallback(() => {
        if (propertiesDocked()) {
            showDockedProperties(false);
        } else {
            closePropertiesOverlay();
        }
    }, [propertiesDocked, showDockedProperties, closePropertiesOverlay]);

    // Escape in the panel closes the overlay, and from the docked panel goes back to the content.
    const handlePropertiesEscape = useCallback(() => {
        if (propertiesDocked()) {
            setFocusContent(true);
        } else {
            closePropertiesOverlay();
        }
    }, [propertiesDocked, closePropertiesOverlay]);

    // Moving the focus on to the file manager behind the overlay closes it, as a click there does,
    // and leaves the focus where it went. A menu or a dialog, outside the file manager, keeps it open.
    const handlePropertiesFocusOut = useCallback((to: Node) => {
        if (rootRef.current?.contains(to)) {
            setPropertiesOverlay(false);
            setPinned(null);
            propertiesOpener.current = null;
        }
    }, []);

    // The pane docking, or no longer, as the file manager's width changes. Docking closes the
    // overlay, so it doesn't open again as the width shrinks back. A panel that goes with the change,
    // the overlay or the docked one, drops what `ActionContext.properties` asked it to show, and hands
    // the focus it had to the content.
    const handlePropertiesDocking = (docked: boolean) => {
        const shownBefore = docked ? propertiesOverlay : propertiesOpen;
        const shownNow = docked ? propertiesOpen : propertiesOverlay;

        if (docked) {
            setPropertiesOverlay(false);
            propertiesOpener.current = null;
        }

        if (shownBefore && !shownNow) {
            setPinned(null);

            if (paneRef.current?.contains(document.activeElement)) {
                setFocusContent(true);
            }
        }
    };

    // Opens the window listing the keys. It gives the focus back itself as it closes, to `opener`
    // or to what has it now, since the main menu it may be opened from hands the focus back to its
    // button only as it closes, after the window has taken note of what had it.
    const showShortcuts = useCallback((opener?: HTMLElement | null) => {
        shortcutsOpener.current =
            opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        setShortcutsOpen(true);
    }, []);

    const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);

    // Once it has faded out, the focus goes back where it was, or to the content when that's gone.
    const handleShortcutsClosed = useCallback(() => {
        const opener = shortcutsOpener.current;

        shortcutsOpener.current = null;

        if (opener && opener !== document.body && opener.isConnected) {
            opener.focus();
        }

        if (!opener || document.activeElement !== opener) {
            setFocusContent(true);
        }
    }, []);

    // A main menu item's shortcut works anywhere in the file manager, before the file manager's own
    // keys, as the actions' come first in the content and the tree. Returns whether one ran.
    const runMenuShortcut = (event: KeyboardEvent) => {
        if (typesInField(event)) {
            return false;
        }

        // Each key the press stands for in turn, so the key typed wins over the one at its place.
        for (const key of pressedKeys(event)) {
            for (const group of mainMenu) {
                const item = group.items.find(
                    (candidate) =>
                        candidate.shortcut && !candidate.disabled && matchesShortcut(event, candidate.shortcut, key),
                );

                if (item) {
                    item.onSelect();

                    return true;
                }
            }
        }

        return false;
    };

    // Keys that work anywhere in the file manager: the main menu's shortcuts, F6, F9, Ctrl+?, Ctrl+H,
    // Ctrl+F, Ctrl+Shift+F, Ctrl+L, Ctrl+Z, Shift+Ctrl+Z and Ctrl+Y outside fields, Alt+Enter, and Alt+Left
    // and Alt+Right for back and forward, the other way round right to left, as the arrows on the
    // buttons are.
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        // Menus and dialogs portal out of the file manager, but their key presses still bubble here
        // through React's tree; they aren't the file manager's.
        if (
            event.defaultPrevented ||
            !(event.target instanceof Node) ||
            !event.currentTarget.contains(event.target)
        ) {
            return;
        }

        if (runMenuShortcut(event)) {
            event.preventDefault();

            return;
        }

        const others = event.ctrlKey || event.metaKey || event.shiftKey;
        const plain = !others && !event.altKey;
        const zooms = zoomStep(event);
        const undoWay = undoDirection(event);
        let handled = true;

        if (event.key === "F6" && !event.ctrlKey && !event.metaKey && !event.altKey) {
            switchPane();
        } else if (event.key === "F9" && plain) {
            toggleSidebar();
        } else if (showsShortcuts(event)) {
            showShortcuts();
        } else if (
            // Ctrl+H shows and hides hidden files, as in GNOME Files. Not ⌘H, which hides the
            // browser on macOS before the page sees it.
            pressesKey(event, "h") &&
            event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            !event.altKey
        ) {
            toggleHidden();
        } else if (
            // Ctrl+F or ⌘F searches the open folder, and with Shift every section, as in GNOME Files,
            // in place of the browser's find while the focus is in here.
            pressesKey(event, "f") &&
            (event.ctrlKey || event.metaKey) &&
            !event.altKey &&
            section &&
            (!event.shiftKey || canSearchEverywhere)
        ) {
            openSearch(event.shiftKey ? "everywhere" : "folder");
        } else if (
            // Ctrl+L or ⌘L types a path to go to, as in GNOME Files, in place of the browser's
            // address bar while the focus is in here. With no section, it stays the browser's.
            pressesKey(event, "l") &&
            (event.ctrlKey || event.metaKey) &&
            !event.shiftKey &&
            !event.altKey &&
            section
        ) {
            openPath();
        } else if (undoWay) {
            // With nothing to undo or redo, the key is the browser's.
            handled = runUndo(undoWay);
        } else if (zooms !== null && panelRef.current?.contains(event.target)) {
            // Only in the content, so the browser's own zoom still works from anywhere else.
            zoomContent(zooms);
        } else if (event.altKey && !others && event.key === "Enter") {
            toggleProperties();
        } else if (event.altKey && !others && event.key === (direction === "rtl" ? "ArrowRight" : "ArrowLeft")) {
            goBack();
        } else if (event.altKey && !others && event.key === (direction === "rtl" ? "ArrowLeft" : "ArrowRight")) {
            goForward();
        } else {
            handled = false;
        }

        if (handled) {
            event.preventDefault();
        }
    };

    const toggleView = useCallback(() => setView(view === "list" ? "grid" : "list"), [view, setView]);

    // Zooms the view shown a step in or out, or back to its start, and says how large it is now,
    // which only shows otherwise.
    const zoomContent = useCallback(
        (step: ZoomStep) => {
            if (!canZoom(zoom, view, step)) {
                return;
            }

            const next = zoomedBy(zoom, view, step);

            setZoom(next);
            announce(localeValue.text.zoomChanged(localeValue.formatPercent(zoomScale(next, view))));
        },
        [zoom, view, setZoom, announce, localeValue],
    );

    // Ctrl+wheel and a touchpad's pinch over the content zoom it rather than the page.
    useWheelZoom(panelRef, zoomContent);

    // Learns the letters printed on the keyboard, so shortcuts follow them on a non-Latin layout.
    useEffect(watchKeyboardLayout, []);

    const toggleHidden = useCallback(() => setShowHidden(!showHidden), [showHidden, setShowHidden]);
    const closeMenu = useCallback(() => setMenu((prev) => prev && { ...prev, open: false }), []);
    const setSelecting = useCallback((on: boolean) => setSelectingKey(on ? openKey : null), [openKey]);
    const toggleSelecting = useCallback(() => setSelecting(!selecting), [setSelecting, selecting]);
    const handleRevealed = useCallback(
        (focused: boolean) => {
            if (reveal?.announce && !focused) {
                announce(reveal.announce);
            }

            setReveal(null);
        },
        [reveal, announce],
    );
    const clearTreeReveal = useCallback(() => setTreeReveal(null), []);

    const askName = useCallback((request: NameRequest) => {
        setNaming((prev) => ({ open: true, id: (prev?.id ?? 0) + 1, request }));
    }, []);

    const closeNaming = useCallback(() => setNaming((prev) => prev && { ...prev, open: false }), []);

    const askDestination = useCallback((request: TransferRequest) => {
        setTransfer((prev) => ({ open: true, id: (prev?.id ?? 0) + 1, request }));
    }, []);

    const closeTransfer = useCallback(() => setTransfer((prev) => prev && { ...prev, open: false }), []);

    const askDelete = useCallback((request: DeleteRequest) => {
        setDeleting((prev) => ({ open: true, id: (prev?.id ?? 0) + 1, request }));
    }, []);

    const closeDelete = useCallback(() => setDeleting((prev) => prev && { ...prev, open: false }), []);

    const askRestore = useCallback((request: RestoreRequest) => {
        setRestoring((prev) => ({ open: true, id: (prev?.id ?? 0) + 1, request }));
    }, []);

    const closeRestore = useCallback(() => setRestoring((prev) => prev && { ...prev, open: false }), []);

    const askPaste = useCallback((request: PasteRequest) => {
        setPasting((prev) => ({ open: true, id: (prev?.id ?? 0) + 1, request }));
    }, []);

    const closePaste = useCallback(() => setPasting((prev) => prev && { ...prev, open: false }), []);

    const askUpload = useCallback((request: UploadRequest) => {
        setUploadCheck((prev) => ({ open: true, id: (prev?.id ?? 0) + 1, request }));
    }, []);

    const closeUploadCheck = useCallback(() => setUploadCheck((prev) => prev && { ...prev, open: false }), []);

    const askPreview = useCallback(
        (request: PreviewRequest) => {
            const fromContent = focusInContent();

            setPreviewing((prev) => ({ open: true, id: (prev?.id ?? 0) + 1, request, fromContent }));
        },
        [focusInContent],
    );

    const closePreview = useCallback(() => setPreviewing((prev) => prev && { ...prev, open: false }), []);

    // Downloads are prepared in the background while the user browses, and the panel shows those
    // that take a moment or need the user. A folder's hidden files go along only while they show.
    const downloads = useDownloadQueue();

    useLayoutEffect(() => downloads.queue.setMaxActive(downloadLimit), [downloads.queue, downloadLimit]);

    const shownDownloads = useMemo(() => downloads.items.filter((item) => item.shown), [downloads.items]);

    const askDownload = useCallback(
        (served: FileAdapter, entries: FileEntry[], folder: FolderRef) =>
            downloads.queue.add(served, entries, folder.name, showHidden),
        [downloads.queue, showHidden],
    );

    // Entries of several folders as one file, from the adapter's `downloadAcross`, named after
    // `folder`, which holds them all, when the file comes without a name.
    const askDownloadAcross = useCallback(
        (served: FileAdapter, groups: EntryGroup[], folder: FolderRef) =>
            downloads.queue.add(
                served,
                groupedEntries(groups),
                folder.name,
                showHidden,
                groups.map((group) => ({ folder: folderOf(group.section, group.trail), entries: group.entries })),
            ),
        [downloads.queue, showHidden],
    );

    // The preview's Download button saves the file shown.
    const handlePreviewDownload = useCallback(
        ({ entry, section: shown, adapter: served, trail }: PreviewFile) =>
            askDownload(served, [entry], folderOf(shown, trail)),
        [askDownload],
    );

    // Once the preview has faded out, the content takes the focus back if the preview was opened
    // from there, on the file shown last when the selection followed it, unless it closed for
    // something else that took the focus, as the properties do.
    const handlePreviewClosed = useCallback(() => {
        if (previewing?.fromContent && !previewing.handedOff) {
            setFocusContent(true);
        }
    }, [previewing?.fromContent, previewing?.handedOff]);

    // The files the preview steps through as a change made through the file manager leaves them:
    // `change` gives an entry of the adapter's as it now is, or null once it's gone from there. The
    // preview shows the file now in the place of one that went, and closes once none is left.
    const changePreview = useCallback(
        (served: FileAdapter, change: (entry: FileEntry) => FileEntry | null) =>
            setPreviewing((prev) => {
                if (!prev?.request.files.some((file) => file.adapter === served)) {
                    return prev;
                }

                const files = prev.request.files.flatMap((file) => {
                    const now = file.adapter === served ? change(file.entry) : file.entry;

                    return !now ? [] : now === file.entry ? [file] : [{ ...file, entry: now }];
                });

                return files.length === prev.request.files.length &&
                    files.every((file, index) => file === prev.request.files[index])
                    ? prev
                    : { ...prev, request: { ...prev.request, files } };
            }),
        [],
    );

    // A single file steps through its folder, and the content's selection follows the file shown,
    // as it does in GNOME's and macOS's previewers.
    const handlePreviewStep = useCallback(
        ({ follow }: PreviewRequest, { entry, section: shown, trail }: PreviewFile) => {
            const key = folderKey(shown.id, folderOf(shown, trail).id);

            if (follow && key === openKey) {
                setReveal({ key, id: entry.id });
            }
        },
        [openKey],
    );

    // Pastes `pasted` into the folder at `trail`, when it can go there and no other paste is being
    // checked, or tries a failed copy or move again (`retrying`).
    const offerPaste = useCallback(
        (pasted: Clipboard, target: Section, trail: FolderRef[], retrying?: number) =>
            !pasting?.open && canPaste(pasted, target.adapter ?? adapter, target, trail, store, moving)
                ? () => askPaste({ clipboard: pasted, section: target, trail, retrying })
                : undefined,
        [adapter, store, moving, pasting?.open, askPaste],
    );

    // Moves entries to the trash, which much made further down does (`trashEntries`), handed over
    // once that's made.
    const trashAsked = useRef<((groups: UndoGroup[]) => void) | null>(null);

    // Dropped on the trash's root, entries go to the trash, Ctrl held or not, when they could be
    // deleted, through its adapter, which serves them all. Nothing else goes into the trash
    // (`canPaste`), nor another adapter's entries into this one's.
    const offerTrash = useCallback(
        (dragged: DraggedEntries, target: Section, trail: FolderRef[]) => {
            const served = target.adapter ?? adapter;
            const busyThrough = movingThrough(moving, served);

            return inTrashRoot(target, trail) &&
                served.trash &&
                dragged.parts.every(
                    (part) =>
                        part.adapter === served &&
                        !part.section.trash &&
                        entriesAllow(store, part.section, part.trail, part.entries, "delete", busyThrough),
                )
                ? () => trashAsked.current?.(dragged.parts)
                : undefined;
        },
        [adapter, store, moving],
    );

    // Whether dragged entries could be moved into a folder `into` serves, as far as their adapters
    // and permissions go: by their own adapter's `move`, or into another's folder, copied there and
    // deleted from theirs (`carries`).
    const movableInto = useCallback(
        (dragged: DraggedEntries, into: FileAdapter) =>
            dragged.parts.every((part) => {
                const busy = movingThrough(moving, part.adapter);
                const leaves = (what: "move" | "delete") =>
                    entriesAllow(store, part.section, part.trail, part.entries, what, busy);

                return (
                    carries("move", part.adapter, into, part.entries) &&
                    leaves("move") &&
                    (part.adapter === into || leaves("delete"))
                );
            }),
        [store, moving],
    );

    // A drop is pasted like the clipboard, with the dragged entries as a clipboard of their own, so
    // the real one is left as it was. It copies with Ctrl or Option held, where the entries can't be
    // moved there, and into a folder another adapter serves, as a drop onto another disk does on a
    // desktop, unless Shift or ⌘ is held; otherwise it moves. Dropped on the trash, they go to it.
    const dropInto = useCallback<DropInto>(
        (dragged, keys, target, trail) => {
            if (target.trash) {
                const run = offerTrash(dragged, target, trail);

                return run && { run, copy: false };
            }

            const into = target.adapter ?? adapter;
            const across = dragged.parts.some((part) => part.adapter !== into);
            const copy = keys.copy || (across && !keys.move) || !movableInto(dragged, into);
            const run = offerPaste({ ...dragged, kind: copy ? "copy" : "cut" }, target, trail);

            return run && { run, copy };
        },
        [adapter, offerPaste, offerTrash, movableInto],
    );

    // What can be done with dragged entries: moved, by their adapter or into another's folder, or
    // else only copied, by it or into another's, or nothing at all. Entries a move under way is
    // moving aren't dragged, as they can't be pasted anywhere either, nor are those in the trash,
    // which are only restored.
    const carried = useCallback(
        (dragged: DraggedEntries) => {
            const { parts } = dragged;

            if (
                parts.some(
                    (part) =>
                        !!part.section.trash ||
                        entriesMoving(part.section, part.trail, part.entries, movingThrough(moving, part.adapter)),
                )
            ) {
                return null;
            }

            const movable = parts.every((part) => {
                const busy = movingThrough(moving, part.adapter);
                const leaves = (what: "move" | "delete") =>
                    entriesAllow(store, part.section, part.trail, part.entries, what, busy);

                return (
                    leaves("move") &&
                    (!!part.adapter.move || (!!part.adapter.delete && !!part.adapter.content && leaves("delete")))
                );
            });

            if (movable) {
                return "move";
            }

            return parts.every((part) => !!(part.adapter.copy || part.adapter.content)) ? "copy" : null;
        },
        [store, moving],
    );

    // Uploads into the folder at `trail`, when its section and adapter take uploads, the folder can
    // change, and no other upload is being checked. Files dropped from outside go the same way.
    const offerUpload = useCallback(
        (target: Section, trail: FolderRef[]) => {
            const served = target.adapter ?? adapter;

            return served.upload &&
                takesUploads(target) &&
                folderWritable(store, target, trail, movingThrough(moving, served)) &&
                !uploadCheck?.open
                ? (dropped: DroppedFiles) => askUpload({ section: target, adapter: served, trail, dropped })
                : undefined;
        },
        [adapter, store, moving, uploadCheck?.open, askUpload],
    );

    // A drag of files none of which the section can take (`acceptUploads`) shows the no-drop cursor.
    const uploadInto = useCallback(
        (target: DropTarget, items: DataTransferItemList) =>
            mayAccept(uploadPatterns(target.section), items) ? offerUpload(target.section, target.trail) : undefined,
        [offerUpload],
    );

    // Files pasted from the system clipboard too, into the folder Ctrl+V pastes into, but never while
    // entries cut or copied in the file manager can be pasted there, which come first. The page can't
    // tell which was copied last. Ctrl+V only gets this far when no action took it (`runShortcut`);
    // Shift+Insert always does. While the entries are looked for again, nothing is pasted, since
    // they may yet turn out pastable there.
    const pasteFiles = useCallback<PasteFiles>(
        (event, target, trail) => {
            const served = target.adapter ?? adapter;
            const ownFirst =
                clipboard &&
                (clipboard.parts.some((part) => part.lookup) ||
                    canPaste(clipboard, served, target, trail, store, moving));
            const upload = ownFirst ? undefined : offerUpload(target, trail);

            if (!upload || !event.clipboardData.types.includes("Files")) {
                return;
            }

            const pasted = filesIn(event.clipboardData);

            if (pasted.files.length > 0 || pasted.folders.length > 0) {
                event.preventDefault();
                upload(pasted);
            }
        },
        [adapter, store, moving, clipboard, offerUpload],
    );

    // Only opens from a click or key press, which an action's `onSelect` runs in. It offers the
    // types the section takes (`acceptUploads`), though most pickers let the user pick any, so the
    // upload check leaves out the rest. Picking a folder, it hands over the files in it, each with
    // its path inside it, and the browser may ask first whether to upload that many.
    const pickFiles = useCallback((into: (dropped: DroppedFiles) => void, accept: string, folder = false) => {
        pickedInto.current = into;

        if (pickerRef.current) {
            pickerRef.current.accept = folder ? "" : accept;
            pickerRef.current.webkitdirectory = folder;
            pickerRef.current.click();
        }
    }, []);

    const handlePicked = (event: ChangeEvent<HTMLInputElement>) => {
        const picker = event.currentTarget;
        const files = Array.from(picker.files ?? []);
        const folder = picker.webkitdirectory ? pickedFolder(files) : undefined;
        const into = pickedInto.current;

        // Emptied, so picking the same files again still counts as a change.
        picker.value = "";
        pickedInto.current = null;

        if (into && folder) {
            into({ files: [], folders: [folder] });
        } else if (into && !picker.webkitdirectory && files.length > 0) {
            into({ files, folders: [] });
        }
    };

    const drag = useEntryDrag(adapter, dropInto, uploadInto, carried, rootRef);
    const dragging = !!drag.context.dragged;

    // Shows the sidebar for the drag under way, unless it shows already, leaving the overlay open
    // or the docked sidebar hidden as before once the drag ends.
    const showSidebarForDrag = useCallback(() => {
        const sidebar = sidebarRef.current;

        if (!sidebar) {
            return;
        }

        if (overlays(sidebar)) {
            if (!sidebarOpen) {
                setSidebarForDrag("overlay");
                setSidebarOpen(true);
            }
        } else if (sidebarHidden) {
            setSidebarForDrag("peek");
        }
    }, [sidebarOpen, sidebarHidden]);

    const endSidebarForDrag = useCallback(() => {
        if (sidebarForDrag === "overlay") {
            setSidebarOpen(false);
            sidebarOpener.current = null;
        }

        setSidebarForDrag(null);
    }, [sidebarForDrag]);

    // However a drag of entries ends, dropped anywhere or called off, mouse or touch. Files dragged
    // in from outside end with the drop, or by leaving the file manager (the root's handlers).
    const wasDragging = useRef(false);

    useEffect(() => {
        if (wasDragging.current && !dragging) {
            endSidebarForDrag();
        }

        wasDragging.current = dragging;
    });

    // Sections served by one adapter can show the same folders, under the same ids, since ids are
    // unique within an adapter, so a change made in one of them shows in all of them.
    const sectionsOf = useCallback(
        (served: FileAdapter) =>
            [...sectionsById.values()].filter((candidate) => (candidate.adapter ?? adapter) === served),
        [adapter, sectionsById],
    );

    // The roots of the trash sections an adapter serves, which entries go to and come back from.
    const trashRootIds = useCallback(
        (served: FileAdapter) => trashesOf(sectionsById.values(), adapter, served).map((trash) => trash.rootId),
        [sectionsById, adapter],
    );

    // Folders a dialog may have changed are listed again wherever they're cached, in every section
    // the adapter serves, and so is every listing holding one of them, for its item count.
    const relist = useCallback(
        (served: FileAdapter, folderIds: string[]) => {
            sectionsOf(served).forEach((shown) => store.relist(shown.id, served, folderIds));
            setSearchVersion((count) => count + 1);
        },
        [sectionsOf, store],
    );

    // `FileManagerApi.refresh`: as `relist`, for one adapter's sections or all of them, and for every
    // folder they've listed when no ids are given.
    const refresh = useCallback(
        (folderIds?: readonly string[], options?: RefreshOptions) => {
            sectionsById.forEach((shown) => {
                const served = shown.adapter ?? adapter;

                if (!options?.adapter || options.adapter === served) {
                    store.relist(shown.id, served, folderIds);
                }
            });
            setSearchVersion((count) => count + 1);
        },
        [adapter, sectionsById, store],
    );

    // Uploads run in the background, a few at a time, while the user browses; the folders they end
    // in are listed again like any other change. The file manager provides its locale rather than
    // reading it, so the queue is handed its text for a folder kept beside a file.
    const uploads = useUploadQueue(relist, localeValue.text.keptBothName);

    useLayoutEffect(() => uploads.queue.setMaxActive(uploadLimit), [uploads.queue, uploadLimit]);

    // What uploads just put in folders, for the folder view to highlight once it shows them.
    const [arrivals, setArrivals] = useState(NO_ARRIVALS);
    const arrivalCount = useRef(0);
    const arrived = useRef(new Set<number>());

    const arrive = useCallback((arrival: Omit<Arrival, "key">) => {
        const key = (arrivalCount.current += 1);

        setArrivals((prev) => [...prev, { ...arrival, key }]);
        window.setTimeout(() => setArrivals((prev) => prev.filter((waiting) => waiting.key !== key)), ARRIVAL_WAIT);
    }, []);

    const handleArrived = useCallback((keys: number[]) => {
        setArrivals((prev) => prev.filter((waiting) => !keys.includes(waiting.key)));
    }, []);

    // Each upload arrives as it's done, in whichever folder view shows where it went.
    useEffect(() => {
        uploads.items.forEach((item) => {
            if (item.status === "done" && !arrived.current.has(item.id)) {
                arrived.current.add(item.id);
                arrive({
                    adapter: item.adapter,
                    folderId: item.folder.id,
                    entryId: item.entryId,
                    name: uploadPlaces.current.get(item.id)?.name,
                    show: false,
                });
            }
        });
    }, [uploads.items, arrive]);

    // Files in the folders of types the section doesn't take are left out as the folders are read.
    // A file never takes a folder's place, nor a file's that can't be replaced (`replaceable`), so
    // with Replace, one whose name such an entry has is kept beside it. A file kept beside one of
    // its name may be given another, which only the adapter knows. Uploads can't be undone, so they
    // end the history as they start.
    const startUpload = useCallback(
        (
            { section: target, adapter: served, trail }: UploadRequest,
            files: File[],
            folders: FolderUpload[],
            conflict: ConflictPolicy,
        ) => {
            const into = folderOf(target, trail);
            const location = { sectionId: target.id, trail };
            const patterns = uploadPatterns(target);
            const accepts = patterns ? (file: File) => acceptsFile(patterns, file) : undefined;
            const listed = store.get(folderKey(target.id, into.id))?.entries ?? [];
            const unreplaced = new Set(
                listed
                    .filter((entry) => entry.kind === "folder" || !replaceable(store, target, entry))
                    .map((entry) => entry.name),
            );
            const kept = conflict === "replace" ? files.filter((file) => unreplaced.has(file.name)) : [];
            const taken = new Set(conflict === "keepBoth" ? listed.map((entry) => entry.name) : unreplaced);
            const queueFiles = (queued: File[], policy: ConflictPolicy) =>
                uploads.queue.add(served, into, queued, policy).forEach((id, index) => {
                    const { name } = queued[index];

                    uploadPlaces.current.set(id, { location, name: taken.has(name) ? undefined : name });
                });

            closeUploadCheck();
            endHistory();
            uploads.queue.addFolders(served, into, folders, conflict, accepts).forEach((id, index) => {
                uploadPlaces.current.set(id, { location, name: folders[index].name });
            });
            queueFiles(files.filter((file) => !kept.includes(file)), conflict);
            queueFiles(kept, "keepBoth");
        },
        [closeUploadCheck, endHistory, uploads.queue, store],
    );

    // Forgets the ended uploads, and where they went.
    const clearUploads = useCallback(() => {
        uploads.queue.clear();

        const kept = new Set(uploads.queue.getItems().map((item) => item.id));

        uploadPlaces.current.forEach((_, id) => !kept.has(id) && uploadPlaces.current.delete(id));
        arrived.current.forEach((id) => !kept.has(id) && arrived.current.delete(id));
    }, [uploads.queue]);

    // "Show in folder" on a finished upload: while its section is there, served as it was, and the
    // folder it went into hasn't gone (see `revise`).
    const canShowUpload = useCallback(
        (item: UploadItem) => {
            const upload = uploadPlaces.current.get(item.id);
            const shown = upload && sectionsById.get(upload.location.sectionId);

            return !!shown && (shown.adapter ?? adapter) === item.adapter;
        },
        [sectionsById, adapter],
    );

    // Opens the folder, ending a search, even in the open folder, as "Open item location" does, and
    // has the folder view scroll to what the upload put there and highlight it, never selecting it.
    // The focus stays on the button, so the panel's other uploads can be shown in turn.
    const showUpload = useCallback(
        (item: UploadItem) => {
            const upload = uploadPlaces.current.get(item.id);
            const shown = upload && sectionsById.get(upload.location.sectionId);

            if (!upload || !shown || !canShowUpload(item)) {
                return;
            }

            const into = folderOf(shown, upload.location.trail);
            const name = item.kind === "file" ? item.file.name : item.name;

            arrive({ adapter: item.adapter, folderId: into.id, entryId: item.entryId, name: upload.name, show: true });
            stopSearching();

            if (!samePlace(upload.location, place)) {
                goTo(upload.location);
            }

            announce(localeValue.text.uploadShown(isolate(name), isolate(into.name)));
        },
        [sectionsById, canShowUpload, arrive, stopSearching, place, goTo, announce, localeValue],
    );

    // With path ids, a change can leave an id naming another folder: a deleted or moved folder's id
    // is free for a new one, as is a renamed folder's old id, and a new or renamed folder's id may
    // have named one before. So can the ids below
    // them, so the listings cached for them, and for every folder any section has cached below them,
    // are dropped in every section the adapter serves, and what still shows one lists it afresh. A
    // section rooted in one of them can't follow it, since its root is the consumer's: its places go
    // back to the root, to show what the adapter now has there. Returns the dropped ids, for the
    // places inside them.
    //
    // Of those, the folders that are `gone` from where they were (all but a new folder, and a renamed
    // folder's new id) can also take with them a section rooted further below, which nothing cached
    // ties to them, since ids are never parsed. So a section that doesn't list one of them, and so may
    // be rooted below it, lists what it shows again at once, quietly, and every listing of every
    // section the adapter serves is listed again as it opens, whatever `relistAfter` says.
    const dropFolders = useCallback(
        (served: FileAdapter, folderIds: string[], goneIds: readonly string[] = folderIds) => {
            const showing = sectionsOf(served);
            const gone = new Set(goneIds);
            const holding = new Set(
                gone.size > 0 ? showing.filter((shown) => store.lists(shown.id, gone)).map((shown) => shown.id) : [],
            );
            const dropped = new Set([
                ...folderIds,
                ...showing.flatMap((shown) => folderIds.flatMap((id) => store.cachedTree(shown.id, id))),
            ]);
            const lostRoots = new Set(showing.filter((shown) => dropped.has(shown.rootId)).map((shown) => shown.id));

            showing.forEach((shown) => {
                store.forget(shown.id, dropped);

                if (gone.size === 0) {
                    return;
                }

                if (lostRoots.has(shown.id) || holding.has(shown.id)) {
                    store.stale(shown.id);
                } else {
                    store.recheck(shown.id, served);
                }
            });

            if (lostRoots.size > 0) {
                revise((visited) =>
                    lostRoots.has(visited.sectionId) && visited.trail.length > 0 ? { ...visited, trail: [] } : visited,
                );
            }

            return dropped;
        },
        [revise, sectionsOf, store],
    );

    // Whether a section may be rooted below one of the folders, as `dropFolders` has it: it's one
    // `served` serves, none of whose listings lists one of them. Read before their listings go.
    const mayBeRootedBelow = useCallback(
        (served: FileAdapter, folderIds: readonly string[]) => {
            if (folderIds.length === 0) {
                return () => false;
            }

            const ids = new Set(folderIds);
            const above = new Set(
                sectionsOf(served)
                    .filter((shown) => store.lists(shown.id, ids))
                    .map((shown) => shown.id),
            );

            return (sectionId: string) => !above.has(sectionId);
        },
        [sectionsOf, store],
    );

    // A copy's or move's `onChanged`: as `relist`, and the folders a Replace or Merge merged others
    // into are listed again all the way down, wherever they're cached, since what's in them may have
    // changed at any depth. Their ids still name them. A section that doesn't list one may be rooted
    // below it, which nothing cached ties to it, so what it shows is listed again at once.
    const relistTransferred = useCallback(
        (served: FileAdapter, folderIds: string[], mergedIds: string[] = []) => {
            const merged = new Set(mergedIds);

            relist(served, folderIds);

            if (merged.size === 0) {
                return;
            }

            sectionsOf(served).forEach((shown) => {
                if (store.lists(shown.id, merged)) {
                    store.relist(shown.id, served, mergedIds.flatMap((id) => store.cachedTree(shown.id, id)));
                } else {
                    store.recheck(shown.id, served);
                }
            });
        },
        [relist, sectionsOf, store],
    );

    // Moved folders go from the cache (`dropFolders`). The open place, in whichever section shows
    // them, can't follow a moved folder it's inside, so it goes where the folder went. Moved entries
    // leave the clipboard too, since their ids may have changed, and the rest are looked for again
    // when they may be below a moved folder.
    const handleMoved = useCallback(
        (fromAdapter: FileAdapter, entries: FileEntry[], destination: FileManagerLocation) => {
            const movedIds = new Set(entries.map((entry) => entry.id));
            const mayBeBelow = mayBeRootedBelow(fromAdapter, folderIdsOf(entries));
            const dropped = dropFolders(fromAdapter, folderIdsOf(entries));

            if (
                section &&
                (section.adapter ?? adapter) === fromAdapter &&
                [section.rootId, ...place.trail.map((step) => step.id)].some((id) => dropped.has(id))
            ) {
                goTo(destination);
            }

            setClipboard((prev) => prev && withoutEntries(prev, fromAdapter, movedIds, dropped, mayBeBelow));
            changePreview(fromAdapter, (entry) => (movedIds.has(entry.id) ? null : entry));
        },
        [adapter, section, place, dropFolders, mayBeRootedBelow, goTo, changePreview],
    );

    // The sidebar tree scrolls to a folder just created, in whichever section shows it, once the
    // folder it was made in has been listed again. Hidden ones aren't, while hidden files are off,
    // since their row never comes.
    const revealInTree = useCallback(
        (served: FileAdapter, parentId: string, entry: FileEntry) => {
            if (entry.kind !== "folder" || (isHidden(entry) && !showHidden)) {
                return;
            }

            const showing = sectionsOf(served);

            setTreeReveal({
                keys: showing.map((shown) => folderKey(shown.id, entry.id)),
                parentKeys: showing.map((shown) => folderKey(shown.id, parentId)),
            });
        },
        [sectionsOf, showHidden],
    );

    // A rename, or a folder made, goes in the history, to be renamed back, or the folder deleted
    // while it's still empty, which takes the adapter's `delete`.
    const recordNamed = useCallback(
        (request: NameRequest, entry: FileEntry, message: string) => {
            const { section: target, adapter: served, trail } = request;
            const group = { section: target, trail, entries: [entry] };

            if (request.kind === "rename") {
                recordChange("rename", served, { kind: "rename", group, name: request.entry.name }, message);
            } else if (served.delete) {
                recordChange("newFolder", served, { kind: "remove", group }, message);
            } else {
                endHistory();
            }
        },
        [recordChange, endHistory],
    );

    // A folder made in the transfer picker may take an id that named another folder before, as one
    // made from the menu may (`handleNamed`). The picker opens it itself, which says so, and it goes
    // in the history as one made from the menu does.
    const handleFolderCreated = useCallback(
        (request: NameRequest, entry: FileEntry) => {
            const { section: target, adapter: served, trail } = request;

            dropFolders(served, [entry.id], []);
            revealInTree(served, folderOf(target, trail).id, entry);
            recordNamed(request, entry, localeValue.text.createDone(isolate(entry.name)));
        },
        [dropFolders, revealInTree, recordNamed, localeValue],
    );

    // What a copy or move did, leaving out the entries skipped for names that clashed, or null when
    // it did nothing.
    const transferMessage = useCallback(
        (kind: TransferRequest["kind"], entries: FileEntry[], skipped: readonly FileEntry[], folder: FolderRef) => {
            const leftOut = new Set(skipped);
            const done = entries.filter((entry) => !leftOut.has(entry));

            return done.length > 0
                ? (kind === "copy" ? localeValue.text.copyDone : localeValue.text.moveDone)(
                      done.length,
                      isolate(done[0].name),
                      isolate(folder.name),
                  )
                : null;
        },
        [localeValue],
    );

    // A move undone puts back the name each entry had where it came from, when it was kept both on
    // the way in under another and the name is still free there; one it can't keeps the one it has.
    // Each goes through the adapter serving where it went back to.
    const renameBack = useCallback(
        async (settled: SettledTransfer[], signal: AbortSignal) => {
            for (const { end, place, pairs } of settled) {
                const served = end.item.targetAdapter;
                const names = place.names;
                const wanted = new Map(end.item.entries.map((entry, index) => [entry.id, names?.[index]] as const));
                const off = pairs.filter((pair) => {
                    const name = wanted.get(pair.from.id);

                    return name !== undefined && name !== pair.to.name;
                });

                if (!served.rename || off.length === 0) {
                    continue;
                }

                const { section: into, trail } = place.request;
                const folderId = folderOf(into, trail).id;
                const listed = await listingOf(store, into.id, served, folderId, true, signal).catch(() => null);

                if (!listed) {
                    continue;
                }

                const taken = new Set(listed.map((entry) => entry.name));

                for (const pair of off) {
                    const name = wanted.get(pair.from.id) ?? pair.to.name;

                    if (signal.aborted || taken.has(name)) {
                        continue;
                    }

                    try {
                        const renamed = await served.rename(pair.to, name, { signal });
                        const request: NameRequest = {
                            kind: "rename",
                            section: into,
                            adapter: served,
                            trail,
                            entry: pair.to,
                        };

                        undoTools.current?.applyNamed(request, renamed, null, false);
                        undoTools.current?.relist(served, [folderId]);
                        taken.delete(pair.to.name);
                        taken.add(renamed.name);
                        pair.to = renamed;
                    } catch {
                        // It keeps the name it was given.
                    }
                }
            }
        },
        [store],
    );

    // Once the last copy or move of a batch has ended, what's done is said, and goes in the history,
    // to be undone by what the adapter says it made: the copies deleted, or the entries moved back
    // where each came from, between adapters as they went. A change that can't be undone that way, as
    // Replace or Merge was chosen or the adapter said nothing, ends the history, and so does one that
    // failed, or was called off once under way, as the entry it stopped at may have gone in part; what
    // went before it then goes in as a change of its own, when the adapter reported each entry as it
    // went (`went`). A batch carrying out an undo or redo ends it, with what redoes or undoes it in
    // turn, or says it failed, the panel showing why with Try again, and what went before that going
    // on the other list.
    const settleBatch = useCallback(
        (batch: TransferBatch, skipped: readonly FileEntry[], target: FolderRef) => {
            const { ended, run } = batch;
            const { kind } = ended[0].item;
            const { text } = localeValue;
            // Those that reached the adapter, which may have changed something, and whether any of
            // them stopped partway.
            const reached = ended.filter((end) => end.outcome !== "cancelled" || end.item.status !== "queued");
            const partway = reached.some((end) => end.outcome !== "done");
            // Stopped partway, it says how many of those asked for went.
            const leftOut = new Set(skipped);
            const done = batch.done.filter((entry) => !leftOut.has(entry));
            const asked = ended.flatMap((end) => end.item.entries).filter((entry) => !leftOut.has(entry));
            let message = transferMessage(kind, batch.done, skipped, target);

            if (message && partway && done.length < asked.length) {
                message = (kind === "copy" ? text.copyPartlyDone : text.movePartlyDone)(
                    done.length,
                    asked.length,
                    isolate(target.name),
                );
            }

            const settled = reached.flatMap((end): SettledTransfer[] => {
                const { item, outcome, made, place } = end;
                const pairs =
                    outcome === "done"
                        ? madePairs(item.entries, made, item.conflict)
                        : wentPairs(item.went, item.conflict);

                return pairs && place ? [{ end, place, pairs }] : [];
            });
            // Copies are undone by deleting them, through the adapter they went into, and moves by
            // moving them back, across again when they went into another adapter's folder, which
            // takes that one handing them over and theirs taking them.
            const undoable =
                settled.length === reached.length &&
                settled.every(({ end, pairs }) => {
                    const { adapter: from, targetAdapter: to } = end.item;

                    return kind === "copy"
                        ? !!to.delete
                        : from === to || carries("move", to, from, pairs.map((pair) => pair.to));
                });
            const went = undoable ? settled.filter((transfer) => transfer.pairs.length > 0) : [];
            const failed = ended.find((end) => end.outcome === "failed");

            if (message && run?.direction !== "undo") {
                announce(message);
            }

            if (went.length === 0) {
                // Called off before any of it reached the adapter, an undo or redo is put back.
                if (run && failed) {
                    failRun(run, failed.item.error && isolate(failed.item.error), false);
                } else if (run && reached.length === 0) {
                    callOffRun(run);
                } else if (run) {
                    leaveRun(run);
                } else if (reached.length > 0 && (!undoable || partway)) {
                    endHistory();
                }

                return;
            }

            // Undone, a move hands the next redo the names the adapter chooses, as the move did.
            const actionOf = (): UndoAction => {
                if (kind === "copy") {
                    const { section: into, trail } = went[0].place.request;
                    const copies = went.flatMap(({ pairs }) => pairs.map((pair) => pair.to));

                    return {
                        kind: "removeCopies",
                        group: { section: into, trail, entries: copies, adapter: went[0].end.item.targetAdapter },
                        sources: went.map(({ place, pairs }) => {
                            const [part] = place.request.clipboard.parts;

                            return {
                                section: part.section,
                                trail: part.trail,
                                adapter: part.adapter,
                                entries: pairs.map((pair) => pair.from),
                            };
                        }),
                    };
                }

                return {
                    kind: "move",
                    moves: went.map(({ end, place, pairs }): UndoMove => {
                        const [part] = place.request.clipboard.parts;

                        return {
                            group: {
                                section: place.request.section,
                                trail: place.request.trail,
                                adapter: end.item.targetAdapter,
                                entries: pairs.map((pair) => pair.to),
                            },
                            to: { section: part.section, trail: part.trail, adapter: part.adapter },
                            names: run?.direction === "undo" ? undefined : pairs.map((pair) => pair.from.name),
                        };
                    }),
                };
            };
            const madeFrom = went.flatMap(({ pairs }) => pairs.map((pair) => pair.from));
            const doneMessage =
                message ??
                (kind === "copy" ? text.copyDone : text.moveDone)(
                    madeFrom.length,
                    isolate(madeFrom[0].name),
                    isolate(target.name),
                );
            const served = went[0].end.item.adapter;

            if (!run) {
                // Nothing older can be undone past the entry it stopped at, which may have gone in
                // part, but what went before it still can be.
                if (partway) {
                    endHistory();
                }

                recordChange(kind, served, actionOf(), doneMessage);
            } else if (partway) {
                // What went goes on the other list, as a run done does, unless an undo ends after
                // another change was made, which left nothing to redo; the panel tries the rest again.
                const back = otherWay(run.direction);

                if (back === "undo" || historyEpoch.current === run.epoch) {
                    putDone(run, back, actionOf());
                }

                if (failed) {
                    failRun(run, failed.item.error && isolate(failed.item.error), false);
                } else {
                    leaveRun(run);
                }
            } else if (run.direction === "redo") {
                endRun(run, { action: actionOf(), message: doneMessage });
            } else {
                void renameBack(went, run.controller.signal).then(() => {
                    if (!run.controller.signal.aborted) {
                        announce(text.undone(kind));
                        endRun(run, { action: actionOf(), message: text.undone(kind) });
                    }
                });
            }
        },
        [
            transferMessage,
            renameBack,
            recordChange,
            endRun,
            putDone,
            failRun,
            callOffRun,
            leaveRun,
            endHistory,
            announce,
            localeValue,
        ],
    );

    // As a copy or move ends, what it may have changed is listed again, however it ended, since the
    // adapter can't take back what it has done: the destination, through the adapter serving it, the
    // source after a move, and after a Replace or Merge, the folders merged into, all the way down.
    // Moved entries, all of them once it's done, or those reported gone before it failed or was
    // called off (`went`), leave the cache, the clipboard and the preview (`handleMoved`). Once its
    // batch has all ended, it's announced and goes in the history (`settleBatch`). A failure stays in
    // the panel to be tried again, and is announced unless the panel was showing already, since a
    // panel just shown isn't read out, while its title is once it shows, or something of it went,
    // which the batch says.
    const handleTransferEnded = useCallback<TransferEnded>(
        (item, outcome, items, made) => {
            const transfer = transferPlaces.current.get(item.id);
            const { kind, adapter: served, targetAdapter, entries, source, target, went } = item;
            const batch: TransferBatch = transfer?.batch ?? { left: 1, done: [], ended: [] };
            const gone = outcome === "done" ? entries : went.map((each) => each.entry);

            if (outcome !== "failed") {
                transferPlaces.current.delete(item.id);
            }

            batch.left -= 1;
            batch.ended.push({ item, outcome, made, place: transfer });
            batch.done.push(...gone);

            // Cancelled while it waited, it never reached the adapter.
            if (!(outcome === "cancelled" && item.status === "queued")) {
                const across = served !== targetAdapter;

                relistTransferred(
                    targetAdapter,
                    kind === "move" && !across ? [target.id, source.id] : [target.id],
                    item.conflict === "replace" ? transfer?.merged : undefined,
                );

                if (kind === "move" && across) {
                    relist(served, [source.id]);
                }

                if (kind === "move" && transfer && gone.length > 0) {
                    const { section: into, trail } = transfer.request;

                    handleMoved(served, gone, { sectionId: into.id, trail });
                }

                if (
                    outcome === "failed" &&
                    went.length === 0 &&
                    !items.some((other) => other.shown && other.id !== item.id)
                ) {
                    announce(
                        (kind === "copy" ? localeValue.text.copyFailedNotice : localeValue.text.moveFailedNotice)(
                            entries.length,
                            isolate(entries[0].name),
                            isolate(target.name),
                        ),
                    );
                }
            }

            if (batch.left === 0) {
                settleBatch(batch, transfer?.skipped ?? [], target);
            }
        },
        [relist, relistTransferred, handleMoved, settleBatch, announce, localeValue],
    );

    useLayoutEffect(() => {
        transferEnded.current = handleTransferEnded;
    });

    // Forgets a failed copy or move, and what it was of.
    const forgetTransfer = useCallback(
        (id: number) => {
            transfers.queue.forget(id);
            transferPlaces.current.delete(id);
        },
        [transfers.queue],
    );

    // A copy or move asked for, by the picker, a paste or a drop, once its names are settled, or by
    // an undo or redo, one per folder the entries are in, as the adapter takes entries sharing a
    // folder, through the adapter serving them, into a folder of its own or another's: those
    // already in the target are left there by a move, and kept both by a copy.
    // Entries of several folders sharing names go one folder after another, so each lands before
    // the next is settled against it. A cut leaves the clipboard as its paste starts, so it isn't
    // pasted twice while it runs; a copy can be pasted again. One that fails is tried again from the
    // panel, and goes from it as the new one starts. An undo moving entries back to several folders
    // starts each with the same `batch`.
    const startTransfer = useCallback(
        (
            request: PasteRequest,
            conflict: ConflictPolicy,
            skipped: FileEntry[],
            merged: string[],
            { batch: given, names }: TransferStart = {},
        ) => {
            const { clipboard: pasted, section: target, trail, retrying } = request;
            const into = folderOf(target, trail);
            const intoAdapter = target.adapter ?? adapter;
            // Only the target's own adapter's entries can be in it already.
            const there = (part: ClipboardPart) =>
                part.adapter === intoAdapter && folderOf(part.section, part.trail).id === into.id;

            if (retrying !== undefined) {
                forgetTransfer(retrying);
            }

            const parts = pasted.parts.filter((part) => pasted.kind === "copy" || !there(part));
            const batch: TransferBatch = given ?? { left: 0, done: [], ended: [] };

            batch.left += parts.length;
            const inTurn = sharesNames(groupedEntries(parts));
            let before: number | undefined;

            parts.forEach((part) => {
                const id = transfers.queue.add(
                    pasted.kind === "cut" ? "move" : "copy",
                    part.adapter,
                    intoAdapter,
                    part.entries,
                    folderOf(part.section, part.trail),
                    into,
                    there(part) ? "keepBoth" : conflict,
                    inTurn ? before : undefined,
                );

                before = id;

                transferPlaces.current.set(id, {
                    request: { clipboard: { ...pasted, parts: [part] }, section: target, trail },
                    skipped,
                    merged,
                    retriable: true,
                    batch,
                    names,
                });
            });

            if (pasted.kind === "cut") {
                setClipboard((prev) => (prev === pasted ? null : prev));
            }
        },
        [adapter, transfers.queue, forgetTransfer],
    );

    // The picker's destination is one of the sections it was opened with, as a dialog finishes with
    // the sections it was opened for.
    const handleTransferStart = useCallback(
        (
            { kind, section: from, groups, destinations }: TransferRequest,
            destination: FileManagerLocation,
            conflict: ConflictPolicy,
            skipped: FileEntry[],
            merged: string[],
        ) => {
            const target = destinations.find((candidate) => candidate.id === destination.sectionId) ?? from;
            const pasted: Clipboard = { kind: kind === "move" ? "cut" : "copy", parts: groups };

            closeTransfer();
            startTransfer({ clipboard: pasted, section: target, trail: destination.trail }, conflict, skipped, merged);
        },
        [closeTransfer, startTransfer],
    );

    const handlePasteStart = useCallback(
        (request: PasteRequest, conflict: ConflictPolicy, skipped: FileEntry[], merged: string[]) => {
            closePaste();
            startTransfer(request, conflict, skipped, merged);
        },
        [closePaste, startTransfer],
    );

    // A failed copy or move can be tried again while its sections are there, served as they were,
    // none of its folders has gone (see `revise`), and no move under way is moving its entries or
    // the folder they'd go into, which would refuse the paste.
    const canRetryTransfer = useCallback(
        (item: TransferItem) => {
            const transfer = transferPlaces.current.get(item.id);

            if (!transfer?.retriable) {
                return false;
            }

            const { clipboard: pasted, section: target, trail } = transfer.request;
            const into = sectionsById.get(target.id);
            const servedAsBefore = (shown: Section | undefined, served: FileAdapter): shown is Section =>
                !!shown && (shown.adapter ?? adapter) === served;

            return (
                servedAsBefore(into, item.targetAdapter) &&
                !folderMoving(into, trail, movingThrough(moving, item.targetAdapter)) &&
                pasted.parts.every((part) => {
                    const from = sectionsById.get(part.section.id);

                    return (
                        servedAsBefore(from, part.adapter) &&
                        !entriesMoving(from, part.trail, part.entries, movingThrough(moving, part.adapter))
                    );
                })
            );
        },
        [sectionsById, adapter, moving],
    );

    // Tries a failed copy or move again as a paste, so the destination's names are checked again,
    // since part of it may have gone through, and the user chooses afresh; it stays in the panel
    // until the new one starts, as the user may cancel. The entries the adapter reported gone before
    // it failed (`went`) are left out, and of the rest, only those their folder still lists go, when
    // it's listed, so a move doesn't ask again for what it moved. With none left, there's nothing
    // to try again, and it's forgotten.
    const retryTransfer = useCallback(
        (item: TransferItem) => {
            const transfer = transferPlaces.current.get(item.id);
            const into = transfer && sectionsById.get(transfer.request.section.id);

            if (!transfer || !into || !canRetryTransfer(item)) {
                return;
            }

            // Each part in its section as it is now, which `canRetryTransfer` found there.
            const { clipboard: pasted, trail } = transfer.request;
            const wentIds = new Set(item.went.map((each) => each.entry.id));
            const parts = pasted.parts.flatMap((part) => {
                const from = sectionsById.get(part.section.id) ?? part.section;
                const listed = store.get(folderKey(from.id, folderOf(from, part.trail).id))?.entries;
                const listedIds = listed && new Set(listed.map((entry) => entry.id));
                const entries = part.entries.filter(
                    (entry) => !wentIds.has(entry.id) && (!listedIds || listedIds.has(entry.id)),
                );

                return entries.length > 0 ? [{ ...part, section: from, entries }] : [];
            });

            if (parts.length === 0) {
                forgetTransfer(item.id);
            } else {
                offerPaste({ ...pasted, parts }, into, trail, item.id)?.();
            }
        },
        [sectionsById, canRetryTransfer, store, offerPaste, forgetTransfer],
    );

    // Forgets every failed copy and move, and what they were of.
    const clearTransfers = useCallback(() => {
        transfers.queue.clear();

        const kept = new Set(transfers.queue.getItems().map((item) => item.id));

        transferPlaces.current.forEach((_, id) => !kept.has(id) && transferPlaces.current.delete(id));
    }, [transfers.queue]);

    // Folders a copy or move changes show their progress bar while it waits or runs, in any section
    // showing them: the one it goes into, the one listing that folder (where it was dropped onto, or
    // pasted into from its menu), and, for a move, the one the entries leave. So do those of a paste
    // while its names are checked, and those entries go to the trash from or are restored to.
    const busy = useMemo(() => {
        const served = section?.adapter ?? adapter;

        if (!folder) {
            return false;
        }

        if (pasteIds?.some((each) => each.adapter === served && each.folderIds.includes(folder.id))) {
            return true;
        }

        if (undoing?.folders.some((each) => each.adapter === served && each.folderIds.includes(folder.id))) {
            return true;
        }

        if (trashWork.some((work) => work.adapter === served && work.folderIds.includes(folder.id))) {
            return true;
        }

        // The target by the adapter serving it, and the source by the entries', which may differ.
        return transfers.items.some((item) => {
            const transfer = transferPlaces.current.get(item.id);

            if (item.status === "failed") {
                return false;
            }

            const above = transfer && folderOf(transfer.request.section, transfer.request.trail.slice(0, -1));

            return (
                (item.targetAdapter === served && (item.target.id === folder.id || above?.id === folder.id)) ||
                (item.kind === "move" && item.adapter === served && item.source.id === folder.id)
            );
        });
    }, [section, adapter, folder, pasteIds, undoing, trashWork, transfers.items]);

    // Deleted folders go from the cache (`dropFolders`), and places inside one, in the history too,
    // end at the folder that held it, in every section showing it. Deleted entries leave the clipboard,
    // and the rest are looked for again when they may be below a deleted folder. So do entries moved
    // to the trash, and entries of the trash restored, whose ids there name nothing any more.
    const applyGone = useCallback(
        (fromAdapter: FileAdapter, gone: FileEntry[]) => {
            const goneIds = new Set(gone.map((entry) => entry.id));
            const showing = new Set(sectionsOf(fromAdapter).map((shown) => shown.id));
            const mayBeBelow = mayBeRootedBelow(fromAdapter, folderIdsOf(gone));
            const dropped = dropFolders(fromAdapter, folderIdsOf(gone));

            revise((visited) => (showing.has(visited.sectionId) ? outsideDeleted(visited, dropped) : visited));
            setClipboard((prev) => prev && withoutEntries(prev, fromAdapter, goneIds, dropped, mayBeBelow));
            changePreview(fromAdapter, (entry) => (goneIds.has(entry.id) ? null : entry));
        },
        [dropFolders, mayBeRootedBelow, revise, sectionsOf, changePreview],
    );

    // Each adapter's entries, as ids mean something only to their own.
    const applyDeleted = useCallback(
        (groups: DeleteRequest["groups"]) =>
            new Set(groups.map((group) => group.adapter)).forEach((fromAdapter) =>
                applyGone(fromAdapter, groupedEntries(groups.filter((group) => group.adapter === fromAdapter))),
            ),
        [applyGone],
    );

    // Entries moved to the trash, by the user or an undo or redo, go as deleted ones do, and their
    // folder and the trash are listed again, with the listings holding them.
    const applyTrashed = useCallback(
        (served: FileAdapter, group: EntryGroup) => {
            applyGone(served, group.entries);
            relist(served, [folderOf(group.section, group.trail).id, ...trashRootIds(served)]);
        },
        [applyGone, relist, trashRootIds],
    );

    // Entries restored, by the user or an undo or redo, leave the trash as deleted ones go, and what
    // they now are back in their folders (`made`, when the adapter says) may take ids that named
    // other folders before, as a new folder may. The trash and the folders they went back along
    // (`folderIds`, those above too, as one gone since may have been made again) are listed again,
    // and after a Replace or Merge, the folders merged into, all the way down.
    const applyRestored = useCallback(
        (
            served: FileAdapter,
            trashed: FileEntry[],
            made: FileEntry[] | undefined,
            folderIds: string[],
            merged: string[],
        ) => {
            applyGone(served, trashed);

            if (made) {
                dropFolders(served, folderIdsOf(made), []);
            }

            relistTransferred(served, [...new Set([...trashRootIds(served), ...folderIds])], merged);
        },
        [applyGone, dropFolders, relistTransferred, trashRootIds],
    );

    // Entries just restored, by the user or an undo or redo, are selected and scrolled to where the
    // folder they went back to is open, in whichever section shows it. The other folders, with what
    // each now holds, are what the notice's Show opens, or lists to choose from when there are
    // several. Without what they now are, there's nothing to select, and Show only opens a folder.
    const revealRestored = useCallback(
        (groups: UndoGroup[]) => {
            const open = openKey
                ? groups.find((group) =>
                      sectionsOf(group.adapter).some(
                          (shown) => folderKey(shown.id, folderOf(group.section, group.trail).id) === openKey,
                      ),
                  )
                : undefined;
            const [first, ...rest] = open?.entries ?? [];

            if (openKey && first) {
                setReveal({ key: openKey, id: first.id, with: rest.map((entry) => entry.id) });
            }

            const others = groups.filter((group) => group !== open);

            return others.length > 0 ? others : undefined;
        },
        [sectionsOf, openKey],
    );

    // Deleting is for good, so it ends the history, unless it's the copies undoing a copy deletes,
    // whose redo copies them again. So does emptying the trash, which takes away what restoring
    // moves to the trash would put back.
    const handleDeleted = useCallback(
        (request: DeleteRequest) => {
            const entries = groupedEntries(request.groups);
            const run = undoingNow.current;

            closeDelete();
            applyDeleted(request.groups);

            if (request.emptiesTrash) {
                endHistory();
                announce(localeValue.text.emptyTrashDone);

                return;
            }

            if (request.undoesCopy && run?.step.action.kind === "removeCopies") {
                const { group, sources } = run.step.action;
                const message = localeValue.text.undone("copy");

                announce(message);
                endRun(run, {
                    action: {
                        kind: "copy",
                        sources,
                        to: { section: group.section, trail: group.trail, adapter: group.adapter },
                    },
                    message,
                });

                return;
            }

            endHistory();
            announce(localeValue.text.deleteDone(entries.length, isolate(entries[0].name)));
        },
        [closeDelete, applyDeleted, endRun, endHistory, announce, localeValue],
    );

    // The dialog confirming a copy's copies closed without deleting them leaves the copy to undo.
    const handleDeleteClose = useCallback(() => {
        const run = undoingNow.current;

        if (deleting?.request.undoesCopy && run?.step.action.kind === "removeCopies") {
            callOffRun(run);
        }

        closeDelete();
    }, [deleting?.request.undoesCopy, callOffRun, closeDelete]);

    // Asks to confirm emptying a trash, which the dialog lists afresh as the user confirms.
    const emptyTrashOf = useCallback(
        (trash: Section) => {
            const served = trash.adapter ?? adapter;

            return served.delete
                ? () =>
                      askDelete({
                          groups: [{ section: trash, trail: NO_TRAIL, entries: [], adapter: served }],
                          emptiesTrash: true,
                      })
                : undefined;
        },
        [adapter, askDelete],
    );

    // Starts and ends what shows the progress bar over the folders entries go to the trash from or
    // are restored to, and over the trash, while the adapter works.
    const startTrashWork = useCallback((work: TrashWork[]) => {
        const controller = new AbortController();

        trashControllers.current.add(controller);
        setTrashWork((prev) => [...prev, ...work]);

        return {
            signal: controller.signal,
            end: () => {
                trashControllers.current.delete(controller);
                setTrashWork((prev) => prev.filter((each) => !work.includes(each)));
            },
        };
    }, []);

    // Moves entries to the trash at once, a folder's at a time, each through its own adapter, as a
    // desktop's Delete key does, holding them meanwhile, as a move does, while their folders and the
    // trash show the progress bar. What went is said, and goes in the history to be restored, when
    // each adapter says what it put in the trash and can restore it; otherwise it ends the history,
    // as deleting does. One that fails says so in the notice, with why, and ends the history, as
    // part of it may have gone. What it calls once the adapter has answered is as it is by then
    // (`undoTools`).
    const trashEntries = useCallback(
        async (groups: UndoGroup[]) => {
            const work = [...new Set(groups.map((group) => group.adapter))].map((served): TrashWork => {
                const own = groups.filter((group) => group.adapter === served);

                return {
                    adapter: served,
                    kind: "trash",
                    folderIds: [
                        ...own.map((group) => folderOf(group.section, group.trail).id),
                        ...trashRootIds(served),
                    ],
                    entries: groupedEntries(own),
                };
            });
            const { signal, end } = startTrashWork(work);
            const done: { group: UndoGroup; made?: FileEntry[] }[] = [];
            let failed: { group: UndoGroup; error: unknown } | null = null;

            for (const group of groups) {
                try {
                    if (!group.adapter.trash) {
                        throw new Error("Not supported here.");
                    }

                    const result = await group.adapter.trash(group.entries, { signal });

                    if (signal.aborted) {
                        return;
                    }

                    done.push({ group, made: trashMade(result) });
                    undoTools.current?.applyTrashed(group.adapter, group);
                } catch (error) {
                    if (signal.aborted) {
                        return;
                    }

                    // Some of them may be in the trash all the same.
                    undoTools.current?.relist(group.adapter, [
                        folderOf(group.section, group.trail).id,
                        ...(undoTools.current?.trashRootIds(group.adapter) ?? []),
                    ]);
                    failed = { group, error };

                    break;
                }
            }

            end();

            const tools = undoTools.current;

            if (!tools) {
                return;
            }

            const { text } = tools;
            const went = done.flatMap(({ group }) => group.entries);
            const message = went.length > 0 ? text.trashDone(went.length, isolate(went[0].name)) : null;

            const restores = done.flatMap(({ group, made }): UndoRestore[] =>
                group.adapter.restore && made && madePairs(group.entries, made, "keepBoth")
                    ? [{ adapter: group.adapter, entries: made, to: { section: group.section, trail: group.trail } }]
                    : [],
            );
            const undoable = restores.length === done.length;

            if (message) {
                announce(message);
            }

            // Nothing older can be undone past one that failed, as part of it may have gone, but
            // the folders that went before it can still be restored.
            if (failed) {
                const failure = text.trashFailed(failed.group.entries.length, isolate(failed.group.entries[0].name));
                const detail = errorDetail(failed.error);

                endHistory();

                if (message && undoable) {
                    recordChange("trash", done[0].group.adapter, { kind: "restore", restores }, message);
                }

                announce(detail ? `${failure}: ${detail}` : failure);
                showNotice({ message: failure, detail });

                return;
            }

            if (message && undoable) {
                recordChange("trash", done[0].group.adapter, { kind: "restore", restores }, message);
            } else {
                endHistory();
            }
        },
        [trashRootIds, startTrashWork, recordChange, endHistory, showNotice, announce],
    );

    useLayoutEffect(() => {
        trashAsked.current = (groups) => void trashEntries(groups);
    });

    // Restores entries of the trash once the names of the folders they go back to are settled,
    // holding them meanwhile, while the trash and those folders show the progress bar. What went is
    // said, shown where its folder is open, and offered to the notice's Show otherwise, and goes in
    // the history to be moved to the trash again, when the adapter says what it put back, a section
    // shows every folder it went to, and nothing was replaced; otherwise it ends the history. One
    // that fails says so in the notice, with why, and ends the history, as part of it may have gone.
    const restoreEntries = useCallback(
        async (request: RestoreRequest, conflict: ConflictPolicy, skipped: FileEntry[], merged: string[]) => {
            const { adapter: served, entries, origins } = request;
            const folderIds = entries.flatMap((entry) => entry.trashed?.trail.at(-1)?.id ?? []);
            const alongIds = entries.flatMap((entry) => entry.trashed?.trail.map((step) => step.id) ?? []);
            const work: TrashWork = {
                adapter: served,
                kind: "restore",
                folderIds: [...trashRootIds(served), ...folderIds],
                entries,
            };
            const { signal, end } = startTrashWork([work]);
            let made: FileEntry[] | undefined;
            let failure: { error: unknown } | null = null;

            try {
                if (!served.restore) {
                    throw new Error("Not supported here.");
                }

                made = trashMade(await served.restore(entries, { signal, conflict }));
            } catch (error) {
                failure = { error };
            }

            if (signal.aborted) {
                return;
            }

            end();

            const tools = undoTools.current;

            if (!tools) {
                return;
            }

            const { text } = tools;

            if (failure) {
                const message = text.restoreFailed(entries.length, isolate(entries[0].name));
                const detail = errorDetail(failure.error);

                // Some of them may be back all the same.
                tools.relist(served, work.folderIds);
                endHistory();
                announce(detail ? `${message}: ${detail}` : message);
                showNotice({ message, detail });

                return;
            }

            const pairs = madePairs(entries, made, conflict);
            const leftOut = new Set(skipped);
            const went = pairs ? pairs.map((pair) => pair.from) : entries.filter((entry) => !leftOut.has(entry));

            tools.applyRestored(served, went, made, alongIds, conflict === "replace" ? merged : []);

            // Everything skipped, nothing changed.
            if (went.length === 0) {
                return;
            }

            // The folders they went back to, where a section shows them, with what each now holds
            // when the adapter says, to be shown, and moved to the trash again a folder's at a time.
            const madeOf = new Map(pairs?.map((pair) => [pair.from, pair.to] as const));
            const groups = new Map<string, UndoGroup>();
            const unplaced = went.filter((entry) => {
                const to = origins[entries.indexOf(entry)];

                if (!to) {
                    return true;
                }

                const key = folderKey(to.section.id, folderOf(to.section, to.trail).id);
                const group = groups.get(key) ?? { section: to.section, trail: to.trail, entries: [], adapter: served };
                const now = madeOf.get(entry);

                if (now) {
                    group.entries.push(now);
                }

                groups.set(key, group);

                return false;
            });
            const message = text.restoreDone(went.length, isolate(went[0].name));
            const show = tools.revealRestored([...groups.values()]);

            announce(message);

            if (pairs && unplaced.length === 0 && served.trash) {
                recordChange("restore", served, { kind: "trash", groups: [...groups.values()] }, message, show);
            } else {
                endHistory();

                if (show) {
                    showNotice({ message, show });
                }
            }
        },
        [trashRootIds, startTrashWork, recordChange, endHistory, showNotice, announce],
    );

    const handleRestoreStart = useCallback(
        (request: RestoreRequest, conflict: ConflictPolicy, skipped: FileEntry[], merged: string[]) => {
            closeRestore();
            void restoreEntries(request, conflict, skipped, merged);
        },
        [closeRestore, restoreEntries],
    );

    // The new or renamed entry is selected if its folder is open, in whichever section shows it,
    // unless it's renamed back quietly, as a move undone does, and `message` is said. A renamed
    // folder keeps its place in the path, the history and the sidebar tree, in every section
    // showing it.
    const applyNamed = useCallback(
        (request: NameRequest, entry: FileEntry, message: string | null, reveals = true) => {
            const { section: target, adapter: served, trail } = request;
            const parentId = folderOf(target, trail).id;
            const before = request.kind === "rename" ? request.entry : undefined;
            const showing = sectionsOf(served);

            // Shown in the open folder, the entry is announced once it's revealed there, unless it
            // takes the focus.
            if (reveals && openKey && showing.some((shown) => folderKey(shown.id, parentId) === openKey)) {
                setReveal({ key: openKey, id: entry.id, announce: message ?? undefined });
            } else if (message) {
                announce(message);
            }

            // A folder's ids, old and new, may name other folders' contents, as path ids do. Whether a
            // section may be rooted below the folder renamed is read before its listings go.
            const gone = entry.kind === "folder" && before && entry.id !== before.id ? [before.id] : [];
            const mayBeBelow = mayBeRootedBelow(served, gone);
            const dropped =
                entry.kind === "folder" && entry.id !== before?.id
                    ? dropFolders(served, before ? [entry.id, before.id] : [entry.id], gone)
                    : NO_IDS;

            // A renamed entry on the clipboard is pasted as it is now, entries below a renamed folder
            // are followed, and those that may be below it otherwise are looked for again. The
            // preview shows a renamed file by its new name, under its new id.
            if (before) {
                setClipboard(
                    (prev) => prev && withRenamed(prev, served, before, entry, dropped, mayBeBelow),
                );
                changePreview(served, (shown) => (shown.id === before.id ? entry : shown));
            }

            if (entry.kind !== "folder") {
                return;
            }

            if (!before) {
                revealInTree(served, parentId, entry);

                return;
            }

            const showingIds = new Set(showing.map((shown) => shown.id));

            revise((visited) => (showingIds.has(visited.sectionId) ? renameInPlace(visited, before, entry) : visited));

            // A section rooted in the folder keeps its root expanded as it is, under the old id.
            if (entry.id !== before.id) {
                setExpanded((prev) => {
                    const renamed = showing.filter(
                        (shown) => shown.rootId !== before.id && prev.has(folderKey(shown.id, before.id)),
                    );

                    if (renamed.length === 0) {
                        return prev;
                    }

                    const next = new Set(prev);

                    renamed.forEach((shown) => {
                        next.delete(folderKey(shown.id, before.id));
                        next.add(folderKey(shown.id, entry.id));
                    });

                    return next;
                });
            }
        },
        [openKey, sectionsOf, dropFolders, mayBeRootedBelow, revealInTree, revise, changePreview, announce],
    );

    const handleNamed = useCallback(
        (request: NameRequest, entry: FileEntry) => {
            const message =
                request.kind === "rename"
                    ? localeValue.text.renameDone(isolate(request.entry.name), isolate(entry.name))
                    : localeValue.text.createDone(isolate(entry.name));

            closeNaming();
            applyNamed(request, entry, message);
            recordNamed(request, entry, message);
        },
        [closeNaming, applyNamed, recordNamed, localeValue],
    );

    // Carries out an undo or redo taken off its list. What it acts on is checked first against its
    // folder's listing, listed afresh: each entry by its id, with the name it was left with, and a
    // copy with its size and date too, as deleting it is for good. Anything not as the change left
    // it, as changed elsewhere since, leaves it all alone, and the step goes; the adapter failing
    // puts the step back to try again. What it calls once the adapter has answered is as it is by
    // then (`undoTools`).
    const carryOut = useCallback(
        async (run: UndoRun) => {
            const {
                step,
                direction,
                controller: { signal },
            } = run;
            const { action, adapter: served } = step;
            const tools = () => {
                if (!undoTools.current) {
                    throw new UndoRefused();
                }

                return undoTools.current;
            };
            // Where entries are, in their section as it is now.
            const placed = <T extends { section: Section }>(where: T): T => ({
                ...where,
                section: tools().sectionsById.get(where.section.id) ?? where.section,
            });
            // A move to the trash, or a restore, may go through several adapters, each part through its own.
            const asListed = async (group: EntryGroup, exactly: boolean, through = served) => {
                const listed = await listingOf(
                    store,
                    group.section.id,
                    through,
                    folderOf(group.section, group.trail).id,
                    true,
                    signal,
                ).catch((error: unknown) => {
                    if (signal.aborted) {
                        throw error;
                    }

                    return [];
                });
                const { found, changed } = asLeft(listed, group.entries, exactly);

                if (changed.length > 0) {
                    throw new UndoRefused(tools().text.undoChanged(changed.length, isolate(changed[0].name)));
                }

                return found;
            };
            // Whether the entries' folder can change, and they can be renamed or deleted, with no
            // move under way holding them.
            const changeable = (group: EntryGroup, what?: "rename" | "delete", through = served) => {
                const busy = movingThrough(tools().moving, through);

                return (
                    folderWritable(store, group.section, group.trail, busy) &&
                    !entriesMoving(group.section, group.trail, group.entries, busy) &&
                    (!what || group.entries.every((entry) => allows(what, entry.permissions)))
                );
            };
            // Whether entries can go into a folder, as a paste of them could, through the adapter
            // serving it, which may not be theirs.
            const goes = (pasted: Clipboard, to: UndoTarget) =>
                canPaste(pasted, to.adapter, to.section, to.trail, store, tools().moving);

            try {
                if (!stepHolds(step, tools().sectionsById, tools().adapter)) {
                    throw new UndoRefused();
                }

                switch (action.kind) {
                    case "rename": {
                        const group = placed(action.group);
                        const [entry] = await asListed(group, false);

                        if (!served.rename || !changeable({ ...group, entries: [entry] }, "rename")) {
                            throw new UndoRefused();
                        }

                        const renamed = await served.rename(entry, action.name, { signal });
                        const { text, relist: listAgain, applyNamed: named } = tools();
                        const message =
                            direction === "undo"
                                ? text.undone("rename")
                                : text.renameDone(isolate(entry.name), isolate(renamed.name));
                        const request: NameRequest = {
                            kind: "rename",
                            section: group.section,
                            adapter: served,
                            trail: group.trail,
                            entry,
                        };

                        listAgain(served, [folderOf(group.section, group.trail).id]);
                        named(request, renamed, direction === "undo" ? null : message);

                        if (direction === "undo") {
                            announce(message);
                        }

                        endRun(run, {
                            action: { kind: "rename", group: { ...group, entries: [renamed] }, name: entry.name },
                            message,
                        });

                        return;
                    }
                    case "remove": {
                        const group = placed(action.group);
                        const [folder] = await asListed(group, false);
                        const inside = await listingOf(store, group.section.id, served, folder.id, true, signal).catch(
                            (error: unknown) => {
                                if (signal.aborted) {
                                    throw error;
                                }

                                return null;
                            },
                        );

                        if (!inside) {
                            throw new UndoRefused(tools().text.undoChanged(1, isolate(folder.name)));
                        }

                        if (inside.length > 0) {
                            throw new UndoRefused(tools().text.undoNotEmpty(isolate(folder.name)));
                        }

                        if (!served.delete || !changeable({ ...group, entries: [folder] }, "delete")) {
                            throw new UndoRefused();
                        }

                        await served.delete([folder], { signal });

                        const { text, relist: listAgain, applyDeleted: deleted } = tools();
                        const message = text.undone("newFolder");

                        listAgain(served, [folderOf(group.section, group.trail).id]);
                        deleted([{ ...group, entries: [folder], adapter: served }]);
                        announce(message);
                        endRun(run, {
                            action: {
                                kind: "create",
                                to: { section: group.section, trail: group.trail },
                                name: folder.name,
                            },
                            message,
                        });

                        return;
                    }
                    case "create": {
                        const to = placed(action.to);

                        if (!served.createFolder || !changeable({ ...to, entries: [] })) {
                            throw new UndoRefused();
                        }

                        const parentId = folderOf(to.section, to.trail).id;
                        const made = await served.createFolder(parentId, action.name, { signal });
                        const { text, relist: listAgain, applyNamed: named } = tools();
                        const message = text.createDone(isolate(made.name));

                        listAgain(served, [parentId]);
                        named({ kind: "create", section: to.section, adapter: served, trail: to.trail }, made, message);
                        endRun(run, { action: { kind: "remove", group: { ...to, entries: [made] } }, message });

                        return;
                    }
                    case "removeCopies": {
                        // Through the adapter the copies went into, which may not be the one they
                        // were copied from.
                        const group = placed(action.group);
                        const through = group.adapter;
                        const copies = await asListed(group, true, through);

                        if (!through.delete || !changeable({ ...group, entries: copies }, "delete", through)) {
                            throw new UndoRefused();
                        }

                        // The dialog ends the run, done (`handleDeleted`) or called off (`handleDeleteClose`).
                        tools().askDelete({
                            groups: [{ ...group, entries: copies }],
                            undoesCopy: true,
                        });

                        return;
                    }
                    case "copy": {
                        const to = placed(action.to);
                        const sources = await Promise.all(
                            action.sources.map(async (source) => {
                                const group = placed(source);

                                return { ...group, entries: await asListed(group, false, group.adapter) };
                            }),
                        );
                        const pasted: Clipboard = { kind: "copy", parts: sources };

                        if (!goes(pasted, to)) {
                            throw new UndoRefused();
                        }

                        // The batch ends the run once the copies are done (`settleBatch`).
                        tools().startTransfer(
                            { clipboard: pasted, section: to.section, trail: to.trail },
                            "keepBoth",
                            [],
                            [],
                            { batch: { left: 0, done: [], ended: [], run } },
                        );

                        return;
                    }
                    case "move": {
                        const moves = await Promise.all(
                            action.moves.map(async (move) => {
                                const group = placed(move.group);
                                const pasted: Clipboard = {
                                    kind: "cut",
                                    parts: [{ ...group, entries: await asListed(group, false, group.adapter) }],
                                };

                                return { ...move, pasted, to: placed(move.to) };
                            }),
                        );

                        if (moves.some(({ pasted, to }) => !goes(pasted, to))) {
                            throw new UndoRefused();
                        }

                        // Each goes back to its own folder, together, and the batch ends the run.
                        const batch: TransferBatch = { left: 0, done: [], ended: [], run };

                        moves.forEach(({ pasted, to, names }) =>
                            tools().startTransfer(
                                { clipboard: pasted, section: to.section, trail: to.trail },
                                "keepBoth",
                                [],
                                [],
                                { batch, names },
                            ),
                        );

                        return;
                    }
                    case "trash": {
                        const groups = await Promise.all(
                            action.groups.map(async (given) => {
                                const group = placed(given);

                                return { ...group, entries: await asListed(group, false, group.adapter) };
                            }),
                        );

                        if (
                            groups.some((group) => !group.adapter.trash || !changeable(group, "delete", group.adapter))
                        ) {
                            throw new UndoRefused();
                        }

                        // A folder's at a time, each gone from it once it's in the trash, held meanwhile.
                        // One failing after others went leaves those done, and what's left to try again.
                        const restores: UndoRestore[] = [];
                        let partway: { index: number; error: unknown } | null = null;
                        const { end } = tools().startTrashWork(
                            groups.map(
                                (group): TrashWork => ({
                                    adapter: group.adapter,
                                    kind: "trash",
                                    folderIds: [],
                                    entries: group.entries,
                                }),
                            ),
                        );

                        try {
                            for (const [index, group] of groups.entries()) {
                                if (!group.adapter.trash) {
                                    throw new UndoRefused();
                                }

                                let made: FileEntry[] | undefined;

                                try {
                                    made = trashMade(await group.adapter.trash(group.entries, { signal }));
                                } catch (error) {
                                    if (index === 0 || signal.aborted) {
                                        throw error;
                                    }

                                    partway = { index, error };

                                    break;
                                }

                                tools().applyTrashed(group.adapter, group);

                                if (made && madePairs(group.entries, made, "keepBoth")) {
                                    restores.push({
                                        adapter: group.adapter,
                                        entries: made,
                                        to: { section: group.section, trail: group.trail },
                                    });
                                }
                            }
                        } finally {
                            end();
                        }

                        if (partway) {
                            const went = groups.slice(0, partway.index);

                            // The adapter may have done some of the one that failed all the same.
                            run.folders.forEach((each) => tools().relist(each.adapter, each.folderIds));
                            failRunPartway(
                                run,
                                restores.length === went.length && went.every((group) => !!group.adapter.restore)
                                    ? { kind: "restore", restores }
                                    : null,
                                { kind: "trash", groups: action.groups.slice(partway.index) },
                                action.groups[partway.index].adapter,
                                errorDetail(partway.error),
                            );

                            return;
                        }

                        const { text } = tools();
                        const entries = groupedEntries(groups);
                        const message =
                            direction === "undo"
                                ? text.undone("restore")
                                : text.trashDone(entries.length, isolate(entries[0].name));

                        announce(message);

                        // Without what's in the trash now, nothing can be restored from here, and
                        // what's older would have to go back past it.
                        if (
                            restores.length === groups.length &&
                            groups.every((group) => !!group.adapter.restore)
                        ) {
                            endRun(run, { action: { kind: "restore", restores }, message });
                        } else if (leaveRun(run)) {
                            endHistory();
                            showNotice({ message });
                        }

                        return;
                    }
                    case "restore": {
                        const restores = action.restores.map((restore) => ({ ...restore, to: placed(restore.to) }));
                        // Each adapter's entries as the change left them in its trash, where a section
                        // shows the trash; without one, the adapter has the final say.
                        const parts = await Promise.all(
                            [...new Set(restores.map((restore) => restore.adapter))].map(async (through) => {
                                const own = restores.filter((restore) => restore.adapter === through);
                                const trashed = own.flatMap((restore) => restore.entries);
                                const trashes = trashesOf(tools().sectionsById.values(), tools().adapter, through);

                                if (trashes.length === 0) {
                                    return { adapter: through, restores: own, given: trashed };
                                }

                                const listed = await Promise.all(
                                    trashes.map((trash) =>
                                        listingOf(store, trash.id, through, trash.rootId, true, signal).catch(
                                            (error: unknown) => {
                                                if (signal.aborted) {
                                                    throw error;
                                                }

                                                return [];
                                            },
                                        ),
                                    ),
                                );
                                const { found, changed } = asLeft(listed.flat(), trashed, false);

                                if (changed.length > 0) {
                                    throw new UndoRefused(
                                        tools().text.undoChanged(changed.length, isolate(changed[0].name)),
                                    );
                                }

                                return { adapter: through, restores: own, given: found };
                            }),
                        );

                        const writable = (through: FileAdapter, to: UndoFolder) =>
                            folderWritable(store, to.section, to.trail, movingThrough(tools().moving, through));

                        if (
                            parts.some(
                                ({ adapter: through, restores: own }) =>
                                    !through.restore || own.some(({ to }) => !writable(through, to)),
                            )
                        ) {
                            throw new UndoRefused();
                        }

                        // An adapter's at a time, all at once, held meanwhile. Each is moved to the
                        // trash again a folder's at a time, from the one it went back to, which they
                        // came in the order they were given. One failing after others went leaves
                        // those done, and what's left to try again.
                        const shown: UndoGroup[] = [];
                        let undoable = true;
                        let partway: { index: number; error: unknown } | null = null;
                        const { end } = tools().startTrashWork(
                            parts.map(
                                (part): TrashWork => ({
                                    adapter: part.adapter,
                                    kind: "restore",
                                    folderIds: [],
                                    entries: part.given,
                                }),
                            ),
                        );

                        try {
                            for (const [index, part] of parts.entries()) {
                                if (!part.adapter.restore) {
                                    throw new UndoRefused();
                                }

                                let made: FileEntry[] | undefined;

                                try {
                                    made = trashMade(
                                        await part.adapter.restore(part.given, { signal, conflict: "keepBoth" }),
                                    );
                                } catch (error) {
                                    if (index === 0 || signal.aborted) {
                                        throw error;
                                    }

                                    partway = { index, error };

                                    break;
                                }

                                const pairs = madePairs(part.given, made, "keepBoth");
                                const alongIds = part.restores.flatMap(({ to }) => [
                                    to.section.rootId,
                                    ...to.trail.map((step) => step.id),
                                ]);
                                let next = 0;

                                tools().applyRestored(part.adapter, part.given, made, alongIds, []);
                                undoable = undoable && !!pairs && !!part.adapter.trash;
                                part.restores.forEach((restore) => {
                                    const entries = pairs
                                        ? pairs.slice(next, next + restore.entries.length).map((pair) => pair.to)
                                        : [];

                                    next += restore.entries.length;
                                    shown.push({ ...restore.to, entries, adapter: part.adapter });
                                });
                            }
                        } finally {
                            end();
                        }

                        if (partway) {
                            const left = new Set(parts.slice(partway.index).map((part) => part.adapter));
                            const rest = action.restores.filter((restore) => left.has(restore.adapter));

                            tools().revealRestored(shown);
                            run.folders.forEach((each) => tools().relist(each.adapter, each.folderIds));
                            failRunPartway(
                                run,
                                undoable ? { kind: "trash", groups: shown } : null,
                                { kind: "restore", restores: rest },
                                parts[partway.index].adapter,
                                errorDetail(partway.error),
                            );

                            return;
                        }

                        const given = parts.flatMap((part) => part.given);
                        const { text, revealRestored: revealBack } = tools();
                        const message =
                            direction === "undo"
                                ? text.undone("trash")
                                : text.restoreDone(given.length, isolate(given[0].name));
                        const show = revealBack(shown);

                        announce(message);

                        if (undoable) {
                            endRun(run, { action: { kind: "trash", groups: shown }, message, show });
                        } else if (leaveRun(run)) {
                            endHistory();
                            showNotice({ message, show });
                        }

                        return;
                    }
                }
            } catch (error) {
                if (signal.aborted) {
                    return;
                }

                if (error instanceof UndoRefused) {
                    failRun(run, error.message || undefined, false);

                    return;
                }

                // The adapter may have done some of it all the same.
                run.folders.forEach((each) => undoTools.current?.relist(each.adapter, each.folderIds));
                failRun(run, errorDetail(error), true);
            }
        },
        [store, announce, endRun, failRun, failRunPartway, leaveRun, endHistory, showNotice],
    );

    // Undoes, or redoes, the latest change of `direction`'s list, taking it off, one at a time.
    // Returns whether there was one, with none under way.
    const runUndo = useCallback(
        (direction: UndoDirection) => {
            const step = historyNow.current[direction].at(-1);

            if (!step || undoingNow.current) {
                return false;
            }

            // Entries going to the trash, or coming back from it, show the progress bar over it too,
            // each adapter's.
            const { kind } = step.action;
            const folders = changedFolders(step);
            const run: UndoRun = {
                step,
                direction,
                folders:
                    kind === "trash" || kind === "restore"
                        ? [
                              ...folders,
                              ...[...new Set(folders.map((each) => each.adapter))].map((through) => ({
                                  adapter: through,
                                  folderIds: trashRootIds(through),
                              })),
                          ]
                        : folders,
                epoch: historyEpoch.current,
                controller: new AbortController(),
            };

            changeHistory((before) => ({ ...before, [direction]: before[direction].slice(0, -1) }));
            undoingNow.current = run;
            setUndoing(run);
            void carryOut(run);

            return true;
        },
        [changeHistory, carryOut, trashRootIds],
    );

    const contextFor = useCallback(
        (request: MenuRequest): ActionContext => {
            const { target, section: menuSection, trail, entries, listing, inResults } = request;
            const menuFolder = folderOf(menuSection, trail);
            const folderAdapter = menuSection.adapter ?? adapter;
            const base = { section: menuSection, adapter: folderAdapter, trail };
            // The entries by their folder: one, or several for a search's results, of one section or
            // more, each folder going by its own section's permissions and adapter, which is asked
            // a folder's entries at a time. `trail` is then the nearest folder of `menuSection`
            // holding its own, where nothing is made, uploaded or pasted for them.
            const groups = requestGroups(request);
            const spread = groups.length > 1;
            const servedBy = (group: EntryGroup) => group.section.adapter ?? adapter;
            // The entries by their folder, each with the adapter serving it, as the clipboard and
            // the picker take them, which may be several, for a search's results.
            const parts = groups.map((group): ClipboardPart => ({ ...group, adapter: servedBy(group) }));

            // What the folders and the entries' own permissions allow, while no move under way is
            // moving them, or their folders, through their own adapter.
            const busy = movingThrough(moving, folderAdapter);
            const busyFor = (group: EntryGroup) => movingThrough(moving, servedBy(group));

            // The sections the entries can be copied or moved (`kind`) into, by their own adapter or
            // into another's (`carries`), which takes deleting them from theirs for a move, taking
            // entries from each of theirs, and their own. A section nothing can change is offered
            // only when it's one of theirs, and the trash never, as entries go there only by being
            // moved to it. The picker starts where the entries are, or in the first section they can
            // go into.
            const deletable = (part: ClipboardPart) =>
                entriesAllow(store, part.section, part.trail, part.entries, "delete", busyFor(part));
            const destinationsFor = (kind: TransferRequest["kind"]) =>
                [...sectionsById.values()].filter((candidate) => {
                    const into = candidate.adapter ?? adapter;

                    return (
                        !candidate.trash &&
                        (groups.some((group) => group.section.id === candidate.id) || !candidate.readOnly) &&
                        parts.every(
                            (part) =>
                                carries(kind, part.adapter, into, part.entries) &&
                                importsFrom(candidate, part.section) &&
                                (kind === "copy" || part.adapter === into || deletable(part)),
                        )
                    );
                });
            const transferTo = (kind: TransferRequest["kind"], destinations: Section[]) => {
                const pickerStart = destinations.some((candidate) => candidate.id === menuSection.id)
                    ? { section: menuSection, trail }
                    : destinations[0] && { section: destinations[0], trail: [] };

                return pickerStart
                    ? () => askDestination({ ...pickerStart, kind, groups: parts, destinations })
                    : undefined;
            };
            const copyDestinations = destinationsFor("copy");
            const entriesBusy = groups.some((group) =>
                entriesMoving(group.section, group.trail, group.entries, busyFor(group)),
            );
            const writable = groups.every((group) => folderWritable(store, group.section, group.trail, busyFor(group)));
            const permits = (what: "rename" | "move" | "delete") =>
                writable &&
                !entriesBusy &&
                entries.length > 0 &&
                entries.every((entry) => allows(what, entry.permissions));
            // The trash changes nothing, but its root's entries are restored or deleted for good, as
            // their own permissions allow; nothing in it is copied out or moved to the trash again.
            const inTrash = groups.some((group) => !!group.section.trash);
            const trashRoot = groups.every((group) => inTrashRoot(group.section, group.trail));
            const trashPermits = (what: "move" | "delete") =>
                trashRoot &&
                !entriesBusy &&
                entries.length > 0 &&
                entries.every((entry) => allows(what, entry.permissions));
            // Where each of them goes back to, as a section's folder, when one shows it. They're only
            // restored into folders the backend lets change and no move under way is moving, or the
            // trash's work holding, whichever section shows them, as a restore is the trash's, not
            // the section's.
            const origins = trashRoot
                ? entries.map((entry) =>
                      entry.trashed ? trashOrigin(sectionsById.values(), adapter, folderAdapter, entry.trashed) : null,
                  )
                : [];
            const restorable = origins.every(
                (origin) =>
                    !origin ||
                    (folderPermits(store, origin.section, origin.trail) &&
                        !folderMoving(origin.section, origin.trail, busy)),
            );

            // Pastes into the folder at `pasteTrail`, when what was cut or copied can go there.
            // Entries from several folders aren't in `trail`'s, so nothing goes in there for them.
            const pasteTo = (pasteTrail: FolderRef[]) =>
                clipboard && !spread ? offerPaste(clipboard, menuSection, pasteTrail) : undefined;

            const uploadHere = spread ? undefined : offerUpload(menuSection, trail);

            const [only] = entries;
            // A folder's own menu, its empty space, the path bar's or a section row's, downloads the
            // folder itself.
            const downloaded = downloadedEntries(entries, menuFolder);

            // Entries of several folders are one file per adapter, from its `downloadAcross`, or else
            // one per folder, as `download` takes a folder's.
            const downloadSpread = () => {
                const byAdapter = new Map<FileAdapter, EntryGroup[]>();

                groups.forEach((group) => byAdapter.set(servedBy(group), [...(byAdapter.get(servedBy(group)) ?? []), group]));

                const asked = [...byAdapter].flatMap(([served, own]) => {
                    if (own.length > 1 && served.downloadAcross) {
                        const holding = selectionRequest(own);

                        return [() => askDownloadAcross(served, own, folderOf(holding.section, holding.trail))];
                    }

                    return own.map((group) =>
                        canDownload(served, group.entries)
                            ? () => askDownload(served, group.entries, folderOf(group.section, group.trail))
                            : undefined,
                    );
                });

                return asked.every((ask) => !!ask) ? () => asked.forEach((ask) => ask?.()) : undefined;
            };

            // A single file steps through the files of the view it's listed in, in its order, and
            // the selection follows; several files, of one folder or several, step through
            // themselves. Without their adapter's `content`, only those a previewer reading nothing
            // takes.
            const previewedIn = (group: EntryGroup) =>
                group.entries
                    .filter((entry) => entry.kind === "file" && previewable(entry, servedBy(group), previewers))
                    .map(
                        (entry): PreviewFile => ({
                            entry,
                            section: group.section,
                            adapter: servedBy(group),
                            trail: group.trail,
                        }),
                    );
            const previewed = groups.flatMap(previewedIn);
            const preview =
                previewed.length > 0
                    ? () => {
                          const own = { section: menuSection, trail, entries: listing ?? [] };
                          const siblings = entries.length === 1 ? previewedIn(own) : [];
                          const index = siblings.findIndex((file) => file.entry.id === only.id);

                          askPreview(
                              index >= 0
                                  ? { files: siblings, index, follow: true, inResults }
                                  : { files: previewed, index: 0, follow: false, inResults },
                          );
                      }
                    : undefined;

            const context: ActionContext = {
                target,
                entries,
                folder: menuFolder,
                section: menuSection,
                byFolder: spread
                    ? groups.map((group) => ({
                          section: group.section,
                          folder: folderOf(group.section, group.trail),
                          entries: group.entries,
                      }))
                    : undefined,
                readOnly: !writable,
                moving: entriesBusy,
                refresh: () => {
                    groups.forEach((group) => {
                        const { id } = folderOf(group.section, group.trail);

                        store.load(folderKey(group.section.id, id), servedBy(group), id, true);
                    });
                    setSearchVersion((count) => count + 1);
                },
                openFolder: (entry) => {
                    goTo({ sectionId: menuSection.id, trail: [...trail, { id: entry.id, name: entry.name }] });
                },
                createFolder:
                    folderAdapter.createFolder && writable && !spread
                        ? () => askName({ ...base, kind: "create" })
                        : undefined,
                createFolderInto:
                    folderAdapter.createFolder &&
                    entries.length === 1 &&
                    only.kind === "folder" &&
                    folderWritable(store, menuSection, [...trail, { id: only.id, name: only.name }], busy)
                        ? () =>
                              askName({
                                  ...base,
                                  trail: [...trail, { id: only.id, name: only.name }],
                                  kind: "create",
                              })
                        : undefined,
                rename:
                    folderAdapter.rename && entries.length === 1 && permits("rename")
                        ? () => askName({ ...base, kind: "rename", entry: entries[0] })
                        : undefined,
                copyTo:
                    entries.length > 0 &&
                    !entriesBusy &&
                    !inTrash &&
                    copyDestinations.some((candidate) => !candidate.readOnly)
                        ? transferTo("copy", copyDestinations)
                        : undefined,
                moveTo: permits("move") ? transferTo("move", destinationsFor("move")) : undefined,
                // Cut and copied entries may be pasted into another adapter's folder, copied across,
                // which takes reading them, and deleting them for a cut.
                cut:
                    permits("move") &&
                    parts.every((part) => !!part.adapter.move || (!!part.adapter.delete && !!part.adapter.content))
                        ? () => {
                              setClipboard({ kind: "cut", parts });
                              announce(localeValue.text.clipboardCut(entries.length, isolate(only.name)));
                          }
                        : undefined,
                copy:
                    entries.length > 0 &&
                    !entriesBusy &&
                    !inTrash &&
                    parts.every((part) => !!(part.adapter.copy || part.adapter.content))
                        ? () => {
                              setClipboard({ kind: "copy", parts });
                              announce(localeValue.text.clipboardCopied(entries.length, isolate(only.name)));
                          }
                        : undefined,
                delete:
                    groups.every((group) => !!servedBy(group).delete) && (permits("delete") || trashPermits("delete"))
                        ? () => askDelete({ groups: groups.map((group) => ({ ...group, adapter: servedBy(group) })) })
                        : undefined,
                trash:
                    !inTrash && groups.every((group) => !!servedBy(group).trash) && permits("delete")
                        ? () => void trashEntries(groups.map((group) => ({ ...group, adapter: servedBy(group) })))
                        : undefined,
                restore:
                    folderAdapter.restore &&
                    trashPermits("move") &&
                    entries.every((entry) => !!entry.trashed) &&
                    restorable
                        ? () => askRestore({ section: menuSection, adapter: folderAdapter, entries, origins })
                        : undefined,
                emptyTrash:
                    inTrashRoot(menuSection, trail) &&
                    store.get(folderKey(menuSection.id, menuFolder.id))?.entries?.length !== 0
                        ? emptyTrashOf(menuSection)
                        : undefined,
                download: spread
                    ? downloadSpread()
                    : canDownload(folderAdapter, downloaded)
                      ? () => askDownload(folderAdapter, downloaded, menuFolder)
                      : undefined,
                properties: () => showProperties(subjectOf(request)),
                upload:
                    uploadHere &&
                    ((files?: File[]) =>
                        files
                            ? uploadHere({ files, folders: [] })
                            : pickFiles(uploadHere, uploadPatterns(menuSection)?.join(",") ?? "")),
                uploadFolder:
                    uploadHere && folderAdapter.createFolder && picksFolders()
                        ? () => pickFiles(uploadHere, "", true)
                        : undefined,
                paste: pasteTo(trail),
                pasteInto:
                    entries.length === 1 && only.kind === "folder"
                        ? pasteTo([...trail, { id: only.id, name: only.name }])
                        : undefined,
                preview,
                undo: history.undo.length > 0 && !undoing ? () => runUndo("undo") : undefined,
                redo: history.redo.length > 0 && !undoing ? () => runUndo("redo") : undefined,
            };

            // A result of a search everywhere is shown in its folder, which ends the search, even when
            // that's the open folder.
            if (inResults && entries.length === 1) {
                context.openLocation = () => {
                    const location = { sectionId: menuSection.id, trail };

                    setReveal({ key: folderKey(menuSection.id, menuFolder.id), id: only.id });
                    stopSearching();

                    if (samePlace(location, place)) {
                        if (focusInContent()) {
                            setFocusContent(true);
                        }
                    } else {
                        goTo(location);
                    }
                };
            }

            // An entry in the trash's root opens the folder it was moved there from, when a section
            // shows it, as GNOME's trash offers.
            const origin = entries.length === 1 ? origins[0] : null;

            if (origin) {
                context.openOrigin = () => goTo({ sectionId: origin.section.id, trail: origin.trail });
            }

            // Only the tree's menu from a long-press hands this over (see `MenuRequest.select`).
            context.select = request.select;

            // Opened as double-clicking it does: a folder here, and a file as the consumer says, or
            // in the preview when they decline it. Without `onOpenFile`, opening a file is only
            // previewing it, which `preview` already offers.
            if (entries.length === 1 && only.kind === "folder") {
                context.open = () => context.openFolder(only);
            } else if (entries.length === 1 && onOpenFile) {
                context.open = () => {
                    if (onOpenFile(only, context) === false) {
                        preview?.();
                    }
                };
            }

            return context;
        },
        [
            adapter,
            store,
            moving,
            goTo,
            askName,
            askDestination,
            askDelete,
            askRestore,
            trashEntries,
            emptyTrashOf,
            askDownload,
            askDownloadAcross,
            askPreview,
            offerPaste,
            offerUpload,
            pickFiles,
            showProperties,
            sectionsById,
            clipboard,
            onOpenFile,
            previewers,
            place,
            stopSearching,
            focusInContent,
            history,
            undoing,
            runUndo,
            announce,
            localeValue,
        ],
    );

    // What undoing and redoing call once the adapter has answered.
    useLayoutEffect(() => {
        undoTools.current = {
            adapter,
            sectionsById,
            moving,
            text: localeValue.text,
            applyNamed,
            applyDeleted,
            applyTrashed,
            applyRestored,
            trashRootIds,
            startTrashWork,
            revealRestored,
            askDelete,
            relist,
            startTransfer,
        };
    });

    // Whether anything the file manager does can be undone, for the main menu's Undo and Redo and the
    // keyboard shortcuts to show.
    const canUndo = useMemo(
        () =>
            undoLimit > 0 &&
            sections.some((group) => group.sections.some((shown) => canUndoWith(shown.adapter ?? adapter))),
        [undoLimit, sections, adapter],
    );

    const undoItems = useMemo(
        (): UndoItems | undefined =>
            canUndo
                ? {
                      undo: (!undoing && history.undo.at(-1)?.change) || null,
                      redo: (!undoing && history.redo.at(-1)?.change) || null,
                      onUndo: () => runUndo("undo"),
                      onRedo: () => runUndo("redo"),
                  }
                : undefined,
        [canUndo, undoing, history, runUndo],
    );

    // The notice shows while its button's step is the latest of its list, or under way, so it never
    // offers to undo what's no longer next; one without a button shows for its time.
    const offer = notice?.offer;
    const offerHolds =
        !!offer && (history[offer.direction].at(-1)?.id === offer.stepId || undoing?.step.id === offer.stepId);
    const shownNotice = notice && (!offer || offerHolds) ? notice : null;
    const noticeAction =
        shownNotice?.offer &&
        (shownNotice.offer.retry
            ? localeValue.text.tryAgain
            : shownNotice.offer.direction === "undo"
              ? localeValue.text.undo
              : localeValue.text.redo);
    const noticeShow = shownNotice?.show && localeValue.text.showRestored;
    // Several folders to show are listed by name, with where each is.
    const noticePlaces = useMemo(
        () =>
            shownNotice?.show && shownNotice.show.length > 1
                ? shownNotice.show.map((group) => placeName(sectionsById.get(group.section.id), group.trail))
                : undefined,
        [shownNotice?.show, sectionsById],
    );

    const handleNoticeAction = useCallback(() => {
        if (notice?.offer) {
            runUndo(notice.offer.direction);
        }
    }, [notice, runUndo]);

    // The notice's Show: opens a folder entries were restored to, the one chosen from its list when
    // there are several, with them selected, ending a search, and takes the focus into it, as "Open
    // item location" does.
    const handleNoticeShow = useCallback(
        (index: number) => {
            const group = notice?.show?.[index];
            const shown = group && sectionsById.get(group.section.id);

            if (!group || !shown) {
                return;
            }

            const { trail, entries } = group;
            const location = { sectionId: shown.id, trail };
            const [first, ...rest] = entries;

            if (first) {
                setReveal({
                    key: folderKey(shown.id, folderOf(shown, trail).id),
                    id: first.id,
                    with: rest.map((entry) => entry.id),
                });
            }

            stopSearching();
            setFocusContent(true);

            if (!samePlace(location, place)) {
                goTo(location);
            }
        },
        [notice, sectionsById, place, stopSearching, goTo],
    );

    const focusFromNotice = useCallback(() => setFocusContent(true), []);

    // Where an entry in a trash's root was moved there from, as a search's results show where they
    // are, for the properties and the list. The trash open is the only one whose list shows it.
    const locateIn = useCallback(
        (trash: Section, info: TrashInfo) =>
            trashedLocation(sectionsById.values(), adapter, trash.adapter ?? adapter, info),
        [sectionsById, adapter],
    );
    const trashOpen = section && inTrashRoot(section, place.trail) ? section : undefined;
    const locateTrashed = useCallback(
        (info: TrashInfo) => (trashOpen ? locateIn(trashOpen, info) : ""),
        [trashOpen, locateIn],
    );

    // What the app's actions in the preview's header get: the context menu's for the one file shown,
    // in its folder, with what takes the user elsewhere closing the preview first. It isn't
    // previewed again from there.
    const previewActionsFor = useCallback(
        ({ inResults }: PreviewRequest, { entry, section: shown, trail }: PreviewFile): ToolbarGroup[] => {
            if (previewActions.length === 0) {
                return NO_TOOLBAR;
            }

            const context = contextFor({ target: "selection", section: shown, trail, entries: [entry], inResults });
            const inPreview: ActionContext = {
                ...context,
                preview: undefined,
                closePreview,
                open: onOpenFile
                    ? () => {
                          if (onOpenFile(entry, inPreview) !== false) {
                              closePreview();
                          }
                      }
                    : undefined,
                openLocation:
                    context.openLocation &&
                    (() => {
                        closePreview();
                        context.openLocation?.();
                    }),
                openOrigin:
                    context.openOrigin &&
                    (() => {
                        closePreview();
                        context.openOrigin?.();
                    }),
                // The properties take the focus, which the preview leaves them as it closes.
                properties: () => {
                    setPreviewing((prev) => prev && { ...prev, open: false, handedOff: true });
                    context.properties();
                },
            };

            return toolbarGroups(previewActions, inPreview);
        },
        [previewActions, contextFor, closePreview, onOpenFile],
    );

    // Opens a file as double-clicking it does, with `onOpenFile`, or in the preview when there's
    // none or it declines the file. Returns false when nothing opened it.
    const openFile = useCallback(
        (request: MenuRequest) => {
            const context = contextFor(request);
            const [entry] = request.entries;

            if (entry && onOpenFile && onOpenFile(entry, context) !== false) {
                return true;
            }

            context.preview?.();

            return !!context.preview;
        },
        [contextFor, onOpenFile],
    );

    const openMenu = useCallback<OpenMenu>(
        (position, request) => {
            const context = contextFor(request);
            const groups = visibleActionGroups(actions, context);

            if (groups.length === 0) {
                return false;
            }

            menuOpener.current = document.activeElement;
            setMenu({ open: true, position, context, groups });

            return true;
        },
        [actions, contextFor],
    );

    // Offered exactly as the menu would offer it, so a shortcut never runs a hidden action. The key
    // the layout types is tried first, for every target, before the letter at the key's place.
    const runShortcut = useCallback<RunShortcut>(
        (event, requests) =>
            pressedKeys(event).some((key) =>
                requests.some((request) => {
                    const context = contextFor(request);
                    const action = visibleActionGroups(actions, context)
                        .flatMap((group) => group.actions)
                        .find((candidate) => candidate.shortcut && matchesShortcut(event, candidate.shortcut, key));

                    if (!action) {
                        return false;
                    }

                    // The paste key of a disabled action goes on to the browser, whose paste may
                    // carry files from the desktop to upload (`pasteFiles`).
                    if (action.disabled?.(context)) {
                        return !pastes(event);
                    }

                    action.onSelect(context);

                    return true;
                }),
            ),
        [actions, contextFor],
    );

    // `FileManagerApi.reveal`: the entry is selected and scrolled to by the folder view once the
    // folder it's in, the open one or the one gone to, lists it.
    const revealEntry = useCallback(
        (entryId: string, target?: FileManagerLocation) => {
            const at = target ?? place;
            const atSection = sectionsById.get(at.sectionId);

            if (!atSection) {
                return;
            }

            setReveal({ key: folderKey(atSection.id, folderOf(atSection, at.trail).id), id: entryId });

            if (target) {
                goTo(target);
            }
        },
        [place, sectionsById, goTo],
    );

    // Aborts the paths still being looked for, with the file manager unmounting. Made as it mounts,
    // so the development double mount leaves a signal that isn't aborted.
    const mounted = useRef<AbortController | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        mounted.current = controller;

        return () => controller.abort();
    }, []);

    const allSections = useMemo(() => [...sectionsById.values()], [sectionsById]);

    // Goes where a typed path leads (`resolvePath`): the folder it names, or for a file the folder
    // holding it, with the file revealed there. Resolves with where it went, or why it couldn't, in
    // the text. It goes through `api` for the places it asks, since the file manager may have moved
    // on while the adapters' listings were asked.
    const followPath = useCallback(
        async (typed: string, signal: AbortSignal): Promise<GoToPathResult> => {
            if (!section) {
                return { ok: false, message: localeValue.text.noSections };
            }

            let result: PathResult;

            try {
                result = await resolvePath(
                    typed,
                    { place, section, sections: allSections, adapter, store, fold: localeValue.foldLetters },
                    signal,
                );
            } catch {
                // Only the signal rejects, with nobody left to tell.
                return { ok: false, message: "" };
            }

            if (signal.aborted) {
                return { ok: false, message: "" };
            }

            if (!result.found) {
                return { ok: false, message: pathProblemText(result.problem, localeValue.text) };
            }

            const { location, entryId } = result;

            if (entryId) {
                api.current.revealEntry(entryId, location);
            } else {
                api.current.goTo(location);
            }

            return { ok: true, location, entryId };
        },
        [section, place, allSections, adapter, store, localeValue],
    );

    // What the path field does with a path typed: goes there, closing the field and taking the focus
    // on into the content, or says why it can't, to show under the field.
    const submitPath = useCallback(async (typed: string, signal: AbortSignal) => {
        const result = await api.current.followPath(typed, signal);

        if (!result.ok) {
            return result.message;
        }

        pathOpener.current = null;
        setPathEditing(false);
        setFocusContent(true);

        return null;
    }, []);

    // `FileManagerApi.download`: as the context menu's Download, for entries of the open folder or
    // the one at `target`, or with none, that folder itself.
    const downloadFrom = useCallback(
        (entries: readonly FileEntry[] = [], target?: FileManagerLocation) => {
            const at = target ?? place;
            const atSection = sectionsById.get(at.sectionId);

            if (!atSection) {
                return false;
            }

            const served = atSection.adapter ?? adapter;
            const folder = folderOf(atSection, at.trail);
            const downloaded = downloadedEntries(entries, folder);

            if (!canDownload(served, downloaded)) {
                return false;
            }

            askDownload(served, downloaded, folder);

            return true;
        },
        [adapter, place, sectionsById, askDownload],
    );

    // `FileManagerApi.actionContext`: what the context menu's actions get, for entries of the open
    // folder or the one at `target`, or with none, for that folder itself. A single file previews
    // through the folder's files as the content orders them, once the folder is listed.
    const actionContextAt = useCallback(
        (entries: readonly FileEntry[] = [], target?: FileManagerLocation) => {
            const at = target ?? place;
            const atSection = sectionsById.get(at.sectionId);

            if (!atSection) {
                return null;
            }

            const listed = store.get(folderKey(atSection.id, folderOf(atSection, at.trail).id))?.entries;
            // The trash's root may be ordered by where its entries came from.
            const locationOf = inTrashRoot(atSection, at.trail)
                ? (entry: FileEntry) => (entry.trashed ? locateIn(atSection, entry.trashed) : "")
                : undefined;
            const listing = listed
                ?.filter((entry) => showHidden || !isHidden(entry))
                .sort(entryComparator(sort, localeValue, locationOf));

            return contextFor({
                target: entries.length > 0 ? "selection" : "folder",
                section: atSection,
                trail: at.trail,
                entries: [...entries],
                listing,
            });
        },
        [place, sectionsById, store, showHidden, sort, localeValue, locateIn, contextFor],
    );

    // The API stays the same object while the file manager is mounted, so a consumer can keep it;
    // its methods go to what's current when they're called.
    const api = useRef({
        goTo,
        goBack,
        goForward,
        refresh,
        revealEntry,
        downloadFrom,
        actionContextAt,
        openSearch,
        closeSearch,
        openPath,
        followPath,
        showShortcuts,
        runUndo,
    });

    useLayoutEffect(() => {
        api.current = {
            goTo,
            goBack,
            goForward,
            refresh,
            revealEntry,
            downloadFrom,
            actionContextAt,
            openSearch,
            closeSearch,
            openPath,
            followPath,
            showShortcuts,
            runUndo,
        };
    });

    // What the properties show: what `ActionContext.properties` asked for, while its sections are
    // as they were, or else a search everywhere's selection while its results show, or the content's
    // selection, or with nothing selected, the open folder itself.
    const propertiesSubject = useMemo((): PropertiesSubject => {
        if (pinned && subjectHolds(pinned, sectionsById)) {
            return pinned;
        }

        if (showsResults) {
            return resultSelection.length > 0
                ? {
                      kind: "entries",
                      inResults: true,
                      entries: resultSelection.map(({ entry, section: shown, trail }) => ({
                          entry,
                          section: shown,
                          trail,
                      })),
                  }
                : NO_SUBJECT;
        }

        if (!section) {
            return NO_SUBJECT;
        }

        if (shownSelection.key === openKey && shownSelection.entries.length > 0) {
            return {
                kind: "entries",
                inResults: false,
                entries: shownSelection.entries.map((entry) => ({ entry, section, trail: place.trail })),
            };
        }

        return { kind: "folder", section, trail: place.trail };
    }, [pinned, sectionsById, showsResults, resultSelection, section, shownSelection, openKey, place.trail]);

    useImperativeHandle(
        apiRef,
        (): FileManagerApi => ({
            navigate: (target) => api.current.goTo(target),
            back: () => api.current.goBack(),
            forward: () => api.current.goForward(),
            refresh: (folderIds, options) => api.current.refresh(folderIds, options),
            reveal: (entryId, target) => api.current.revealEntry(entryId, target),
            download: (entries, target) => api.current.downloadFrom(entries, target),
            actionContext: (entries, target) => api.current.actionContextAt(entries, target),
            search: (scope, typed) => api.current.openSearch(scope, typed),
            closeSearch: () => api.current.closeSearch(),
            editPath: () => api.current.openPath(),
            goToPath: (typed) => api.current.followPath(typed, mounted.current?.signal ?? new AbortController().signal),
            focus: () => setFocusContent(true),
            showShortcuts: () => api.current.showShortcuts(),
            undo: () => api.current.runUndo("undo"),
            redo: () => api.current.runUndo("redo"),
        }),
        [],
    );

    return (
        <LocaleContext value={localeValue}>
            <RootProviders direction={direction}>
                <DataContext value={data}>
                    <CutContext value={cut}>
                        <MovingContext value={moving}>
                            <DragContext value={drag.context}>
                                {/* The consumer's handlers run first, so one can take an event before the
                                    file manager does, e.g. a key press, by calling `preventDefault`. */}
                                {/* Focusable but not tabbable, so a press on its empty space, such as the
                                    header's, keeps the focus in here rather than dropping it to the page,
                                    where the keys handled below would never come. */}
                                <div
                                    tabIndex={-1}
                                    {...rootAttributes}
                                    ref={rootElementRef}
                                    className={cx(theme.theme, theme.root, styles.root, fmClasses.fileManager, className)}
                                    onPointerDownCapture={(event) => {
                                        onPointerDownCapture?.(event);
                                        drag.onPointerDownCapture(event);
                                    }}
                                    onDragEnter={(event) => {
                                        onDragEnter?.(event);
                                        refuseFiles(event);
                                    }}
                                    onDragOver={(event) => {
                                        onDragOver?.(event);
                                        refuseFiles(event);
                                    }}
                                    onDragLeave={(event) => {
                                        onDragLeave?.(event);

                                        // Files dragged in from outside that leave the file manager
                                        // take the sidebar shown for them away.
                                        if (
                                            carriesFiles(event) &&
                                            !(
                                                event.relatedTarget instanceof Node &&
                                                event.currentTarget.contains(event.relatedTarget)
                                            )
                                        ) {
                                            endSidebarForDrag();
                                        }
                                    }}
                                    onDrop={(event) => {
                                        onDrop?.(event);
                                        refuseFiles(event);
                                        drag.end();
                                        endSidebarForDrag();
                                    }}
                                    onDragEnd={(event) => {
                                        onDragEnd?.(event);
                                        drag.end();
                                    }}
                                    onKeyDown={(event) => {
                                        onKeyDown?.(event);
                                        handleKeyDown(event);
                                    }}
                                >
                                    <div className={styles.frame} data-sidebar-hidden={sidebarHidden}>
                                        <Backdrop
                                            open={sidebarOpen}
                                            className={styles.backdrop}
                                            style={dragging || sidebarForDrag ? PASS_THROUGH : undefined}
                                            onClick={closeSidebar}
                                        />
                                        <Backdrop
                                            open={propertiesOverlay}
                                            className={styles.propertiesBackdrop}
                                            onClick={closePropertiesOverlay}
                                        />
                                        <Sidebar
                                            ref={sidebarRef}
                                            title={title ?? localeValue.text.sidebarTitle}
                                            groups={sections}
                                            single={singleSection}
                                            expanded={expanded}
                                            showHidden={showHidden}
                                            openKey={openKey}
                                            reveal={treeReveal}
                                            open={sidebarOpen}
                                            hidden={sidebarHidden}
                                            peek={sidebarForDrag === "peek"}
                                            width={sidebarWidth}
                                            defaultWidth={defaultSidebarWidth}
                                            widest={widestSidebar}
                                            onWidthChange={setSidebarWidth}
                                            searchScope={searchScope}
                                            canSearchEverywhere={canSearchEverywhere}
                                            onToggle={toggleExpanded}
                                            onRevealed={clearTreeReveal}
                                            onExpand={expand}
                                            onNavigate={navigateFromSidebar}
                                            hasActions={hasActions}
                                            onOpenMenu={openMenu}
                                            onShortcut={runShortcut}
                                            onPasteFiles={pasteFiles}
                                            onClose={closeSidebar}
                                            onSearchEverywhere={searchEverywhere}
                                            mainMenu={mainMenu}
                                            undoItems={undoItems}
                                            onShowShortcuts={showShortcuts}
                                        />
                                        <div className={styles.main} data-properties-shown={propertiesOpen}>
                                            <HeaderBar
                                                pathBar={
                                                    section && searchScope ? (
                                                        <SearchField
                                                            scope={searchScope}
                                                            query={query}
                                                            folderName={folderOf(section, place.trail).name}
                                                            groups={searchGroups}
                                                            excluded={excludedSections}
                                                            inputRef={searchInputRef}
                                                            onQueryChange={changeQuery}
                                                            onExcludedChange={setSearchExcluded}
                                                            onClose={closeSearch}
                                                            onDismiss={stopSearching}
                                                            onFocusContent={focusFromSearch}
                                                        />
                                                    ) : section && pathEditing ? (
                                                        <PathField
                                                            initial={pathOf(section, place.trail)}
                                                            inputRef={pathInputRef}
                                                            onGo={submitPath}
                                                            onClose={closePath}
                                                            onDismiss={dismissPath}
                                                        />
                                                    ) : section ? (
                                                        <PathBar
                                                            section={section}
                                                            trail={place.trail}
                                                            hasActions={hasActions}
                                                            onNavigate={goTo}
                                                            onOpenMenu={openMenu}
                                                            onEdit={openPath}
                                                        />
                                                    ) : (
                                                        <span />
                                                    )
                                                }
                                                canGoBack={canGoBack}
                                                canGoForward={canGoForward}
                                                hasFolder={!!section}
                                                view={view}
                                                zoom={zoom}
                                                sort={sort}
                                                resultsShown={showsResults}
                                                trashShown={!!trashOpen && !showsResults}
                                                showHidden={showHidden}
                                                selecting={selecting}
                                                searchScope={searchScope}
                                                canSearchEverywhere={canSearchEverywhere}
                                                sidebarHidden={sidebarHidden}
                                                sidebarDocked={sidebarDocked}
                                                propertiesOpen={propertiesOpen}
                                                propertiesDocked={propertiesDocked}
                                                onBack={goBack}
                                                onForward={goForward}
                                                historyStops={historyStops}
                                                onGoInHistory={goInHistoryBy}
                                                onToggleView={toggleView}
                                                onZoom={zoomContent}
                                                onSortChange={setSort}
                                                onToggleHidden={toggleHidden}
                                                onToggleSelecting={toggleSelecting}
                                                onSearch={toggleSearch}
                                                onShowSidebar={showSidebar}
                                                onDragShowSidebar={showSidebarForDrag}
                                                onToggleSidebar={toggleDocked}
                                                onToggleProperties={toggleDockedProperties}
                                                onOpenProperties={openPropertiesOverlay}
                                                sidebarButtonRef={sidebarButtonRef}
                                            />
                                            <div className={styles.body}>
                                                <div ref={columnRef} className={styles.column}>
                                                    <div ref={panelRef} className={cx(styles.panel, fmClasses.content)}>
                                                        {/* A search everywhere's results show in the folder's place
                                                            while something is typed. The folder stays mounted
                                                            under them, hidden, so it comes back as it was, its
                                                            selection included. */}
                                                        {showsResults && (
                                                            <SearchResults
                                                                targets={searchedTargets}
                                                                query={searchedFor}
                                                                version={searchVersion}
                                                                delay={searchDelay}
                                                                view={view}
                                                                zoom={zoom[view]}
                                                                sort={sort}
                                                                showHidden={showHidden}
                                                                hasActions={hasActions}
                                                                takeFocus={focusContent}
                                                                onSortChange={setSort}
                                                                onNavigate={goTo}
                                                                onOpenFile={openFile}
                                                                onOpenMenu={openMenu}
                                                                onShortcut={runShortcut}
                                                                onSelectionChange={handleResultSelection}
                                                            />
                                                        )}
                                                        {trashOpen && !showsResults && (
                                                            <TrashBar
                                                                section={trashOpen}
                                                                onEmpty={emptyTrashOf(trashOpen)}
                                                            />
                                                        )}
                                                        {/* Keyed by folder, so each opens at the top with nothing
                                                            selected. */}
                                                        <div
                                                            key={openKey ?? undefined}
                                                            className={styles.view}
                                                            hidden={showsResults}
                                                        >
                                                            {!section && <NoSections />}
                                                            {section && (
                                                                <FolderView
                                                                    section={section}
                                                                    trail={place.trail}
                                                                    view={view}
                                                                    zoom={zoom[view]}
                                                                    sort={folderSort(sort, !!trashOpen)}
                                                                    showHidden={showHidden}
                                                                    query={searchScope === "folder" ? query : ""}
                                                                    hasActions={hasActions}
                                                                    selecting={selecting}
                                                                    busy={busy}
                                                                    takeFocus={focusContent && !showsResults}
                                                                    revealId={revealId}
                                                                    revealWith={revealWith}
                                                                    arrivals={arrivals}
                                                                    selectedIds={
                                                                        selectionControlled ? selectedIdSet : undefined
                                                                    }
                                                                    defaultSelectedIds={
                                                                        initialSelection?.key === openKey
                                                                            ? initialSelection.ids
                                                                            : undefined
                                                                    }
                                                                    onSelectionChange={handleSelectionChange}
                                                                    onSelectingChange={setSelecting}
                                                                    onSortChange={setSort}
                                                                    onNavigate={goTo}
                                                                    onOpenFile={openFile}
                                                                    onOpenMenu={openMenu}
                                                                    onShortcut={runShortcut}
                                                                    onPasteFiles={pasteFiles}
                                                                    onRevealed={handleRevealed}
                                                                    onRevealUnmatched={closeSearch}
                                                                    onArrived={handleArrived}
                                                                    trashLocation={trashOpen ? locateTrashed : undefined}
                                                                />
                                                            )}
                                                        </div>
                                                        <NoticeBar
                                                            notice={shownNotice}
                                                            actionLabel={noticeAction}
                                                            showLabel={noticeShow}
                                                            showPlaces={noticePlaces}
                                                            onShow={handleNoticeShow}
                                                            raised={selecting && !showsResults}
                                                            onAction={handleNoticeAction}
                                                            onClose={closeNotice}
                                                            onFocusLost={focusFromNotice}
                                                        />
                                                    </div>
                                                    {shownTransfers.length > 0 && (
                                                        <div className={styles.taskPanel}>
                                                            <TransferPanel
                                                                items={shownTransfers}
                                                                onCancel={transfers.queue.cancel}
                                                                onRetry={retryTransfer}
                                                                canRetry={canRetryTransfer}
                                                                onCancelAll={transfers.queue.cancelAll}
                                                                onClear={clearTransfers}
                                                            />
                                                        </div>
                                                    )}
                                                    {shownDownloads.length > 0 && (
                                                        <div className={styles.taskPanel}>
                                                            <DownloadPanel
                                                                items={shownDownloads}
                                                                onCancel={downloads.queue.cancel}
                                                                onRetry={downloads.queue.retry}
                                                                onSave={downloads.queue.save}
                                                                onCancelAll={downloads.queue.cancelAll}
                                                                onClear={downloads.queue.clear}
                                                            />
                                                        </div>
                                                    )}
                                                    {uploads.items.length > 0 && (
                                                        <div className={styles.taskPanel}>
                                                            <UploadPanel
                                                                items={uploads.items}
                                                                onCancel={uploads.queue.cancel}
                                                                onRetry={uploads.queue.retry}
                                                                onShow={showUpload}
                                                                canShow={canShowUpload}
                                                                onCancelAll={uploads.queue.cancelAll}
                                                                onClear={clearUploads}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                <PropertiesPane
                                                    ref={paneRef}
                                                    subject={propertiesSubject}
                                                    shown={propertiesOpen}
                                                    open={propertiesOverlay}
                                                    width={propertiesWidth}
                                                    defaultWidth={defaultPropertiesWidth}
                                                    onWidthChange={setPropertiesWidth}
                                                    changes={searchVersion}
                                                    showHidden={showHidden}
                                                    cache={propertiesCache}
                                                    takeFocus={focusProperties}
                                                    actions={propertiesActions}
                                                    contextFor={contextFor}
                                                    locateTrashed={locateIn}
                                                    relist={relist}
                                                    onClose={closeProperties}
                                                    onEscape={handlePropertiesEscape}
                                                    onFocusOut={handlePropertiesFocusOut}
                                                    onDockedChange={handlePropertiesDocking}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <Announcer announcement={announcement?.region === "root" ? announcement : null} />
                                    <ContextMenu menu={menu} onClose={closeMenu} />
                                    {naming && (
                                        <NameDialog
                                            key={`name:${naming.id}`}
                                            open={naming.open}
                                            request={naming.request}
                                            onClose={closeNaming}
                                            onChanged={relist}
                                            onDone={handleNamed}
                                        />
                                    )}
                                    {transfer && (
                                        <TransferDialog
                                            key={`transfer:${transfer.id}`}
                                            open={transfer.open}
                                            request={transfer.request}
                                            showHidden={showHidden}
                                            onClose={closeTransfer}
                                            onChanged={relist}
                                            onStart={handleTransferStart}
                                            onFolderCreated={handleFolderCreated}
                                        />
                                    )}
                                    {deleting && (
                                        <DeleteDialog
                                            key={`delete:${deleting.id}`}
                                            open={deleting.open}
                                            request={deleting.request}
                                            onClose={handleDeleteClose}
                                            onChanged={relist}
                                            onDone={handleDeleted}
                                        />
                                    )}
                                    {restoring && (
                                        <RestoreDialog
                                            key={`restore:${restoring.id}`}
                                            open={restoring.open}
                                            request={restoring.request}
                                            onClose={closeRestore}
                                            onStart={handleRestoreStart}
                                        />
                                    )}
                                    {pasting && (
                                        <PasteDialog
                                            key={`paste:${pasting.id}`}
                                            open={pasting.open}
                                            request={pasting.request}
                                            onClose={closePaste}
                                            onStart={handlePasteStart}
                                        />
                                    )}
                                    {uploadCheck && (
                                        <UploadDialog
                                            key={`upload:${uploadCheck.id}`}
                                            open={uploadCheck.open}
                                            request={uploadCheck.request}
                                            onClose={closeUploadCheck}
                                            onUpload={startUpload}
                                        />
                                    )}
                                    {previewing && (
                                        <PreviewDialog
                                            key={`preview:${previewing.id}`}
                                            open={previewing.open}
                                            request={previewing.request}
                                            disableRestoreFocus={previewing.fromContent}
                                            previewers={previewers}
                                            actionsFor={previewActionsFor}
                                            announcement={announcement?.region === "preview" ? announcement : null}
                                            onClose={closePreview}
                                            onClosed={handlePreviewClosed}
                                            onStep={handlePreviewStep}
                                            onDownload={handlePreviewDownload}
                                        />
                                    )}
                                    <ShortcutsDialog
                                        open={shortcutsOpen}
                                        actions={actions}
                                        previewActions={previewActions}
                                        propertiesActions={propertiesActions}
                                        mainMenu={mainMenu}
                                        canSearchEverywhere={canSearchEverywhere}
                                        choosesSections={searchTargets.length > 1}
                                        canPreview={canPreview}
                                        canUpload={canUpload}
                                        canEditProperties={canEditProperties}
                                        canUndo={canUndo}
                                        onClose={closeShortcuts}
                                        onClosed={handleShortcutsClosed}
                                    />
                                    <input
                                        ref={pickerRef}
                                        type="file"
                                        multiple
                                        style={pickerStyle}
                                        onChange={handlePicked}
                                    />
                                    {drag.preview &&
                                        createPortal(
                                            <DragPreview
                                                ref={drag.previewRef}
                                                entry={drag.preview.entry}
                                                count={drag.preview.count}
                                                touch={drag.preview.touch}
                                                effect={drag.effect}
                                            />,
                                            document.body,
                                        )}
                                </div>
                            </DragContext>
                        </MovingContext>
                    </CutContext>
                </DataContext>
            </RootProviders>
        </LocaleContext>
    );
};

export default FileManager;
