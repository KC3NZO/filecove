import type { ReactNode } from "react";

import { ariaShortcut } from "../../../utils/shortcut";
import IconSlot from "../../icons/icon-slot";
import Menu, { MenuDivider, MenuIcon, MenuItem, MenuShortcut, MenuText } from "../../ui/menu";

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

const renderItems = ({ groups, context }: MenuState, onClose: () => void) => {
    // Labels without an icon are inset so they line up with the ones that have one.
    const hasIcons = groups.some((group) => group.actions.some((action) => action.icon));
    const items: ReactNode[] = [];

    groups.forEach((group, index) => {
        if (index > 0) {
            items.push(<MenuDivider key={`${group.id}:divider`} />);
        }

        group.actions.forEach((action) => {
            items.push(
                <MenuItem
                    key={`${group.id}:${action.id}`}
                    data-destructive={!!action.destructive}
                    aria-keyshortcuts={action.shortcut && ariaShortcut(action.shortcut)}
                    disabled={action.disabled?.(context)}
                    onClick={() => {
                        onClose();
                        action.onSelect(context);
                    }}
                >
                    {action.icon && (
                        <MenuIcon>
                            <IconSlot icon={action.icon} />
                        </MenuIcon>
                    )}
                    <MenuText inset={hasIcons && !action.icon}>{action.label}</MenuText>
                    {action.shortcut && <MenuShortcut>{action.shortcut}</MenuShortcut>}
                </MenuItem>,
            );
        });
    });

    return items;
};

/**
 * The menu of the actions that apply to what was right-clicked, at the point it was opened at. It
 * opens leftwards from its point when the part it was opened in runs right to left
 * (`MenuPosition.rtl`). A right-click outside it closes it, as `Menu` does for every menu.
 */
const ContextMenu = ({ menu, onClose }: ContextMenuProps) => (
    <Menu open={!!menu?.open} position={menu?.position} rtl={menu?.position.rtl} onClose={onClose}>
        {menu && renderItems(menu, onClose)}
    </Menu>
);

export default ContextMenu;
