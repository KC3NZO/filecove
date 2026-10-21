import { useContext, useLayoutEffect, useMemo, useRef } from "react";
import type { CSSProperties, DOMAttributes, DragEvent, KeyboardEvent, MouseEvent, ReactNode, RefObject } from "react";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { DataContext } from "../../../contexts/data-context";
import { DragContext } from "../../../contexts/drag-context";
import { useCutIds } from "../../../hooks/use-cut-ids";
import { useDraggedIds } from "../../../hooks/use-dragged-ids";
import { useDropTarget } from "../../../hooks/use-drop-target";
import { useFolder } from "../../../hooks/use-folder";
import { folderKey } from "../../../store/folder-store";
import {
    cutMarker,
    dragMarkers,
    focusOutline,
    hoverBackground,
    selectedBackground,
    selectedHoverBackground,
} from "../../../styles/mixins";
import { focusTreeItem, isMenuKey, isRtl, neighbourTreeItem } from "../../../utils/keyboard";
import { belowElement, pointerPosition } from "../../../utils/menu-position";
import { folderOf } from "../../../utils/navigation";
import { selectModifiers } from "../../../utils/selection";
import { compareEntries } from "../../../utils/sort";
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
    RunShortcut,
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
    /** Expands the folder or section with that `folderKey`, without collapsing it if it's expanded. */
    onExpand: (key: string) => void;
    onNavigate: (place: Place) => void;
    onSelectFolder: (target: TreeTarget, modifiers?: SelectModifiers) => void;
    onSelectSection: (key: string) => void;
    onOpenMenu: OpenMenu;
    onShortcut: RunShortcut;
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

interface ErrorItemProps {
    depth: number;
    onRetry: () => void;
}

type DragHandlers = Pick<
    DOMAttributes<HTMLElement>,
    "onDragStart" | "onDragEnter" | "onDragOver" | "onDragLeave" | "onDrop"
>;

