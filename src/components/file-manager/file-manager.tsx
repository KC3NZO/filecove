import { useCallback, useState } from "react";

import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import FileGrid from "./content/file-grid";
import FileList from "./content/file-list";
import HeaderBar from "./header-bar/header-bar";
import { ROOT_CONTAINER, VIEW_CONTAINER, rootWide } from "./layout";
import Sidebar from "./sidebar/sidebar";

import type { FileItem, LocationSection, PathSegment, ViewMode } from "./types";

export interface FileManagerProps {
    /** Sidebar locations, grouped into sections. */
    sections: LocationSection[];
    /** Entries of the open folder. */
    items: FileItem[];
    /** Path of the open folder, root first. */
    path: PathSegment[];
    /** Shown at the top of the sidebar. */
    title?: string;
    defaultSelectedLocation?: string;
    defaultExpandedLocations?: string[];
    defaultView?: ViewMode;
}

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
    sections,
    items,
    path,
    title = "Files",
    defaultSelectedLocation,
    defaultExpandedLocations,
    defaultView = "list",
}: FileManagerProps) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [view, setView] = useState<ViewMode>(defaultView);
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    const openSidebar = useCallback(() => setSidebarOpen(true), []);
    const closeSidebar = useCallback(() => setSidebarOpen(false), []);
    const toggleView = useCallback(() => setView((prev) => (prev === "list" ? "grid" : "list")), []);

    const ContentView = view === "list" ? FileList : FileGrid;

    return (
        <Box sx={rootSx}>
            <Box sx={frameSx}>
                <Backdrop open={sidebarOpen} sx={backdropSx} onClick={closeSidebar} />
                <Sidebar
                    title={title}
                    sections={sections}
                    open={sidebarOpen}
                    onClose={closeSidebar}
                    defaultSelected={defaultSelectedLocation}
                    defaultExpanded={defaultExpandedLocations}
                />
                <Box sx={mainSx}>
                    <HeaderBar path={path} view={view} onToggleView={toggleView} onOpenSidebar={openSidebar} />
                    <Box sx={viewSx}>
                        <ContentView items={items} selectedId={selectedItem} onSelect={setSelectedItem} />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default FileManager;
