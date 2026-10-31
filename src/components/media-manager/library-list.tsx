import type { Ref } from "react";

import ButtonBase from "@mui/material/ButtonBase";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useLocale } from "../../hooks/use-locale";
import { HEADER_HEIGHT } from "../../styles/layout";
import { LIBRARIES_WIDTH, mediaMedium } from "../../styles/media-layout";
import {
    focusRing,
    forcedColors,
    forcedSelected,
    hoverBackground,
    selectedBackground,
    selectedHoverBackground,
} from "../../styles/mixins";
import { KIND_ICONS } from "../../utils/media";
import TooltipIconButton from "../buttons/tooltip-icon-button";
import Icon from "../icons/icon";
import IconSlot from "../icons/icon-slot";

import type { MediaSectionGroup } from "../../types";

interface LibraryListProps {
    ref: Ref<HTMLElement>;
    groups: readonly MediaSectionGroup[];
    /** The id of the library shown. */
    openId: string | undefined;
    /** Whether the drawer is open, where the list doesn't dock. */
    open: boolean;
    onOpen: (sectionId: string) => void;
    /** Closes the drawer. */
    onClose: () => void;
}

// Below `mediaMedium`, a drawer that slides in over the library from the start side while it's
// open, as the file manager's sidebar does, inside the media manager rather than portalled. It
// slides by `translate` rather than `transform`, which Emotion's RTL plugin would flip a second
// time, and is hidden while closed, so its buttons drop out of the Tab order. From it, docked
// beside the library.
const listSx: SxProps<Theme> = (theme) => ({
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    position: "absolute",
    zIndex: 3,
    top: 0,
    bottom: 0,
    insetInlineStart: 0,
    width: `min(${LIBRARIES_WIDTH + 40}px, 85%)`,
    overflowY: "auto",
    px: 1,
    pb: 1,
    bgcolor: "background.default",
    boxShadow: 8,
    outline: "none",
    "--closed-shift": "-100%",
    "&:dir(rtl)": { "--closed-shift": "100%" },
    translate: "var(--closed-shift)",
    visibility: "hidden",
    transition: theme.transitions.create(["translate", "visibility"], {
        duration: theme.transitions.duration.enteringScreen,
        easing: theme.transitions.easing.easeOut,
    }),
    '&[data-open="true"]': { translate: "none", visibility: "visible" },
    [mediaMedium]: {
        position: "relative",
        zIndex: "auto",
        width: LIBRARIES_WIDTH,
        boxShadow: "none",
        translate: "none",
        visibility: "visible",
        transition: "none",
    },
});

// Only in the drawer: its title and its ✕.
const headerSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 1,
    flexShrink: 0,
    minHeight: HEADER_HEIGHT,
    paddingInlineStart: 1.5,
    [mediaMedium]: { display: "none" },
};

const titleSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    fontSize: "0.9375rem",
    fontWeight: 700,
};

const groupTitleSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    minHeight: 28,
    px: 1.5,
    mt: 1,
    color: "text.secondary",
    fontWeight: 600,
};

const rowSx: SxProps<Theme> = (theme) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 1.5,
    width: "100%",
    minHeight: 36,
    px: 1.5,
    borderRadius: 2,
    color: "text.primary",
    textAlign: "start",
    "&:hover": { bgcolor: hoverBackground(theme) },
    '&[aria-current="page"]': { bgcolor: selectedBackground(theme), color: "primary.main" },
    '&[aria-current="page"]:hover': { bgcolor: selectedHoverBackground(theme) },
    ...focusRing,
    [forcedColors]: { '&[aria-current="page"]': forcedSelected['&[data-selected="true"]'] },
});

const labelSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
};

/**
 * The libraries, the sections in their groups, as a list of places the library shows one of:
 * docked beside it where there's room, or a drawer over it.
 */
const LibraryList = ({ ref, groups, openId, open, onOpen, onClose }: LibraryListProps) => {
    const { text } = useLocale();

    return (
        <Box
            ref={ref}
            component="nav"
            tabIndex={-1}
            aria-label={text.mediaLibraries}
            sx={listSx}
            data-open={open}
            onKeyDown={(event) => {
                if (event.key === "Escape" && open && !event.defaultPrevented) {
                    event.preventDefault();
                    onClose();
                }
            }}
        >
            <Box sx={headerSx}>
                <Typography component="h2" noWrap sx={titleSx}>
                    {text.mediaLibraries}
                </Typography>
                <TooltipIconButton label={text.mediaCloseLibraries} onClick={onClose}>
                    <Icon name="close" fontSize="small" />
                </TooltipIconButton>
            </Box>
            {groups.map((group) =>
                group.sections.length === 0 ? null : (
                    <Box key={group.id} component="section" aria-label={group.title}>
                        {group.title && (
                            <Typography variant="caption" component="h3" sx={groupTitleSx}>
                                {group.title}
                            </Typography>
                        )}
                        {group.sections.map((section) => (
                            <ButtonBase
                                key={section.id}
                                sx={rowSx}
                                aria-current={section.id === openId ? "page" : undefined}
                                onClick={() => onOpen(section.id)}
                            >
                                <IconSlot icon={section.icon ?? KIND_ICONS[section.kind]} />
                                <Typography variant="body2" noWrap sx={labelSx}>
                                    {section.label}
                                </Typography>
                            </ButtonBase>
                        ))}
                    </Box>
                ),
            )}
        </Box>
    );
};

export default LibraryList;
