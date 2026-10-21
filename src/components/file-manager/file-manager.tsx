import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, DragEvent } from "react";
import { createPortal } from "react-dom";

import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import { CutContext } from "../../contexts/cut-context";
import { DataContext } from "../../contexts/data-context";
import { DragContext } from "../../contexts/drag-context";
import { carriesFiles } from "../../hooks/use-drop-target";
import { useEntryDrag } from "../../hooks/use-entry-drag";
import { usePlaceHistory } from "../../hooks/use-place-history";
import { useUploadQueue } from "../../hooks/use-upload-queue";
import { createFolderStore, folderKey } from "../../store/folder-store";
import { ROOT_CONTAINER, VIEW_CONTAINER, rootWide } from "../../styles/layout";
import { visibleActionGroups } from "../../utils/action-groups";
import { canPaste, withRenamed, withoutEntries } from "../../utils/clipboard";
import { folderOf, outsideDeleted, renameInPlace } from "../../utils/navigation";
import { importsFrom } from "../../utils/sections";
import { matchesShortcut } from "../../utils/shortcut";
import { DEFAULT_SORT } from "../../utils/sort";
import UploadPanel from "../uploads/upload-panel";
import FolderView from "./content/folder-view";
import ContextMenu from "./context-menu/context-menu";
import DeleteDialog from "./dialogs/delete-dialog";
import NameDialog from "./dialogs/name-dialog";
import PasteDialog from "./dialogs/paste-dialog";
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
    FolderRef,
    MenuRequest,
    OpenMenu,
    Place,
    RunShortcut,
    Section,
    SectionGroup,
    SortOrder,
    ViewMode,
} from "../../types";
import type { MenuState } from "./context-menu/context-menu";
import type { DeleteDialogState, DeleteRequest } from "./dialogs/delete-dialog";
import type { NameDialogState, NameRequest } from "./dialogs/name-dialog";
import type { PasteDialogState, PasteRequest } from "./dialogs/paste-dialog";
import type { TransferDialogState, TransferRequest } from "./dialogs/transfer-dialog";
import type { UploadDialogState, UploadRequest } from "./dialogs/upload-dialog";

interface BaseProps {
    /** Backend for every section that doesn't bring its own. */
    adapter: FileAdapter;
    /** Context menu actions, in groups. */
    actions?: ActionGroup[];
    /** Shown at the top of the sidebar. */
    title?: string;
    defaultView?: ViewMode;
    /** Content order at first; name, A to Z, when omitted. The sidebar tree is always by name. */
    defaultSort?: SortOrder;
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

// The content sits as an inset, rounded panel on the window background, as in GNOME Files. The
// panel itself doesn't scroll, so the outline it shows while the open folder would take a drop
// stays put over the content scrolling under it, sticky column header included.
const panelSx: SxProps<Theme> = {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    mx: 0.75,
    mb: 0.75,
    borderRadius: 3,
    overflow: "hidden",
    bgcolor: "background.paper",
    [rootWide]: { ml: 0 },
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
    mx: 0.75,
    mb: 0.75,
    [rootWide]: { ml: 0 },
};

const pickerStyle: CSSProperties = { display: "none" };

const FileManager = ({
    adapter,
    sections: groups,
    section: singleSection,
    actions = NO_ACTIONS,
    title = "Files",
    defaultSectionId,
    defaultView = "list",
    defaultSort = DEFAULT_SORT,
}: FileManagerProps) => {
    const [store] = useState(createFolderStore);
    const data = useMemo(() => ({ store, adapter }), [store, adapter]);

    useEffect(() => () => store.abortAll(), [store]);

    // A single section is handled as one group of one, so only the sidebar needs to tell them apart.
    const sections = useMemo<SectionGroup[]>(
        () => (singleSection ? [{ id: singleSection.id, sections: [singleSection] }] : (groups ?? [])),
        [singleSection, groups],
    );

    const sectionsById = useMemo(
        () => new Map(sections.flatMap((group) => group.sections.map((section) => [section.id, section] as const))),
        [sections],
    );

    const { place, canGoBack, canGoForward, navigate, back, forward, rewrite } = usePlaceHistory(() => ({
        sectionId: defaultSectionId ?? sections[0]?.sections[0]?.id ?? "",
        trail: [],
    }));

    const section = sectionsById.get(place.sectionId);
    const folder = section && folderOf(section, place.trail);
    const openKey = section && folder ? folderKey(section.id, folder.id) : null;

    // Only the first section shown starts expanded, if it shows its folders at all; after that,
    // only the chevrons change the tree.
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(
        () => new Set(section && section.showFolders !== false ? [folderKey(section.id, section.rootId)] : []),
    );
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [view, setView] = useState<ViewMode>(defaultView);
    // Kept across folders, as the view is.
    const [sort, setSort] = useState<SortOrder>(defaultSort);
    // Only the view menu's checkbox for now; listings aren't filtered by it yet.
    const [showHidden, setShowHidden] = useState(false);
    const [menu, setMenu] = useState<MenuState | null>(null);
    const [naming, setNaming] = useState<NameDialogState | null>(null);
    const [transfer, setTransfer] = useState<TransferDialogState | null>(null);
    const [deleting, setDeleting] = useState<DeleteDialogState | null>(null);
    const [clipboard, setClipboard] = useState<Clipboard | null>(null);
    const [pasting, setPasting] = useState<PasteDialogState | null>(null);
    const [uploadCheck, setUploadCheck] = useState<UploadDialogState | null>(null);
    const [reveal, setReveal] = useState<Reveal | null>(null);
    // The browser's file picker, and where the files picked with it go.
    const pickerRef = useRef<HTMLInputElement>(null);
    const pickedInto = useRef<((dropped: DroppedFiles) => void) | null>(null);
    // The folder in which touch selection mode is on, so opening another folder turns it off.
    const [selectingKey, setSelectingKey] = useState<string | null>(null);
    const selecting = openKey !== null && selectingKey === openKey;

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

    // Going somewhere leaves the sidebar tree as the user left it; the path bar shows where it is.
    const goTo = useCallback(
        (target: Place) => {
            if (sectionsById.has(target.sectionId)) {
                navigate(target);
            }
        },
        [navigate, sectionsById],
    );

    const openSidebar = useCallback(() => setSidebarOpen(true), []);
    const closeSidebar = useCallback(() => setSidebarOpen(false), []);
    const toggleView = useCallback(() => setView((prev) => (prev === "list" ? "grid" : "list")), []);
    const toggleHidden = useCallback(() => setShowHidden((prev) => !prev), []);
    const closeMenu = useCallback(() => setMenu((prev) => prev && { ...prev, open: false }), []);
    const setSelecting = useCallback((on: boolean) => setSelectingKey(on ? openKey : null), [openKey]);
    const toggleSelecting = useCallback(() => setSelecting(!selecting), [setSelecting, selecting]);
    const clearReveal = useCallback(() => setReveal(null), []);

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
        [closeNaming, openKey, sectionsOf, dropFolders, rewrite],
    );

