import { useMemo } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { FolderTypeIcon, Icon } from "../../icons";
import { pointerPosition } from "../context-menu/position";
import { useFolder } from "../data/data-context";
import { folderKey } from "../data/folder-store";
import { compareEntries } from "../format";
import IconSlot from "../icon-slot";
import { focusRing, selectedBackground } from "../styles";

import type { FileEntry } from "../adapter";
import type { FolderState } from "../data/folder-store";
import type { FolderRef, MenuPosition, OpenMenu, Place, Section } from "../types";

/** Props every item of a section's tree passes down unchanged. */
interface TreeProps {
    section: Section;
    expanded: ReadonlySet<string>;
    /** `folderKey` of the open folder. */
    selectedKey: string | null;
    onToggle: (key: string) => void;
    onNavigate: (place: Place) => void;
    onOpenMenu: OpenMenu;
}

interface FolderItemProps extends TreeProps {
    entry: FileEntry;
    depth: number;
    parentTrail: FolderRef[];
}

interface FolderChildrenProps extends TreeProps {
    state: FolderState | undefined;
    /** Depth of the child rows. */
    depth: number;
    /** Trail to the folder whose children these are. */
    trail: FolderRef[];
    onRetry: () => void;
}

interface TreeRowProps {
    variant: "section" | "folder";
    icon: ReactNode;
    label: string;
    selected: boolean;
    expandable: boolean;
    expanded: boolean;
    loading: boolean;
    onSelect: () => void;
    onToggle: () => void;
    onMenu: (position: MenuPosition) => boolean;
}

/*
 * Tree geometry, in px. Each `<li>` sets `--depth`, and every offset below is derived from it.
 * A level's guide line runs through the centre of its parent's chevron, or through the section
 * icon for the first level, so the tree visibly hangs from the section it belongs to.
 */
const INSET = 12;
const INDENT = 16;
const CHEVRON = 20;

const ROOT_TRAIL: FolderRef[] = [];

const indent = (extra: number) => `calc(${INSET + extra}px + var(--depth) * ${INDENT}px)`;

const depthStyle = (depth: number) => ({ "--depth": depth }) as CSSProperties;

const isFolder = (entry: FileEntry) => entry.kind === "folder";

const itemSx: SxProps<Theme> = {
    listStyle: "none",
};

const rowSx: SxProps<Theme> = (theme) => ({
    position: "relative",
    borderRadius: 2,
    color: "text.primary",
    "&:hover": { bgcolor: "action.hover" },
    '&[data-selected="true"]': {
        bgcolor: selectedBackground(theme),
        color: "primary.main",
    },
});

const sectionButtonSx: SxProps<Theme> = {
    width: "100%",
    minHeight: 36,
    justifyContent: "flex-start",
    gap: 1.5,
    pl: `${INSET}px`,
    // Room for the expand toggle on the right.
    pr: 4.5,
    borderRadius: "inherit",
    ...focusRing,
};

const folderButtonSx: SxProps<Theme> = {
    width: "100%",
    minHeight: 30,
    justifyContent: "flex-start",
    gap: 1,
    pl: indent(CHEVRON + 4),
    pr: 1,
    borderRadius: "inherit",
    "& > svg": { flexShrink: 0 },
    ...focusRing,
};

const sectionLabelSx: SxProps<Theme> = {
    minWidth: 0,
    fontSize: "0.875rem",
};

const folderLabelSx: SxProps<Theme> = {
    minWidth: 0,
    fontSize: "0.8125rem",
};

// Sections keep the plain GNOME look, so their toggle only shows on hover, on keyboard focus,
// while expanded, or always on touch screens where there is no hover.
const sectionToggleSx: SxProps<Theme> = {
    position: "absolute",
    top: "50%",
    right: 6,
    width: 24,
    height: 24,
    transform: "translateY(-50%)",
    borderRadius: 1,
    color: "text.secondary",
    opacity: 0,
    transition: "opacity 120ms",
    "&:hover": { bgcolor: "action.hover", color: "text.primary" },
    '*:hover > &, &.Mui-focusVisible, &[aria-expanded="true"]': { opacity: 1 },
    "@media (hover: none)": { opacity: 1 },
    "& > svg": { fontSize: "1.125rem", transition: "transform 150ms" },
    '&[aria-expanded="true"] > svg': { transform: "rotate(90deg)" },
    ...focusRing,
};

const folderToggleSx: SxProps<Theme> = {
    position: "absolute",
    top: "50%",
    left: indent(0),
    width: CHEVRON,
    height: CHEVRON,
    transform: "translateY(-50%)",
    borderRadius: 1,
    color: "text.secondary",
    "&:hover": { bgcolor: "action.hover", color: "text.primary" },
    "& > svg": { fontSize: "1rem", transition: "transform 150ms" },
    '&[aria-expanded="true"] > svg': { transform: "rotate(90deg)" },
    ...focusRing,
};

const childListSx: SxProps<Theme> = {
    position: "relative",
    m: 0,
    px: 0,
    py: 0.25,
    "&::before": {
        content: '""',
        position: "absolute",
        top: 2,
        bottom: 2,
        left: indent(CHEVRON / 2),
        width: "1px",
        bgcolor: "divider",
    },
};

