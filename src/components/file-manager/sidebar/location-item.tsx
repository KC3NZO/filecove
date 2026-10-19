import { useMemo } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useFolder } from "../../../hooks/use-folder";
import { folderKey } from "../../../store/folder-store";
import { focusRing, selectedBackground } from "../../../styles/mixins";
import { compareEntries } from "../../../utils/format";
import { pointerPosition } from "../../../utils/menu-position";
import { folderOf } from "../../../utils/navigation";
import { selectModifiers } from "../../../utils/selection";
import { FolderTypeIcon } from "../../icons/file-icon";
import Icon from "../../icons/icon";
import IconSlot from "../icon-slot";

import type {
    FileEntry,
    FolderRef,
    FolderState,
    MenuPosition,
    OpenMenu,
    Place,
    Section,
    SelectModifiers,
    TreeSelection,
    TreeTarget,
} from "../../../types";

/**
 * Props every item of a section's tree passes down unchanged. The tree's selection is its own:
 * selecting here never touches what is selected in the content, and a menu opened here acts on
 * the tree's selection only.
 */
interface TreeProps {
    section: Section;
    expanded: ReadonlySet<string>;
    /** `folderKey` of the open folder. */
    openKey: string | null;
    /** The tree's selection; null while the open folder alone counts as selected. */
    selection: TreeSelection | null;
    onToggle: (key: string) => void;
    onNavigate: (place: Place) => void;
    onSelectFolder: (target: TreeTarget, modifiers?: SelectModifiers) => void;
    onSelectSection: (key: string) => void;
    onOpenMenu: OpenMenu;
}

interface FolderItemProps extends TreeProps {
    entry: FileEntry;
    depth: number;
    parentTrail: FolderRef[];
    /** The row and its sibling folders, in display order. */
    siblings: FileEntry[];
    /** `folderKey`s of `siblings`. */
    siblingKeys: string[];
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
    /** Part of the tree's selection. */
    selected: boolean;
    /** The open folder, which needn't be selected. */
    open: boolean;
    expandable: boolean;
    expanded: boolean;
    loading: boolean;
    onSelect: (event: MouseEvent) => void;
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
    '&[data-selected="true"]': { bgcolor: selectedBackground(theme) },
    // The open folder keeps its accent text when the selection moves to other folders.
    '&[data-open="true"]': { color: "primary.main" },
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
    open,
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
        <Box sx={rowSx} data-selected={selected} data-open={open} onContextMenu={handleContextMenu}>
            <ButtonBase
                sx={isSection ? sectionButtonSx : folderButtonSx}
                aria-current={open ? "page" : undefined}
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
    const sectionId = tree.section.id;
    const folders = useMemo(() => state?.entries?.filter(isFolder).sort(compareEntries) ?? [], [state?.entries]);
    const keys = useMemo(() => folders.map((entry) => folderKey(sectionId, entry.id)), [folders, sectionId]);

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
        <FolderItem
            key={entry.id}
            entry={entry}
            depth={depth}
            parentTrail={trail}
            siblings={folders}
            siblingKeys={keys}
            {...tree}
        />
    ));
};

const FolderItem = ({ entry, depth, parentTrail, siblings, siblingKeys, ...tree }: FolderItemProps) => {
    const { section, expanded, openKey, selection, onToggle, onNavigate, onSelectFolder, onOpenMenu } = tree;
    const key = folderKey(section.id, entry.id);
    const isExpanded = expanded.has(key);
    const { state, reload } = useFolder(section, entry.id, isExpanded && entry.hasSubfolders !== false);

    const trail = useMemo(
        () => [...parentTrail, { id: entry.id, name: entry.name }],
        [parentTrail, entry.id, entry.name],
    );

    const hasNoFolders =
        entry.hasSubfolders === false || (state?.status === "ready" && !state.entries?.some(isFolder));

    const selected = selection ? selection.ids.has(key) : key === openKey;

    const target: TreeTarget = {
        key,
        parentKey: folderKey(section.id, folderOf(section, parentTrail).id),
        parentTrail,
        order: siblingKeys,
    };

    // Ctrl and Shift select without opening anything; a plain click opens the folder.
    const handleSelect = (event: MouseEvent) => {
        const modifiers = selectModifiers(event);

        if (modifiers.toggle || modifiers.range) {
            onSelectFolder(target, modifiers);
        } else {
            onNavigate({ sectionId: section.id, trail });
        }
    };

    // As in the content, a selected folder's menu acts on every selected folder, while any
    // other folder is selected on its own first and the menu acts on it alone.
    const handleMenu = (position: MenuPosition) => {
        if (!selected) {
            onSelectFolder(target);
        }

        const entries =
            selected && selection
                ? siblings.filter((sibling) => selection.ids.has(folderKey(section.id, sibling.id)))
                : [entry];

        return onOpenMenu(position, { target: "selection", section, trail: parentTrail, entries });
    };

    return (
        <Box component="li" sx={itemSx} style={depthStyle(depth)}>
            <TreeRow
                variant="folder"
                icon={<FolderTypeIcon folderName={entry.name} size="1.125rem" />}
                label={entry.name}
                selected={selected}
                open={key === openKey}
                expandable={!hasNoFolders}
                expanded={isExpanded}
                loading={state?.status === "loading" && !state.entries}
                onSelect={handleSelect}
                onToggle={() => onToggle(key)}
                onMenu={handleMenu}
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

/**
 * A section's row, with its root's folders as a lazily loaded tree beneath it. The row itself is
 * a root, not a folder that can be selected with others, so Ctrl and Shift just open it.
 */
const SectionItem = (tree: TreeProps) => {
    const { section, expanded, openKey, selection, onToggle, onNavigate, onSelectSection, onOpenMenu } = tree;
    const key = folderKey(section.id, section.rootId);
    const isExpanded = expanded.has(key);
    const { state, reload } = useFolder(section, section.rootId, isExpanded);

    const hasNoFolders = state?.status === "ready" && !state.entries?.some(isFolder);

    // Its menu is about the section's root folder, so it alone becomes the selection meanwhile.
    const handleMenu = (position: MenuPosition) => {
        onSelectSection(key);

        return onOpenMenu(position, { target: "folder", section, trail: ROOT_TRAIL, entries: [] });
    };

    return (
        <Box component="li" sx={itemSx} style={depthStyle(0)}>
            <TreeRow
                variant="section"
                icon={<IconSlot icon={section.icon ?? "folder"} />}
                label={section.label}
                selected={selection ? selection.ids.has(key) : key === openKey}
                open={key === openKey}
                expandable={!hasNoFolders}
                expanded={isExpanded}
                loading={state?.status === "loading" && !state.entries}
                onSelect={() => onNavigate({ sectionId: section.id, trail: ROOT_TRAIL })}
                onToggle={() => onToggle(key)}
                onMenu={handleMenu}
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
