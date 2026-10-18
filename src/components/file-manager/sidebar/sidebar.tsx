import { Fragment, useCallback } from "react";
import type { KeyboardEvent } from "react";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { Icon } from "../../icons";
import { HEADER_HEIGHT, SIDEBAR_WIDTH, rootWide } from "../layout";
import SectionItem from "./location-item";

import type { OpenMenu, Place, SectionGroup } from "../types";

interface SidebarProps {
    title: string;
    groups: SectionGroup[];
    expanded: ReadonlySet<string>;
    /** `folderKey` of the open folder. */
    selectedKey: string | null;
    /** Whether the overlay is showing while the sidebar is collapsed; has no effect once it docks. */
    open: boolean;
    onToggle: (key: string) => void;
    onNavigate: (place: Place) => void;
    onOpenMenu: OpenMenu;
    onClose: () => void;
}

const sidebarSx: SxProps<Theme> = (theme) => ({
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    bgcolor: "background.default",

    // Collapsed: an overlay drawer that slides in over the content. It stays inside the
    // file manager rather than portalling to <body>, so an embedded instance overlays only itself.
    position: "absolute",
    zIndex: 2,
    top: 0,
    bottom: 0,
    left: 0,
    width: `min(${SIDEBAR_WIDTH + 32}px, 85%)`,
    boxShadow: 8,
    transform: "translateX(-100%)",
    // Hidden, not just off-screen, so its buttons drop out of the tab order while closed.
    visibility: "hidden",
    transition: theme.transitions.create(["transform", "visibility"], {
        duration: theme.transitions.duration.enteringScreen,
        easing: theme.transitions.easing.easeOut,
    }),
    '&[data-open="true"]': {
        transform: "none",
        visibility: "visible",
    },

    // Docked beside the content.
    [rootWide]: {
        position: "relative",
        zIndex: "auto",
        width: SIDEBAR_WIDTH,
        boxShadow: "none",
        transform: "none",
        visibility: "visible",
        transition: "none",
    },
});

const headerSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    flexShrink: 0,
    minHeight: HEADER_HEIGHT,
    px: 1,
};

const titleSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    textAlign: "center",
    fontSize: "0.9375rem",
    fontWeight: 700,
};

const navSx: SxProps<Theme> = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    px: 1,
    pb: 1,
};

const groupTitleSx: SxProps<Theme> = {
    display: "block",
    px: 1.5,
    pt: 0.5,
    pb: 0.5,
    color: "text.secondary",
    fontWeight: 600,
};

const listSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    m: 0,
    p: 0,
};

const dividerSx: SxProps<Theme> = {
    mx: 1.25,
    my: 1,
};

const Sidebar = ({
    title,
    groups,
    expanded,
    selectedKey,
    open,
    onToggle,
    onNavigate,
    onOpenMenu,
    onClose,
}: SidebarProps) => {
    // Picking a location closes the overlay; expanding a folder doesn't, so the tree can be browsed in it.
    const handleNavigate = useCallback(
        (place: Place) => {
            onNavigate(place);
            onClose();
        },
        [onNavigate, onClose],
    );

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            onClose();
        }
    };

    return (
        <Box sx={sidebarSx} data-open={open} onKeyDown={handleKeyDown}>
            <Box sx={headerSx}>
                <IconButton aria-label="Search">
                    <Icon name="search" fontSize="small" />
                </IconButton>
                <Typography component="span" noWrap sx={titleSx}>
                    {title}
                </Typography>
                <IconButton aria-label="Main menu">
                    <Icon name="menu" fontSize="small" />
                </IconButton>
            </Box>
            <Box component="nav" aria-label="Sections" sx={navSx}>
                {groups.map((group, index) => (
                    <Fragment key={group.id}>
                        {index > 0 && <Divider sx={dividerSx} />}
                        {group.title && (
                            <Typography variant="caption" sx={groupTitleSx}>
                                {group.title}
                            </Typography>
                        )}
                        <Box component="ul" sx={listSx}>
                            {group.sections.map((section) => (
                                <SectionItem
                                    key={section.id}
                                    section={section}
                                    expanded={expanded}
                                    selectedKey={selectedKey}
                                    onToggle={onToggle}
                                    onNavigate={handleNavigate}
                                    onOpenMenu={onOpenMenu}
                                />
                            ))}
                        </Box>
                    </Fragment>
                ))}
            </Box>
        </Box>
    );
};

export default Sidebar;
