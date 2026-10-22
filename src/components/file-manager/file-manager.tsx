import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, DragEvent, KeyboardEvent } from "react";
import { createPortal, flushSync } from "react-dom";

import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import { CutContext } from "../../contexts/cut-context";
import { DataContext } from "../../contexts/data-context";
import { DirectionContext } from "../../contexts/direction-context";
import { DragContext } from "../../contexts/drag-context";
import { LocaleContext } from "../../contexts/locale-context";
import { carriesFiles } from "../../hooks/use-drop-target";
import { useEntryDrag } from "../../hooks/use-entry-drag";
import { useLocaleValue } from "../../hooks/use-locale";
import { usePlaceHistory } from "../../hooks/use-place-history";
import { useTextDirection } from "../../hooks/use-text-direction";
import { useUploadQueue } from "../../hooks/use-upload-queue";
import { createFolderStore, folderKey } from "../../store/folder-store";
import { createThumbnailCache } from "../../store/thumbnail-cache";
import { ROOT_CONTAINER, VIEW_CONTAINER, rootWide } from "../../styles/layout";
import { visibleActionGroups } from "../../utils/action-groups";
import { canPaste, withRenamed, withoutEntries } from "../../utils/clipboard";
import { isHidden } from "../../utils/hidden";
import { folderLeft, folderOf, outsideDeleted, renameInPlace } from "../../utils/navigation";
import { importsFrom } from "../../utils/sections";
import { matchesShortcut } from "../../utils/shortcut";
import { DEFAULT_SORT } from "../../utils/sort";
import UploadPanel from "../uploads/upload-panel";
import FolderView from "./content/folder-view";
import ContextMenu from "./context-menu/context-menu";
import DeleteDialog from "./dialogs/delete-dialog";
import NameDialog from "./dialogs/name-dialog";
import PasteDialog from "./dialogs/paste-dialog";
import PreviewDialog from "./dialogs/preview-dialog";
import TransferDialog from "./dialogs/transfer-dialog";
import UploadDialog from "./dialogs/upload-dialog";
import DragPreview from "./drag-preview";
import HeaderBar from "./header-bar/header-bar";
import PathBar from "./header-bar/path-bar";
import Sidebar from "./sidebar/sidebar";

import type {
    ActionContext,
    ActionGroup,
    Clipboard,
    ConflictPolicy,
    DroppedFiles,
    DropInto,
    DropTarget,
    FileAdapter,
    FileEntry,
    FileManagerLocaleText,
    FolderRef,
    MenuRequest,
    OpenMenu,
    Place,
    RunShortcut,
    Section,
    SectionGroup,
    SortOrder,
    TreeReveal,
    ViewMode,
} from "../../types";
import type { MenuState } from "./context-menu/context-menu";
import type { DeleteDialogState, DeleteRequest } from "./dialogs/delete-dialog";
import type { NameDialogState, NameRequest } from "./dialogs/name-dialog";
import type { PasteDialogState, PasteRequest } from "./dialogs/paste-dialog";
import type { PreviewDialogState, PreviewRequest } from "./dialogs/preview-dialog";
import type { TransferDialogState, TransferRequest } from "./dialogs/transfer-dialog";
import type { UploadDialogState, UploadRequest } from "./dialogs/upload-dialog";

interface BaseProps {
    /** Backend for every section that doesn't bring its own. */
    adapter: FileAdapter;
    /** Context menu actions, in groups. */
    actions?: ActionGroup[];
    /** Shown at the top of the sidebar; `localeText.sidebarTitle`, "Files" in English, when omitted. */
    title?: string;
    defaultView?: ViewMode;
    /** Content order at first; name, A to Z, when omitted. The sidebar tree is always by name. */
    defaultSort?: SortOrder;
    /**
     * What opening a file does, by double-clicking, tapping or pressing Enter on it, or with
     * `ActionContext.open`, e.g. opening it in an editor of the consumer's. Return false to leave a
     * file to the preview, e.g. one of a type there's no editor for. Without it, a file opens in the
     * preview, when the adapter has `content`, and `ActionContext.open` is missing for files, since
     * it would only do what `preview` does.
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
}

interface MultiSectionProps extends BaseProps {
    /** Sidebar sections, in groups. Each section is an independent root. */
    sections: SectionGroup[];
    section?: never;
    /** Section open at first; the first one when omitted. */
    defaultSectionId?: string;
}

