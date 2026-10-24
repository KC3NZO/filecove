import { memo, useContext, useRef } from "react";
import type {
    ClipboardEvent,
    CSSProperties,
    DOMAttributes,
    DragEvent,
    KeyboardEvent,
    MouseEvent,
    ReactNode,
} from "react";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { DataContext } from "../../../contexts/data-context";
import { DragContext } from "../../../contexts/drag-context";
import { useCutIds } from "../../../hooks/use-cut-ids";
import { useDraggedIds } from "../../../hooks/use-dragged-ids";
import { useDropTarget } from "../../../hooks/use-drop-target";
import { useData } from "../../../hooks/use-folder";
import { useLocale } from "../../../hooks/use-locale";
import { useLongPress } from "../../../hooks/use-long-press";
import { folderKey } from "../../../store/folder-store";
import {
    cutMarker,
    dragMarkers,
    focusOutline,
    forcedColors,
    forcedSelected,
    hoverBackground,
    selectedBackground,
    selectedHoverBackground,
} from "../../../styles/mixins";
import { isRtl } from "../../../utils/dom";
import { isMenuKey } from "../../../utils/keyboard";
import { belowElement, pointerPosition, pressPosition } from "../../../utils/menu-position";
import { folderOf } from "../../../utils/navigation";
import { selectModifiers } from "../../../utils/selection";
import { FolderTypeIcon } from "../../icons/file-icon";
import Icon from "../../icons/icon";
import IconSlot from "../../icons/icon-slot";

import type {
    ErrorRow,
    FileManagerLocation,
    FolderRef,
    FolderRow,
    MenuPosition,
    OpenMenu,
    PasteFiles,
    RunShortcut,
    SectionRow,
    SelectModifiers,
    StatusRow,
    TreeGuide,
    TreeItemRow,
    TreeSelection,
    TreeTarget,
} from "../../../types";

/**
 * Props every row of the tree gets unchanged. The tree's selection is its own: selecting here
 * never touches what is selected in the content, and a menu opened here acts on the tree's
 * selection only.
 */
interface TreeProps {
    /** `folderKey` of the open folder. */
    openKey: string | null;
    /** The tree's selection; null while the open folder alone counts as selected. */
    selection: TreeSelection | null;
    onToggle: (key: string) => void;
    /** Expands the folder or section with that `folderKey`, without collapsing it if it's expanded. */
    onExpand: (key: string) => void;
    onNavigate: (place: FileManagerLocation) => void;
    onSelectFolder: (target: TreeTarget, modifiers?: SelectModifiers) => void;
    onSelectSection: (key: string) => void;
    onOpenMenu: OpenMenu;
    onShortcut: RunShortcut;
    onPasteFiles: PasteFiles;
}

interface TreeRowItemProps extends TreeProps {
    row: TreeItemRow | StatusRow;
}

interface FolderItemProps extends TreeProps {
    row: FolderRow;
}

interface SectionItemProps extends TreeProps {
    row: SectionRow;
}

interface ErrorItemProps {
    row: ErrorRow;
}

interface StatusItemProps {
    row: StatusRow;
}

interface GuideLineProps {
    guide: TreeGuide;
}

type DragHandlers = Pick<
    DOMAttributes<HTMLElement>,
    "onDragStart" | "onDragEnter" | "onDragOver" | "onDragLeave" | "onDrop"
>;

/** A row's `useLongPress`, which a touch or pen press held on it goes to. */
type PressHandlers = Pick<DOMAttributes<HTMLElement>, "onPointerDown" | "onClickCapture">;

interface TreeItemProps {
    variant: "section" | "folder";
    /** Where the row goes, and whether it expands. */
    row: SectionRow | FolderRow;
    icon: ReactNode;
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
    pressHandlers: PressHandlers;
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
    /** Uploads files pasted from the system clipboard into its folder. */
    onPaste: (event: ClipboardEvent) => void;
}

/*
 * Tree geometry, in px. Each row and guide line sets `--depth`, and every offset below is derived
 * from it. A level's guide line runs through the centre of its parent's chevron, or through the
 * section icon for the first level, so the tree visibly hangs from the section it belongs to.
 */
const INSET = 12;
const INDENT = 16;
const CHEVRON = 20;

const ROOT_TRAIL: FolderRef[] = [];

const indent = (extra: number) => `calc(${INSET + extra}px + var(--depth) * ${INDENT}px)`;

