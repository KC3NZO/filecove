import { useId, useState } from "react";

import { useLocale } from "../../../hooks/use-locale";
import { isRtl } from "../../../utils/dom";
import { ZOOM_ARIA_SHORTCUTS, formatShortcut } from "../../../utils/shortcut";
import { LOCATED_SORT_KEYS, SORT_KEYS, SORT_LABELS, folderSort, withSortKey } from "../../../utils/sort";
import { canZoom, zoomScale } from "../../../utils/zoom";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";
import { CheckMark, RadioMark } from "../../ui/checkbox";
import Menu, { MenuDivider, MenuIcon, MenuItem, MenuLabel, MenuShortcut, MenuText } from "../../ui/menu";
import Tooltip from "../../ui/tooltip";
import styles from "./view-menu.module.css";

import type { SortDirection, SortKey, SortOrder, ViewMode, ViewZoom, ZoomStep } from "../../../types";

interface ViewMenuProps {
    /** The view shown, which the zoom items zoom. */
    view: ViewMode;
    zoom: ViewZoom;
    sort: SortOrder;
    /** Whether a search everywhere's results show, which can be ordered by relevance. */
    resultsShown: boolean;
    /**
     * Whether the trash's root shows, whose date goes by when its entries were moved there, and
     * which can be ordered by where they came from.
     */
    trashShown: boolean;
    showHidden: boolean;
    /** Whether the docked sidebar is hidden. */
    sidebarHidden: boolean;
    /** Whether the sidebar docks at the moment, read as the menu opens. */
    sidebarDocked: () => boolean;
    /** Whether the docked properties show. */
    propertiesOpen: boolean;
    /** Whether the properties dock at the moment, read as the menu opens. */
    propertiesDocked: () => boolean;
    /** Zooms the view shown a step in or out, or back to its start. */
    onZoom: (step: ZoomStep) => void;
    onSortChange: (sort: SortOrder) => void;
    onToggleHidden: () => void;
    onToggleSidebar: () => void;
    onToggleProperties: () => void;
    /** Opens the properties over the content, giving the focus back to `opener` as they close. */
    onOpenProperties: (opener: HTMLElement | null) => void;
}

const PROPERTIES_KEYS = ["Alt", "Enter"];

const DIRECTIONS: readonly SortDirection[] = ["asc", "desc"];

const SORT_KEYS_WITH_RELEVANCE: readonly SortKey[] = ["relevance", ...LOCATED_SORT_KEYS];

/**
 * The header's view options: how the content is sorted, whether hidden files show, while the
 * sidebar docks, whether it shows, whether the properties show, docked, or else opening them over
 * the content, and zooming the view shown. It stays open while options change, so the key and the
 * direction can both be picked in one go, and the view zoomed by several steps.
 */
