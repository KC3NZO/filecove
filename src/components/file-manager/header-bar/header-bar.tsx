import type { ReactNode, Ref } from "react";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../../hooks/use-locale";
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
    /** Whether the docked sidebar is hidden. */
    sidebarHidden: boolean;
    /** Whether the sidebar docks at the moment, rather than collapsing, as container queries decide. */
    sidebarDocked: () => boolean;
    onBack: () => void;
    onForward: () => void;
    onToggleView: () => void;
    onSortChange: (sort: SortOrder) => void;
    onToggleHidden: () => void;
    onToggleSelecting: () => void;
    /** Opens the collapsed sidebar, or shows the hidden docked one. */
    onShowSidebar: () => void;
    /** Hides or shows the docked sidebar. */
    onToggleSidebar: () => void;
    /** The button that shows the sidebar, which takes the focus back when the overlay closes. */
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

/**
 * Only while the sidebar is collapsed, or hidden: the button that shows it, and search, which
 * otherwise lives in the sidebar.
 */
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
    sidebarHidden,
    sidebarDocked,
    onBack,
    onForward,
    onToggleView,
    onSortChange,
    onToggleHidden,
    onToggleSelecting,
    onShowSidebar,
    onToggleSidebar,
    sidebarButtonRef,
}: HeaderBarProps) => {
    const { text } = useLocale();

    return (
        <Box sx={headerSx}>
            <Box sx={startGroupSx}>
                <IconButton
                    ref={sidebarButtonRef}
                    aria-label={text.showSidebar}
                    aria-keyshortcuts="F9"
                    sx={sidebarHidden ? undefined : collapsedOnlySx}
                    onClick={onShowSidebar}
                >
                    <Icon name="menu" fontSize="small" />
                </IconButton>
                <IconButton aria-label={text.back} disabled={!canGoBack} onClick={onBack}>
                    <Icon name="arrowBack" fontSize="small" />
                </IconButton>
                <IconButton aria-label={text.forward} disabled={!canGoForward} sx={mediumUpSx} onClick={onForward}>
                    <Icon name="arrowForward" fontSize="small" />
                </IconButton>
            </Box>
            <Box sx={pathSlotSx}>{pathBar}</Box>
            <Box sx={endGroupSx}>
                <IconButton
                    aria-label={selecting ? text.doneSelecting : text.select}
                    aria-pressed={selecting}
                    sx={selectButtonSx}
                    onClick={onToggleSelecting}
                >
                    <Icon name="selectMode" fontSize="small" />
                </IconButton>
                <IconButton aria-label={text.search} sx={sidebarHidden ? undefined : collapsedOnlySx}>
                    <Icon name="search" fontSize="small" />
                </IconButton>
                <IconButton aria-label={view === "list" ? text.gridView : text.listView} onClick={onToggleView}>
                    <Icon name={view === "list" ? "gridView" : "listView"} fontSize="small" />
                </IconButton>
                <ViewMenu
                    sort={sort}
                    showHidden={showHidden}
                    sidebarHidden={sidebarHidden}
                    sidebarDocked={sidebarDocked}
                    onSortChange={onSortChange}
                    onToggleHidden={onToggleHidden}
                    onToggleSidebar={onToggleSidebar}
                />
            </Box>
        </Box>
    );
};

export default HeaderBar;
