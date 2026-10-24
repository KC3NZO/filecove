import { useContext } from "react";
import type { RefObject } from "react";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Checkbox from "@mui/material/Checkbox";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import type { MenuProps } from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../../contexts/direction-context";
import { useLocale } from "../../../hooks/use-locale";
import { focusRing, menuPaperSx } from "../../../styles/mixins";
import Icon from "../../icons/icon";
import IconSlot from "../../icons/icon-slot";

import type { SectionGroup } from "../../../types";

interface SearchSectionsMenuProps {
    groups: SectionGroup[];
    /** Ids of the sections left out of the search; never all of them. */
    excluded: ReadonlySet<string>;
    /** The open menu's button, and which way its text runs, read as it opened. */
    menu: SectionsMenu | null;
    buttonRef: RefObject<HTMLButtonElement | null>;
    onOpen: () => void;
    onClose: () => void;
    onExcludedChange: (excluded: ReadonlySet<string>) => void;
}

export interface SectionsMenu {
    anchor: HTMLElement;
    rtl: boolean;
}

const NONE: ReadonlySet<string> = new Set();

const buttonSx: SxProps<Theme> = {
    flexShrink: 0,
    gap: 0.25,
    height: 26,
    paddingInlineStart: 1,
    paddingInlineEnd: 0.5,
    borderRadius: 1.5,
    color: "text.secondary",
    fontSize: "0.8125rem",
    whiteSpace: "nowrap",
    "&:hover, &[aria-expanded=\"true\"]": { bgcolor: "action.hover", color: "text.primary" },
    ...focusRing,
};

const slotProps: MenuProps["slotProps"] = {
    paper: { sx: menuPaperSx },
    list: { dense: true },
};

// Hangs from the button's end edge, as the view menu does: the field ends near the header's end.
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

// The checkboxes only show state. The menu item takes the click and holds the focus, so arrow keys
// keep moving through the menu, and it carries the role and checked state.
const controlSx: SxProps<Theme> = {
    p: 0,
    pointerEvents: "none",
};

const sectionIconSx: SxProps<Theme> = {
    display: "inline-flex",
    marginInlineEnd: 1.5,
    color: "text.secondary",
};

/**
 * The search field's button for which sections a search everywhere covers, and its menu, which
 * stays open while sections are checked, so several can change in one go. One section always
 * stays checked. Pressing the button keeps the focus in the field until the menu takes it, and
 * the menu gives it back there.
 */
const SearchSectionsMenu = ({
    groups,
    excluded,
    menu,
    buttonRef,
    onOpen,
    onClose,
    onExcludedChange,
}: SearchSectionsMenuProps) => {
    const { text } = useLocale();
    const dir = useContext(DirectionContext);
    const total = groups.reduce((count, group) => count + group.sections.length, 0);
    const checked = total - excluded.size;
    const all = excluded.size === 0;

    const toggle = (id: string) => {
        const next = new Set(excluded);

        if (!next.delete(id)) {
            next.add(id);
        }

        onExcludedChange(next);
    };

    return (
        <>
            <ButtonBase
                ref={buttonRef}
                aria-label={text.searchSections}
                aria-haspopup="menu"
                aria-expanded={!!menu}
                aria-keyshortcuts="Alt+ArrowDown"
                sx={buttonSx}
                onMouseDown={(event) => event.preventDefault()}
                onClick={onOpen}
            >
                {all ? text.allSections : text.sectionCount(checked)}
                <Icon name="expand" fontSize="small" />
            </ButtonBase>
            <Menu
                dir={dir}
                open={!!menu}
                anchorEl={menu?.anchor}
                {...ORIGINS[menu?.rtl ? "rtl" : "ltr"]}
                slotProps={slotProps}
                onClose={onClose}
            >
                <MenuItem
                    role="menuitemcheckbox"
                    aria-checked={all ? true : "mixed"}
                    onClick={() => onExcludedChange(NONE)}
                >
                    <ListItemIcon>
                        <Checkbox
                            size="small"
                            checked={all}
                            indeterminate={!all}
                            tabIndex={-1}
                            disableRipple
                            sx={controlSx}
                        />
                    </ListItemIcon>
                    <ListItemText>{text.allSections}</ListItemText>
                </MenuItem>
                {groups.flatMap((group) => [
                    group.title ? (
                        <ListSubheader key={`title-${group.id}`} sx={subheaderSx}>
                            {group.title}
                        </ListSubheader>
                    ) : null,
                    ...group.sections.map((section) => {
                        const on = !excluded.has(section.id);

                        return (
                            <MenuItem
                                key={section.id}
                                role="menuitemcheckbox"
                                aria-checked={on}
                                disabled={on && checked === 1}
                                onClick={() => toggle(section.id)}
                            >
                                <ListItemIcon>
                                    <Checkbox
                                        size="small"
                                        checked={on}
                                        tabIndex={-1}
                                        disableRipple
                                        sx={controlSx}
                                    />
                                </ListItemIcon>
                                {section.icon && (
                                    <Box component="span" sx={sectionIconSx}>
                                        <IconSlot icon={section.icon} />
                                    </Box>
                                )}
                                <ListItemText>
                                    <bdi>{section.label}</bdi>
                                </ListItemText>
                            </MenuItem>
                        );
                    }),
                ])}
            </Menu>
        </>
    );
};

export default SearchSectionsMenu;
