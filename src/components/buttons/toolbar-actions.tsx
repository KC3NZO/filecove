import { useContext, useRef, useState } from "react";
import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import type { MenuProps } from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../contexts/direction-context";
import { menuPaperSx } from "../../styles/mixins";
import { isRtl } from "../../utils/dom";
import { ariaShortcut } from "../../utils/shortcut";
import Icon from "../icons/icon";
import IconSlot from "../icons/icon-slot";
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
     * A container query (an `sx` key) from which the actions show as buttons; below it, every one
     * is in "More actions". Without it, they always show as buttons.
     */
    wide?: string;
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

const slotProps: MenuProps["slotProps"] = {
    paper: { sx: menuPaperSx },
    list: { dense: true },
};

// Hangs from the button's end edge, as the header's other menus do: its right edge, or its left
// edge right to left.
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

const buttonsSx = {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
} satisfies SxProps<Theme>;

const destructiveSx: SxProps<Theme> = {
    '&[data-destructive="true"]': { color: "error.main" },
};

// A label without an icon is inset, which MUI does with a `padding-left`.
const itemSx: SxProps<Theme> = {
    "& .MuiListItemText-inset": { paddingLeft: 0, paddingInlineStart: "36px" },
    '&[data-destructive="true"]': {
        color: "error.main",
        "& .MuiListItemIcon-root": { color: "inherit" },
    },
};

const shortcutSx: SxProps<Theme> = {
    marginInlineStart: 3,
    color: "text.secondary",
};

// Hidden below `wide`, where the menu holds every action instead.
const shownFrom = (wide: string | undefined): SxProps<Theme> =>
    wide ? { ...buttonsSx, display: "none", [wide]: { display: "flex" } } : buttonsSx;

/**
 * The app's actions in a header, the preview's, the properties panel's or the media manager's: those with an icon as icon
 * buttons, as many as `inline` says and the header has room for, and the rest in a "More actions"
 * menu, built as the context menu is. Each action runs on what the header shows, already bound. It
 * knows nothing of the file manager, so the media manager's panels can use it too.
 */
const ToolbarActions = ({ groups, moreLabel, inline, wide, size = "medium" }: ToolbarActionsProps) => {
    const dir = useContext(DirectionContext);
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

    // Below `wide` the buttons don't show, so the menu holds every action, as read when it opens.
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
                items.push(<Divider key={`${group}:divider`} />);
            }

            items.push(
                <MenuItem
                    key={`${group}:${action.id}`}
                    sx={itemSx}
                    data-destructive={action.destructive}
                    aria-keyshortcuts={action.shortcut && ariaShortcut(action.shortcut)}
                    disabled={action.disabled}
                    onClick={() => {
                        close();
                        action.run();
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
    }

    // With nothing left over, "More actions" only shows where the buttons don't.
    const moreSx: SxProps<Theme> | undefined = rest.length === 0 && wide ? { [wide]: { display: "none" } } : undefined;

    return (
        <>
            {asButtons.size > 0 && (
                <Box ref={buttonsRef} sx={shownFrom(wide)}>
                    {[...asButtons].map((action) => (
                        <TooltipIconButton
                            key={action.id}
                            size={size}
                            label={action.label}
                            sx={destructiveSx}
                            data-destructive={action.destructive}
                            aria-keyshortcuts={action.shortcut && ariaShortcut(action.shortcut)}
                            disabled={action.disabled}
                            onClick={action.run}
                        >
                            {action.icon && <IconSlot icon={action.icon} />}
                        </TooltipIconButton>
                    ))}
                </Box>
            )}
            {(rest.length > 0 || wide) && (
                <TooltipIconButton
                    size={size}
                    label={moreLabel}
                    sx={moreSx}
                    aria-haspopup="menu"
                    aria-expanded={!!menu?.open}
                    onClick={(event) => openMenu(event.currentTarget)}
                >
                    <Icon name="more" fontSize={size === "small" ? "small" : "medium"} />
                </TooltipIconButton>
            )}
            <Menu
                dir={dir}
                open={!!menu?.open}
                anchorEl={menu?.anchor}
                {...ORIGINS[menu?.rtl ? "rtl" : "ltr"]}
                slotProps={slotProps}
                onClose={close}
            >
                {items}
            </Menu>
        </>
    );
};

export default ToolbarActions;
