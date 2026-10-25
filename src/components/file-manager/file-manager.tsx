import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ComponentPropsWithoutRef, CSSProperties, DragEvent, KeyboardEvent, Ref } from "react";
import { createPortal, flushSync } from "react-dom";

import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { useControlled, useForkRef } from "@mui/material/utils";

import { CutContext } from "../../contexts/cut-context";
import { DataContext } from "../../contexts/data-context";
import { DirectionContext } from "../../contexts/direction-context";
import { DragContext } from "../../contexts/drag-context";
import { LocaleContext } from "../../contexts/locale-context";
import { MovingContext } from "../../contexts/moving-context";
import { useAnnouncer } from "../../hooks/use-announcer";
import { useClipboardFollow } from "../../hooks/use-clipboard-follow";
import { carriesFiles } from "../../hooks/use-drop-target";
import { useDownloadQueue } from "../../hooks/use-download-queue";
import { useEntryDrag } from "../../hooks/use-entry-drag";
import { useLocaleValue } from "../../hooks/use-locale";
import { useLocationHistory } from "../../hooks/use-location-history";
import type { ReviseLocation } from "../../hooks/use-location-history";
import { useSetting } from "../../hooks/use-setting";
import { useStableSet } from "../../hooks/use-stable-set";
import { useTextDirection } from "../../hooks/use-text-direction";
import { useTransferQueue } from "../../hooks/use-transfer-queue";
import { useUploadQueue } from "../../hooks/use-upload-queue";
import { useWheelZoom } from "../../hooks/use-wheel-zoom";
import { createFolderStore, folderKey, keyFolder } from "../../store/folder-store";
import { createPropertiesCache } from "../../store/properties-cache";
import { createThumbnailCache } from "../../store/thumbnail-cache";
import { ROOT_CONTAINER, VIEW_CONTAINER, rootExtraWide, rootWide } from "../../styles/layout";
import { withSx } from "../../styles/sx";
import { toolbarGroups, visibleActionGroups } from "../../utils/action-groups";
import { isolate } from "../../utils/bidi";
import { canPaste, withRenamed, withoutEntries } from "../../utils/clipboard";
import { canDownload, downloadedEntries } from "../../utils/download";
import {
    acceptsFile,
    filesIn,
    mayAccept,
    pickedFolder,
    picksFolders,
    takesUploads,
    uploadPatterns,
} from "../../utils/files";
import { isHidden } from "../../utils/hidden";
import { folderLeft, folderOf, outsideDeleted, renameInPlace, samePlace } from "../../utils/navigation";
import { allows, entriesAllow, entriesMoving, folderMoving, folderWritable } from "../../utils/permissions";
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
    zoomStep,
} from "../../utils/shortcut";
import { previewable } from "../../utils/preview";
import { DEFAULT_SORT, entryComparator, sameSort } from "../../utils/sort";
import { isMoving, movingIds, movingThrough } from "../../utils/transfer";
import { DEFAULT_ZOOM, canZoom, sameZoom, zoomScale, zoomedBy } from "../../utils/zoom";
import DownloadPanel from "../downloads/download-panel";
import TransferPanel from "../transfers/transfer-panel";
import UploadPanel from "../uploads/upload-panel";
import Announcer from "./announcer";
import FolderView from "./content/folder-view";
import NoSections from "./content/no-sections";
import SearchResults from "./content/search-results";
import ContextMenu from "./context-menu/context-menu";
import DeleteDialog from "./dialogs/delete-dialog";
import NameDialog from "./dialogs/name-dialog";
import PasteDialog from "./dialogs/paste-dialog";
import PreviewDialog from "./dialogs/preview-dialog";
import ShortcutsDialog from "./dialogs/shortcuts-dialog";
import TransferDialog from "./dialogs/transfer-dialog";
import UploadDialog from "./dialogs/upload-dialog";
import DragPreview from "./drag-preview";
import HeaderBar from "./header-bar/header-bar";
import PathBar from "./header-bar/path-bar";
import SearchField from "./header-bar/search-field";
import PropertiesPane from "./properties-pane";
import Sidebar from "./sidebar/sidebar";

import type {
    ActionContext,
    ActionGroup,
    Arrival,
    Clipboard,
    ConflictPolicy,
    DraggedEntries,
    DroppedFiles,
    DropInto,
    DropTarget,
    FileAdapter,
    FileEntry,
    FileManagerApi,
    FileManagerLocaleText,
    FileManagerLocation,
    FileManagerSearch,
    FilePreviewer,
    FolderRef,
    FolderUpload,
    LocationChangeReason,
    MainMenuGroup,
    MenuRequest,
    OpenMenu,
    RefreshOptions,
    PasteFiles,
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
    TreeReveal,
    UploadItem,
    ViewMode,
    ViewZoom,
    ZoomStep,
} from "../../types";
import type { TransferOutcome } from "../../store/transfer-queue";
import type { MenuState } from "./context-menu/context-menu";
import type { DeleteDialogState, DeleteRequest } from "./dialogs/delete-dialog";
import type { NameDialogState, NameRequest } from "./dialogs/name-dialog";
import type { PasteDialogState, PasteRequest } from "./dialogs/paste-dialog";
import type { PreviewDialogState, PreviewRequest } from "./dialogs/preview-dialog";
import type { TransferDialogState, TransferRequest } from "./dialogs/transfer-dialog";
import type { UploadDialogState, UploadRequest } from "./dialogs/upload-dialog";

