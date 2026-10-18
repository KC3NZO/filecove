import { Fragment, useCallback, useState } from "react";
import type { KeyboardEvent } from "react";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { Icon } from "../../icons";
import { HEADER_HEIGHT, SIDEBAR_WIDTH, rootWide } from "../layout";
import LocationItem from "./location-item";

import type { LocationSection } from "../types";

interface SidebarProps {
    title: string;
    sections: LocationSection[];
    /** Whether the overlay is showing while the sidebar is collapsed; has no effect once it docks. */
    open: boolean;
    onClose: () => void;
    defaultSelected?: string;
    defaultExpanded?: string[];
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

const sectionTitleSx: SxProps<Theme> = {
    display: "block",
    px: 1.5,
    pt: 1,
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

const Sidebar = ({ title, sections, open, onClose, defaultSelected, defaultExpanded }: SidebarProps) => {
    const [selected, setSelected] = useState(defaultSelected);
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(defaultExpanded));

    const handleToggle = useCallback((id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    }, []);

    // Opening a location also reveals its sub-tree, the way Explorer's navigation pane does.
    const handleSelect = useCallback(
        (id: string) => {
            setSelected(id);
            setExpanded((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
            onClose();
        },
        [onClose],
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
            <Box component="nav" aria-label="Locations" sx={navSx}>
                {sections.map((section, index) => (
                    <Fragment key={section.id}>
                        {index > 0 && <Divider sx={dividerSx} />}
                        {section.title && (
                            <Typography variant="caption" sx={sectionTitleSx}>
                                {section.title}
                            </Typography>
                        )}
                        <Box component="ul" sx={listSx}>
                            {section.locations.map((node) => (
                                <LocationItem
                                    key={node.id}
                                    node={node}
                                    depth={0}
                                    selected={selected}
                                    expanded={expanded}
                                    onSelect={handleSelect}
                                    onToggle={handleToggle}
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