interface SingleSectionProps extends BaseProps {
    /**
     * The one root to browse. The sidebar shows its folders as the tree itself, with no section
     * row above them, unless the section sets `showFolders: false`.
     */
    section: Section;
    sections?: never;
    defaultSectionId?: never;
}

/** Either `sections`, for a sidebar of independent roots, or a single `section`. */
export type FileManagerProps = MultiSectionProps | SingleSectionProps;

/** An entry to select in the open folder once its listing has it. */
interface Reveal {
    /** `folderKey` of the folder it was meant for. */
    key: string;
    id: string;
}

const NO_ACTIONS: ActionGroup[] = [];

const folderIdsOf = (entries: FileEntry[]) =>
    entries.filter((entry) => entry.kind === "folder").map((entry) => entry.id);

// While entries are dragged, the backdrop of the overlay sidebar lets drops through to the content,
// so a folder dragged out of the sidebar can land there.
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
// visible frame is the child below it.
const rootSx: SxProps<Theme> = {
    containerType: "inline-size",
    containerName: ROOT_CONTAINER,
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
};

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

const mainSx: SxProps<Theme> = {
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

// The upload panel is a second inset panel under the content, so it never covers the files.
const uploadsSx: SxProps<Theme> = {
    marginInline: 0.75,
    mb: 0.75,
    ...besideSidebar,
};

const pickerStyle: CSSProperties = { display: "none" };

// Below `rootWide` the sidebar overlays the content. Container queries decide that, so it's read
// from the sidebar's style.
const overlays = (sidebar: HTMLElement) => getComputedStyle(sidebar).position === "absolute";

const FileManager = ({
    adapter,
    sections: groups,
    section: singleSection,
    actions = NO_ACTIONS,
    title,
    defaultSectionId,
    defaultView = "list",
    defaultSort = DEFAULT_SORT,
    onOpenFile,
    localeText,
    locale,
}: FileManagerProps) => {
    const localeValue = useLocaleValue(localeText, locale);
    const [store] = useState(createFolderStore);
    const [thumbnails] = useState(createThumbnailCache);
    const data = useMemo(() => ({ store, adapter, thumbnails }), [store, adapter, thumbnails]);

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

    const { place, previous, next, canGoBack, canGoForward, navigate, back, forward, rewrite } = usePlaceHistory(
        () => ({
            sectionId: defaultSectionId ?? sections[0]?.sections[0]?.id ?? "",
            trail: [],
        }),
    );

    const section = sectionsById.get(place.sectionId);
    const folder = section && folderOf(section, place.trail);
    const openKey = section && folder ? folderKey(section.id, folder.id) : null;

    // Only the first section shown starts expanded, if it shows its folders at all; after that,
    // only the chevrons change the tree.
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(
        () => new Set(section && section.showFolders !== false ? [folderKey(section.id, section.rootId)] : []),
    );
    const [sidebarOpen, setSidebarOpen] = useState(false);
    // Whether the docked sidebar is hidden, with F9 or the view menu. Collapsed, it shows as an
    // overlay instead, while `sidebarOpen`.
    const [sidebarHidden, setSidebarHidden] = useState(false);
    const [view, setView] = useState<ViewMode>(defaultView);
    // Kept across folders, as the view is.
    const [sort, setSort] = useState<SortOrder>(defaultSort);
    // Kept across folders, as the sort is. Listings are filtered by it where they're shown, never in the store.
    const [showHidden, setShowHidden] = useState(false);
    const [menu, setMenu] = useState<MenuState | null>(null);
    const [naming, setNaming] = useState<NameDialogState | null>(null);
    const [transfer, setTransfer] = useState<TransferDialogState | null>(null);
    const [deleting, setDeleting] = useState<DeleteDialogState | null>(null);
    const [clipboard, setClipboard] = useState<Clipboard | null>(null);
    const [pasting, setPasting] = useState<PasteDialogState | null>(null);
    const [uploadCheck, setUploadCheck] = useState<UploadDialogState | null>(null);
    const [previewing, setPreviewing] = useState<PreviewDialogState | null>(null);
    const [reveal, setReveal] = useState<Reveal | null>(null);
    // A folder just created, which the sidebar tree scrolls to once it shows its row.
    const [treeReveal, setTreeReveal] = useState<TreeReveal | null>(null);
    // The browser's file picker, and where the files picked with it go.
    const pickerRef = useRef<HTMLInputElement>(null);
    const pickedInto = useRef<((dropped: DroppedFiles) => void) | null>(null);
    // The folder in which touch selection mode is on, so opening another folder turns it off.
    const [selectingKey, setSelectingKey] = useState<string | null>(null);
    const selecting = openKey !== null && selectingKey === openKey;
    const rootRef = useRef<HTMLDivElement>(null);
    // Handed to what portals out of the file manager, so it runs the same way (`DirectionContext`).
    const direction = useTextDirection(rootRef);
    const panelRef = useRef<HTMLDivElement>(null);
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

    // An entry still waiting to be selected is forgotten once another folder opens.
    if (reveal && reveal.key !== openKey) {
        setReveal(null);
    }

    const hasActions = useMemo(() => actions.some((group) => group.actions.length > 0), [actions]);

    const cut = useMemo(
        () =>
            clipboard?.kind === "cut"
                ? { adapter: clipboard.adapter, ids: new Set(clipboard.entries.map((entry) => entry.id)) }
                : null,
        [clipboard],
    );

    // Folders a running paste changes, whose view shows a progress bar meanwhile, in any section
    // showing them: the one it goes into, the one listing that folder (where it was dropped onto,
    // or pasted into from its menu), and, for a move, the one the entries leave.
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

    const busy =
        !!folder && !!pasteIds && pasteIds.adapter === (section?.adapter ?? adapter) && pasteIds.ids.has(folder.id);

    // Expands without ever collapsing, for a drag resting on a collapsed folder or section.
    const expand = useCallback((key: string) => {
        setExpanded((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    }, []);

    const toggleExpanded = useCallback((key: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }

            return next;
        });
    }, []);

    // Whether the focus is in the content panel, or in the context menu opened from it, since an
    // action picked in the menu counts as run where the menu was opened.
    const focusInContent = useCallback(() => {
        const active = document.activeElement;
        const from = active?.closest('[role="menu"]') ? menuOpener.current : active;

        return !!from && !!panelRef.current?.contains(from);
    }, []);

    // Opening a folder from the content takes the focus along into it, as the view it was in goes
    // away. Going up to a folder the open one is in selects the folder it was left through, as
    // desktop file managers do.
    const arrive = useCallback(
        (target: Place) => {
            const targetSection = sectionsById.get(target.sectionId);
            const left = folderLeft(place, target);

            if (focusInContent()) {
                setFocusContent(true);
            }

            if (left && targetSection) {
                const key = folderKey(targetSection.id, folderOf(targetSection, target.trail).id);

                setReveal({ key, id: left.id });
            }
        },
        [place, sectionsById, focusInContent],
    );

    // Going somewhere leaves the sidebar tree as the user left it; the path bar shows where it is.
    const goTo = useCallback(
        (target: Place) => {
            if (sectionsById.has(target.sectionId)) {
                arrive(target);
                navigate(target);
            }
        },
        [arrive, navigate, sectionsById],
    );

    const goBack = useCallback(() => {
        if (previous) {
            arrive(previous);
            back();
        }
    }, [previous, arrive, back]);

    const goForward = useCallback(() => {
        if (next) {
            arrive(next);
            forward();
        }
    }, [next, arrive, forward]);

    // The overlay closes on the place picked in it, so the focus goes on to the content.
    const navigateFromSidebar = useCallback(
        (target: Place) => {
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

    // F6 moves the focus between the sidebar tree and the content, as in GNOME Files. While the
    // sidebar is collapsed, it opens the overlay, which takes the focus.
    const switchPane = () => {
        const sidebar = sidebarRef.current;

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
    }, []);

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

    // Keys that work anywhere in the file manager: F6, F9, Ctrl+H, and Alt+Left and Alt+Right for
    // back and forward, the other way round right to left, as the arrows on the buttons are.
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

        const others = event.ctrlKey || event.metaKey || event.shiftKey;
        const plain = !others && !event.altKey;
        let handled = true;

        if (event.key === "F6" && !event.ctrlKey && !event.metaKey && !event.altKey) {
            switchPane();
        } else if (event.key === "F9" && plain) {
            toggleSidebar();
        } else if (
            // Ctrl+H shows and hides hidden files, as in GNOME Files. Not ⌘H, which hides the
            // browser on macOS before the page sees it.
            event.key.toLowerCase() === "h" &&
            event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            !event.altKey
        ) {
            toggleHidden();
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

    const toggleView = useCallback(() => setView((prev) => (prev === "list" ? "grid" : "list")), []);
    const toggleHidden = useCallback(() => setShowHidden((prev) => !prev), []);
    const closeMenu = useCallback(() => setMenu((prev) => prev && { ...prev, open: false }), []);
    const setSelecting = useCallback((on: boolean) => setSelectingKey(on ? openKey : null), [openKey]);
    const toggleSelecting = useCallback(() => setSelecting(!selecting), [setSelecting, selecting]);
    const clearReveal = useCallback(() => setReveal(null), []);
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

    // Once the preview has faded out, the content takes the focus back if the preview was opened
    // from there, on the file shown last when the selection followed it.
    const handlePreviewClosed = useCallback(() => {
        if (previewing?.fromContent) {
            setFocusContent(true);
        }
    }, [previewing?.fromContent]);

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

    // Pastes `pasted` into the folder at `trail`, when it can go there and no other paste is running.
    const offerPaste = useCallback(
        (pasted: Clipboard, target: Section, trail: FolderRef[]) =>
            !pasting?.open && canPaste(pasted, target.adapter ?? adapter, target, trail)
                ? () => askPaste({ clipboard: pasted, section: target, trail })
                : undefined,
        [adapter, pasting?.open, askPaste],
    );

    // A drop is pasted like the clipboard, with the dragged entries as a clipboard of their own, so
    // the real one is left as it was.
    const dropInto = useCallback<DropInto>(
        (dragged, copy, target, trail) => offerPaste({ ...dragged, kind: copy ? "copy" : "cut" }, target, trail),
        [offerPaste],
    );

    // Uploads into the folder at `trail`, when its adapter takes uploads and no other upload is
    // being checked. Files dropped from outside go the same way.
    const offerUpload = useCallback(
        (target: Section, trail: FolderRef[]) => {
            const served = target.adapter ?? adapter;

            return served.upload && !uploadCheck?.open
                ? (dropped: DroppedFiles) => askUpload({ section: target, adapter: served, trail, dropped })
                : undefined;
        },
        [adapter, uploadCheck?.open, askUpload],
    );

    const uploadInto = useCallback(
        (target: DropTarget) => offerUpload(target.section, target.trail),
        [offerUpload],
    );

    // Only opens from a click or key press, which an action's `onSelect` runs in.
    const pickFiles = useCallback((into: (dropped: DroppedFiles) => void) => {
        pickedInto.current = into;
        pickerRef.current?.click();
    }, []);

    const handlePicked = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.currentTarget.files ?? []);
        const into = pickedInto.current;

        // Emptied, so picking the same files again still counts as a change.
        event.currentTarget.value = "";
        pickedInto.current = null;

        if (into && files.length > 0) {
            into({ files, folders: [] });
        }
    };

    const drag = useEntryDrag(adapter, dropInto, uploadInto);

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
        },
        [sectionsOf, store],
    );

    // Uploads run in the background, a few at a time, while the user browses; the folders they end
    // in are listed again like any other change.
    const uploads = useUploadQueue(relist);

    const startUpload = useCallback(
        ({ section: target, adapter: served, trail }: UploadRequest, files: File[], conflict: ConflictPolicy) => {
            closeUploadCheck();
            uploads.queue.add(served, folderOf(target, trail), files, conflict);
        },
        [closeUploadCheck, uploads.queue],
    );

    // With path ids, a change can leave an id naming another folder: a deleted or moved folder's id
    // is free for a new one, as is a renamed folder's old id, and a new or renamed folder's id may
    // have named one before. So can the ids below them, so the listings cached for them, and for
    // every folder any section has cached below them, are dropped in every section the adapter
    // serves. A section rooted in one of them can't follow it, since its root is the consumer's:
    // its places go back to the root, which is listed again, as nothing would list it on its own,
    // to show what the adapter now has there. Returns the dropped ids, for the places inside them.
    const dropFolders = useCallback(
        (served: FileAdapter, folderIds: string[]) => {
            const showing = sectionsOf(served);
            const dropped = new Set([
                ...folderIds,
                ...showing.flatMap((shown) => folderIds.flatMap((id) => store.cachedTree(shown.id, id))),
            ]);
            const lostRoots = new Set(showing.filter((shown) => dropped.has(shown.rootId)).map((shown) => shown.id));

            showing.forEach((shown) => {
                const rootKey = folderKey(shown.id, shown.rootId);
                const relistRoot = lostRoots.has(shown.id) && !!store.get(rootKey);

                store.forget(shown.id, dropped);

                if (relistRoot) {
                    store.load(rootKey, served, shown.rootId, true);
                }
            });

            if (lostRoots.size > 0) {
                rewrite((visited) =>
                    lostRoots.has(visited.sectionId) && visited.trail.length > 0 ? { ...visited, trail: [] } : visited,
                );
            }

            return dropped;
        },
        [rewrite, sectionsOf, store],
    );

    // Moved folders go from the cache (`dropFolders`). The open place, in whichever section shows
    // them, can't follow a moved folder it's inside, so it goes where the folder went. Moved entries
    // leave the clipboard too, since their ids may have changed.
    const handleMoved = useCallback(
        (fromAdapter: FileAdapter, entries: FileEntry[], destination: Place) => {
            const movedIds = new Set(entries.map((entry) => entry.id));
            const dropped = dropFolders(fromAdapter, folderIdsOf(entries));

            if (
                section &&
                (section.adapter ?? adapter) === fromAdapter &&
                [section.rootId, ...place.trail.map((step) => step.id)].some((id) => dropped.has(id))
            ) {
                goTo(destination);
            }

            setClipboard((prev) => prev && withoutEntries(prev, fromAdapter, movedIds));
        },
        [adapter, section, place, dropFolders, goTo],
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
            dropFolders(served, [entry.id]);
            revealInTree(served, parentId, entry);
        },
        [dropFolders, revealInTree],
    );

    const handleTransferred = useCallback(
        (request: TransferRequest, destination: Place) => {
            closeTransfer();

            if (request.kind === "move") {
                handleMoved(request.adapter, request.entries, destination);
            }
        },
        [closeTransfer, handleMoved],
    );

    // A cut is pasted once, so its entries leave the clipboard, as do entries moved by a drop; a
    // copy can be pasted again.
    const handlePasted = useCallback(
        ({ clipboard: pasted, section: target, trail }: PasteRequest) => {
            closePaste();

            if (pasted.kind === "cut") {
                handleMoved(pasted.adapter, pasted.entries, { sectionId: target.id, trail });
            }
        },
        [closePaste, handleMoved],
    );

    // Deleted folders go from the cache (`dropFolders`), and places inside one, in the history too,
    // end at the folder that held it, in every section showing it. Deleted entries leave the clipboard.
    const handleDeleted = useCallback(
        ({ adapter: fromAdapter, entries }: DeleteRequest) => {
            const deletedIds = new Set(entries.map((entry) => entry.id));
            const showing = new Set(sectionsOf(fromAdapter).map((shown) => shown.id));

            closeDelete();

            const dropped = dropFolders(fromAdapter, folderIdsOf(entries));

            rewrite((visited) => (showing.has(visited.sectionId) ? outsideDeleted(visited, dropped) : visited));
            setClipboard((prev) => prev && withoutEntries(prev, fromAdapter, deletedIds));
        },
        [closeDelete, dropFolders, rewrite, sectionsOf],
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

            closeNaming();

            if (openKey && showing.some((shown) => folderKey(shown.id, parentId) === openKey)) {
                setReveal({ key: openKey, id: entry.id });
            }

            // A renamed entry on the clipboard is pasted as it is now.
            if (before) {
                setClipboard((prev) => prev && withRenamed(prev, served, before, entry));
            }

            if (entry.kind !== "folder") {
                return;
            }

            if (!before) {
                revealInTree(served, parentId, entry);
            }

            if (entry.id !== before?.id) {
                dropFolders(served, before ? [entry.id, before.id] : [entry.id]);
            }

            if (!before) {
                return;
            }

            const showingIds = new Set(showing.map((shown) => shown.id));

            rewrite((visited) => (showingIds.has(visited.sectionId) ? renameInPlace(visited, before, entry) : visited));

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
        [closeNaming, openKey, sectionsOf, dropFolders, revealInTree, rewrite],
    );

    const contextFor = useCallback(
        ({ target, section: menuSection, trail, entries, listing }: MenuRequest): ActionContext => {
            const menuFolder = folderOf(menuSection, trail);
            const folderAdapter = menuSection.adapter ?? adapter;
            const base = { section: menuSection, adapter: folderAdapter, trail };
            const transferTo = (kind: TransferRequest["kind"]) => () =>
                askDestination({
                    ...base,
                    kind,
                    entries,
                    destinations: [...sectionsById.values()].filter(
                        (candidate) =>
                            (candidate.adapter ?? adapter) === folderAdapter && importsFrom(candidate, menuSection),
                    ),
                });

            // Pastes into the folder at `pasteTrail`, when what was cut or copied can go there.
            const pasteTo = (pasteTrail: FolderRef[]) =>
                clipboard ? offerPaste(clipboard, menuSection, pasteTrail) : undefined;

            const uploadHere = offerUpload(menuSection, trail);

            const [only] = entries;
            const files = entries.filter((entry) => entry.kind === "file");

            // A single file steps through the files of the view it's listed in, in its order, and
            // the selection follows; several files step through themselves.
            const preview =
                folderAdapter.content && files.length > 0
                    ? () => {
                          const siblings =
                              entries.length === 1 && listing ? listing.filter((entry) => entry.kind === "file") : [];
                          const index = siblings.findIndex((entry) => entry.id === only.id);

                          askPreview(
                              index >= 0
                                  ? { ...base, entries: siblings, index, follow: true }
                                  : { ...base, entries: files, index: 0, follow: false },
                          );
                      }
                    : undefined;

            const context: ActionContext = {
                target,
                entries,
                folder: menuFolder,
                section: menuSection,
                refresh: () => {
                    store.load(folderKey(menuSection.id, menuFolder.id), folderAdapter, menuFolder.id, true);
                },
                openFolder: (entry) => {
                    goTo({ sectionId: menuSection.id, trail: [...trail, { id: entry.id, name: entry.name }] });
                },
                createFolder: folderAdapter.createFolder ? () => askName({ ...base, kind: "create" }) : undefined,
                createFolderInto:
                    folderAdapter.createFolder && entries.length === 1 && only.kind === "folder"
                        ? () =>
                              askName({
                                  ...base,
                                  trail: [...trail, { id: only.id, name: only.name }],
                                  kind: "create",
                              })
                        : undefined,
                rename:
                    folderAdapter.rename && entries.length === 1
                        ? () => askName({ ...base, kind: "rename", entry: entries[0] })
                        : undefined,
                copyTo: folderAdapter.copy && entries.length > 0 ? transferTo("copy") : undefined,
                moveTo: folderAdapter.move && entries.length > 0 ? transferTo("move") : undefined,
                cut:
                    folderAdapter.move && entries.length > 0
                        ? () => setClipboard({ ...base, kind: "cut", entries })
                        : undefined,
                copy:
                    folderAdapter.copy && entries.length > 0
                        ? () => setClipboard({ ...base, kind: "copy", entries })
                        : undefined,
                delete: folderAdapter.delete && entries.length > 0 ? () => askDelete({ ...base, entries }) : undefined,
                upload:
                    uploadHere &&
                    ((files?: File[]) => (files ? uploadHere({ files, folders: [] }) : pickFiles(uploadHere))),
                paste: pasteTo(trail),
                pasteInto:
                    entries.length === 1 && only.kind === "folder"
                        ? pasteTo([...trail, { id: only.id, name: only.name }])
                        : undefined,
                preview,
            };

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
            goTo,
            askName,
            askDestination,
            askDelete,
            askPreview,
            offerPaste,
            offerUpload,
            pickFiles,
            sectionsById,
            clipboard,
            onOpenFile,
        ],
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

    // Offered exactly as the menu would offer it, so a shortcut never runs a hidden action.
    const runShortcut = useCallback<RunShortcut>(
        (event, requests) =>
            requests.some((request) => {
                const context = contextFor(request);
                const action = visibleActionGroups(actions, context)
                    .flatMap((group) => group.actions)
                    .find((candidate) => candidate.shortcut && matchesShortcut(event, candidate.shortcut));

                if (action && !action.disabled?.(context)) {
                    action.onSelect(context);
                }

                return !!action;
            }),
        [actions, contextFor],
    );

    return (
        <LocaleContext value={localeValue}>
            <DirectionContext value={direction}>
                <DataContext value={data}>
                    <CutContext value={cut}>
                        <DragContext value={drag.context}>
                            <Box
                                ref={rootRef}
                                sx={rootSx}
                                onPointerDownCapture={drag.onPointerDownCapture}
                                onDragEnter={refuseFiles}
                                onDragOver={refuseFiles}
                                onDrop={(event) => {
                                    refuseFiles(event);
                                    drag.end();
                                }}
                                onDragEnd={drag.end}
                                onKeyDown={handleKeyDown}
                            >
                                <Box sx={frameSx} data-sidebar-hidden={sidebarHidden}>
                                    <Backdrop
                                        open={sidebarOpen}
                                        sx={backdropSx}
                                        style={drag.context.dragged ? PASS_THROUGH : undefined}
                                        onClick={closeSidebar}
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
                                        onToggle={toggleExpanded}
                                        onRevealed={clearTreeReveal}
                                        onExpand={expand}
                                        onNavigate={navigateFromSidebar}
                                        onOpenMenu={openMenu}
                                        onShortcut={runShortcut}
                                        onClose={closeSidebar}
                                    />
                                    <Box sx={mainSx}>
                                        <HeaderBar
                                            pathBar={
                                                section ? (
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
                                            view={view}
                                            sort={sort}
                                            showHidden={showHidden}
                                            selecting={selecting}
                                            sidebarHidden={sidebarHidden}
                                            sidebarDocked={sidebarDocked}
                                            onBack={goBack}
                                            onForward={goForward}
                                            onToggleView={toggleView}
                                            onSortChange={setSort}
                                            onToggleHidden={toggleHidden}
                                            onToggleSelecting={toggleSelecting}
                                            onShowSidebar={showSidebar}
                                            onToggleSidebar={toggleDocked}
                                            sidebarButtonRef={sidebarButtonRef}
                                        />
                                        <Box ref={panelRef} sx={panelSx}>
                                            {/* Keyed by folder, so each opens at the top with nothing selected. */}
                                            <Box key={openKey ?? undefined} sx={viewSx}>
                                                {section && (
                                                    <FolderView
                                                        section={section}
                                                        trail={place.trail}
                                                        view={view}
                                                        sort={sort}
                                                        showHidden={showHidden}
                                                        hasActions={hasActions}
                                                        selecting={selecting}
                                                        busy={busy}
                                                        takeFocus={focusContent}
                                                        revealId={reveal?.id}
                                                        onSelectingChange={setSelecting}
                                                        onSortChange={setSort}
                                                        onNavigate={goTo}
                                                        onOpenFile={openFile}
                                                        onOpenMenu={openMenu}
                                                        onShortcut={runShortcut}
                                                        onRevealed={clearReveal}
                                                    />
                                                )}
                                            </Box>
                                        </Box>
                                        {uploads.items.length > 0 && (
                                            <Box sx={uploadsSx}>
                                                <UploadPanel
                                                    items={uploads.items}
                                                    onCancel={uploads.queue.cancel}
                                                    onRetry={uploads.queue.retry}
                                                    onCancelAll={uploads.queue.cancelAll}
                                                    onClear={uploads.queue.clear}
                                                />
                                            </Box>
                                        )}
                                    </Box>
                                </Box>
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
                                        onDone={handleTransferred}
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
                                        onChanged={relist}
                                        onDone={handlePasted}
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
                                        onClose={closePreview}
                                        onClosed={handlePreviewClosed}
                                        onStep={handlePreviewStep}
                                    />
                                )}
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
                                        />,
                                        document.body,
                                    )}
                            </Box>
                        </DragContext>
                    </CutContext>
                </DataContext>
            </DirectionContext>
        </LocaleContext>
    );
};

export default FileManager;