// The root element's own attributes, which go on it as they do on a MUI component's root, so an
// `id`, an `aria-label`, a `data-` attribute or a handler can be set there. `title` is the sidebar's.
type RootAttributes = Omit<ComponentPropsWithoutRef<"div">, "title" | "children">;

/*
 * The location, the view settings, the tree's expanded folders, the search and the selection below
 * can each be controlled, as MUI's props are: pass the value and change it in its `on…Change`
 * callback, or leave it to the file manager, starting from its `default…` prop. Which one is decided on
 * mounting, and MUI warns in development about switching later. Controlled, the user's changes are
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
    /** The order at first, when the file manager keeps it; name, A to Z, when omitted. */
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
    sx?: SxProps<Theme>;
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

/** What's done as a copy or move in the transfer queue ends. */
type TransferEnded = (item: TransferItem, outcome: TransferOutcome, items: TransferItem[]) => void;

/** What a copy or move in the transfer queue is of, and where it goes, for when it ends. */
interface TransferPlace {
    /**
     * The entries, where they are and where they go, as a paste: the entries cut for a move. The
     * trails are rewritten with the history's, to try it again where they are now.
     */
    request: PasteRequest;
    /** The names of the entries the user chose to skip, as the folder had them. */
    skipped: string[];
    /** The folders a Replace or Merge merges others into, listed again all the way down as it ends. */
    merged: string[];
    /** Whether it can be tried again: false once a folder in either trail has gone (see `revise`). */
    retriable: boolean;
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

const folderIdsOf = (entries: FileEntry[]) =>
    entries.filter((entry) => entry.kind === "folder").map((entry) => entry.id);

const sameKeys = (a: readonly SearchHit[], b: readonly SearchHit[]) =>
    a.length === b.length && a.every((hit, index) => hit.key === b[index].key);

/** What a menu was opened on, for the properties: its entries, or with none, its folder itself. */
const subjectOf = ({ section, trail, entries, inResults }: MenuRequest): PropertiesSubject =>
    entries.length > 0
        ? { kind: "entries", inResults: !!inResults, entries: entries.map((entry) => ({ entry, section, trail })) }
        : { kind: "folder", section, trail };

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

// The root only establishes the container; a container can't match its own queries, so the
// visible frame is the child below it. The consumer's `sx` goes over it.
const rootSx = {
    containerType: "inline-size",
    containerName: ROOT_CONTAINER,
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    // It takes the focus only from a press on nothing focusable, never by Tab.
    outline: "none",
    // While a touch or pen presses, the browser drags nothing by itself, as some do on a long-press,
    // so the file manager's own touch drag is the only one (`useEntryDrag`).
    '&[data-touch-press] [draggable="true"]': { WebkitUserDrag: "none" },
} satisfies SxProps<Theme>;

const frameSx: SxProps<Theme> = {
    display: "flex",
    height: "100%",
    bgcolor: "background.default",
    color: "text.primary",
};

const backdropSx: SxProps<Theme> = {
    position: "absolute",
    zIndex: 1,
    [rootWide]: { display: "none" },
};

// Behind the properties' overlay, which docks from `rootExtraWide`.
const propertiesBackdropSx: SxProps<Theme> = {
    position: "absolute",
    zIndex: 1,
    [rootExtraWide]: { display: "none" },
};

const mainSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
};

// Under the header bar: the content with the panels under it, and the docked properties beside
// them. Not positioned, so the properties' overlay covers the file manager from top to bottom, as
// the sidebar's does.
const bodySx: SxProps<Theme> = {
    display: "flex",
    flex: 1,
    minHeight: 0,
};

const columnSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
};

// Docked, the sidebar takes the panels' margin on its side, the start; hidden, they take it back.
const besideSidebar = {
    [rootWide]: {
        marginInlineStart: 0,
        '[data-sidebar-hidden="true"] &': { marginInlineStart: 0.75 },
    },
};

// The content sits as an inset, rounded panel on the window background, as in GNOME Files. The
// panel itself doesn't scroll, so the outline it shows while the open folder would take a drop
// stays put over the content scrolling under it, sticky column header included.
const panelSx: SxProps<Theme> = {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    marginInline: 0.75,
    mb: 0.75,
    borderRadius: 3,
    overflow: "hidden",
    bgcolor: "background.paper",
    ...besideSidebar,
    // The folder view marks itself, inside the scrolling view, with `data-drop-target`.
    '&:has(> * > [data-drop-target="true"])::after': {
        content: '""',
        position: "absolute",
        inset: 0,
        border: "2px solid",
        borderColor: "primary.main",
        borderRadius: "inherit",
        pointerEvents: "none",
    },
};

const viewSx: SxProps<Theme> = {
    containerType: "inline-size",
    containerName: VIEW_CONTAINER,
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
};