// The tree places each row itself, since it only renders the rows in or near view.
const placeStyle = (row: { top: number; height: number }, depth: number) =>
    ({ top: row.top, height: row.height, "--depth": depth }) as CSSProperties;

// Placed by `placeStyle`. The item takes the focus, but the row inside it shows the ring.
const itemSx: SxProps<Theme> = {
    position: "absolute",
    insetInline: 0,
    listStyle: "none",
    outline: "none",
};

const rowSx: SxProps<Theme> = (theme) => ({
    position: "relative",
    height: "100%",
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
    // The open folder's accent text, then the selection over it.
    [forcedColors]: { '&[data-open="true"]': { color: "Highlight" }, ...forcedSelected },
});

// The row's main part, which a click opens or selects. It's no button: the item around it takes
// the focus and the keys.
const mainPartSx = {
    display: "flex",
    alignItems: "center",
    width: "100%",
    height: "100%",
    borderRadius: "inherit",
    cursor: "pointer",
    userSelect: "none",
    WebkitTouchCallout: "none",
    WebkitTapHighlightColor: "transparent",
} as const;

const sectionButtonSx: SxProps<Theme> = {
    ...mainPartSx,
    gap: 1.5,
    paddingInlineStart: `${INSET}px`,
    // Room for the expand toggle at the end.
    paddingInlineEnd: 4.5,
};

const folderButtonSx: SxProps<Theme> = {
    ...mainPartSx,
    gap: 1,
    paddingInlineStart: indent(CHEVRON + 4),
    paddingInlineEnd: 1,
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

// The chevrons are for pointers; the keyboard expands and collapses with Right and Left. Expanded,
// a chevron turns to point down: clockwise from pointing right, or anticlockwise right to left,
// where the icon is mirrored to point left (`Icon`).
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
    "--chevron-turn": "90deg",
    "&:dir(rtl)": { "--chevron-turn": "-90deg" },
    "&:hover": { bgcolor: "action.hover", color: "text.primary" },
    '&[data-expanded="true"] > svg': { rotate: "var(--chevron-turn)" },
} as const;

// Sections keep the plain GNOME look, so their toggle only shows on hover, on keyboard focus,
// while expanded, or always on touch screens where there is no hover.
const sectionToggleSx: SxProps<Theme> = {
    ...toggleSx,
    insetInlineEnd: 6,
    width: 24,
    height: 24,
    opacity: 0,
    transition: "opacity 120ms",
    '*:hover > &, [role="treeitem"]:focus-visible > * > &, &[data-expanded="true"]': { opacity: 1 },
    "@media (hover: none)": { opacity: 1 },
    "& > svg": { fontSize: "1.125rem", transition: "rotate 150ms" },
};

const folderToggleSx: SxProps<Theme> = {
    ...toggleSx,
    insetInlineStart: indent(0),
    width: CHEVRON,
    height: CHEVRON,
    "& > svg": { fontSize: "1rem", transition: "rotate 150ms" },
};

// Along the folders below an expanded row, placed by the tree like a row, behind the rows.
const guideSx: SxProps<Theme> = {
    position: "absolute",
    insetInlineStart: indent(CHEVRON / 2),
    width: "1px",
    bgcolor: "divider",
    pointerEvents: "none",
};

