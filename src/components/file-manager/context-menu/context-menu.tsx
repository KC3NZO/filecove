import { useMemo } from "react";
import type { MouseEvent, ReactNode } from "react";

import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import IconSlot from "../icon-slot";

import type { ActionContext, ActionGroup, MenuPosition } from "../types";

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

const paperSx: SxProps<Theme> = {
    minWidth: 220,
    borderRadius: 2,
};

const itemSx: SxProps<Theme> = {
    '&[data-destructive="true"]': {
        color: "error.main",
        "& .MuiListItemIcon-root": { color: "inherit" },
    },
};

const shortcutSx: SxProps<Theme> = {
    ml: 3,
    color: "text.secondary",
};

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
                            {action.shortcut}
                        </Typography>
                    )}
                </MenuItem>,
            );
        });
    });

    return items;
};

const ContextMenu = ({ menu, onClose }: ContextMenuProps) => {
    const slotProps = useMemo(
        () => ({
            paper: { sx: paperSx },
            list: { dense: true },
            root: {
                // A right-click outside the open menu closes it, rather than opening the browser's menu over it.
                onContextMenu: (event: MouseEvent) => {
                    event.preventDefault();
                    onClose();
                },
            },
        }),
        [onClose],
    );

    return (
        <Menu
            open={!!menu?.open}
            anchorReference="anchorPosition"
            anchorPosition={menu?.position}
            slotProps={slotProps}
            onClose={onClose}
        >
            {menu && renderItems(menu, onClose)}
        </Menu>
    );
};

export default ContextMenu;
