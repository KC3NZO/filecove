import { useContext, useId, useState } from "react";

import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import type { MenuProps } from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../../contexts/direction-context";
import { useLocale } from "../../../hooks/use-locale";
import { insetLabelSx } from "../../../styles/direction";
import { forcedColors, forcedEdge, menuPaperSx } from "../../../styles/mixins";
import { isRtl } from "../../../utils/dom";
import { ZOOM_ARIA_SHORTCUTS, formatShortcut } from "../../../utils/shortcut";
import { SORT_KEYS, SORT_LABELS, folderSort, withSortKey } from "../../../utils/sort";
import { canZoom, zoomScale } from "../../../utils/zoom";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";

import type { SortDirection, SortKey, SortOrder, ViewMode, ViewZoom, ZoomStep } from "../../../types";

interface ViewMenuProps {
    /** The view shown, which the zoom items zoom. */
    view: ViewMode;
    zoom: ViewZoom;
    sort: SortOrder;
    /** Whether a search everywhere's results show, which can be ordered by relevance. */
    resultsShown: boolean;
    /** Whether the trash's root shows, whose date goes by when its entries were moved there. */
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

const SORT_KEYS_WITH_RELEVANCE: readonly SortKey[] = ["relevance", ...SORT_KEYS];


const slotProps: MenuProps["slotProps"] = {
    paper: { sx: menuPaperSx },
    list: { dense: true },
};

// Hangs from the button's end edge, since the button sits at the header's end: its right edge, or
// its left edge right to left.
const ORIGINS: Record<"ltr" | "rtl", Pick<MenuProps, "anchorOrigin" | "transformOrigin">> = {
    ltr: {
        anchorOrigin: { vertical: "bottom", horizontal: "right" },
        transformOrigin: { vertical: "top", horizontal: "right" },
    },
    rtl: {
        anchorOrigin: { vertical: "bottom", horizontal: "left" },
        transformOrigin: { vertical: "top", horizontal: "left" },
    },
};

// Not sticky, and without its own background, which wouldn't match the menu paper's elevation tint.
const subheaderSx: SxProps<Theme> = {
    position: "static",
    bgcolor: "transparent",
    lineHeight: "2rem",
    fontSize: "0.75rem",
    fontWeight: 600,
};

// The radios and the checkbox only show state. The menu item takes the click and holds the focus,
// so arrow keys keep moving through the menu, and it carries the role and checked state.
const controlSx: SxProps<Theme> = {
    p: 0,
    pointerEvents: "none",
};

const shortcutSx: SxProps<Theme> = {
    marginInlineStart: 3,
    color: "text.secondary",
};

// The zoom row under its subheader, across the menu: Zoom out, the size, which puts it back, and
// Zoom in, as browsers' menus have it.
const zoomRowSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    px: 1,
    pb: 0.5,
};

// Menu items, so the arrow keys reach them, shaped as round icon buttons.
const zoomButtonSx: SxProps<Theme> = {
    justifyContent: "center",
    width: 32,
    height: 32,
    minHeight: 0,
    p: 0,
    borderRadius: "50%",
};

const zoomValueSx: SxProps<Theme> = {
    flex: 1,
    justifyContent: "center",
    minWidth: "3.5rem",
    height: 32,
    minHeight: 0,
    px: 1,
    borderRadius: 4,
    fontVariantNumeric: "tabular-nums",
};