// A row in place of folders: a load error, or the single section tree's loading and empty states.
const statusRowSx: SxProps<Theme> = {
    position: "absolute",
    insetInline: 0,
    listStyle: "none",
    display: "flex",
    alignItems: "center",
    gap: 1,
    paddingInlineStart: indent(CHEVRON + 4),
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
 * A folder or section in the tree: a `treeitem` row, which says where it is among all of them,
 * since the tree only renders the rows in or near view. Only the tree is in the tab order; it
 * hands the focus to an item, and the arrow keys move it between them (`sidebar.tsx`). The item
 * takes the keys that act on it:
 *
 * - Enter opens it, and Space selects it, Shift+Space from the anchor, or opens a section.
 * - Right expands it and Left collapses it, the other way round right to left. Right on an
 *   expanded item and Left on a collapsed one move the focus, which the tree does.
 * - The Menu key or Shift+F10 opens its menu, and an action's shortcut runs on it.
 */
const TreeItem = ({
    variant,
    row,
    icon,
    selected,
    open,
    cut = false,
    draggable = false,
    dragged = false,
    dropTarget,
    dragHandlers,
    pressHandlers,
    onSelect,
    onOpen,
    onSpace,
    onToggle,
    onMenu,
    onShortcut,
    onPaste,
}: TreeItemProps) => {
    const isSection = variant === "section";
    const { expandable, expanded, loading } = row;
    // The pointer of the latest press, read per press, as the content reads it.
    const pointerType = useRef("mouse");

    // A touch long-press is the row's own (`pressHandlers`), which opens the menu as the finger
    // lifts or drags the folder, so neither the browser's menu nor ours opens on top of it.
    const handleContextMenu = (event: MouseEvent) => {
        if (pointerType.current !== "mouse") {
            event.preventDefault();
        } else if (onMenu(pointerPosition(event))) {
            event.preventDefault();
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
        // Only a key pressed on the item itself acts on it.
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

    // Only a paste on the item itself acts on it, as with a key press.
    const handlePaste = (event: ClipboardEvent<HTMLLIElement>) => {
        if (event.target === event.currentTarget) {
            onPaste(event);
        }
    };

    return (
        <Box
            component="li"
            sx={itemSx}
            style={placeStyle(row, row.depth)}
            role="treeitem"
            tabIndex={-1}
            aria-label={row.label}
            aria-level={row.depth + 1}
            aria-setsize={row.siblingCount}
            aria-posinset={row.position}
            aria-selected={selected}
            aria-expanded={expandable ? expanded : undefined}
            aria-current={open ? "page" : undefined}
            aria-busy={loading || undefined}
            data-tree-key={row.id}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
        >
            <Box
                sx={rowSx}
                draggable={draggable}
                data-selected={selected}
                data-open={open}
                data-cut={cut}
                data-dragged={dragged}
                data-drop-target={dropTarget}
                onPointerDownCapture={(event) => {
                    pointerType.current = event.pointerType;
                }}
                onContextMenu={handleContextMenu}
                {...pressHandlers}
                {...dragHandlers}
            >
                <Box sx={isSection ? sectionButtonSx : folderButtonSx} onClick={onSelect}>
                    {icon}
                    <Typography component="span" noWrap sx={isSection ? sectionLabelSx : folderLabelSx}>
                        <bdi>{row.label}</bdi>
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
        </Box>
    );
};

/** A row saying a folder's sub-folders couldn't be listed, which Enter, Space or its link lists again. */
const ErrorItem = ({ row }: ErrorItemProps) => {
    const { store, adapter } = useData();
    const { text } = useLocale();
    const { section, folderId } = row;

    const retry = () => store.load(folderKey(section.id, folderId), section.adapter ?? adapter, folderId, true);

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.target === event.currentTarget && !event.altKey && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            retry();
        }
    };

    return (
        <Box
            component="li"
            sx={statusRowSx}
            style={placeStyle(row, row.depth)}
            role="treeitem"
            tabIndex={-1}
            aria-level={row.depth + 1}
            aria-setsize={row.siblingCount}
            aria-posinset={row.position}
            aria-label={row.label}
            data-tree-key={row.id}
            data-error
            onKeyDown={handleKeyDown}
        >
            {text.folderLoadFailed}
            <Box component="span" sx={retrySx} onClick={retry}>
                {text.retry}
            </Box>
        </Box>
    );
};

/** In place of a single section's folders: loading, or "No folders". */
const StatusItem = ({ row }: StatusItemProps) => {
    const { text } = useLocale();

    return (
        <Box component="li" role="none" sx={statusRowSx} style={placeStyle(row, 0)}>
            {row.loading && <CircularProgress size={12} color="inherit" />}
            {row.loading ? text.loading : text.noFolders}
        </Box>
    );
};

/**
 * A folder's row. Memoized, like a section's, so scrolling only renders the rows coming into view.
 */
const FolderItem = memo(
    ({
        row,
        openKey,
        selection,
        onToggle,
        onExpand,
        onNavigate,
        onSelectFolder,
        onOpenMenu,
        onShortcut,
        onPasteFiles,
    }: FolderItemProps) => {
        const { id: key, section, entry, parentTrail, trail, siblings, siblingKeys, expandable, expanded } = row;
        const cutIds = useCutIds(section);
        const draggedIds = useDraggedIds(section);
        const data = useContext(DataContext);
        const drag = useContext(DragContext);

        // A drag moves or copies, so it needs an adapter that does one or the other.
        const adapter = section.adapter ?? data?.adapter;
        const draggable = !!(adapter?.move || adapter?.copy);

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
            onHold: !expandable || expanded ? undefined : onExpand,
        });

        // As in the content, a selected folder's menu acts on every selected folder, and so do a
        // drag from it and a shortcut on it, while any other folder is acted on alone.
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

        // An action for entries runs on the folder, and one for a folder runs in it, so Ctrl+V
        // pastes into it and F5 lists it again.
        const handleShortcut = (event: KeyboardEvent) =>
            onShortcut(event, [
                { target: "selection", section, trail: parentTrail, entries: actedOn() },
                { target: "folder", section, trail, entries: [] },
            ]);

        const pick = () => ({ section, trail: parentTrail, entries: takeSelection(), grabbed: entry });

        const handleDragStart = (event: DragEvent) => {
            drag?.start(event, pick);
        };

        // The tree has no selection mode, so on touch a long-press opens the folder's menu once the
        // finger lifts, as a right-click would, and the finger moving on drags it, as a mouse does.
        const longPress = useLongPress({
            itemAt: () => key,
            onLongPress: (_, press) =>
                drag?.touch(press, draggable ? pick : null, () => handleMenu(pressPosition(press))),
        });

        return (
            <TreeItem
                variant="folder"
                row={row}
                icon={<FolderTypeIcon folderName={entry.name} size="1.125rem" />}
                selected={selected}
                open={key === openKey}
                cut={cutIds.has(entry.id)}
                draggable={draggable}
                dragged={draggedIds.has(entry.id)}
                dropTarget={drop.dropKey !== null}
                dragHandlers={{ ...drop.handlers, onDragStart: draggable ? handleDragStart : undefined }}
                pressHandlers={longPress}
                onSelect={handleSelect}
                onOpen={open}
                onSpace={(modifiers) => onSelectFolder(target, modifiers)}
                onToggle={() => onToggle(key)}
                onMenu={handleMenu}
                onShortcut={handleShortcut}
                onPaste={(event) => onPasteFiles(event, section, trail)}
            />
        );
    },
);

