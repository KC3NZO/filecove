import { useContext, useState } from "react";

import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import type { MenuProps } from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../../contexts/direction-context";
import { useLocale } from "../../../hooks/use-locale";
import { menuPaperSx } from "../../../styles/mixins";
import { isRtl } from "../../../utils/dom";
import { SORT_KEYS, SORT_LABELS, withSortKey } from "../../../utils/sort";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";

import type { SortDirection, SortOrder } from "../../../types";

interface ViewMenuProps {
    sort: SortOrder;
    showHidden: boolean;
    /** Whether the docked sidebar is hidden. */
    sidebarHidden: boolean;
    /** Whether the sidebar docks at the moment, read as the menu opens. */
    sidebarDocked: () => boolean;
    onSortChange: (sort: SortOrder) => void;
    onToggleHidden: () => void;
    onToggleSidebar: () => void;
}

const DIRECTIONS: readonly SortDirection[] = ["asc", "desc"];

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

/**
 * The header's view options: how the content is sorted, whether hidden files show and, while the
 * sidebar docks, whether it shows. It stays open while options change, so the key and the
 * direction can both be picked in one go.
 */
const ViewMenu = ({
    sort,
    showHidden,
    sidebarHidden,
    sidebarDocked,
    onSortChange,
    onToggleHidden,
    onToggleSidebar,
}: ViewMenuProps) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    // The menu portals out of the file manager, where its container queries don't reach, so
    // whether the sidebar docks is read as it opens. Collapsed, the header's button shows it.
    const [docked, setDocked] = useState(false);
    const [rtl, setRtl] = useState(false);
    const { text } = useLocale();
    const dir = useContext(DirectionContext);
    const keyLabels = SORT_LABELS[sort.key](text);

    return (
        <>
            <TooltipIconButton
                label={text.viewOptions}
                aria-haspopup="menu"
                aria-expanded={!!anchor}
                onClick={(event) => {
                    setDocked(sidebarDocked());
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
                {SORT_KEYS.map((key) => (
                    <MenuItem
                        key={key}
                        role="menuitemradio"
                        aria-checked={key === sort.key}
                        onClick={() => onSortChange(withSortKey(sort, key))}
                    >
                        <ListItemIcon>
                            <Radio size="small" checked={key === sort.key} tabIndex={-1} disableRipple sx={controlSx} />
                        </ListItemIcon>
                        <ListItemText>{SORT_LABELS[key](text).label}</ListItemText>
                    </MenuItem>
                ))}
                <Divider />
                {DIRECTIONS.map((direction) => (
                    <MenuItem
                        key={direction}
                        role="menuitemradio"
                        aria-checked={direction === sort.direction}
                        onClick={() => onSortChange({ key: sort.key, direction })}
                    >
                        <ListItemIcon>
                            <Radio
                                size="small"
                                checked={direction === sort.direction}
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
            </Menu>
        </>
    );
};

export default ViewMenu;
