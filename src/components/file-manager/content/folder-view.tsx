import { useCallback, useMemo } from "react";
import type { MouseEvent, ReactNode } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useFolder } from "../../../hooks/use-folder";
import { useSelection } from "../../../hooks/use-selection";
import { compareEntries } from "../../../utils/format";
import { pointerPosition } from "../../../utils/menu-position";
import { folderOf } from "../../../utils/navigation";
import { selectModifiers } from "../../../utils/selection";
import Icon from "../../icons/icon";
import FileGrid from "./file-grid";
import FileList from "./file-list";

import type { FileEntry, FolderRef, MenuPosition, OpenMenu, Place, Section, ViewMode } from "../../../types";

interface FolderViewProps {
    section: Section;
    trail: FolderRef[];
    view: ViewMode;
    hasActions: boolean;
    onNavigate: (place: Place) => void;
    onOpenMenu: OpenMenu;
}

// Fills the scroll panel even when the folder is short, so its empty space takes clicks and right-clicks.
const surfaceSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    minHeight: "100%",
};

// Overlays the top edge while a loaded folder refreshes, without pushing the content down.
const progressSx: SxProps<Theme> = {
    position: "sticky",
    top: 0,
    zIndex: 2,
    mb: "-4px",
};

const stateSx: SxProps<Theme> = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    p: 3,
    textAlign: "center",
    color: "text.secondary",
};

const stateIconSx: SxProps<Theme> = {
    fontSize: "3rem",
    opacity: 0.6,
};

const stateTitleSx: SxProps<Theme> = {
    color: "text.primary",
    fontWeight: 600,
};

/**
 * The open folder's contents. It owns the selection, so the selection starts empty in every
 * folder (the file manager remounts this per folder) and is never shared with the sidebar.
 */
const FolderView = ({ section, trail, view, hasActions, onNavigate, onOpenMenu }: FolderViewProps) => {
    const { state, reload } = useFolder(section, folderOf(section, trail).id, true);

    const entries = useMemo(() => (state?.entries ? [...state.entries].sort(compareEntries) : undefined), [state?.entries]);

    const { selectedIds, selected, select, clear } = useSelection(entries);

    const handleOpen = useCallback(
        (entry: FileEntry) => {
            if (entry.kind === "folder") {
                onNavigate({ sectionId: section.id, trail: [...trail, { id: entry.id, name: entry.name }] });
            }
        },
        [onNavigate, section.id, trail],
    );

    // As in desktop file managers, the menu of a selected entry acts on the whole selection, while
    // any other entry is selected on its own first and the menu acts on it alone.
    const handleEntryMenu = useCallback(
        (position: MenuPosition, entry: FileEntry) => {
            const inSelection = selectedIds.has(entry.id);

            if (!inSelection) {
                select(entry.id);
            }

            return onOpenMenu(position, {
                target: "selection",
                section,
                trail,
                entries: inSelection ? selected : [entry],
            });
        },
        [selectedIds, selected, select, onOpenMenu, section, trail],
    );

    // Clicking empty space clears the selection, unless Ctrl or Shift is held: a modifier click
    // that just misses an entry shouldn't throw a built-up selection away.
    const handleBackgroundClick = (event: MouseEvent) => {
        const { toggle, range } = selectModifiers(event);

        if (!toggle && !range) {
            clear();
        }
    };

    const handleBackgroundMenu = (event: MouseEvent) => {
        clear();

        if (onOpenMenu(pointerPosition(event), { target: "folder", section, trail, entries: [] })) {
            event.preventDefault();
        }
    };

    const ContentView = view === "list" ? FileList : FileGrid;
    let content: ReactNode;

    if (entries?.length) {
        content = (
            <ContentView
                entries={entries}
                selectedIds={selectedIds}
                hasActions={hasActions}
                onSelect={select}
                onOpen={handleOpen}
                onMenu={handleEntryMenu}
            />
        );
    } else if (entries) {
        content = (
            <Box sx={stateSx}>
                <Icon name="folderOpen" sx={stateIconSx} />
                <Typography sx={stateTitleSx}>Folder is empty</Typography>
            </Box>
        );
    } else if (state?.status === "error") {
        content = (
            <Box sx={stateSx}>
                <Icon name="info" sx={stateIconSx} />
                <Typography sx={stateTitleSx}>Couldn't open this folder</Typography>
                {state.error instanceof Error && <Typography variant="body2">{state.error.message}</Typography>}
                <Button
                    size="small"
                    variant="outlined"
                    onClick={(event) => {
                        event.stopPropagation();
                        reload();
                    }}
                >
                    Try again
                </Button>
            </Box>
        );
    } else {
        content = (
            <Box sx={stateSx}>
                <CircularProgress size={28} />
            </Box>
        );
    }

    return (
        <Box sx={surfaceSx} onClick={handleBackgroundClick} onContextMenu={handleBackgroundMenu}>
            {state?.status === "loading" && entries && <LinearProgress sx={progressSx} />}
            {content}
        </Box>
    );
};

export default FolderView;
