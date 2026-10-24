import { useContext, useMemo } from "react";
import type { MouseEvent, ReactNode } from "react";

import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import type { PopoverOrigin } from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../../contexts/direction-context";
import { insetLabelSx } from "../../../styles/direction";
import { menuPaperSx } from "../../../styles/mixins";
import { ariaShortcut } from "../../../utils/shortcut";
import IconSlot from "../../icons/icon-slot";

import type { ActionContext, ActionGroup, MenuPosition } from "../../../types";

export interface MenuState {
    /** False while the menu plays its closing transition; the rest is kept so it doesn't empty mid-fade. */
    open: boolean;
    position: MenuPosition;
    context: ActionContext;
    /** Already narrowed to what applies to `context`. */
    groups: ActionGroup[];
}

interface ContextMenuProps {
    menu: MenuState | null;
    onClose: () => void;
}

const itemSx: SxProps<Theme> = {
    ...insetLabelSx,
    '&[data-destructive="true"]': {
        color: "error.main",
        "& .MuiListItemIcon-root": { color: "inherit" },
    },
};

const shortcutSx: SxProps<Theme> = {
    marginInlineStart: 3,
    color: "text.secondary",
};

// The menu opens leftwards from its point when the part it was opened in runs right to left. MUI's
// own default goes by the theme's `direction` instead, which a page with `dir` set may not have.
const LTR_ORIGIN: PopoverOrigin = { vertical: "top", horizontal: "left" };
const RTL_ORIGIN: PopoverOrigin = { vertical: "top", horizontal: "right" };

const renderItems = ({ groups, context }: MenuState, onClose: () => void) => {
    // Labels without an icon are inset so they line up with the ones that have one.
    const hasIcons = groups.some((group) => group.actions.some((action) => action.icon));
    const items: ReactNode[] = [];

    groups.forEach((group, index) => {
        if (index > 0) {
            items.push(<Divider key={`${group.id}:divider`} />);
        }

        group.actions.forEach((action) => {
            items.push(
                <MenuItem
                    key={`${group.id}:${action.id}`}
                    sx={itemSx}
                    data-destructive={!!action.destructive}
                    aria-keyshortcuts={action.shortcut && ariaShortcut(action.shortcut)}
                    disabled={action.disabled?.(context)}
                    onClick={() => {
                        onClose();
                        action.onSelect(context);
                    }}
                >
                    {action.icon && (
                        <ListItemIcon>
                            <IconSlot icon={action.icon} />
                        </ListItemIcon>
                    )}
                    <ListItemText inset={hasIcons && !action.icon}>{action.label}</ListItemText>
                    {action.shortcut && (
                        <Typography variant="body2" sx={shortcutSx}>
                            <bdi>{action.shortcut}</bdi>
                        </Typography>
                    )}
                </MenuItem>,
            );
        });
    });

    return items;
};

const ContextMenu = ({ menu, onClose }: ContextMenuProps) => {
    const dir = useContext(DirectionContext);
    const slotProps = useMemo(
        () => ({
            paper: { sx: menuPaperSx },
            list: { dense: true },
            root: {
                // A right-click outside the open menu closes it, rather than opening the browser's menu
                // over it. One on the menu, or the Menu key pressed in it, which some browsers send on
                // its release after the key press opened the menu, leaves it open.
                onContextMenu: (event: MouseEvent) => {
                    event.preventDefault();

                    if (!(event.target instanceof Element && event.target.closest('[role="menu"]'))) {
                        onClose();
                    }
                },
            },
        }),
        [onClose],
    );

    return (
        <Menu
            dir={dir}
            open={!!menu?.open}
            anchorReference="anchorPosition"
            anchorPosition={menu?.position}
            transformOrigin={menu?.position.rtl ? RTL_ORIGIN : LTR_ORIGIN}
            slotProps={slotProps}
            onClose={onClose}
        >
            {menu && renderItems(menu, onClose)}
        </Menu>
    );
};

export default ContextMenu;
