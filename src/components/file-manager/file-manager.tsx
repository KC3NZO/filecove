import { useCallback, useEffect, useMemo, useState } from "react";

import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import { DataContext } from "../../contexts/data-context";
import { usePlaceHistory } from "../../hooks/use-place-history";
import { createFolderStore, folderKey } from "../../store/folder-store";
import { ROOT_CONTAINER, VIEW_CONTAINER, rootWide } from "../../styles/layout";
import { visibleActionGroups } from "../../utils/action-groups";
import { folderOf } from "../../utils/navigation";
import { DEFAULT_SORT } from "../../utils/sort";
import FolderView from "./content/folder-view";
import ContextMenu from "./context-menu/context-menu";
import HeaderBar from "./header-bar/header-bar";
import PathBar from "./header-bar/path-bar";
import Sidebar from "./sidebar/sidebar";

import type {
    ActionContext,
    ActionGroup,
    FileAdapter,
    OpenMenu,
    Place,
    Section,
    SectionGroup,
    SortOrder,
    ViewMode,
} from "../../types";
import type { MenuState } from "./context-menu/context-menu";

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

    const { place, canGoBack, canGoForward, navigate, back, forward } = usePlaceHistory(() => ({
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
    // The folder in which touch selection mode is on, so opening another folder turns it off.
    const [selectingKey, setSelectingKey] = useState<string | null>(null);
    const selecting = openKey !== null && selectingKey === openKey;

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

    const openMenu = useCallback<OpenMenu>(
        (position, { target, section: menuSection, trail, entries }) => {
            const menuFolder = folderOf(menuSection, trail);
            const context: ActionContext = {
                target,
                entries,
                folder: menuFolder,
                section: menuSection,
                refresh: () => {
                    const folderAdapter = menuSection.adapter ?? adapter;

                    store.load(folderKey(menuSection.id, menuFolder.id), folderAdapter, menuFolder.id, true);
                },
                openFolder: (entry) => {
                    goTo({ sectionId: menuSection.id, trail: [...trail, { id: entry.id, name: entry.name }] });
                },
            };
            const groups = visibleActionGroups(actions, context);

            if (groups.length === 0) {
                return false;
            }

            setMenu({ open: true, position, context, groups });

            return true;
        },
        [actions, adapter, store, goTo],
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
                                    onSelectingChange={setSelecting}
                                    onSortChange={setSort}
                                    onNavigate={goTo}
                                    onOpenMenu={openMenu}
                                />
                            )}
                        </Box>
                    </Box>
                </Box>
                <ContextMenu menu={menu} onClose={closeMenu} />
            </Box>
        </DataContext>
    );
};

export default FileManager;
