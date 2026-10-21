import type { ReactNode, Ref } from "react";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import type { SxProps, Theme } from "@mui/material/styles";

import { HEADER_HEIGHT, rootMedium, rootWide } from "../../../styles/layout";
import Icon from "../../icons/icon";
import ViewMenu from "./view-menu";

import type { SortOrder, ViewMode } from "../../../types";

interface HeaderBarProps {
    /** Centre slot, normally the path bar. */
    pathBar: ReactNode;
    canGoBack: boolean;
    canGoForward: boolean;
    view: ViewMode;
    sort: SortOrder;
    showHidden: boolean;
    /** Whether touch selection mode is on. */
    selecting: boolean;
    onBack: () => void;
    onForward: () => void;
    onToggleView: () => void;
    onSortChange: (sort: SortOrder) => void;
    onToggleHidden: () => void;
    onToggleSelecting: () => void;
    onOpenSidebar: () => void;
    /** The button that shows the collapsed sidebar, which takes the focus back when it closes. */
    sidebarButtonRef?: Ref<HTMLButtonElement>;
}

// Narrow: the buttons on top and the path bar on a row of its own below them, just above the
// content it describes, since beside the buttons it would only have room for one segment.
// From `rootMedium` it moves between the buttons and stays centred while there is room, giving
// way to the buttons when there isn't.
const headerSx: SxProps<Theme> = {
    display: "grid",
    gridTemplateAreas: '"start . end" "path path path"',
    gridTemplateColumns: "max-content minmax(0, 1fr) max-content",
    gridTemplateRows: `${HEADER_HEIGHT}px auto`,
    alignItems: "center",
    columnGap: 1,
    flexShrink: 0,
    minHeight: HEADER_HEIGHT,
    px: 1,
    pb: 0.75,
    [rootMedium]: {
        gridTemplateAreas: '"start path end"',
        gridTemplateColumns: "minmax(max-content, 1fr) minmax(0, 48rem) minmax(max-content, 1fr)",
        gridTemplateRows: "auto",
        pb: 0,
    },
};

const startGroupSx: SxProps<Theme> = {
    gridArea: "start",
    display: "flex",
    alignItems: "center",
    gap: 0.25,
};

const pathSlotSx: SxProps<Theme> = {
    gridArea: "path",
    minWidth: 0,
};

const endGroupSx: SxProps<Theme> = {
    gridArea: "end",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 0.25,
};

/** Only while the sidebar is collapsed: its toggle, and search, which otherwise lives in the sidebar. */
const collapsedOnlySx: SxProps<Theme> = {
    [rootWide]: { display: "none" },
};

// Touch screens only, which have no Ctrl or Shift to select several entries with. This asks what
// the input can do, not how wide the screen is, so it is a media query rather than a container one.
const selectButtonSx: SxProps<Theme> = {
    display: "none",
    '&[aria-pressed="true"]': { color: "primary.main" },
    "@media (hover: none)": { display: "inline-flex" },
};

const mediumUpSx: SxProps<Theme> = {
    display: "none",
    [rootMedium]: { display: "inline-flex" },
};

const HeaderBar = ({
    pathBar,
    canGoBack,
    canGoForward,
    view,
    sort,
    showHidden,
    selecting,
    onBack,
    onForward,
    onToggleView,
    onSortChange,
    onToggleHidden,
    onToggleSelecting,
    onOpenSidebar,
    sidebarButtonRef,
}: HeaderBarProps) => (
    <Box sx={headerSx}>
        <Box sx={startGroupSx}>
            <IconButton ref={sidebarButtonRef} aria-label="Show sidebar" sx={collapsedOnlySx} onClick={onOpenSidebar}>
                <Icon name="menu" fontSize="small" />
            </IconButton>
            <IconButton aria-label="Back" disabled={!canGoBack} onClick={onBack}>
                <Icon name="arrowBack" fontSize="small" />
            </IconButton>
            <IconButton aria-label="Forward" disabled={!canGoForward} sx={mediumUpSx} onClick={onForward}>
                <Icon name="arrowForward" fontSize="small" />
            </IconButton>
        </Box>
        <Box sx={pathSlotSx}>{pathBar}</Box>
        <Box sx={endGroupSx}>
            <IconButton
                aria-label={selecting ? "Done selecting" : "Select"}
                aria-pressed={selecting}
                sx={selectButtonSx}
                onClick={onToggleSelecting}
            >
                <Icon name="selectMode" fontSize="small" />
            </IconButton>
            <IconButton aria-label="Search" sx={collapsedOnlySx}>
                <Icon name="search" fontSize="small" />
            </IconButton>
            <IconButton aria-label={view === "list" ? "Grid view" : "List view"} onClick={onToggleView}>
                <Icon name={view === "list" ? "gridView" : "listView"} fontSize="small" />
            </IconButton>
            <ViewMenu
                sort={sort}
                showHidden={showHidden}
                onSortChange={onSortChange}
                onToggleHidden={onToggleHidden}
            />
        </Box>
    </Box>
);

export default HeaderBar;