/**
 * A section's row, whose root's folders are listed below it while it's expanded. The row itself is
 * a root, not a folder that can be selected with others, so Ctrl and Shift just open it.
 */
const SectionItem = memo(
    ({
        row,
        openKey,
        selection,
        onToggle,
        onExpand,
        onNavigate,
        onSelectSection,
        onOpenMenu,
        onShortcut,
        onPasteFiles,
    }: SectionItemProps) => {
        const { id: key, section, expandable, expanded } = row;
        const drag = useContext(DragContext);

        // Dropped onto, the entries go into the root. Its row isn't an entry, so it's never dragged.
        const drop = useDropTarget({
            targetsAt: () => [{ key, section, trail: ROOT_TRAIL }],
            onHold: !expandable || expanded ? undefined : onExpand,
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

        // On touch, a long-press opens its menu once the finger lifts, as a right-click would. It's
        // never dragged, so the finger moving on scrolls.
        const longPress = useLongPress({
            itemAt: () => key,
            onLongPress: (_, press) => drag?.touch(press, null, () => handleMenu(pressPosition(press))),
        });

        return (
            <TreeItem
                variant="section"
                row={row}
                icon={<IconSlot icon={section.icon ?? "folder"} />}
                selected={selection ? selection.ids.has(key) : key === openKey}
                open={key === openKey}
                dropTarget={drop.dropKey !== null}
                dragHandlers={drop.handlers}
                pressHandlers={longPress}
                onSelect={open}
                onOpen={open}
                onToggle={() => onToggle(key)}
                onMenu={handleMenu}
                onShortcut={handleShortcut}
                onPaste={(event) => onPasteFiles(event, section, ROOT_TRAIL)}
            />
        );
    },
);

/** The guide line along the folders below an expanded row. */
export const GuideLine = ({ guide }: GuideLineProps) => (
    <Box
        sx={guideSx}
        style={{ top: guide.top, height: guide.bottom - guide.top, "--depth": guide.depth } as CSSProperties}
        aria-hidden
    />
);

/** One of the tree's list items: a section, a folder, a folder that couldn't be listed, or a status. */
const TreeRowItem = ({ row, ...tree }: TreeRowItemProps) => {
    switch (row.kind) {
        case "section":
            return <SectionItem row={row} {...tree} />;
        case "folder":
            return <FolderItem row={row} {...tree} />;
        case "error":
            return <ErrorItem row={row} />;
        default:
            return <StatusItem row={row} />;
    }
};

export default TreeRowItem;
