import { useCallback, useEffect, useMemo, useState } from "react";

import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import FolderView from "./content/folder-view";
import { visibleActionGroups } from "./context-menu/actions";
import ContextMenu from "./context-menu/context-menu";
import { DataContext } from "./data/data-context";
import { createFolderStore, folderKey } from "./data/folder-store";
import HeaderBar from "./header-bar/header-bar";
import PathBar from "./header-bar/path-bar";
import { ROOT_CONTAINER, VIEW_CONTAINER, rootWide } from "./layout";
import { folderOf, usePlaceHistory } from "./navigation";
import Sidebar from "./sidebar/sidebar";

import type { FileAdapter } from "./adapter";
import type { MenuState } from "./context-menu/context-menu";
import type { ActionContext, ActionGroup, OpenMenu, Place, Section, SectionGroup, ViewMode } from "./types";

export interface FileManagerProps {
    /** Backend for every section that doesn't bring its own. */
    adapter: FileAdapter;
    /** Sidebar sections, in groups. Each section is an independent root. */
    sections: SectionGroup[];
    /** Context menu actions, in groups. */
    actions?: ActionGroup[];
    /** Shown at the top of the sidebar. */
    title?: string;
    /** Section open at first; the first one when omitted. */
    defaultSectionId?: string;
    defaultView?: ViewMode;
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

/** Folder keys of a place's section root and every folder on its trail. */
const keysAlong = (section: Section, place: Place) =>
    [section.rootId, ...place.trail.map((folder) => folder.id)].map((id) => folderKey(section.id, id));

const FileManager = ({
    adapter,
    sections,
    actions = NO_ACTIONS,
    title = "Files",
    defaultSectionId,
    defaultView = "list",
}: FileManagerProps) => {
    const [store] = useState(createFolderStore);
    const data = useMemo(() => ({ store, adapter }), [store, adapter]);

    useEffect(() => () => store.abortAll(), [store]);

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

    const [expanded, setExpanded] = useState<ReadonlySet<string>>(
        () => new Set(section ? keysAlong(section, place) : []),
    );
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [view, setView] = useState<ViewMode>(defaultView);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [menu, setMenu] = useState<MenuState | null>(null);

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

    // Going somewhere also reveals it in the sidebar tree, like Explorer's navigation pane.
    const goTo = useCallback(
        (target: Place) => {
            const targetSection = sectionsById.get(target.sectionId);

            if (!targetSection) {
                return;
            }

            navigate(target);
            setSelectedId(null);
            setExpanded((prev) => {
                const keys = keysAlong(targetSection, target);

                return keys.every((key) => prev.has(key)) ? prev : new Set([...prev, ...keys]);
            });
        },
        [navigate, sectionsById],
    );

    const goBack = useCallback(() => {
        back();
        setSelectedId(null);
    }, [back]);

    const goForward = useCallback(() => {
        forward();
        setSelectedId(null);
    }, [forward]);

    const openSidebar = useCallback(() => setSidebarOpen(true), []);
    const closeSidebar = useCallback(() => setSidebarOpen(false), []);
    const toggleView = useCallback(() => setView((prev) => (prev === "list" ? "grid" : "list")), []);
    const closeMenu = useCallback(() => setMenu((prev) => prev && { ...prev, open: false }), []);

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
                        expanded={expanded}
                        selectedKey={section && folder ? folderKey(section.id, folder.id) : null}
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
                            onBack={goBack}
                            onForward={goForward}
                            onToggleView={toggleView}
                            onOpenSidebar={openSidebar}
                        />
                        {/* Keyed by folder so each one opens scrolled to the top. */}
                        <Box key={section && folder ? folderKey(section.id, folder.id) : undefined} sx={viewSx}>
                            {section && (
                                <FolderView
                                    section={section}
                                    trail={place.trail}
                                    view={view}
                                    selectedId={selectedId}
                                    hasActions={hasActions}
                                    onSelect={setSelectedId}
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
