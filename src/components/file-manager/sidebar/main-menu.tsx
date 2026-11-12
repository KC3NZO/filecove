import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { useLocale } from "../../../hooks/use-locale";
import { isRtl } from "../../../utils/dom";
import { ariaShortcut, formatShortcut } from "../../../utils/shortcut";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";
import IconSlot from "../../icons/icon-slot";
import Menu, { MenuDivider, MenuIcon, MenuItem, MenuShortcut, MenuText } from "../../ui/menu";

import type { MainMenuGroup, UndoChange } from "../../../types";

/** The menu's Undo and Redo, named by the change each undoes or redoes, or null with none to. */
export interface UndoItems {
    undo: UndoChange | null;
    redo: UndoChange | null;
    onUndo: () => void;
    onRedo: () => void;
}

interface MainMenuProps {
    /** The consumer's items, shown between the file manager's Undo and Redo and its "Keyboard shortcuts". */
    groups: MainMenuGroup[];
    /** Undo and Redo, at the top; missing when nothing the file manager does can be undone. */
    undo?: UndoItems;
    /** Opens the keyboard shortcuts, which give the focus back to `opener` as they close. */
    onShowShortcuts: (opener: HTMLElement | null) => void;
}

const UNDO_KEYS = ["Ctrl", "Z"];
const REDO_KEYS = ["Ctrl", "Shift", "Z"];
const SHORTCUTS_KEYS = ["Ctrl", "?"];

/**
 * The sidebar's main menu: Undo and Redo, as in GNOME Files, the consumer's items, for what belongs
 * to the app (preferences, help, about), then "Keyboard shortcuts". Picking an item closes the menu
 * first.
 */
const MainMenu = ({ groups, undo, onShowShortcuts }: MainMenuProps) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const [rtl, setRtl] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const { text } = useLocale();
    const shown = groups.filter((group) => group.items.length > 0);
    // Labels without an icon are inset so they line up with the ones that have one.
    const hasIcons = shown.some((group) => group.items.some((item) => item.icon));
    const close = () => setAnchor(null);
    const items: ReactNode[] = [];

    if (undo) {
        items.push(
            <MenuItem
                key="undo"
                aria-keyshortcuts="Control+Z Meta+Z"
                disabled={!undo.undo}
                onClick={() => {
                    close();
                    undo.onUndo();
                }}
            >
                <MenuText inset={hasIcons}>{undo.undo ? text.undoChange(undo.undo) : text.undo}</MenuText>
                <MenuShortcut>{formatShortcut(UNDO_KEYS, text)}</MenuShortcut>
            </MenuItem>,
            <MenuItem
                key="redo"
                aria-keyshortcuts="Shift+Control+Z Shift+Meta+Z Control+Y Meta+Y"
                disabled={!undo.redo}
                onClick={() => {
                    close();
                    undo.onRedo();
                }}
            >
                <MenuText inset={hasIcons}>{undo.redo ? text.redoChange(undo.redo) : text.redo}</MenuText>
                <MenuShortcut>{formatShortcut(REDO_KEYS, text)}</MenuShortcut>
            </MenuItem>,
            <MenuDivider key="undo:divider" />,
        );
    }

    shown.forEach((group) => {
        group.items.forEach((item) => {
            items.push(
                <MenuItem
                    key={`${group.id}:${item.id}`}
                        aria-keyshortcuts={item.shortcut && ariaShortcut(item.shortcut)}
                    disabled={item.disabled}
                    onClick={() => {
                        close();
                        item.onSelect();
                    }}
                >
                    {item.icon && (
                        <MenuIcon>
                            <IconSlot icon={item.icon} />
                        </MenuIcon>
                    )}
                    <MenuText inset={hasIcons && !item.icon}>{item.label}</MenuText>
                    {item.shortcut && <MenuShortcut>{item.shortcut}</MenuShortcut>}
                </MenuItem>,
            );
        });

        items.push(<MenuDivider key={`${group.id}:divider`} />);
    });

    return (
        <>
            <TooltipIconButton
                ref={buttonRef}
                label={text.mainMenu}
                aria-haspopup="menu"
                aria-expanded={!!anchor}
                onClick={(event) => {
                    setRtl(isRtl(event.currentTarget));
                    setAnchor(event.currentTarget);
                }}
            >
                <Icon name="menu" fontSize="small" />
            </TooltipIconButton>
            {/* Hangs from the button's end edge, since the button sits at the sidebar header's end. */}
            <Menu open={!!anchor} anchor={anchor} rtl={rtl} align="end" onClose={close}>
                {items}
                {/* Ctrl only, not ⌘, as the key works. */}
                <MenuItem
                        aria-keyshortcuts="Control+?"
                    onClick={() => {
                        close();
                        onShowShortcuts(buttonRef.current);
                    }}
                >
                    <MenuText inset={hasIcons}>{text.keyboardShortcuts}</MenuText>
                    <MenuShortcut>{formatShortcut(SHORTCUTS_KEYS, text)}</MenuShortcut>
                </MenuItem>
            </Menu>
        </>
    );
};

export default MainMenu;
