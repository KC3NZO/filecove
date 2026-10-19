import { useCallback, useEffect, useMemo, useState } from "react";

import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import { DataContext } from "../../contexts/data-context";
import { usePlaceHistory } from "../../hooks/use-place-history";
import { createFolderStore, folderKey } from "../../store/folder-store";
import { ROOT_CONTAINER, VIEW_CONTAINER, rootWide } from "../../styles/layout";
import { visibleActionGroups } from "../../utils/action-groups";
import { folderOf, renameInPlace } from "../../utils/navigation";
import { matchesShortcut } from "../../utils/shortcut";
import { DEFAULT_SORT } from "../../utils/sort";
import FolderView from "./content/folder-view";
import ContextMenu from "./context-menu/context-menu";
import NameDialog from "./dialogs/name-dialog";
import TransferDialog from "./dialogs/transfer-dialog";
import HeaderBar from "./header-bar/header-bar";
import PathBar from "./header-bar/path-bar";
import Sidebar from "./sidebar/sidebar";

import type {
    ActionContext,
    ActionGroup,
    FileAdapter,
    FileEntry,
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
import type { NameDialogState, NameRequest } from "./dialogs/name-dialog";
import type { TransferDialogState, TransferRequest } from "./dialogs/transfer-dialog";

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

// The content sits as an inset, rounded panel on the window background, as in GNOME Files.
const viewSx: SxProps<Theme> = {
    containerType: "inline-size",
    containerName: VIEW_CONTAINER,
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    mx: 0.75,
    mb: 0.75,
    borderRadius: 3,
    bgcolor: "background.paper",
    [rootWide]: { ml: 0 },
};

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
    const [reveal, setReveal] = useState<Reveal | null>(null);
    // The folder in which touch selection mode is on, so opening another folder turns it off.
    const [selectingKey, setSelectingKey] = useState<string | null>(null);
    const selecting = openKey !== null && selectingKey === openKey;

    // An entry still waiting to be selected is forgotten once another folder opens.
    if (reveal && reveal.key !== openKey) {
        setReveal(null);
    }

    const hasActions = useMemo(() => actions.some((group) => group.actions.length > 0), [actions]);

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

    // With path ids, a moved folder's old id is free for another folder, so its cached listing is
    // dropped. A place inside a moved folder can't be followed, so it goes where the folder went.
    const handleTransferred = useCallback(
        (request: TransferRequest, destination: Place) => {
            closeTransfer();

            if (request.kind !== "move") {
                return;
            }

            const movedIds = new Set(request.entries.filter((entry) => entry.kind === "folder").map((entry) => entry.id));

            movedIds.forEach((id) => store.forget(folderKey(request.section.id, id)));

            if (place.sectionId === request.section.id && place.trail.some((step) => movedIds.has(step.id))) {
                goTo(destination);
            }
        },
        [closeTransfer, store, place, goTo],
    );

    // The new or renamed entry is selected if its folder is open. A renamed folder keeps its
    // place in the path, the history and the sidebar tree.
    const handleNamed = useCallback(
        (request: NameRequest, entry: FileEntry) => {
            const { section: target, trail } = request;
            const parentKey = folderKey(target.id, folderOf(target, trail).id);
            const before = request.kind === "rename" ? request.entry : undefined;

            closeNaming();

            if (parentKey === openKey) {
                setReveal({ key: parentKey, id: entry.id });
            }

            if (entry.kind !== "folder") {
                return;
            }

            // A folder's new id may have named another folder before, as a path does after that
            // folder was renamed away, so anything cached under it is stale. So is the old id.
            if (entry.id !== before?.id) {
                store.forget(folderKey(target.id, entry.id));

                if (before) {
                    store.forget(folderKey(target.id, before.id));
                }
            }

            if (!before) {
                return;
            }

            rewrite((visited) => renameInPlace(visited, target.id, before, entry));

            if (entry.id !== before.id) {
                const oldKey = folderKey(target.id, before.id);

                setExpanded((prev) => {
                    if (!prev.has(oldKey)) {
                        return prev;
                    }

                    const next = new Set(prev);

                    next.delete(oldKey);
                    next.add(folderKey(target.id, entry.id));

                    return next;
                });
            }
        },
        [closeNaming, openKey, store, rewrite],
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
                        (candidate) => (candidate.adapter ?? adapter) === folderAdapter,
                    ),
                });

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
            };
        },
        [adapter, store, goTo, askName, askDestination, sectionsById],
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
            <Box sx={rootSx}>
                <Box sx={frameSx}>
                    <Backdrop open={sidebarOpen} sx={backdropSx} onClick={closeSidebar} />
                    <Sidebar
                        title={title}
                        groups={sections}
                        single={singleSection}
                        expanded={expanded}
                        openKey={openKey}
                        open={sidebarOpen}
                        onToggle={toggleExpanded}
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
                        {/* Keyed by folder so each one opens scrolled to the top, with nothing selected. */}
                        <Box key={openKey ?? undefined} sx={viewSx}>
                            {section && (
                                <FolderView
                                    section={section}
                                    trail={place.trail}
                                    view={view}
                                    sort={sort}
                                    hasActions={hasActions}
                                    selecting={selecting}
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
                </Box>
                <ContextMenu menu={menu} onClose={closeMenu} />
                {naming && (
                    <NameDialog
                        key={naming.id}
                        open={naming.open}
                        request={naming.request}
                        onClose={closeNaming}
                        onDone={handleNamed}
                    />
                )}
                {transfer && (
                    <TransferDialog
                        key={transfer.id}
                        open={transfer.open}
                        request={transfer.request}
                        onClose={closeTransfer}
                        onDone={handleTransferred}
                    />
                )}
            </Box>
        </DataContext>
    );
};

export default FileManager;