const ViewMenu = ({
    view,
    zoom,
    sort,
    resultsShown,
    trashShown,
    showHidden,
    sidebarHidden,
    sidebarDocked,
    propertiesOpen,
    propertiesDocked,
    onZoom,
    onSortChange,
    onToggleHidden,
    onToggleSidebar,
    onToggleProperties,
    onOpenProperties,
}: ViewMenuProps) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    // The menu portals out of the file manager, where its container queries don't reach, so
    // whether the sidebar docks is read as it opens. Collapsed, the header's button shows it.
    const [docked, setDocked] = useState(false);
    // Read so too: docked properties are shown and hidden here, and otherwise opened over the content.
    const [propertiesDock, setPropertiesDock] = useState(false);
    const [rtl, setRtl] = useState(false);
    const { text, formatPercent } = useLocale();
    const percent = formatPercent(zoomScale(zoom, view));
    const zoomId = useId();
    // Folders have no relevance, nor a location but the trash's root, and are by name instead.
    const order = resultsShown ? sort : folderSort(sort, trashShown);
    const folderKeys = trashShown ? LOCATED_SORT_KEYS : SORT_KEYS;
    const keys = resultsShown ? SORT_KEYS_WITH_RELEVANCE : folderKeys;
    const keyLabels = SORT_LABELS[order.key](text);

    return (
        <>
            <TooltipIconButton
                label={text.viewOptions}
                aria-haspopup="menu"
                aria-expanded={!!anchor}
                onClick={(event) => {
                    setDocked(sidebarDocked());
                    setPropertiesDock(propertiesDocked());
                    setRtl(isRtl(event.currentTarget));
                    setAnchor(event.currentTarget);
                }}
            >
                <Icon name="expand" fontSize="small" />
            </TooltipIconButton>
            {/* Hangs from the button's end edge, since the button sits at the header's end. */}
            <Menu open={!!anchor} anchor={anchor} rtl={rtl} align="end" onClose={() => setAnchor(null)}>
                <MenuLabel>{text.sortBy}</MenuLabel>
                {keys.map((key) => (
                    <MenuItem
                        key={key}
                        role="menuitemradio"
                        aria-checked={key === order.key}
                        onClick={() => onSortChange(withSortKey(order, key))}
                    >
                        <MenuIcon>
                            <RadioMark checked={key === order.key} />
                        </MenuIcon>
                        <MenuText>
                            {trashShown && key === "modified"
                                ? text.sortTrashed
                                : trashShown && key === "location"
                                  ? text.trashLocation
                                  : SORT_LABELS[key](text).label}
                        </MenuText>
                    </MenuItem>
                ))}
                {order.key !== "relevance" && <MenuDivider />}
                {order.key !== "relevance" &&
                    DIRECTIONS.map((direction) => (
                        <MenuItem
                            key={direction}
                            role="menuitemradio"
                            aria-checked={direction === order.direction}
                            onClick={() => onSortChange({ key: order.key, direction })}
                        >
                            <MenuIcon>
                                <RadioMark checked={direction === order.direction} />
                            </MenuIcon>
                            <MenuText>{keyLabels[direction]}</MenuText>
                        </MenuItem>
                    ))}
                <MenuDivider />
                <MenuItem
                    role="menuitemcheckbox"
                    aria-checked={showHidden}
                    aria-keyshortcuts="Control+H"
                    onClick={onToggleHidden}
                >
                    <MenuIcon>
                        <CheckMark checked={showHidden} />
                    </MenuIcon>
                    <MenuText>{text.showHiddenFiles}</MenuText>
                    <MenuShortcut>{text.showHiddenFilesShortcut}</MenuShortcut>
                </MenuItem>
                {docked && (
                    <MenuItem
                        role="menuitemcheckbox"
                        aria-checked={!sidebarHidden}
                        aria-keyshortcuts="F9"
                        onClick={onToggleSidebar}
                    >
                        <MenuIcon>
                            <CheckMark checked={!sidebarHidden} />
                        </MenuIcon>
                        <MenuText>{text.showSidebar}</MenuText>
                        <MenuShortcut>F9</MenuShortcut>
                    </MenuItem>
                )}
                {propertiesDock ? (
                    <MenuItem
                        role="menuitemcheckbox"
                        aria-checked={propertiesOpen}
                        aria-keyshortcuts="Alt+Enter"
                        onClick={onToggleProperties}
                    >
                        <MenuIcon>
                            <CheckMark checked={propertiesOpen} />
                        </MenuIcon>
                        <MenuText>{text.showProperties}</MenuText>
                        <MenuShortcut>{formatShortcut(PROPERTIES_KEYS, text)}</MenuShortcut>
                    </MenuItem>
                ) : (
                    // Over the content, the properties take the focus, so the menu closes, handing
                    // its button to them to give the focus back to.
                    <MenuItem
                        aria-keyshortcuts="Alt+Enter"
                        onClick={() => {
                            setAnchor(null);
                            onOpenProperties(anchor);
                        }}
                    >
                        <MenuText inset>{text.showProperties}</MenuText>
                        <MenuShortcut>{formatShortcut(PROPERTIES_KEYS, text)}</MenuShortcut>
                    </MenuItem>
                )}
                <MenuDivider />
                <MenuLabel id={zoomId}>
                    {text.zoom}
                </MenuLabel>
                <div role="group" aria-labelledby={zoomId} className={styles.zoomRow}>
                    <Tooltip title={text.zoomOut}>
                        <MenuItem
                            disabled={!canZoom(zoom, view, -1)}
                            aria-label={text.zoomOut}
                            aria-keyshortcuts={ZOOM_ARIA_SHORTCUTS[-1]}
                            className={styles.zoomButton}
                            onClick={() => onZoom(-1)}
                        >
                            <Icon name="zoomOut" fontSize="small" />
                        </MenuItem>
                    </Tooltip>
                    <Tooltip title={text.zoomReset}>
                        <MenuItem
                            disabled={!canZoom(zoom, view, 0)}
                            aria-label={text.zoomResetFrom(percent)}
                            aria-keyshortcuts={ZOOM_ARIA_SHORTCUTS[0]}
                            className={styles.zoomValue}
                            onClick={() => onZoom(0)}
                        >
                            {percent}
                        </MenuItem>
                    </Tooltip>
                    <Tooltip title={text.zoomIn}>
                        <MenuItem
                            disabled={!canZoom(zoom, view, 1)}
                            aria-label={text.zoomIn}
                            aria-keyshortcuts={ZOOM_ARIA_SHORTCUTS[1]}
                            className={styles.zoomButton}
                            onClick={() => onZoom(1)}
                        >
                            <Icon name="zoomIn" fontSize="small" />
                        </MenuItem>
                    </Tooltip>
                </div>
            </Menu>
        </>
    );
};

export default ViewMenu;
