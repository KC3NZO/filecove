import { useCallback, useEffect, useRef, useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { FileManager } from "../src";
import { useHashLocation } from "./hooks/use-hash-location";
import { useStoredState } from "./hooks/use-stored-state";
import { addElsewhere, childId } from "./mocks/mock-adapter";
import {
    createDemoActions,
    createDemoMainMenu,
    createPreviewActions,
    createPropertiesActions,
    sections,
    serverAdapter,
} from "./mocks/mock-data";
import { previewers } from "./mocks/mock-previewers";
import { lateSections, locale, relistAfter, single, uncontrolled } from "./options";

import type {
    FileEntry,
    FileManagerApi,
    FileManagerLocation,
    FileManagerSearch,
    SectionFolder,
    SectionGroup,
    SelectionDetails,
    SortOrder,
    ViewMode,
    ViewZoom,
} from "../src";

interface Selection {
    ids: string[];
    entries: FileEntry[];
    /** Where they're selected; missing until something is told. */
    location?: FileManagerLocation;
}

/** A file to show in its folder from outside the file manager, as a link elsewhere in an app might. */
interface Shown {
    location: FileManagerLocation;
    id: string;
}

const NOTHING_SELECTED: Selection = { ids: [], entries: [] };

const singleSection = sections[0].sections[0];
const shownSections = single ? [singleSection] : sections.flatMap((group) => group.sections);

// Far down a folder of 10,000 files, so showing it scrolls there; in a single section, a file in Website.
const archiveId = childId("/server/project/b", "archive");
const componentsTrail = [
    { id: childId("/server/project/a", "src"), name: "src" },
    { id: childId("/server/project/a/src", "components"), name: "components" },
];
const SHOWN: Shown = single
    ? {
          location: { sectionId: singleSection.id, trail: componentsTrail },
          id: childId(componentsTrail[1].id, "sidebar.tsx"),
      }
    : {
          location: { sectionId: "project-b", trail: [{ id: archiveId, name: "archive" }] },
          id: childId(archiveId, "record-07500.pdf"),
      };

const appSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
};

// The file manager fills its container by default; here it shares the page with the footer.
const fileManagerSx: SxProps<Theme> = {
    flex: 1,
    minHeight: 0,
    height: "auto",
};

const footerSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    minHeight: 40,
    px: 2,
    borderTop: 1,
    borderColor: "divider",
    bgcolor: "background.default",
};

const summarySx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    color: "text.secondary",
};

const describe = ({ ids, entries }: Selection) => {
    if (ids.length === 0) {
        return "Nothing selected";
    }

    if (entries.length === 0 || entries.length > 3) {
        return `${ids.length} selected`;
    }

    return `Selected: ${entries.map((entry) => entry.name).join(", ")}`;
};