    const contextFor = useCallback(
        ({ target, section: menuSection, trail, entries }: MenuRequest): ActionContext => {
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

            return {
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
            };
        },
        [
            adapter,
            store,
            goTo,
            askName,
            askDestination,
            askDelete,
            offerPaste,
            offerUpload,
            pickFiles,
            sectionsById,
            clipboard,
        ],
    );

    const openMenu = useCallback<OpenMenu>(
        (position, request) => {
            const context = contextFor(request);
            const groups = visibleActionGroups(actions, context);

            if (groups.length === 0) {
                return false;
            }

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
        <DataContext value={data}>
            <CutContext value={cut}>
                <DragContext value={drag.context}>
                    <Box
                        sx={rootSx}
                        onPointerDownCapture={drag.onPointerDownCapture}
                        onDragEnter={refuseFiles}
                        onDragOver={refuseFiles}
                        onDrop={(event) => {
                            refuseFiles(event);
                            drag.end();
                        }}
                        onDragEnd={drag.end}
                    >
                        <Box sx={frameSx}>
                            <Backdrop
                                open={sidebarOpen}
                                sx={backdropSx}
                                style={drag.context.dragged ? PASS_THROUGH : undefined}
                                onClick={closeSidebar}
                            />
                            <Sidebar
                                title={title}
                                groups={sections}
                                single={singleSection}
                                expanded={expanded}
                                openKey={openKey}
                                open={sidebarOpen}
                                onToggle={toggleExpanded}
                                onExpand={expand}
                                onNavigate={goTo}
                                onOpenMenu={openMenu}
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
                                    onBack={back}
                                    onForward={forward}
                                    onToggleView={toggleView}
                                    onSortChange={setSort}
                                    onToggleHidden={toggleHidden}
                                    onToggleSelecting={toggleSelecting}
                                    onOpenSidebar={openSidebar}
                                />
                                <Box sx={panelSx}>
                                    {/* Keyed by folder, so each opens scrolled to the top with nothing selected. */}
                                    <Box key={openKey ?? undefined} sx={viewSx}>
                                        {section && (
                                            <FolderView
                                                section={section}
                                                trail={place.trail}
                                                view={view}
                                                sort={sort}
                                                hasActions={hasActions}
                                                selecting={selecting}
                                                busy={busy}
                                                revealId={reveal?.id}
                                                onSelectingChange={setSelecting}
                                                onSortChange={setSort}
                                                onNavigate={goTo}
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
                                onClose={closeTransfer}
                                onChanged={relist}
                                onDone={handleTransferred}
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
                        <input ref={pickerRef} type="file" multiple style={pickerStyle} onChange={handlePicked} />
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
    );
};

export default FileManager;
