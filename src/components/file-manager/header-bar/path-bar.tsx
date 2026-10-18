import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import type { SxProps, Theme } from "@mui/material/styles";

import { focusRing } from "../../../styles/mixins";
import { belowElement } from "../../../utils/menu-position";
import Icon from "../../icons/icon";
import IconSlot from "../icon-slot";

import type { FolderRef, IconSource, OpenMenu, Place, Section } from "../../../types";

interface PathBarProps {
    section: Section;
    trail: FolderRef[];
    hasActions: boolean;
    onNavigate: (place: Place) => void;
    onOpenMenu: OpenMenu;
}

interface Segment {
    id: string;
    label: string;
    icon?: IconSource;
}

const barSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    height: 34,
    px: 0.5,
    borderRadius: 2,
    bgcolor: "action.hover",
};

// An LTR track inside an RTL scroller. A scroller starts at its inline-start edge, which for
// RTL is the right, so a path too long to fit shows its last segments and scrolls back
// towards the root, with no JavaScript measuring.
const scrollerSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    direction: "rtl",
    overflowX: "auto",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
};

const trackSx: SxProps<Theme> = {
    direction: "ltr",
    display: "flex",
    alignItems: "center",
    width: "max-content",
    minWidth: "100%",
    listStyle: "none",
    m: 0,
    p: 0,
};

const itemSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
};

const separatorSx: SxProps<Theme> = {
    px: 0.25,
    color: "text.disabled",
    fontSize: "0.875rem",
    userSelect: "none",
};

const segmentSx: SxProps<Theme> = {
    gap: 0.75,
    height: 28,
    maxWidth: "14rem",
    px: 1,
    borderRadius: 1.5,
    color: "text.secondary",
    fontSize: "0.875rem",
    whiteSpace: "nowrap",
    "&:hover": { bgcolor: "action.hover", color: "text.primary" },
    '&[aria-current="location"]': { color: "text.primary", fontWeight: 700 },
    ...focusRing,
};

const labelSx: SxProps<Theme> = {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
};

const menuButtonSx: SxProps<Theme> = {
    ml: 0.25,
};

/** The section's name first, then the folders opened below its root. */
const PathBar = ({ section, trail, hasActions, onNavigate, onOpenMenu }: PathBarProps) => {
    const segments: Segment[] = [
        { id: section.rootId, label: section.label, icon: section.icon },
        ...trail.map((folder) => ({ id: folder.id, label: folder.name })),
    ];

    return (
        <Box component="nav" aria-label="Path" sx={barSx}>
            <Box sx={scrollerSx}>
                <Box component="ol" sx={trackSx}>
                    {segments.map((segment, index) => (
                        <Box component="li" key={segment.id} sx={itemSx}>
                            {index > 0 && (
                                <Box component="span" aria-hidden sx={separatorSx}>
                                    /
                                </Box>
                            )}
                            <ButtonBase
                                sx={segmentSx}
                                aria-current={index === segments.length - 1 ? "location" : undefined}
                                onClick={() => onNavigate({ sectionId: section.id, trail: trail.slice(0, index) })}
                            >
                                {segment.icon && <IconSlot icon={segment.icon} />}
                                <Box component="span" sx={labelSx}>
                                    {segment.label}
                                </Box>
                            </ButtonBase>
                        </Box>
                    ))}
                </Box>
            </Box>
            {hasActions && (
                <IconButton
                    size="small"
                    aria-label="Folder menu"
                    sx={menuButtonSx}
                    onClick={(event) =>
                        onOpenMenu(belowElement(event.currentTarget), {
                            target: "folder",
                            section,
                            trail,
                            entries: [],
                        })
                    }
                >
                    <Icon name="more" fontSize="small" />
                </IconButton>
            )}
        </Box>
    );
};

export default PathBar;