interface TreeItemProps {
    variant: "section" | "folder";
    /** `folderKey` of the folder, or of the section's root. */
    treeKey: string;
    /** 0 for a section, and for the top folders of a single section's tree. */
    depth: number;
    icon: ReactNode;
    label: string;
    /** Part of the tree's selection. */
    selected: boolean;
    /** The open folder, which needn't be selected. */
    open: boolean;
    /** Cut to the clipboard, and not pasted yet. */
    cut?: boolean;
    /** Can be dragged, taking its folder along. */
    draggable?: boolean;
    /** Its folder is among the entries being dragged. */
    dragged?: boolean;
    /** Letting go of the dragged entries now would drop them into its folder. */
    dropTarget: boolean;
    dragHandlers: DragHandlers;
    expandable: boolean;
    expanded: boolean;
    loading: boolean;
    /** The folders below it, shown while it's expanded. */
    children?: ReactNode;
    /** A click on the row, which opens it or, with Ctrl or Shift, selects it. */
    onSelect: (event: MouseEvent) => void;
    /** Opens it, for Enter. */
    onOpen: () => void;
    /** Selects it, for Space; Space opens it when this is missing, as Enter does. */
    onSpace?: (modifiers: SelectModifiers) => void;
    onToggle: () => void;
    onMenu: (position: MenuPosition) => boolean;
    /** Runs the action whose shortcut the key press matches; returns whether one did. */
    onShortcut: (event: KeyboardEvent) => boolean;
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

/**
 * Hands the focus on to the row shown before a tree row that goes while it has it, as a folder
 * deleted or moved away does, so the focus isn't dropped to the page. It runs as the row unmounts,
 * while its element is still in the page.
 */
const useFocusHandOff = (ref: RefObject<HTMLElement | null>) => {
    useLayoutEffect(() => {
        const item = ref.current;

        return () => {
            const neighbour = item?.contains(document.activeElement) && neighbourTreeItem(item);

            if (neighbour) {
                focusTreeItem(neighbour);
            }
        };
    }, [ref]);
};

// The item takes the focus, but the row inside it shows the ring, since the item holds the rows
// below it too.
const itemSx: SxProps<Theme> = {
    listStyle: "none",
    outline: "none",
};

const rowSx: SxProps<Theme> = (theme) => ({
    position: "relative",
    borderRadius: 2,
    color: "text.primary",
    "&:hover": { bgcolor: hoverBackground(theme) },
    '&[data-selected="true"]': { bgcolor: selectedBackground(theme) },
    '&[data-selected="true"]:hover': { bgcolor: selectedHoverBackground(theme) },
    // The open folder keeps its accent text when the selection moves to other folders.
    '&[data-open="true"]': { color: "primary.main" },
    ...cutMarker,
    '[role="treeitem"]:focus-visible > &': focusOutline,
    ...dragMarkers(theme),
});

// The row's main part, which a click opens or selects. It's no button: the item around it takes
// the focus and the keys.
const mainPartSx = {
    display: "flex",
    alignItems: "center",
    width: "100%",
    borderRadius: "inherit",
    cursor: "pointer",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
} as const;

const sectionButtonSx: SxProps<Theme> = {
    ...mainPartSx,
    minHeight: 36,
    gap: 1.5,
    pl: `${INSET}px`,
    // Room for the expand toggle on the right.
    pr: 4.5,
};

const folderButtonSx: SxProps<Theme> = {
    ...mainPartSx,
    minHeight: 30,
    gap: 1,
    pl: indent(CHEVRON + 4),
    pr: 1,
    "& > svg": { flexShrink: 0 },
};

const sectionLabelSx: SxProps<Theme> = {
    minWidth: 0,
    fontSize: "0.875rem",
};

const folderLabelSx: SxProps<Theme> = {
    minWidth: 0,
    fontSize: "0.8125rem",
};

// The chevrons are for pointers; the keyboard expands and collapses with Right and Left.
const toggleSx = {
    position: "absolute",
    top: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transform: "translateY(-50%)",
    borderRadius: 1,
    color: "text.secondary",
    cursor: "pointer",
    "&:hover": { bgcolor: "action.hover", color: "text.primary" },
} as const;

// Sections keep the plain GNOME look, so their toggle only shows on hover, on keyboard focus,
// while expanded, or always on touch screens where there is no hover.
const sectionToggleSx: SxProps<Theme> = {
    ...toggleSx,
    right: 6,
    width: 24,
    height: 24,
    opacity: 0,
    transition: "opacity 120ms",
    '*:hover > &, [role="treeitem"]:focus-visible > * > &, &[data-expanded="true"]': { opacity: 1 },
    "@media (hover: none)": { opacity: 1 },
    "& > svg": { fontSize: "1.125rem", transition: "transform 150ms" },
    '&[data-expanded="true"] > svg': { transform: "rotate(90deg)" },
};

const folderToggleSx: SxProps<Theme> = {
    ...toggleSx,
    left: indent(0),
    width: CHEVRON,
    height: CHEVRON,
    "& > svg": { fontSize: "1rem", transition: "transform 150ms" },
    '&[data-expanded="true"] > svg': { transform: "rotate(90deg)" },
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

// A row in place of folders: a load error, or the root tree's loading and empty states.
const statusRowSx: SxProps<Theme> = {
    listStyle: "none",
    display: "flex",
    alignItems: "center",
    gap: 1,
    minHeight: 30,
    pl: indent(CHEVRON + 4),
    borderRadius: 2,
    color: "text.secondary",
    fontSize: "0.8125rem",
    outline: "none",
    '&[data-error="true"]': { color: "error.main" },
    "&:focus-visible": focusOutline,
};

const retrySx: SxProps<Theme> = {
    px: 0.75,
    borderRadius: 1,
    color: "text.secondary",
    cursor: "pointer",
    textDecoration: "underline",
    "&:hover": { color: "text.primary" },
};

/**
 * A folder or section in the tree: a `treeitem` holding its row and the folders below it. Only
 * the tree is in the tab order; it hands the focus to an item, and the arrow keys move it between
 * them (`sidebar.tsx`). The item takes the keys that act on it:
 *
 * - Enter opens it, and Space selects it, Shift+Space from the anchor, or opens a section.
 * - Right expands it and Left collapses it, the other way round right to left. Right on an
 *   expanded item and Left on a collapsed one move the focus, which the tree does.
 * - The Menu key or Shift+F10 opens its menu, and an action's shortcut runs on it.
 */
const TreeItem = ({
    variant,
    treeKey,
    depth,
    icon,
    label,
    selected,
    open,
    cut = false,
    draggable = false,
    dragged = false,
    dropTarget,
    dragHandlers,
    expandable,
    expanded,
    loading,
    children,
    onSelect,
    onOpen,
    onSpace,
    onToggle,
    onMenu,
    onShortcut,
}: TreeItemProps) => {
    const isSection = variant === "section";
    const itemRef = useRef<HTMLLIElement>(null);

    useFocusHandOff(itemRef);

    const handleContextMenu = (event: MouseEvent) => {
        if (onMenu(pointerPosition(event))) {
            event.preventDefault();
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
        // Items nest, so a key pressed on one bubbles up through the items above it, which leave it be.
        if (event.target !== event.currentTarget) {
            return;
        }

        if (isMenuKey(event)) {
            event.preventDefault();
            onMenu(belowElement(event.currentTarget.firstElementChild ?? event.currentTarget));

            return;
        }

        if (onShortcut(event)) {
            event.preventDefault();

            return;
        }

        if (event.altKey) {
            return;
        }

        const toggle = event.ctrlKey || event.metaKey;
        const rtl = isRtl(event.currentTarget);

        if (event.key === "Enter" && !toggle && !event.shiftKey) {
            onOpen();
        } else if (event.key === " ") {
            if (onSpace) {
                onSpace({ toggle: event.shiftKey ? toggle : true, range: event.shiftKey });
            } else {
                onOpen();
            }
        } else if (expandable && !expanded && event.key === (rtl ? "ArrowLeft" : "ArrowRight")) {
            onToggle();
        } else if (expandable && expanded && event.key === (rtl ? "ArrowRight" : "ArrowLeft")) {
            onToggle();
        } else {
            return;
        }

        event.preventDefault();
    };

    return (
        <Box
            ref={itemRef}
            component="li"
            sx={itemSx}
            style={depthStyle(depth)}
            role="treeitem"
            tabIndex={-1}
            aria-label={label}
            aria-level={depth + 1}
            aria-selected={selected}
            aria-expanded={expandable ? expanded : undefined}
            aria-current={open ? "page" : undefined}
            aria-busy={loading || undefined}
            data-tree-key={treeKey}
            onKeyDown={handleKeyDown}
        >
            <Box
                sx={rowSx}
                draggable={draggable}
                data-selected={selected}
                data-open={open}
                data-cut={cut}
                data-dragged={dragged}
                data-drop-target={dropTarget}
                onContextMenu={handleContextMenu}
                {...dragHandlers}
            >
                <Box sx={isSection ? sectionButtonSx : folderButtonSx} onClick={onSelect}>
                    {icon}
                    <Typography component="span" noWrap sx={isSection ? sectionLabelSx : folderLabelSx}>
                        {label}
                    </Typography>
                </Box>
                {expandable && (
                    <Box
                        component="span"
                        sx={isSection ? sectionToggleSx : folderToggleSx}
                        aria-hidden
                        data-expanded={expanded}
                        onClick={onToggle}
                    >
                        {loading ? <CircularProgress size={12} color="inherit" /> : <Icon name="chevronRight" />}
                    </Box>
                )}
            </Box>
            {children}
        </Box>
    );
};

/** A row saying a folder's sub-folders couldn't be listed, which Enter, Space or its link lists again. */
const ErrorItem = ({ depth, onRetry }: ErrorItemProps) => {
    const itemRef = useRef<HTMLLIElement>(null);

    useFocusHandOff(itemRef);

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onRetry();
        }
    };

    return (
        <Box
            ref={itemRef}
            component="li"
            sx={statusRowSx}
            style={depthStyle(depth)}
            role="treeitem"
            tabIndex={-1}
            aria-level={depth + 1}
            aria-label="Couldn't load. Retry"
            data-error
            onKeyDown={handleKeyDown}
        >
            Couldn't load
            <Box component="span" sx={retrySx} onClick={onRetry}>
                Retry
            </Box>
        </Box>
    );
};

/** The sub-folders of a listed folder, or why they couldn't be listed. */
const FolderChildren = ({ state, depth, trail, onRetry, ...tree }: FolderChildrenProps) => {
    const sectionId = tree.section.id;
    const folders = useMemo(() => state?.entries?.filter(isFolder).sort(compareEntries) ?? [], [state?.entries]);
    const keys = useMemo(() => folders.map((entry) => folderKey(sectionId, entry.id)), [folders, sectionId]);

    if (state?.status === "error") {
        return <ErrorItem depth={depth} onRetry={onRetry} />;
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
    const {
        section,
        expanded,
        openKey,
        selection,
        onToggle,
        onExpand,
        onNavigate,
        onSelectFolder,
        onOpenMenu,
        onShortcut,
    } = tree;
    const key = folderKey(section.id, entry.id);
    const isExpanded = expanded.has(key);
    const { state, reload } = useFolder(section, entry.id, isExpanded && entry.hasSubfolders !== false);
    const cutIds = useCutIds(section);
    const draggedIds = useDraggedIds(section);
    const data = useContext(DataContext);
    const drag = useContext(DragContext);

    // A drag moves or copies, so it needs an adapter that does one or the other.
    const adapter = section.adapter ?? data?.adapter;
    const draggable = !!(adapter?.move || adapter?.copy);

    const trail = useMemo(
        () => [...parentTrail, { id: entry.id, name: entry.name }],
        [parentTrail, entry.id, entry.name],
    );

    // Once the folder has been listed, the listing wins over the adapter's hint, e.g. after a
    // folder was created in it.
    const hasNoFolders = state?.entries ? !state.entries.some(isFolder) : entry.hasSubfolders === false;

    const selected = selection ? selection.ids.has(key) : key === openKey;

    const target: TreeTarget = {
        key,
        parentKey: folderKey(section.id, folderOf(section, parentTrail).id),
        parentTrail,
        order: siblingKeys,
    };

    const open = () => onNavigate({ sectionId: section.id, trail });

    // Ctrl and Shift select without opening anything; a plain click opens the folder.
    const handleSelect = (event: MouseEvent) => {
        const modifiers = selectModifiers(event);

        if (modifiers.toggle || modifiers.range) {
            onSelectFolder(target, modifiers);
        } else {
            open();
        }
    };

    // A collapsed folder that a drag rests on expands, so the folders below it can be dropped into.
    const drop = useDropTarget({
        targetsAt: () => [{ key, section, trail }],
        onHold: hasNoFolders || isExpanded ? undefined : onExpand,
    });

    // As in the content, a selected folder's menu acts on every selected folder, and so do a drag
    // from it and a shortcut on it, while any other folder is acted on alone.
    const actedOn = () =>
        selected && selection
            ? siblings.filter((sibling) => selection.ids.has(folderKey(section.id, sibling.id)))
            : [entry];

    // The menu and a drag select the folder they act on alone first.
    const takeSelection = () => {
        if (!selected) {
            onSelectFolder(target);
        }

        return actedOn();
    };

    const handleMenu = (position: MenuPosition) =>
        onOpenMenu(position, { target: "selection", section, trail: parentTrail, entries: takeSelection() });

    // An action for entries runs on the folder, and one for a folder runs in it, so Ctrl+V pastes
    // into it and F5 lists it again.
    const handleShortcut = (event: KeyboardEvent) =>
        onShortcut(event, [
            { target: "selection", section, trail: parentTrail, entries: actedOn() },
            { target: "folder", section, trail, entries: [] },
        ]);

    const handleDragStart = (event: DragEvent) => {
        drag?.start(event, () => ({ section, trail: parentTrail, entries: takeSelection(), grabbed: entry }));
    };

    return (
        <TreeItem
            variant="folder"
            treeKey={key}
            depth={depth}
            icon={<FolderTypeIcon folderName={entry.name} size="1.125rem" />}
            label={entry.name}
            selected={selected}
            open={key === openKey}
            cut={cutIds.has(entry.id)}
            draggable={draggable}
            dragged={draggedIds.has(entry.id)}
            dropTarget={drop.dropKey !== null}
            dragHandlers={{ ...drop.handlers, onDragStart: draggable ? handleDragStart : undefined }}
            expandable={!hasNoFolders}
            expanded={isExpanded}
            loading={state?.status === "loading" && !state.entries}
            onSelect={handleSelect}
            onOpen={open}
            onSpace={(modifiers) => onSelectFolder(target, modifiers)}
            onToggle={() => onToggle(key)}
            onMenu={handleMenu}
            onShortcut={handleShortcut}
        >
            {!hasNoFolders && (
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box component="ul" role="group" sx={childListSx}>
                        <FolderChildren {...tree} state={state} depth={depth + 1} trail={trail} onRetry={reload} />
                    </Box>
                </Collapse>
            )}
        </TreeItem>
    );
};

/**
 * A section's row, with its root's folders as a lazily loaded tree beneath it. The row itself is
 * a root, not a folder that can be selected with others, so Ctrl and Shift just open it.
 */
const SectionItem = (tree: TreeProps) => {
    const {
        section,
        expanded,
        openKey,
        selection,
        onToggle,
        onExpand,
        onNavigate,
        onSelectSection,
        onOpenMenu,
        onShortcut,
    } = tree;
    const key = folderKey(section.id, section.rootId);
    const showFolders = section.showFolders !== false;
    const isExpanded = showFolders && expanded.has(key);
    const { state, reload } = useFolder(section, section.rootId, isExpanded);

    const hasNoFolders = !showFolders || (state?.status === "ready" && !state.entries?.some(isFolder));

    // Dropped onto, the entries go into the root. Its row isn't an entry, so it's never dragged.
    const drop = useDropTarget({
        targetsAt: () => [{ key, section, trail: ROOT_TRAIL }],
        onHold: hasNoFolders || isExpanded ? undefined : onExpand,
    });

    const open = () => onNavigate({ sectionId: section.id, trail: ROOT_TRAIL });

    // Its menu is about the section's root folder, so it alone becomes the selection meanwhile.
    const handleMenu = (position: MenuPosition) => {
        onSelectSection(key);

        return onOpenMenu(position, { target: "folder", section, trail: ROOT_TRAIL, entries: [] });
    };

    // As with its menu, a shortcut runs in the section's root folder.
    const handleShortcut = (event: KeyboardEvent) =>
        onShortcut(event, [{ target: "folder", section, trail: ROOT_TRAIL, entries: [] }]);

    return (
        <TreeItem
            variant="section"
            treeKey={key}
            depth={0}
            icon={<IconSlot icon={section.icon ?? "folder"} />}
            label={section.label}
            selected={selection ? selection.ids.has(key) : key === openKey}
            open={key === openKey}
            dropTarget={drop.dropKey !== null}
            dragHandlers={drop.handlers}
            expandable={!hasNoFolders}
            expanded={isExpanded}
            loading={state?.status === "loading" && !state.entries}
            onSelect={open}
            onOpen={open}
            onToggle={() => onToggle(key)}
            onMenu={handleMenu}
            onShortcut={handleShortcut}
        >
            {!hasNoFolders && (
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box component="ul" role="group" sx={childListSx}>
                        <FolderChildren {...tree} state={state} depth={1} trail={ROOT_TRAIL} onRetry={reload} />
                    </Box>
                </Collapse>
            )}
        </TreeItem>
    );
};

/**
 * A section's folders as the sidebar's top level, with no section row above them, for a file
 * manager with a single section. The root is always listed; its own place is the path bar's first crumb.
 */
export const SectionTree = (tree: TreeProps) => {
    const { section } = tree;
    const { state, reload } = useFolder(section, section.rootId, true);

    if (!state || (state.status === "loading" && !state.entries)) {
        return (
            <Box component="li" role="none" sx={statusRowSx} style={depthStyle(0)}>
                <CircularProgress size={12} color="inherit" />
                Loading
            </Box>
        );
    }

    if (state.status === "ready" && !state.entries?.some(isFolder)) {
        return (
            <Box component="li" role="none" sx={statusRowSx} style={depthStyle(0)}>
                No folders
            </Box>
        );
    }

    return <FolderChildren {...tree} state={state} depth={0} trail={ROOT_TRAIL} onRetry={reload} />;
};

export default SectionItem;
