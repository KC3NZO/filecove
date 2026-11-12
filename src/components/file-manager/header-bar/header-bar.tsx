import { useCallback, useState } from "react";
import type { ReactNode, Ref } from "react";

import { useDragHold } from "../../../hooks/use-drop-target";
import { useLocale } from "../../../hooks/use-locale";
import { useLongPress } from "../../../hooks/use-long-press";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";
import { fmClasses } from "../../../styles/classes";
import { cx } from "../../../utils/cx";
import styles from "./header-bar.module.css";
import HistoryMenu from "./history-menu";
import ViewMenu from "./view-menu";

import type { HistoryStop, SearchScope, SortOrder, ViewMode, ViewZoom, ZoomStep } from "../../../types";

type HistoryDirection = "back" | "forward";

interface HistoryList {
    direction: HistoryDirection;
    anchor: HTMLElement;
    stops: HistoryStop[];
    open: boolean;
}

interface HeaderBarProps {
    /** Centre slot, the path bar, or the search field while searching. */
    pathBar: ReactNode;
    canGoBack: boolean;
    canGoForward: boolean;
    /** Whether a folder is open, which the folder search and selection mode need. */
    hasFolder: boolean;
    view: ViewMode;
    zoom: ViewZoom;
    sort: SortOrder;
    /** Whether a search everywhere's results show, which the view menu can order by relevance. */
    resultsShown: boolean;
    /** Whether the trash's root shows, whose date the view menu names by when entries were moved there. */
    trashShown: boolean;
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
    /** Whether the docked properties show. */
    propertiesOpen: boolean;
    /** Whether the properties dock at the moment, rather than opening over the content. */
    propertiesDocked: () => boolean;
    onBack: () => void;
    onForward: () => void;
    /** The places back or forward lead to, nearest first, read as their list opens. */
    historyStops: (direction: HistoryDirection) => HistoryStop[];
    /** Goes `by` places through the history (negative is back), from its list. */
    onGoInHistory: (by: number) => void;
    onToggleView: () => void;
    /** Zooms the view shown a step in or out, or back to its start. */
    onZoom: (step: ZoomStep) => void;
    onSortChange: (sort: SortOrder) => void;
    onToggleHidden: () => void;
    onToggleSelecting: () => void;
    /** Opens a search with this scope, switches to it, or closes it when it's the open one. */
    onSearch: (scope: SearchScope) => void;
    /** Opens the collapsed sidebar, or shows the hidden docked one. */
    onShowSidebar: () => void;
    /** Opens the sidebar for a drag that rests on the button that shows it, until the drag ends. */
    onDragShowSidebar: () => void;
    /** Hides or shows the docked sidebar. */
    onToggleSidebar: () => void;
    /** Shows or hides the docked properties. */
    onToggleProperties: () => void;
    /** Opens the properties over the content, giving the focus back to `opener` as they close. */
    onOpenProperties: (opener: HTMLElement | null) => void;
    /** The button that shows the sidebar, which takes the focus back when the overlay closes. */
    sidebarButtonRef?: Ref<HTMLButtonElement>;
}