// The transfer, download and upload panels are further inset panels under the content, so they
// never cover the files.
const taskPanelSx: SxProps<Theme> = {
    marginInline: 0.75,
    mb: 0.75,
    ...besideSidebar,
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
    defaultSort = DEFAULT_SORT,
    onSortChange,
    showHidden: showHiddenProp,
    defaultShowHidden = false,
    onShowHiddenChange,
    sidebarHidden: sidebarHiddenProp,
    defaultSidebarHidden = false,
    onSidebarHiddenChange,
    propertiesOpen: propertiesOpenProp,
    defaultPropertiesOpen = false,
    onPropertiesOpenChange,
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
    sx,
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

    // The location and the selection are kept by their own hooks, which can't use MUI's
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
        canGoBack,
        canGoForward,
        navigate,
        back,
        forward,
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
                const from = followed({ sectionId: clipboard.section.id, trail: clipboard.trail });
                const to = followed({ sectionId: target.id, trail });

                if (from && to) {
                    transfer.request = {
                        clipboard: { ...clipboard, trail: from.trail },
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
    // Whether the docked properties show, with Alt+Enter or the view menu. Collapsed, they show as an
    // overlay instead, while `propertiesOverlay`.
    const [propertiesOpen, setPropertiesOpen] = useSetting({
        name: "propertiesOpen",
        value: propertiesOpenProp,
        defaultValue: defaultPropertiesOpen,
        onChange: onPropertiesOpenChange,
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
    // A folder just created, which the sidebar tree scrolls to once it shows its row.
    const [treeReveal, setTreeReveal] = useState<TreeReveal | null>(null);
    // Copies and moves run in the background while the user browses, a few at once, and the panel
    // shows those that take a moment or failed. What one ending does needs much made further down
    // (`handleTransferEnded`), which it's handed once that's made.
    const transferEnded = useRef<TransferEnded | null>(null);
    const transfers = useTransferQueue((item, outcome, items) => transferEnded.current?.(item, outcome, items));
    const shownTransfers = useMemo(() => transfers.items.filter((item) => item.shown), [transfers.items]);
    // The entries moves under way are moving, which are marked and left alone until they end. Made
    // afresh only as moves start and end, not with every bit of progress.
    const movesKey = transfers.items
        .filter(isMoving)
        .map((item) => item.id)
        .join(" ");
    const moving = useMemo(() => movingIds(transfers.items), [movesKey]);
    // The browser's file picker, and where the files picked with it go.
    const pickerRef = useRef<HTMLInputElement>(null);
    const pickedInto = useRef<((dropped: DroppedFiles) => void) | null>(null);
    // The folder in which touch selection mode is on, so opening another folder turns it off.
    const [selectingKey, setSelectingKey] = useState<string | null>(null);
    const selecting = openKey !== null && selectingKey === openKey;
    const rootRef = useRef<HTMLDivElement>(null);
    const rootElementRef = useForkRef(rootRef, ref);
    const rootStyle = useMemo(() => withSx(rootSx, sx), [sx]);
    // Handed to what portals out of the file manager, so it runs the same way (`DirectionContext`).
    const direction = useTextDirection(rootRef);
    const panelRef = useRef<HTMLDivElement>(null);
    const paneRef = useRef<HTMLDivElement>(null);
    // What had the focus when the properties' overlay opened, which gets it back as the overlay closes.
    const propertiesOpener = useRef<HTMLElement | null>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);
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
    // search everywhere.
    const searchTargets = useMemo(
        () =>
            sections.flatMap((group) =>
                group.sections.flatMap((shown): SearchTarget[] => {
                    const served = shown.adapter ?? adapter;

                    return served.search ? [{ section: shown, adapter: served }] : [];
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
    // what shows them, and a clipboard of entries no section's adapter serves can't be pasted any more.
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

        setClipboard((prev) => (prev && !adapters.has(prev.adapter) ? null : prev));
    }, [sectionsById, adapter, store, revise]);

    const hasActions = useMemo(() => actions.some((group) => group.actions.length > 0), [actions]);

    // Entries on the clipboard that a change may have reached are looked for again.
    useClipboardFollow(clipboard, setClipboard, store);

    // Cut entries being found again by name aren't marked, as their ids may name others meanwhile.
    const cut = useMemo(
        () =>
            clipboard?.kind === "cut" && clipboard.lookup?.by !== "name"
                ? { adapter: clipboard.adapter, ids: new Set(clipboard.entries.map((entry) => entry.id)) }
                : null,
        [clipboard],
    );

    // Folders a paste being checked changes, whose view shows a progress bar meanwhile (`busy`), in
    // any section showing them: the one it goes into, the one listing that folder (where it was
    // dropped onto, or pasted into from its menu), and, for a move, the one the entries leave.
    const pasteIds = useMemo(() => {
        if (!pasting?.open) {
            return null;
        }

        const { clipboard: pasted, section: target, trail } = pasting.request;
        const ids = new Set([folderOf(target, trail).id, folderOf(target, trail.slice(0, -1)).id]);

        if (pasted.kind === "cut") {
            ids.add(folderOf(pasted.section, pasted.trail).id);
        }

        return { adapter: pasted.adapter, ids };
    }, [pasting]);

    // A reveal may be waiting for its folder to open.
    const revealId = reveal?.key === openKey ? reveal.id : undefined;

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

            if (!searchScope) {
                searchOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            }

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
        [section, canSearchEverywhere, searchScope, setSearch],
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
    // Ctrl+F, Ctrl+Shift+F, Alt+Enter, and Alt+Left and Alt+Right for back and forward, the other
    // way round right to left, as the arrows on the buttons are.
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
    const shownDownloads = useMemo(() => downloads.items.filter((item) => item.shown), [downloads.items]);

    const askDownload = useCallback(
        (served: FileAdapter, entries: FileEntry[], folder: FolderRef) =>
            downloads.queue.add(served, entries, folder.name, showHidden),
        [downloads.queue, showHidden],
    );

    // The preview's Download button saves the file shown.
    const handlePreviewDownload = useCallback(
        ({ section: shown, adapter: served, trail }: PreviewRequest, entry: FileEntry) =>
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
                if (!prev || prev.request.adapter !== served) {
                    return prev;
                }

                const entries = prev.request.entries.flatMap((entry) => {
                    const now = change(entry);

                    return now ? [now] : [];
                });

                return entries.length === prev.request.entries.length &&
                    entries.every((entry, index) => entry === prev.request.entries[index])
                    ? prev
                    : { ...prev, request: { ...prev.request, entries } };
            }),
        [],
    );

    // A single file steps through its folder, and the content's selection follows the file shown,
    // as it does in GNOME's and macOS's previewers.
    const handlePreviewStep = useCallback(
        ({ section: shown, trail, follow }: PreviewRequest, entry: FileEntry) => {
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

    // A drop is pasted like the clipboard, with the dragged entries as a clipboard of their own, so
    // the real one is left as it was.
    const dropInto = useCallback<DropInto>(
        (dragged, copy, target, trail) => offerPaste({ ...dragged, kind: copy ? "copy" : "cut" }, target, trail),
        [offerPaste],
    );

    // Dragged entries that can't be moved out of their folder are copied, as a paste of them cut
    // couldn't go anywhere (`canPaste`).
    const movable = useCallback(
        (dragged: DraggedEntries) =>
            !!dragged.adapter.move &&
            entriesAllow(
                store,
                dragged.section,
                dragged.trail,
                dragged.entries,
                "move",
                movingThrough(moving, dragged.adapter),
            ),
        [store, moving],
    );

    // Entries a move under way is moving aren't dragged, as they can't be pasted anywhere either.
    const heldUp = useCallback(
        (dragged: DraggedEntries) =>
            entriesMoving(dragged.section, dragged.trail, dragged.entries, movingThrough(moving, dragged.adapter)),
        [moving],
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
                (clipboard.lookup
                    ? clipboard.adapter === served
                    : canPaste(clipboard, served, target, trail, store, moving));
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

    const drag = useEntryDrag(adapter, dropInto, uploadInto, movable, heldUp, rootRef);
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
    // A file never takes a folder's place, so with Replace, one whose name a folder has is kept
    // beside it. A file kept beside one of its name may be given another, which only the adapter knows.
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
            const folderNames = new Set(listed.filter((entry) => entry.kind === "folder").map((entry) => entry.name));
            const kept = conflict === "replace" ? files.filter((file) => folderNames.has(file.name)) : [];
            const taken = new Set(conflict === "keepBoth" ? listed.map((entry) => entry.name) : folderNames);
            const queueFiles = (queued: File[], policy: ConflictPolicy) =>
                uploads.queue.add(served, into, queued, policy).forEach((id, index) => {
                    const { name } = queued[index];

                    uploadPlaces.current.set(id, { location, name: taken.has(name) ? undefined : name });
                });

            closeUploadCheck();
            uploads.queue.addFolders(served, into, folders, conflict, accepts).forEach((id, index) => {
                uploadPlaces.current.set(id, { location, name: folders[index].name });
            });
            queueFiles(files.filter((file) => !kept.includes(file)), conflict);
            queueFiles(kept, "keepBoth");
        },
        [closeUploadCheck, uploads.queue, store],
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

            setClipboard(
                (prev) => prev && withoutEntries(prev, fromAdapter, movedIds, dropped, mayBeBelow(prev.section.id)),
            );
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

    // A folder made in the transfer picker may take an id that named another folder before, as one
    // made from the menu may (`handleNamed`). The picker opens it itself.
    const handleFolderCreated = useCallback(
        (served: FileAdapter, entry: FileEntry, parentId: string) => {
            dropFolders(served, [entry.id], []);
            revealInTree(served, parentId, entry);
        },
        [dropFolders, revealInTree],
    );

    // Says what a copy or move did, leaving out the entries skipped for names the folder had.
    const announceTransfer = useCallback(
        (kind: TransferRequest["kind"], entries: FileEntry[], skipped: readonly string[], folder: FolderRef) => {
            const skippedNames = new Set(skipped);
            const done = entries.filter((entry) => !skippedNames.has(entry.name));

            if (done.length > 0) {
                announce(
                    (kind === "copy" ? localeValue.text.copyDone : localeValue.text.moveDone)(
                        done.length,
                        isolate(done[0].name),
                        isolate(folder.name),
                    ),
                );
            }
        },
        [announce, localeValue],
    );

    // As a copy or move ends, what it may have changed is listed again, however it ended, since the
    // adapter can't undo what it has done: the destination, the source after a move, and after a
    // Replace or Merge, the folders merged into, all the way down. Once it's done, moved entries leave
    // the cache, the clipboard and the preview (`handleMoved`), and it's announced. A failure stays in
    // the panel to be tried again, and is announced unless the panel was showing already, since a
    // panel just shown isn't read out, while its title is once it shows.
    const handleTransferEnded = useCallback(
        (item: TransferItem, outcome: TransferOutcome, items: TransferItem[]) => {
            const transfer = transferPlaces.current.get(item.id);
            const { kind, adapter: served, entries, source, target } = item;

            if (outcome !== "failed") {
                transferPlaces.current.delete(item.id);
            }

            // Cancelled while it waited, it never reached the adapter.
            if (outcome === "cancelled" && item.status === "queued") {
                return;
            }

            relistTransferred(
                served,
                kind === "move" ? [target.id, source.id] : [target.id],
                item.conflict === "replace" ? transfer?.merged : undefined,
            );

            if (outcome === "done") {
                if (kind === "move" && transfer) {
                    const { section: into, trail } = transfer.request;

                    handleMoved(served, entries, { sectionId: into.id, trail });
                }

                announceTransfer(kind, entries, transfer?.skipped ?? [], target);
            } else if (outcome === "failed" && !items.some((other) => other.shown && other.id !== item.id)) {
                announce(
                    (kind === "copy" ? localeValue.text.copyFailedNotice : localeValue.text.moveFailedNotice)(
                        entries.length,
                        isolate(entries[0].name),
                        isolate(target.name),
                    ),
                );
            }
        },
        [relistTransferred, handleMoved, announceTransfer, announce, localeValue],
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

    // A copy or move asked for, by the picker, a paste or a drop, once its names are settled. A cut
    // leaves the clipboard as its paste starts, so it isn't pasted twice while it runs; a copy can be
    // pasted again. One that fails is tried again from the panel, and goes from it as the new one
    // starts.
    const startTransfer = useCallback(
        (request: PasteRequest, conflict: ConflictPolicy, skipped: string[], merged: string[]) => {
            const { clipboard: pasted, section: target, trail, retrying } = request;

            if (retrying !== undefined) {
                forgetTransfer(retrying);
            }

            const id = transfers.queue.add(
                pasted.kind === "cut" ? "move" : "copy",
                pasted.adapter,
                pasted.entries,
                folderOf(pasted.section, pasted.trail),
                folderOf(target, trail),
                conflict,
            );

            transferPlaces.current.set(id, { request, skipped, merged, retriable: true });

            if (pasted.kind === "cut") {
                setClipboard((prev) => (prev === pasted ? null : prev));
            }
        },
        [transfers.queue, forgetTransfer],
    );

    // The picker's destination is one of the sections it was opened with, as a dialog finishes with
    // the sections it was opened for.
    const handleTransferStart = useCallback(
        (
            { kind, section: from, adapter: served, trail, entries, destinations }: TransferRequest,
            destination: FileManagerLocation,
            conflict: ConflictPolicy,
            skipped: string[],
            merged: string[],
        ) => {
            const target = destinations.find((candidate) => candidate.id === destination.sectionId) ?? from;
            const pasted: Clipboard = {
                kind: kind === "move" ? "cut" : "copy",
                section: from,
                adapter: served,
                trail,
                entries,
            };

            closeTransfer();
            startTransfer({ clipboard: pasted, section: target, trail: destination.trail }, conflict, skipped, merged);
        },
        [closeTransfer, startTransfer],
    );

    const handlePasteStart = useCallback(
        (request: PasteRequest, conflict: ConflictPolicy, skipped: string[], merged: string[]) => {
            closePaste();
            startTransfer(request, conflict, skipped, merged);
        },
        [closePaste, startTransfer],
    );

    // A failed copy or move can be tried again while both its sections are there, served as they
    // were, neither of its folders has gone (see `revise`), and no move under way is moving its
    // entries or the folder they'd go into, which would refuse the paste.
    const canRetryTransfer = useCallback(
        (item: TransferItem) => {
            const transfer = transferPlaces.current.get(item.id);

            if (!transfer?.retriable) {
                return false;
            }

            const { clipboard: pasted, section: target, trail } = transfer.request;
            const from = sectionsById.get(pasted.section.id);
            const into = sectionsById.get(target.id);
            const busy = movingThrough(moving, item.adapter);

            return (
                !!from &&
                !!into &&
                (from.adapter ?? adapter) === item.adapter &&
                (into.adapter ?? adapter) === item.adapter &&
                !entriesMoving(from, pasted.trail, pasted.entries, busy) &&
                !folderMoving(into, trail, busy)
            );
        },
        [sectionsById, adapter, moving],
    );

    // Tries a failed copy or move again as a paste, so the destination's names are checked again,
    // since part of it may have gone through, and the user chooses afresh; it stays in the panel
    // until the new one starts, as the user may cancel. Only the entries their folder still lists
    // go, when it's listed, so a move doesn't ask again for what it moved. With none left, there's
    // nothing to try again, and it's forgotten.
    const retryTransfer = useCallback(
        (item: TransferItem) => {
            const transfer = transferPlaces.current.get(item.id);
            const from = transfer && sectionsById.get(transfer.request.clipboard.section.id);
            const into = transfer && sectionsById.get(transfer.request.section.id);

            if (!transfer || !from || !into || !canRetryTransfer(item)) {
                return;
            }

            const { clipboard: pasted, trail } = transfer.request;
            const listed = store.get(folderKey(from.id, folderOf(from, pasted.trail).id))?.entries;
            const listedIds = listed && new Set(listed.map((entry) => entry.id));
            const entries = listedIds ? pasted.entries.filter((entry) => listedIds.has(entry.id)) : pasted.entries;
            if (entries.length === 0) {
                forgetTransfer(item.id);
            } else {
                offerPaste({ ...pasted, section: from, entries }, into, trail, item.id)?.();
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
    // while its names are checked.
    const busy = useMemo(() => {
        const served = section?.adapter ?? adapter;

        if (!folder) {
            return false;
        }

        if (pasteIds?.adapter === served && pasteIds.ids.has(folder.id)) {
            return true;
        }

        return transfers.items.some((item) => {
            const transfer = transferPlaces.current.get(item.id);

            if (item.status === "failed" || item.adapter !== served) {
                return false;
            }

            const above = transfer && folderOf(transfer.request.section, transfer.request.trail.slice(0, -1));

            return (
                item.target.id === folder.id ||
                above?.id === folder.id ||
                (item.kind === "move" && item.source.id === folder.id)
            );
        });
    }, [section, adapter, folder, pasteIds, transfers.items]);

    // Deleted folders go from the cache (`dropFolders`), and places inside one, in the history too,
    // end at the folder that held it, in every section showing it. Deleted entries leave the clipboard,
    // and the rest are looked for again when they may be below a deleted folder.
    const handleDeleted = useCallback(
        ({ adapter: fromAdapter, entries }: DeleteRequest) => {
            const deletedIds = new Set(entries.map((entry) => entry.id));
            const showing = new Set(sectionsOf(fromAdapter).map((shown) => shown.id));

            closeDelete();

            const mayBeBelow = mayBeRootedBelow(fromAdapter, folderIdsOf(entries));
            const dropped = dropFolders(fromAdapter, folderIdsOf(entries));

            revise((visited) => (showing.has(visited.sectionId) ? outsideDeleted(visited, dropped) : visited));
            setClipboard(
                (prev) => prev && withoutEntries(prev, fromAdapter, deletedIds, dropped, mayBeBelow(prev.section.id)),
            );
            changePreview(fromAdapter, (entry) => (deletedIds.has(entry.id) ? null : entry));
            announce(localeValue.text.deleteDone(entries.length, isolate(entries[0].name)));
        },
        [closeDelete, dropFolders, mayBeRootedBelow, revise, sectionsOf, changePreview, announce, localeValue],
    );

    // The new or renamed entry is selected if its folder is open, in whichever section shows it. A
    // renamed folder keeps its place in the path, the history and the sidebar tree, in every
    // section showing it.
    const handleNamed = useCallback(
        (request: NameRequest, entry: FileEntry) => {
            const { section: target, adapter: served, trail } = request;
            const parentId = folderOf(target, trail).id;
            const before = request.kind === "rename" ? request.entry : undefined;
            const showing = sectionsOf(served);

            const message = before
                ? localeValue.text.renameDone(isolate(before.name), isolate(entry.name))
                : localeValue.text.createDone(isolate(entry.name));

            closeNaming();

            // Shown in the open folder, the entry is announced once it's revealed there, unless it
            // takes the focus.
            if (openKey && showing.some((shown) => folderKey(shown.id, parentId) === openKey)) {
                setReveal({ key: openKey, id: entry.id, announce: message });
            } else {
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
                    (prev) => prev && withRenamed(prev, served, before, entry, dropped, mayBeBelow(prev.section.id)),
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
        [
            closeNaming,
            openKey,
            sectionsOf,
            dropFolders,
            mayBeRootedBelow,
            revealInTree,
            revise,
            changePreview,
            announce,
            localeValue,
        ],
    );

    const contextFor = useCallback(
        (request: MenuRequest): ActionContext => {
            const { target, section: menuSection, trail, entries, listing, inResults } = request;
            const menuFolder = folderOf(menuSection, trail);
            const folderAdapter = menuSection.adapter ?? adapter;
            const base = { section: menuSection, adapter: folderAdapter, trail };
            // The sections the entries can go into, and their own, where the picker starts. A
            // section nothing can change is offered only when it's theirs.
            const destinations = [...sectionsById.values()].filter(
                (candidate) =>
                    (candidate.adapter ?? adapter) === folderAdapter &&
                    importsFrom(candidate, menuSection) &&
                    (candidate.id === menuSection.id || !candidate.readOnly),
            );
            const transferTo = (kind: TransferRequest["kind"]) => () =>
                askDestination({ ...base, kind, entries, destinations });

            // What the folder and the entries' own permissions allow, while no move under way is
            // moving them, or the folder.
            const busy = movingThrough(moving, folderAdapter);
            const entriesBusy = entriesMoving(menuSection, trail, entries, busy);
            const writable = folderWritable(store, menuSection, trail, busy);
            const permits = (what: "rename" | "move" | "delete") =>
                writable &&
                !entriesBusy &&
                entries.length > 0 &&
                entries.every((entry) => allows(what, entry.permissions));

            // Pastes into the folder at `pasteTrail`, when what was cut or copied can go there.
            const pasteTo = (pasteTrail: FolderRef[]) =>
                clipboard ? offerPaste(clipboard, menuSection, pasteTrail) : undefined;

            const uploadHere = offerUpload(menuSection, trail);

            const [only] = entries;
            // A folder's own menu, its empty space, the path bar's or a section row's, downloads the
            // folder itself.
            const downloaded = downloadedEntries(entries, menuFolder);

            // A single file steps through the files of the view it's listed in, in its order, and
            // the selection follows; several files step through themselves. Without the adapter's
            // `content`, only those a previewer reading nothing takes.
            const shows = (entry: FileEntry) => entry.kind === "file" && previewable(entry, folderAdapter, previewers);
            const previewed = entries.filter(shows);
            const preview =
                previewed.length > 0
                    ? () => {
                          const siblings = entries.length === 1 && listing ? listing.filter(shows) : [];
                          const index = siblings.findIndex((entry) => entry.id === only.id);

                          askPreview(
                              index >= 0
                                  ? { ...base, entries: siblings, index, follow: true, inResults }
                                  : { ...base, entries: previewed, index: 0, follow: false, inResults },
                          );
                      }
                    : undefined;

            const context: ActionContext = {
                target,
                entries,
                folder: menuFolder,
                section: menuSection,
                readOnly: !writable,
                moving: entriesBusy,
                refresh: () => {
                    store.load(folderKey(menuSection.id, menuFolder.id), folderAdapter, menuFolder.id, true);
                    setSearchVersion((count) => count + 1);
                },
                openFolder: (entry) => {
                    goTo({ sectionId: menuSection.id, trail: [...trail, { id: entry.id, name: entry.name }] });
                },
                createFolder:
                    folderAdapter.createFolder && writable ? () => askName({ ...base, kind: "create" }) : undefined,
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
                    folderAdapter.copy &&
                    entries.length > 0 &&
                    !entriesBusy &&
                    destinations.some((candidate) => !candidate.readOnly)
                        ? transferTo("copy")
                        : undefined,
                moveTo: folderAdapter.move && permits("move") ? transferTo("move") : undefined,
                cut:
                    folderAdapter.move && permits("move")
                        ? () => {
                              setClipboard({ ...base, kind: "cut", entries });
                              announce(localeValue.text.clipboardCut(entries.length, isolate(only.name)));
                          }
                        : undefined,
                copy:
                    folderAdapter.copy && entries.length > 0 && !entriesBusy
                        ? () => {
                              setClipboard({ ...base, kind: "copy", entries });
                              announce(localeValue.text.clipboardCopied(entries.length, isolate(only.name)));
                          }
                        : undefined,
                delete: folderAdapter.delete && permits("delete") ? () => askDelete({ ...base, entries }) : undefined,
                download: canDownload(folderAdapter, downloaded)
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
            askDownload,
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
            announce,
            localeValue,
        ],
    );

    // What the app's actions in the preview's header get: the context menu's for the one file shown,
    // in its folder, with what takes the user elsewhere closing the preview first. It isn't
    // previewed again from there.
    const previewActionsFor = useCallback(
        ({ section: shown, trail, inResults }: PreviewRequest, entry: FileEntry): ToolbarGroup[] => {
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
            const listing = listed
                ?.filter((entry) => showHidden || !isHidden(entry))
                .sort(entryComparator(sort, localeValue));

            return contextFor({
                target: entries.length > 0 ? "selection" : "folder",
                section: atSection,
                trail: at.trail,
                entries: [...entries],
                listing,
            });
        },
        [place, sectionsById, store, showHidden, sort, localeValue, contextFor],
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
        showShortcuts,
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
            showShortcuts,
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
            focus: () => setFocusContent(true),
            showShortcuts: () => api.current.showShortcuts(),
        }),
        [],
    );

    return (
        <LocaleContext value={localeValue}>
            <DirectionContext value={direction}>
                <DataContext value={data}>
                    <CutContext value={cut}>
                        <MovingContext value={moving}>
                            <DragContext value={drag.context}>
                                {/* The consumer's handlers run first, so one can take an event before the
                                    file manager does, e.g. a key press, by calling `preventDefault`. */}
                                {/* Focusable but not tabbable, so a press on its empty space, such as the
                                    header's, keeps the focus in here rather than dropping it to the page,
                                    where the keys handled below would never come. */}
                                <Box
                                    tabIndex={-1}
                                    {...rootAttributes}
                                    ref={rootElementRef}
                                    sx={rootStyle}
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
                                    <Box sx={frameSx} data-sidebar-hidden={sidebarHidden}>
                                        <Backdrop
                                            open={sidebarOpen}
                                            sx={backdropSx}
                                            style={dragging || sidebarForDrag ? PASS_THROUGH : undefined}
                                            onClick={closeSidebar}
                                        />
                                        <Backdrop
                                            open={propertiesOverlay}
                                            sx={propertiesBackdropSx}
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
                                            searchScope={searchScope}
                                            canSearchEverywhere={canSearchEverywhere}
                                            onToggle={toggleExpanded}
                                            onRevealed={clearTreeReveal}
                                            onExpand={expand}
                                            onNavigate={navigateFromSidebar}
                                            onOpenMenu={openMenu}
                                            onShortcut={runShortcut}
                                            onPasteFiles={pasteFiles}
                                            onClose={closeSidebar}
                                            onSearchEverywhere={searchEverywhere}
                                            mainMenu={mainMenu}
                                            onShowShortcuts={showShortcuts}
                                        />
                                        <Box sx={mainSx}>
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
                                                    ) : section ? (
                                                        <PathBar
                                                            section={section}
                                                            trail={place.trail}
                                                            hasActions={hasActions}
                                                            onNavigate={goTo}
                                                            onOpenMenu={openMenu}
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
                                            <Box sx={bodySx}>
                                                <Box sx={columnSx}>
                                                    <Box ref={panelRef} sx={panelSx}>
                                                        {/* A search everywhere's results show in the folder's place
                                                            while something is typed. The folder stays mounted
                                                            under them, hidden, so it comes back as it was, its
                                                            selection included. */}
                                                        {showsResults && (
                                                            <SearchResults
                                                                targets={searchedTargets}
                                                                query={searchedFor}
                                                                version={searchVersion}
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
                                                        {/* Keyed by folder, so each opens at the top with nothing
                                                            selected. */}
                                                        <Box
                                                            key={openKey ?? undefined}
                                                            sx={viewSx}
                                                            hidden={showsResults}
                                                        >
                                                            {!section && <NoSections />}
                                                            {section && (
                                                                <FolderView
                                                                    section={section}
                                                                    trail={place.trail}
                                                                    view={view}
                                                                    zoom={zoom[view]}
                                                                    sort={sort}
                                                                    showHidden={showHidden}
                                                                    query={searchScope === "folder" ? query : ""}
                                                                    hasActions={hasActions}
                                                                    selecting={selecting}
                                                                    busy={busy}
                                                                    takeFocus={focusContent && !showsResults}
                                                                    revealId={revealId}
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
                                                                />
                                                            )}
                                                        </Box>
                                                    </Box>
                                                    {shownTransfers.length > 0 && (
                                                        <Box sx={taskPanelSx}>
                                                            <TransferPanel
                                                                items={shownTransfers}
                                                                onCancel={transfers.queue.cancel}
                                                                onRetry={retryTransfer}
                                                                canRetry={canRetryTransfer}
                                                                onCancelAll={transfers.queue.cancelAll}
                                                                onClear={clearTransfers}
                                                            />
                                                        </Box>
                                                    )}
                                                    {shownDownloads.length > 0 && (
                                                        <Box sx={taskPanelSx}>
                                                            <DownloadPanel
                                                                items={shownDownloads}
                                                                onCancel={downloads.queue.cancel}
                                                                onRetry={downloads.queue.retry}
                                                                onSave={downloads.queue.save}
                                                                onCancelAll={downloads.queue.cancelAll}
                                                                onClear={downloads.queue.clear}
                                                            />
                                                        </Box>
                                                    )}
                                                    {uploads.items.length > 0 && (
                                                        <Box sx={taskPanelSx}>
                                                            <UploadPanel
                                                                items={uploads.items}
                                                                onCancel={uploads.queue.cancel}
                                                                onRetry={uploads.queue.retry}
                                                                onShow={showUpload}
                                                                canShow={canShowUpload}
                                                                onCancelAll={uploads.queue.cancelAll}
                                                                onClear={clearUploads}
                                                            />
                                                        </Box>
                                                    )}
                                                </Box>
                                                <PropertiesPane
                                                    ref={paneRef}
                                                    subject={propertiesSubject}
                                                    shown={propertiesOpen}
                                                    open={propertiesOverlay}
                                                    changes={searchVersion}
                                                    showHidden={showHidden}
                                                    cache={propertiesCache}
                                                    takeFocus={focusProperties}
                                                    actions={propertiesActions}
                                                    contextFor={contextFor}
                                                    onClose={closeProperties}
                                                    onEscape={handlePropertiesEscape}
                                                    onFocusOut={handlePropertiesFocusOut}
                                                    onDockedChange={handlePropertiesDocking}
                                                />
                                            </Box>
                                        </Box>
                                    </Box>
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
                                            onClose={closeDelete}
                                            onChanged={relist}
                                            onDone={handleDeleted}
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
                                </Box>
                            </DragContext>
                        </MovingContext>
                    </CutContext>
                </DataContext>
            </DirectionContext>
        </LocaleContext>
    );
};

export default FileManager;
