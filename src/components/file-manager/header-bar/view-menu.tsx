import { useState } from "react";

import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import type { MenuProps } from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { SORT_KEYS, SORT_KEY_INFO, withSortKey } from "../../../utils/sort";
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

const paperSx: SxProps<Theme> = {
    minWidth: 220,
    borderRadius: 2,
};

const slotProps: MenuProps["slotProps"] = {
    paper: { sx: paperSx },
    list: { dense: true },
};

// Hangs from the button's right edge, since the button sits at the header's right end.
const anchorOrigin: MenuProps["anchorOrigin"] = { vertical: "bottom", horizontal: "right" };
const transformOrigin: MenuProps["transformOrigin"] = { vertical: "top", horizontal: "right" };

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
    ml: 3,
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
    const keyInfo = SORT_KEY_INFO[sort.key];

    return (
        <>
            <IconButton
                aria-label="View options"
                aria-haspopup="menu"
                aria-expanded={!!anchor}
                onClick={(event) => {
                    setDocked(sidebarDocked());
                    setAnchor(event.currentTarget);
                }}
            >
                <Icon name="expand" fontSize="small" />
            </IconButton>
            <Menu
                open={!!anchor}
                anchorEl={anchor}
                anchorOrigin={anchorOrigin}
                transformOrigin={transformOrigin}
                slotProps={slotProps}
                onClose={() => setAnchor(null)}
            >
                <ListSubheader sx={subheaderSx}>Sort by</ListSubheader>
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
                        <ListItemText>{SORT_KEY_INFO[key].label}</ListItemText>
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
                        <ListItemText>{keyInfo[direction]}</ListItemText>
                    </MenuItem>
                ))}
                <Divider />
                <MenuItem role="menuitemcheckbox" aria-checked={showHidden} onClick={onToggleHidden}>
                    <ListItemIcon>
                        <Checkbox size="small" checked={showHidden} tabIndex={-1} disableRipple sx={controlSx} />
                    </ListItemIcon>
                    <ListItemText>Show hidden files</ListItemText>
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
                        <ListItemText>Show sidebar</ListItemText>
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
