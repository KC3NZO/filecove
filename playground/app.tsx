import { useCallback, useRef, useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { FileManager } from "../src";
import { useHashLocation } from "./hooks/use-hash-location";
import { useStoredState } from "./hooks/use-stored-state";
import { childId } from "./mocks/mock-adapter";
import { createDemoActions, sections, serverAdapter } from "./mocks/mock-data";
import { locale, single, uncontrolled } from "./options";

import type {
    FileEntry,
    FileManagerApi,
    FileManagerLocation,
    SectionFolder,
    SelectionDetails,
    SortOrder,
    ViewMode,
} from "../src";

interface Selection {
    ids: string[];
    entries: FileEntry[];
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
    const apiRef = useRef<FileManagerApi>(null);
    const [location, setLocation] = useHashLocation(shownSections);
    const [view, setView] = useStoredState<ViewMode>("view", "list");
    const [sort, setSort] = useStoredState<SortOrder>("sort", { key: "name", direction: "asc" });
    const [showHidden, setShowHidden] = useStoredState("showHidden", false);
    const [sidebarHidden, setSidebarHidden] = useStoredState("sidebarHidden", false);
    // The section the playground opens in starts expanded, as it does when the file manager keeps it.
    const [expandedFolders, setExpandedFolders] = useStoredState<SectionFolder[]>("expandedFolders", () =>
        shownSections
            .filter((shown) => shown.id === location.sectionId)
            .map((shown) => ({ sectionId: shown.id, folderId: shown.rootId })),
    );
    const [selection, setSelection] = useState(NOTHING_SELECTED);

    const handleSelectionChange = useCallback(
        (ids: string[], { entries }: SelectionDetails) => setSelection({ ids, entries }),
        [],
    );

    // Goes to the file's folder and selects the file, scrolled to once the folder is listed. With
    // the location and the selection controlled, both are asked of the playground, and it takes them.
    const showFile = () => apiRef.current?.reveal(SHOWN.id, SHOWN.location);

    // Uncontrolled, what the playground keeps only sets where the file manager starts.
    const settings = uncontrolled
        ? {
              defaultLocation: location,
              defaultView: view,
              defaultSort: sort,
              defaultShowHidden: showHidden,
              defaultSidebarHidden: sidebarHidden,
              defaultExpandedFolders: expandedFolders,
          }
        : {
              location,
              onLocationChange: setLocation,
              view,
              onViewChange: setView,
              sort,
              onSortChange: setSort,
              showHidden,
              onShowHiddenChange: setShowHidden,
              sidebarHidden,
              onSidebarHiddenChange: setSidebarHidden,
              expandedFolders,
              onExpandedFoldersChange: setExpandedFolders,
              selectedIds: selection.ids,
          };

    const shared = {
        adapter: serverAdapter,
        actions,
        locale,
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
                <FileManager {...shared} sections={sections} />
            )}
            <Box component="footer" sx={footerSx}>
                <Typography variant="body2" noWrap sx={summarySx}>
                    {describe(selection)}
                </Typography>
                <Button size="small" color="inherit" onClick={showFile}>
                    Show a file
                </Button>
                <Button size="small" color="inherit" onClick={() => apiRef.current?.refresh()}>
                    Reload all
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
