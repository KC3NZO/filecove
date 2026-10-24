import { useContext, useRef, useState } from "react";
import type { ReactNode } from "react";

import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import type { MenuProps } from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../../contexts/direction-context";
import { useLocale } from "../../../hooks/use-locale";
import { menuPaperSx } from "../../../styles/mixins";
import { isRtl } from "../../../utils/dom";
import { ariaShortcut, formatShortcut } from "../../../utils/shortcut";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";
import IconSlot from "../../icons/icon-slot";

import type { MainMenuGroup } from "../../../types";

interface MainMenuProps {
    /** The consumer's items, shown above the file manager's own. */
    groups: MainMenuGroup[];
    /** Opens the keyboard shortcuts, which give the focus back to `opener` as they close. */
    onShowShortcuts: (opener: HTMLElement | null) => void;
}

const SHORTCUTS_KEYS = ["Ctrl", "?"];

const slotProps: MenuProps["slotProps"] = {
    paper: { sx: menuPaperSx },
    list: { dense: true },
};

// Hangs from the button's end edge, since the button sits at the sidebar header's end: its right
// edge, or its left edge right to left.
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

// A label without an icon is inset, which MUI does with a `padding-left`.
const itemSx: SxProps<Theme> = {
    "& .MuiListItemText-inset": { paddingLeft: 0, paddingInlineStart: "36px" },
};

const shortcutSx: SxProps<Theme> = {
    marginInlineStart: 3,
    color: "text.secondary",
};

/**
 * The sidebar's main menu: the consumer's items, for what belongs to the app (preferences, help,
 * about), then "Keyboard shortcuts". Picking an item closes the menu first.
 */
const MainMenu = ({ groups, onShowShortcuts }: MainMenuProps) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const [rtl, setRtl] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const { text } = useLocale();
    const dir = useContext(DirectionContext);
    const shown = groups.filter((group) => group.items.length > 0);
    // Labels without an icon are inset so they line up with the ones that have one.
    const hasIcons = shown.some((group) => group.items.some((item) => item.icon));
    const close = () => setAnchor(null);
    const items: ReactNode[] = [];

    shown.forEach((group) => {
        group.items.forEach((item) => {
            items.push(
                <MenuItem
                    key={`${group.id}:${item.id}`}
                    sx={itemSx}
                    aria-keyshortcuts={item.shortcut && ariaShortcut(item.shortcut)}
                    disabled={item.disabled}
                    onClick={() => {
                        close();
                        item.onSelect();
                    }}
                >
                    {item.icon && (
                        <ListItemIcon>
                            <IconSlot icon={item.icon} />
                        </ListItemIcon>
                    )}
                    <ListItemText inset={hasIcons && !item.icon}>{item.label}</ListItemText>
                    {item.shortcut && (
                        <Typography variant="body2" sx={shortcutSx}>
                            <bdi>{item.shortcut}</bdi>
                        </Typography>
                    )}
                </MenuItem>,
            );
        });

        items.push(<Divider key={`${group.id}:divider`} />);
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
            <Menu
                dir={dir}
                open={!!anchor}
                anchorEl={anchor}
                {...ORIGINS[rtl ? "rtl" : "ltr"]}
                slotProps={slotProps}
                onClose={close}
            >
                {items}
                {/* Ctrl only, not ⌘, as the key works. */}
                <MenuItem
                    sx={itemSx}
                    aria-keyshortcuts="Control+?"
                    onClick={() => {
                        close();
                        onShowShortcuts(buttonRef.current);
                    }}
                >
                    <ListItemText inset={hasIcons}>{text.keyboardShortcuts}</ListItemText>
                    <Typography variant="body2" sx={shortcutSx}>
                        <bdi>{formatShortcut(SHORTCUTS_KEYS, text)}</bdi>
                    </Typography>
                </MenuItem>
            </Menu>
        </>
    );
};

export default MainMenu;
