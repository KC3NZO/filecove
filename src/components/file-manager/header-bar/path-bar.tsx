import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import type { SxProps, Theme } from "@mui/material/styles";

import { useDropTarget } from "../../../hooks/use-drop-target";
import { useLocale } from "../../../hooks/use-locale";
import { dragMarkers, focusRing } from "../../../styles/mixins";
import { belowElement } from "../../../utils/menu-position";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";
import IconSlot from "../../icons/icon-slot";

import type { FileManagerLocation, FolderRef, IconSource, OpenMenu, Section } from "../../../types";

interface PathBarProps {
    section: Section;
    trail: FolderRef[];
    hasActions: boolean;
    onNavigate: (place: FileManagerLocation) => void;
    onOpenMenu: OpenMenu;
    /**
     * Types a path in the bar's place, from a press on its empty space or the touch screens' button.
     * Without it, the bar has neither, as in the transfer picker.
     */
    onEdit?: () => void;
}

interface Segment {
    id: string;
    label: string;
    icon?: IconSource;
}

interface CrumbProps {
    section: Section;
    segment: Segment;
    /** Trail to the segment's folder. */
    trail: FolderRef[];
    /** The open folder's. */
    current: boolean;
    onNavigate: (place: FileManagerLocation) => void;
}

const barSx = {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    height: 34,
    px: 0.5,
    borderRadius: 2,
    bgcolor: "action.hover",
} satisfies SxProps<Theme>;

// Its empty space edits the path, as the address bars of Windows' and KDE's file managers do.
const editableBarSx = { ...barSx, cursor: "text" } satisfies SxProps<Theme>;

// The track sits in a reversed flex row, which lines it up with the scroller's end and starts
// scrolled there, so a path too long to fit shows its last segments and scrolls back towards the
// root, with no JavaScript measuring. That holds both ways the text runs, as `direction` tricks
// wouldn't: the path still reads from the root at the start, on the right right to left.
const scrollerSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "row-reverse",
    overflowX: "auto",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
};

// At least as wide as the scroller, so a short path starts at its start rather than its end.
const trackSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
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

// A folder the dragged entries would go into is marked as the tree's and the content's are.
const segmentSx: SxProps<Theme> = (theme) => ({
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
    ...dragMarkers(theme),
});

const labelSx: SxProps<Theme> = {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
};

const menuButtonSx: SxProps<Theme> = {
    marginInlineStart: 0.25,
};

// Touch screens only, which have no Ctrl+L. This asks what the input can do, not how wide the
// screen is, so it is a media query rather than a container one, as the header's Select button is.
const editButtonSx: SxProps<Theme> = {
    display: "none",
    marginInlineStart: 0.25,
    "@media (hover: none)": { display: "inline-flex" },
};

// A press on the bar itself rather than on a segment or a button.
const onEmptySpace = (target: EventTarget) => target instanceof Element && !target.closest("button");

/**
 * A segment of the path, which opens its folder. Entries dragged onto it go into the folder, by the
 * same rules as pasting, and so do files from outside, as a tree row takes them. A drag resting on
 * it opens the folder, as GNOME's path bar does, and goes on there.
 */
const Crumb = ({ section, segment, trail, current, onNavigate }: CrumbProps) => {
    const open = () => onNavigate({ sectionId: section.id, trail });
    const drop = useDropTarget({
        targetsAt: () => [{ key: segment.id, section, trail }],
        onHold: current ? undefined : open,
    });

    return (
        <ButtonBase
            sx={segmentSx}
            aria-current={current ? "location" : undefined}
            data-drop-target={drop.dropKey !== null}
            onClick={open}
            {...drop.handlers}
        >
            {segment.icon && <IconSlot icon={segment.icon} />}
            <Box component="bdi" sx={labelSx}>
                {segment.label}
            </Box>
        </ButtonBase>
    );
};

/**
 * The section's name first, then the folders opened below its root. Its empty space, Ctrl+L and, on
 * touch screens, a button edit the path.
 */
const PathBar = ({ section, trail, hasActions, onNavigate, onOpenMenu, onEdit }: PathBarProps) => {
    const { text } = useLocale();
    const segments: Segment[] = [
        { id: section.rootId, label: section.label, icon: section.icon },
        ...trail.map((folder) => ({ id: folder.id, label: folder.name })),
    ];

    return (
        <Box
            component="nav"
            aria-label={text.path}
            sx={onEdit ? editableBarSx : barSx}
            // Keeps the focus where it is, to go back to as the field closes.
            onMouseDown={onEdit && ((event) => onEmptySpace(event.target) && event.preventDefault())}
            onClick={onEdit && ((event) => onEmptySpace(event.target) && onEdit())}
        >
            <Box sx={scrollerSx}>
                <Box component="ol" sx={trackSx}>
                    {segments.map((segment, index) => (
                        <Box component="li" key={segment.id} sx={itemSx}>
                            {index > 0 && (
                                <Box component="span" aria-hidden sx={separatorSx}>
                                    /
                                </Box>
                            )}
                            <Crumb
                                section={section}
                                segment={segment}
                                trail={trail.slice(0, index)}
                                current={index === segments.length - 1}
                                onNavigate={onNavigate}
                            />
                        </Box>
                    ))}
                </Box>
            </Box>
            {onEdit && (
                <TooltipIconButton
                    size="small"
                    label={text.editPath}
                    aria-keyshortcuts="Control+L Meta+L"
                    sx={editButtonSx}
                    onClick={onEdit}
                >
                    <Icon name="edit" fontSize="small" />
                </TooltipIconButton>
            )}
            {hasActions && (
                <TooltipIconButton
                    size="small"
                    label={text.folderMenu}
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
                </TooltipIconButton>
            )}
        </Box>
    );
};

export default PathBar;
