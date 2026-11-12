import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { isRtl } from "../../utils/dom";
import { cx } from "../../utils/cx";
import { ariaShortcut } from "../../utils/shortcut";
import Icon from "../icons/icon";
import IconSlot from "../icons/icon-slot";
import Menu, { MenuDivider, MenuIcon, MenuItem, MenuShortcut, MenuText } from "../ui/menu";
import styles from "./toolbar-actions.module.css";
import TooltipIconButton from "./tooltip-icon-button";

import type { ToolbarAction, ToolbarGroup } from "../../types";

interface ToolbarActionsProps {
    groups: readonly ToolbarGroup[];
    /** Names the button holding the actions that don't show as buttons. */
    moreLabel: string;
    /**
     * How many of the actions with an icon show as buttons, at most, besides those the header
     * `keep`s as buttons; the rest go in "More actions".
     */
    inline: number;
    /**
     * Whether the header it's in hides the buttons where it's narrow, every action going in "More
     * actions" there. The header says where, by two custom properties its own stylesheet sets:
     * `--toolbar-buttons: none` with `--toolbar-more: inline-flex` where it's narrow, and
     * `--toolbar-buttons: flex` with `--toolbar-more: none` where it has the room. Without it,
     * the actions always show as buttons.
     */
    collapses?: boolean;
    size?: "small" | "medium";
}

/** An action and the group it's in, for the rules between groups in the menu. */
interface Placed {
    group: string;
    action: ToolbarAction;
}

/** The menu, kept as it was while it fades out. */
interface MenuState {
    open: boolean;
    anchor: HTMLElement;
    rtl: boolean;
    items: Placed[];
}

/**
 * The app's actions in a header, the file manager's, the preview's, the properties panel's or the media manager's: those with an icon as icon
 * buttons, as many as `inline` says and the header has room for, and the rest in a "More actions"
 * menu, built as the context menu is. Each action runs on what the header shows, already bound. It
 * knows nothing of the file manager, so the media manager's panels can use it too.
 */
const ToolbarActions = ({ groups, moreLabel, inline, collapses, size = "medium" }: ToolbarActionsProps) => {
    const buttonsRef = useRef<HTMLDivElement>(null);
    const [menu, setMenu] = useState<MenuState | null>(null);
    const placed = groups.flatMap((group) => group.actions.map((action) => ({ group: group.id, action })));
    const asButtons = new Set([
        ...placed
            .filter(({ action }) => action.icon && !action.keep)
            .slice(0, inline)
            .map(({ action }) => action),
        ...placed.filter(({ action }) => action.icon && action.keep).map(({ action }) => action),
    ]);
    const rest = placed.filter(({ action }) => !asButtons.has(action));

    if (placed.length === 0) {
        return null;
    }

    const close = () => setMenu((prev) => prev && { ...prev, open: false });

    // Where the header is narrow the buttons don't show, so the menu holds every action, as read when it opens.
    const openMenu = (anchor: HTMLElement) => {
        const buttons = buttonsRef.current;
        const showing = !!buttons && getComputedStyle(buttons).display !== "none";

        setMenu({ open: true, anchor, rtl: isRtl(anchor), items: showing ? rest : placed });
    };

    const items: ReactNode[] = [];

    if (menu) {
        const hasIcons = menu.items.some(({ action }) => action.icon);

        menu.items.forEach(({ group, action }, index) => {
            if (index > 0 && menu.items[index - 1].group !== group) {
                items.push(<MenuDivider key={`${group}:divider`} />);
            }

            items.push(
                <MenuItem
                    key={`${group}:${action.id}`}
                    data-destructive={action.destructive}
                    aria-keyshortcuts={action.shortcut && ariaShortcut(action.shortcut)}
                    disabled={action.disabled}
                    onClick={() => {
                        close();
                        action.run();
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
    }

    return (
        <>
            {asButtons.size > 0 && (
                <div ref={buttonsRef} className={cx(styles.buttons, collapses && styles.collapsing)}>
                    {[...asButtons].map((action) => (
                        <TooltipIconButton
                            key={action.id}
                            size={size}
                            label={action.label}
                            className={styles.destructive}
                            data-destructive={action.destructive}
                            aria-keyshortcuts={action.shortcut && ariaShortcut(action.shortcut)}
                            disabled={action.disabled}
                            onClick={action.run}
                        >
                            {action.icon && <IconSlot icon={action.icon} />}
                        </TooltipIconButton>
                    ))}
                </div>
            )}
            {(rest.length > 0 || collapses) && (
                <TooltipIconButton
                    size={size}
                    label={moreLabel}
                    className={rest.length === 0 ? styles.spare : undefined}
                    aria-haspopup="menu"
                    aria-expanded={!!menu?.open}
                    onClick={(event) => openMenu(event.currentTarget)}
                >
                    <Icon name="more" fontSize={size === "small" ? "small" : "medium"} />
                </TooltipIconButton>
            )}
            <Menu
                open={!!menu?.open}
                anchor={menu?.anchor}
                rtl={menu?.rtl}
                align="end"
                onClose={close}
            >
                {items}
            </Menu>
        </>
    );
};

export default ToolbarActions;