// As `TooltipIconButton`'s: forced colors drop the tooltip's background.
const tooltipSlotProps = (dir: "ltr" | "rtl" | undefined) => ({
    popper: { dir },
    tooltip: { sx: { [forcedColors]: forcedEdge } },
});

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
    const dir = useContext(DirectionContext);
    const percent = formatPercent(zoomScale(zoom, view));
    const zoomId = useId();
    // Folders have no relevance, and are by name instead.
    const order = resultsShown ? sort : folderSort(sort);
    const keys = resultsShown ? SORT_KEYS_WITH_RELEVANCE : SORT_KEYS;
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
            <Menu
                dir={dir}
                open={!!anchor}
                anchorEl={anchor}
                {...ORIGINS[rtl ? "rtl" : "ltr"]}
                slotProps={slotProps}
                onClose={() => setAnchor(null)}
            >
                <ListSubheader sx={subheaderSx}>{text.sortBy}</ListSubheader>
                {keys.map((key) => (
                    <MenuItem
                        key={key}
                        role="menuitemradio"
                        aria-checked={key === order.key}
                        onClick={() => onSortChange(withSortKey(order, key))}
                    >
                        <ListItemIcon>
                            <Radio size="small" checked={key === order.key} tabIndex={-1} disableRipple sx={controlSx} />
                        </ListItemIcon>
                        <ListItemText>
                            {trashShown && key === "modified" ? text.sortTrashed : SORT_LABELS[key](text).label}
                        </ListItemText>
                    </MenuItem>
                ))}
                {order.key !== "relevance" && <Divider />}
                {order.key !== "relevance" &&
                    DIRECTIONS.map((direction) => (
                        <MenuItem
                            key={direction}
                            role="menuitemradio"
                            aria-checked={direction === order.direction}
                            onClick={() => onSortChange({ key: order.key, direction })}
                        >
                            <ListItemIcon>
                                <Radio
                                    size="small"
                                    checked={direction === order.direction}
                                    tabIndex={-1}
                                    disableRipple
                                    sx={controlSx}
                                />
                            </ListItemIcon>
                            <ListItemText>{keyLabels[direction]}</ListItemText>
                        </MenuItem>
                    ))}
                <Divider />
                <MenuItem
                    role="menuitemcheckbox"
                    aria-checked={showHidden}
                    aria-keyshortcuts="Control+H"
                    onClick={onToggleHidden}
                >
                    <ListItemIcon>
                        <Checkbox size="small" checked={showHidden} tabIndex={-1} disableRipple sx={controlSx} />
                    </ListItemIcon>
                    <ListItemText>{text.showHiddenFiles}</ListItemText>
                    <Typography variant="body2" sx={shortcutSx}>
                        {text.showHiddenFilesShortcut}
                    </Typography>
                </MenuItem>
                {docked && (
                    <MenuItem
                        role="menuitemcheckbox"
                        aria-checked={!sidebarHidden}
                        aria-keyshortcuts="F9"
                        onClick={onToggleSidebar}
                    >
                        <ListItemIcon>
                            <Checkbox
                                size="small"
                                checked={!sidebarHidden}
                                tabIndex={-1}
                                disableRipple
                                sx={controlSx}
                            />
                        </ListItemIcon>
                        <ListItemText>{text.showSidebar}</ListItemText>
                        <Typography variant="body2" sx={shortcutSx}>
                            F9
                        </Typography>
                    </MenuItem>
                )}
                {propertiesDock ? (
                    <MenuItem
                        role="menuitemcheckbox"
                        aria-checked={propertiesOpen}
                        aria-keyshortcuts="Alt+Enter"
                        onClick={onToggleProperties}
                    >
                        <ListItemIcon>
                            <Checkbox
                                size="small"
                                checked={propertiesOpen}
                                tabIndex={-1}
                                disableRipple
                                sx={controlSx}
                            />
                        </ListItemIcon>
                        <ListItemText>{text.showProperties}</ListItemText>
                        <Typography variant="body2" sx={shortcutSx}>
                            {formatShortcut(PROPERTIES_KEYS, text)}
                        </Typography>
                    </MenuItem>
                ) : (
                    // Over the content, the properties take the focus, so the menu closes, handing
                    // its button to them to give the focus back to.
                    <MenuItem
                        aria-keyshortcuts="Alt+Enter"
                        sx={insetLabelSx}
                        onClick={() => {
                            setAnchor(null);
                            onOpenProperties(anchor);
                        }}
                    >
                        <ListItemText inset>{text.showProperties}</ListItemText>
                        <Typography variant="body2" sx={shortcutSx}>
                            {formatShortcut(PROPERTIES_KEYS, text)}
                        </Typography>
                    </MenuItem>
                )}
                <Divider />
                <ListSubheader id={zoomId} sx={subheaderSx}>
                    {text.zoom}
                </ListSubheader>
                <Box component="li" role="group" aria-labelledby={zoomId} sx={zoomRowSx}>
                    <Tooltip title={text.zoomOut} arrow enterDelay={500} slotProps={tooltipSlotProps(dir)}>
                        <MenuItem
                            component="div"
                            disabled={!canZoom(zoom, view, -1)}
                            aria-label={text.zoomOut}
                            aria-keyshortcuts={ZOOM_ARIA_SHORTCUTS[-1]}
                            sx={zoomButtonSx}
                            onClick={() => onZoom(-1)}
                        >
                            <Icon name="zoomOut" fontSize="small" />
                        </MenuItem>
                    </Tooltip>
                    <Tooltip title={text.zoomReset} arrow enterDelay={500} slotProps={tooltipSlotProps(dir)}>
                        <MenuItem
                            component="div"
                            disabled={!canZoom(zoom, view, 0)}
                            aria-label={text.zoomResetFrom(percent)}
                            aria-keyshortcuts={ZOOM_ARIA_SHORTCUTS[0]}
                            sx={zoomValueSx}
                            onClick={() => onZoom(0)}
                        >
                            {percent}
                        </MenuItem>
                    </Tooltip>
                    <Tooltip title={text.zoomIn} arrow enterDelay={500} slotProps={tooltipSlotProps(dir)}>
                        <MenuItem
                            component="div"
                            disabled={!canZoom(zoom, view, 1)}
                            aria-label={text.zoomIn}
                            aria-keyshortcuts={ZOOM_ARIA_SHORTCUTS[1]}
                            sx={zoomButtonSx}
                            onClick={() => onZoom(1)}
                        >
                            <Icon name="zoomIn" fontSize="small" />
                        </MenuItem>
                    </Tooltip>
                </Box>
            </Menu>
        </>
    );
};

export default ViewMenu;
