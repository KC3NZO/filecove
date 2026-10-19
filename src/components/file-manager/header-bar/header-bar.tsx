import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import type { SxProps, Theme } from "@mui/material/styles";

import { HEADER_HEIGHT, rootMedium, rootWide } from "../../../styles/layout";
import Icon from "../../icons/icon";

import type { ViewMode } from "../../../types";

interface HeaderBarProps {
    /** Centre slot, normally the path bar. */
    pathBar: ReactNode;
    canGoBack: boolean;
    canGoForward: boolean;
    view: ViewMode;
    /** Whether touch selection mode is on. */
    selecting: boolean;
    onBack: () => void;
    onForward: () => void;
    onToggleView: () => void;
    onToggleSelecting: () => void;
    onOpenSidebar: () => void;
}

const headerSx: SxProps<Theme> = {
    display: "grid",
    // The path bar stays centred while there is room and gives way to the buttons when there isn't.
    gridTemplateColumns: "minmax(max-content, 1fr) minmax(0, 48rem) minmax(max-content, 1fr)",
    alignItems: "center",
    columnGap: 1,
    flexShrink: 0,
    minHeight: HEADER_HEIGHT,
    px: 1,
};

const startGroupSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 0.25,
};

const endGroupSx: SxProps<Theme> = {
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
    selecting,
    onBack,
    onForward,
    onToggleView,
    onToggleSelecting,
    onOpenSidebar,
}: HeaderBarProps) => (
    <Box sx={headerSx}>
        <Box sx={startGroupSx}>
            <IconButton aria-label="Show sidebar" sx={collapsedOnlySx} onClick={onOpenSidebar}>
                <Icon name="menu" fontSize="small" />
            </IconButton>
            <IconButton aria-label="Back" disabled={!canGoBack} onClick={onBack}>
                <Icon name="arrowBack" fontSize="small" />
            </IconButton>
            <IconButton aria-label="Forward" disabled={!canGoForward} sx={mediumUpSx} onClick={onForward}>
                <Icon name="arrowForward" fontSize="small" />
            </IconButton>
        </Box>
        {pathBar}
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
            <IconButton aria-label="View options">
                <Icon name="expand" fontSize="small" />
            </IconButton>
        </Box>
    </Box>
);

export default HeaderBar;