const HeaderBar = ({
    pathBar,
    canGoBack,
    canGoForward,
    hasFolder,
    view,
    zoom,
    sort,
    resultsShown,
    trashShown,
    showHidden,
    selecting,
    searchScope,
    canSearchEverywhere,
    sidebarHidden,
    sidebarDocked,
    propertiesOpen,
    propertiesDocked,
    onBack,
    onForward,
    historyStops,
    onGoInHistory,
    onToggleView,
    onZoom,
    onSortChange,
    onToggleHidden,
    onToggleSelecting,
    onSearch,
    onShowSidebar,
    onDragShowSidebar,
    onToggleSidebar,
    onToggleProperties,
    onOpenProperties,
    sidebarButtonRef,
}: HeaderBarProps) => {
    const { text } = useLocale();
    const sidebarHold = useDragHold(onDragShowSidebar);
    // Kept after it closes, so the list doesn't empty while it fades out.
    const [historyList, setHistoryList] = useState<HistoryList | null>(null);

    // The list of places the button leads to, from a right-click, the menu key or a long-press.
    const openHistory = useCallback(
        (direction: HistoryDirection, anchor: HTMLElement) => {
            const stops = historyStops(direction);

            if (stops.length > 0) {
                setHistoryList({ direction, anchor, stops, open: true });
            }
        },
        [historyStops],
    );

    const closeHistory = useCallback(() => setHistoryList((list) => list && { ...list, open: false }), []);

    // Touch has no right-click, and iOS never sends `contextmenu` for a long-press.
    const historyPress = useLongPress({
        itemAt: (target) => target.closest<HTMLElement>("[data-history]")?.dataset.history,
        onButtons: true,
        onLongPress: (direction, press) => {
            const button = press.element.closest<HTMLElement>("[data-history]");

            if (button) {
                openHistory(direction as HistoryDirection, button);
            }
        },
    });

    return (
        <div className={cx(styles.header, fmClasses.header)}>
            <div className={styles.startGroup} {...historyPress}>
                <TooltipIconButton
                    ref={sidebarButtonRef}
                    label={text.showSidebar}
                    aria-keyshortcuts="F9"
                    className={sidebarHidden ? styles.sidebarButton : styles.collapsedSidebarButton}
                    data-drag-over={sidebarHold.over}
                    onClick={onShowSidebar}
                    {...sidebarHold.handlers}
                >
                    <Icon name="menu" fontSize="small" />
                </TooltipIconButton>
                <TooltipIconButton
                    label={text.back}
                    disabled={!canGoBack}
                    data-history="back"
                    onClick={onBack}
                    onContextMenu={(event) => {
                        event.preventDefault();
                        openHistory("back", event.currentTarget);
                    }}
                >
                    <Icon name="arrowBack" fontSize="small" />
                </TooltipIconButton>
                <TooltipIconButton
                    label={text.forward}
                    disabled={!canGoForward}
                    data-history="forward"
                    className={styles.mediumUp}
                    onClick={onForward}
                    onContextMenu={(event) => {
                        event.preventDefault();
                        openHistory("forward", event.currentTarget);
                    }}
                >
                    <Icon name="arrowForward" fontSize="small" />
                </TooltipIconButton>
            </div>
            {historyList && (
                <HistoryMenu
                    open={historyList.open}
                    anchor={historyList.anchor}
                    label={historyList.direction === "back" ? text.back : text.forward}
                    stops={historyList.stops}
                    onPick={onGoInHistory}
                    onClose={closeHistory}
                />
            )}
            <div className={styles.pathSlot}>
                <div className={styles.path}>{pathBar}</div>
                {/* Keeps the focus in an open search's field as it's pressed, which it closes or
                    switches to searching the folder. */}
                <TooltipIconButton
                    label={text.searchFolder}
                    aria-pressed={searchScope === "folder"}
                    aria-keyshortcuts="Control+F Meta+F"
                    disabled={!hasFolder}
                    className={styles.pressed}
                    onMouseDown={(event) => searchScope && event.preventDefault()}
                    onClick={() => onSearch("folder")}
                >
                    <Icon name="searchFolder" fontSize="small" />
                </TooltipIconButton>
            </div>
            <div className={styles.endGroup}>
                <TooltipIconButton
                    label={selecting ? text.doneSelecting : text.select}
                    aria-pressed={selecting}
                    disabled={!hasFolder}
                    className={styles.selectButton}
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
                        className={sidebarHidden ? styles.pressed : styles.collapsedOnlyPressed}
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
                    view={view}
                    zoom={zoom}
                    sort={sort}
                    resultsShown={resultsShown}
                    trashShown={trashShown}
                    showHidden={showHidden}
                    sidebarHidden={sidebarHidden}
                    sidebarDocked={sidebarDocked}
                    propertiesOpen={propertiesOpen}
                    propertiesDocked={propertiesDocked}
                    onZoom={onZoom}
                    onSortChange={onSortChange}
                    onToggleHidden={onToggleHidden}
                    onToggleSidebar={onToggleSidebar}
                    onToggleProperties={onToggleProperties}
                    onOpenProperties={onOpenProperties}
                />
            </div>
        </div>
    );
};

export default HeaderBar;