const errorRowSx: SxProps<Theme> = {
    listStyle: "none",
    display: "flex",
    alignItems: "center",
    gap: 1,
    minHeight: 30,
    pl: indent(CHEVRON + 4),
    color: "error.main",
    fontSize: "0.8125rem",
};

const retrySx: SxProps<Theme> = {
    px: 0.75,
    borderRadius: 1,
    color: "text.secondary",
    fontSize: "inherit",
    textDecoration: "underline",
    "&:hover": { color: "text.primary" },
    ...focusRing,
};

const TreeRow = ({
    variant,
    icon,
    label,
    selected,
    expandable,
    expanded,
    loading,
    onSelect,
    onToggle,
    onMenu,
}: TreeRowProps) => {
    const isSection = variant === "section";

    const handleContextMenu = (event: MouseEvent) => {
        if (onMenu(pointerPosition(event))) {
            event.preventDefault();
        }
    };

    return (
        <Box sx={rowSx} data-selected={selected} onContextMenu={handleContextMenu}>
            <ButtonBase
                sx={isSection ? sectionButtonSx : folderButtonSx}
                aria-current={selected ? "page" : undefined}
                onClick={onSelect}
            >
                {icon}
                <Typography component="span" noWrap sx={isSection ? sectionLabelSx : folderLabelSx}>
                    {label}
                </Typography>
            </ButtonBase>
            {expandable && (
                <ButtonBase
                    sx={isSection ? sectionToggleSx : folderToggleSx}
                    aria-label={`${label} folders`}
                    aria-expanded={expanded}
                    onClick={onToggle}
                >
                    {loading ? <CircularProgress size={12} color="inherit" /> : <Icon name="chevronRight" />}
                </ButtonBase>
            )}
        </Box>
    );
};

/** The sub-folders of a listed folder, or why they couldn't be listed. */
const FolderChildren = ({ state, depth, trail, onRetry, ...tree }: FolderChildrenProps) => {
    const folders = useMemo(() => state?.entries?.filter(isFolder).sort(compareEntries) ?? [], [state?.entries]);

    if (state?.status === "error") {
        return (
            <Box component="li" sx={errorRowSx} style={depthStyle(depth)}>
                Couldn't load
                <ButtonBase sx={retrySx} onClick={onRetry}>
                    Retry
                </ButtonBase>
            </Box>
        );
    }

    return folders.map((entry) => (
        <FolderItem key={entry.id} entry={entry} depth={depth} parentTrail={trail} {...tree} />
    ));
};

const FolderItem = ({ entry, depth, parentTrail, ...tree }: FolderItemProps) => {
    const { section, expanded, selectedKey, onToggle, onNavigate, onOpenMenu } = tree;
    const key = folderKey(section.id, entry.id);
    const isExpanded = expanded.has(key);
    const { state, reload } = useFolder(section, entry.id, isExpanded && entry.hasSubfolders !== false);

    const trail = useMemo(
        () => [...parentTrail, { id: entry.id, name: entry.name }],
        [parentTrail, entry.id, entry.name],
    );

    const hasNoFolders =
        entry.hasSubfolders === false || (state?.status === "ready" && !state.entries?.some(isFolder));

    return (
        <Box component="li" sx={itemSx} style={depthStyle(depth)}>
            <TreeRow
                variant="folder"
                icon={<FolderTypeIcon folderName={entry.name} size="1.125rem" />}
                label={entry.name}
                selected={selectedKey === key}
                expandable={!hasNoFolders}
                expanded={isExpanded}
                loading={state?.status === "loading" && !state.entries}
                onSelect={() => onNavigate({ sectionId: section.id, trail })}
                onToggle={() => onToggle(key)}
                onMenu={(position) =>
                    onOpenMenu(position, { target: "selection", section, trail: parentTrail, entries: [entry] })
                }
            />
            {!hasNoFolders && (
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box component="ul" sx={childListSx}>
                        <FolderChildren {...tree} state={state} depth={depth + 1} trail={trail} onRetry={reload} />
                    </Box>
                </Collapse>
            )}
        </Box>
    );
};

/** A section's row, with its root's folders as a lazily loaded tree beneath it. */
const SectionItem = (tree: TreeProps) => {
    const { section, expanded, selectedKey, onToggle, onNavigate, onOpenMenu } = tree;
    const key = folderKey(section.id, section.rootId);
    const isExpanded = expanded.has(key);
    const { state, reload } = useFolder(section, section.rootId, isExpanded);

    const hasNoFolders = state?.status === "ready" && !state.entries?.some(isFolder);

    return (
        <Box component="li" sx={itemSx} style={depthStyle(0)}>
            <TreeRow
                variant="section"
                icon={<IconSlot icon={section.icon ?? "folder"} />}
                label={section.label}
                selected={selectedKey === key}
                expandable={!hasNoFolders}
                expanded={isExpanded}
                loading={state?.status === "loading" && !state.entries}
                onSelect={() => onNavigate({ sectionId: section.id, trail: ROOT_TRAIL })}
                onToggle={() => onToggle(key)}
                onMenu={(position) =>
                    onOpenMenu(position, { target: "folder", section, trail: ROOT_TRAIL, entries: [] })
                }
            />
            {!hasNoFolders && (
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box component="ul" sx={childListSx}>
                        <FolderChildren {...tree} state={state} depth={1} trail={ROOT_TRAIL} onRetry={reload} />
                    </Box>
                </Collapse>
            )}
        </Box>
    );
};

export default SectionItem;
