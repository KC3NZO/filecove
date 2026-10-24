import type { ReactNode, Ref } from "react";

import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../../hooks/use-locale";
import { HEADER_HEIGHT, rootMedium, rootWide } from "../../../styles/layout";
import { forcedColors, forcedPressed } from "../../../styles/mixins";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";
import ViewMenu from "./view-menu";

import type { SearchScope, SortOrder, ViewMode } from "../../../types";

interface HeaderBarProps {
    /** Centre slot, the path bar, or the search field while searching. */
    pathBar: ReactNode;
    canGoBack: boolean;
    canGoForward: boolean;
    /** Whether a folder is open, which the folder search and selection mode need. */
    hasFolder: boolean;
    view: ViewMode;
    sort: SortOrder;
    showHidden: boolean;
    /** Whether touch selection mode is on. */
    selecting: boolean;
    /** What the search field in the path bar's place searches, or null while it isn't there. */
    searchScope: SearchScope | null;
    /** Whether any section can be searched everywhere, without which its button isn't there. */
    canSearchEverywhere: boolean;
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
    /** Opens a search with this scope, switches to it, or closes it when it's the open one. */
    onSearch: (scope: SearchScope) => void;
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

// The path bar, or the search field in its place, then the button that searches the open folder,
// which stays beside either so it never moves.
const pathSlotSx: SxProps<Theme> = {
    gridArea: "path",
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    minWidth: 0,
};

const pathSx: SxProps<Theme> = {
    flex: 1,
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
 * Only while the sidebar is collapsed, or hidden: the button that shows it, and search everywhere,
 * which otherwise lives at the top of the sidebar.
 */
const collapsedOnlySx: SxProps<Theme> = {
    [rootWide]: { display: "none" },
};

const pressedSx: SxProps<Theme> = {
    '&[aria-pressed="true"]': { color: "primary.main" },
    [forcedColors]: forcedPressed,
};

const collapsedOnlyPressedSx: SxProps<Theme> = {
    '&[aria-pressed="true"]': { color: "primary.main" },
    [forcedColors]: forcedPressed,
    [rootWide]: { display: "none" },
};

// Touch screens only, which have no Ctrl or Shift to select several entries with. This asks what
// the input can do, not how wide the screen is, so it is a media query rather than a container one.
const selectButtonSx: SxProps<Theme> = {
    display: "none",
    '&[aria-pressed="true"]': { color: "primary.main" },
    "@media (hover: none)": { display: "inline-flex" },
    [forcedColors]: forcedPressed,
};

const mediumUpSx: SxProps<Theme> = {
    display: "none",
    [rootMedium]: { display: "inline-flex" },
};

const HeaderBar = ({
    pathBar,
    canGoBack,
    canGoForward,
    hasFolder,
    view,
    sort,
    showHidden,
    selecting,
    searchScope,
    canSearchEverywhere,
    sidebarHidden,
    sidebarDocked,
    onBack,
    onForward,
    onToggleView,
    onSortChange,
    onToggleHidden,
    onToggleSelecting,
    onSearch,
    onShowSidebar,
    onToggleSidebar,
    sidebarButtonRef,
}: HeaderBarProps) => {
    const { text } = useLocale();

    return (
        <Box sx={headerSx}>
            <Box sx={startGroupSx}>
                <TooltipIconButton
                    ref={sidebarButtonRef}
                    label={text.showSidebar}
                    aria-keyshortcuts="F9"
                    sx={sidebarHidden ? undefined : collapsedOnlySx}
                    onClick={onShowSidebar}
                >
                    <Icon name="menu" fontSize="small" />
                </TooltipIconButton>
                <TooltipIconButton label={text.back} disabled={!canGoBack} onClick={onBack}>
                    <Icon name="arrowBack" fontSize="small" />
                </TooltipIconButton>
                <TooltipIconButton label={text.forward} disabled={!canGoForward} sx={mediumUpSx} onClick={onForward}>
                    <Icon name="arrowForward" fontSize="small" />
                </TooltipIconButton>
            </Box>
            <Box sx={pathSlotSx}>
                <Box sx={pathSx}>{pathBar}</Box>
                {/* Keeps the focus in an open search's field as it's pressed, which it closes or
                    switches to searching the folder. */}
                <TooltipIconButton
                    label={text.searchFolder}
                    aria-pressed={searchScope === "folder"}
                    aria-keyshortcuts="Control+F Meta+F"
                    disabled={!hasFolder}
                    sx={pressedSx}
                    onMouseDown={(event) => searchScope && event.preventDefault()}
                    onClick={() => onSearch("folder")}
                >
                    <Icon name="searchFolder" fontSize="small" />
                </TooltipIconButton>
            </Box>
            <Box sx={endGroupSx}>
                <TooltipIconButton
                    label={selecting ? text.doneSelecting : text.select}
                    aria-pressed={selecting}
                    disabled={!hasFolder}
                    sx={selectButtonSx}
                    onClick={onToggleSelecting}
                >
                    <Icon name="selectMode" fontSize="small" />
                </TooltipIconButton>
                {/* The sidebar's magnifier, while the sidebar isn't there to hold it. */}
                {canSearchEverywhere && (
                    <TooltipIconButton
                        label={text.searchEverywhere}
                        aria-pressed={searchScope === "everywhere"}
                        aria-keyshortcuts="Control+Shift+F Meta+Shift+F"
                        sx={sidebarHidden ? pressedSx : collapsedOnlyPressedSx}
                        onMouseDown={(event) => searchScope && event.preventDefault()}
                        onClick={() => onSearch("everywhere")}
                    >
                        <Icon name="search" fontSize="small" />
                    </TooltipIconButton>
                )}
                <TooltipIconButton label={view === "list" ? text.gridView : text.listView} onClick={onToggleView}>
                    <Icon name={view === "list" ? "gridView" : "listView"} fontSize="small" />
                </TooltipIconButton>
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