const App = () => {
    const [notice, setNotice] = useState({ open: false, message: "" });
    const [actions] = useState(() => createDemoActions((message) => setNotice({ open: true, message })));
    const [mainMenu] = useState(() => createDemoMainMenu((message) => setNotice({ open: true, message })));
    const [previewActions] = useState(() => createPreviewActions((message) => setNotice({ open: true, message })));
    const [propertiesActions] = useState(() =>
        createPropertiesActions((message) => setNotice({ open: true, message })),
    );
    const apiRef = useRef<FileManagerApi>(null);
    const [location, setLocation] = useHashLocation(shownSections);
    const [view, setView] = useStoredState<ViewMode>("view", "list");
    const [zoom, setZoom] = useStoredState<ViewZoom>("zoom", { list: 0, grid: 0 });
    const [sort, setSort] = useStoredState<SortOrder>("sort", { key: "name", direction: "asc" });
    const [showHidden, setShowHidden] = useStoredState("showHidden", false);
    const [sidebarHidden, setSidebarHidden] = useStoredState("sidebarHidden", false);
    const [propertiesOpen, setPropertiesOpen] = useStoredState("propertiesOpen", false);
    // The section the playground opens in starts expanded, as it does when the file manager keeps it.
    const [expandedFolders, setExpandedFolders] = useStoredState<SectionFolder[]>("expandedFolders", () =>
        shownSections
            .filter((shown) => shown.id === location.sectionId)
            .map((shown) => ({ sectionId: shown.id, folderId: shown.rootId })),
    );
    // A search is passing, so it isn't kept across reloads; which sections a search everywhere leaves
    // out is a choice, so it is.
    const [search, setSearch] = useState<FileManagerSearch | null>(null);
    const [searchExcluded, setSearchExcluded] = useStoredState<string[]>("searchExcludedSections", []);
    const [selection, setSelection] = useState(NOTHING_SELECTED);
    // `?lateSections`: none until they come, as from an app's server.
    const [shownGroups, setShownGroups] = useState<SectionGroup[]>(() => (lateSections ? [] : sections));

    useEffect(() => {
        if (!lateSections) {
            return;
        }

        const timer = setTimeout(() => setShownGroups(sections), 3000);

        return () => clearTimeout(timer);
    }, []);

    const handleSelectionChange = useCallback(
        (ids: string[], { entries, location: at }: SelectionDetails) => setSelection({ ids, entries, location: at }),
        [],
    );

    // Goes to the file's folder and selects the file, scrolled to once the folder is listed. With
    // the location and the selection controlled, both are asked of the playground, and it takes them.
    const showFile = () => apiRef.current?.reveal(SHOWN.id, SHOWN.location);

    // Downloads the selection, or with nothing selected, the open folder, as a toolbar of an app's
    // own would, through the download panel.
    const selected = selection.entries.length > 0;

    const download = () => {
        const asked = selected
            ? apiRef.current?.download(selection.entries, selection.location)
            : apiRef.current?.download();

        if (asked === false) {
            setNotice({ open: true, message: "Nothing here can be downloaded" });
        }
    };

    // Shows the selection's properties, or with nothing selected, the open folder's, as a toolbar of an
    // app's own would, through the same panel as the context menu's Properties.
    const showProperties = () => {
        const context = selected
            ? apiRef.current?.actionContext(selection.entries, selection.location)
            : apiRef.current?.actionContext();

        context?.properties();
    };

    // Makes a folder in the open folder, as a toolbar of an app's own would, through the same name
    // dialog as the context menu's New folder.
    const createFolder = () => {
        const create = apiRef.current?.actionContext()?.createFolder;

        if (create) {
            create();
        } else {
            setNotice({ open: true, message: "No folder can be made here" });
        }
    };

    // Opens a search everywhere, or the open folder's in a single section, as a search box of an app's
    // own would, with a word typed in.
    const searchFor = () => {
        if (apiRef.current?.search(single ? "folder" : "everywhere", "record") === false) {
            setNotice({ open: true, message: "Nothing here can be searched" });
        }
    };

    // Adds a file to the open folder behind the file manager's back, as another user would, which
    // shows once the folder is opened again, as it's listed again then (`?relistAfter=` sets how often).
    const changeElsewhere = () => {
        const here = apiRef.current?.actionContext();
        const name = here ? addElsewhere(here.section.adapter ?? serverAdapter, here.folder.id) : null;

        setNotice({
            open: true,
            message: name ? `"${name}" was added elsewhere. Open the folder again to see it` : "Nothing can be added here",
        });
    };

    // Uncontrolled, what the playground keeps only sets where the file manager starts.
    const settings = uncontrolled
        ? {
              defaultLocation: location,
              defaultView: view,
              defaultZoom: zoom,
              defaultSort: sort,
              defaultShowHidden: showHidden,
              defaultSidebarHidden: sidebarHidden,
              defaultPropertiesOpen: propertiesOpen,
              defaultExpandedFolders: expandedFolders,
              defaultSearchExcludedSections: searchExcluded,
          }
        : {
              location,
              onLocationChange: setLocation,
              view,
              onViewChange: setView,
              zoom,
              onZoomChange: setZoom,
              sort,
              onSortChange: setSort,
              showHidden,
              onShowHiddenChange: setShowHidden,
              sidebarHidden,
              onSidebarHiddenChange: setSidebarHidden,
              propertiesOpen,
              onPropertiesOpenChange: setPropertiesOpen,
              expandedFolders,
              onExpandedFoldersChange: setExpandedFolders,
              search,
              onSearchChange: setSearch,
              searchExcludedSections: searchExcluded,
              onSearchExcludedSectionsChange: setSearchExcluded,
              selectedIds: selection.ids,
          };

    const shared = {
        adapter: serverAdapter,
        actions,
        previewActions,
        propertiesActions,
        previewers,
        mainMenu,
        locale,
        relistAfter,
        apiRef,
        sx: fileManagerSx,
        onSelectionChange: handleSelectionChange,
        ...settings,
    };

    return (
        <Box sx={appSx}>
            {single ? (
                <FileManager {...shared} section={singleSection} />
            ) : (
                <FileManager {...shared} sections={shownGroups} />
            )}
            <Box component="footer" sx={footerSx}>
                <Typography variant="body2" noWrap sx={summarySx}>
                    {describe(selection)}
                </Typography>
                <Button size="small" color="inherit" onClick={download}>
                    {selected ? "Download selection" : "Download folder"}
                </Button>
                <Button size="small" color="inherit" onClick={createFolder}>
                    New folder
                </Button>
                <Button size="small" color="inherit" onClick={showProperties}>
                    Properties
                </Button>
                <Button size="small" color="inherit" onClick={searchFor}>
                    Search "record"
                </Button>
                <Button size="small" color="inherit" onClick={showFile}>
                    Show a file
                </Button>
                <Button size="small" color="inherit" onClick={changeElsewhere}>
                    Change elsewhere
                </Button>
                <Button size="small" color="inherit" onClick={() => apiRef.current?.refresh()}>
                    Reload all
                </Button>
                <Button size="small" color="inherit" onClick={() => apiRef.current?.showShortcuts()}>
                    Shortcuts
                </Button>
            </Box>
            <Snackbar
                open={notice.open}
                message={notice.message}
                autoHideDuration={3000}
                onClose={() => setNotice((prev) => ({ ...prev, open: false }))}
            />
        </Box>
    );
};

export default App;
