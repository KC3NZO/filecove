import { Fragment, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, DragEvent, FocusEvent, KeyboardEvent, Ref } from "react";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";
import { useForkRef } from "@mui/material/utils";

import { DragContext } from "../../../contexts/drag-context";
import { useLocale } from "../../../hooks/use-locale";
import { useTreeRows } from "../../../hooks/use-tree-rows";
import { useTreeSelection } from "../../../hooks/use-tree-selection";
import { useTypeAhead } from "../../../hooks/use-type-ahead";
import { useVirtualRows } from "../../../hooks/use-virtual-rows";
import { folderKey } from "../../../store/folder-store";
import {
    HEADER_HEIGHT,
    RESIZE_STEP,
    SIDEBAR_MAX_WIDTH,
    SIDEBAR_MIN_WIDTH,
    SIDEBAR_WIDTH,
    rootWide,
} from "../../../styles/layout";
import { focusOutline, forcedColors, forcedPressed } from "../../../styles/mixins";
import { focusLost, isRtl, scrollParent } from "../../../utils/dom";
import { focusTreeItem, isTypingKey, matchName } from "../../../utils/keyboard";
import { belowElement } from "../../../utils/menu-position";
import { clampWidth } from "../../../utils/resize";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import Icon from "../../icons/icon";
import ResizeEdge from "../resize-edge";
import SelectionBar from "../selection-bar";
import TreeRowItem, { GuideLine } from "./location-item";
import MainMenu from "./main-menu";

import type {
    FileManagerLocation,
    FolderRow,
    MainMenuGroup,
    OpenMenu,
    PasteFiles,
    RunShortcut,
    SearchScope,
    Section,
    SectionGroup,
    StatusRow,
    TreeItemRow,
    TreeReveal,
    TreeRow,
} from "../../../types";
import type { UndoItems } from "./main-menu";

interface SidebarProps {
    ref?: Ref<HTMLDivElement>;
    title: string;
    groups: SectionGroup[];
    /** The file manager's only section, whose folders then fill the sidebar in place of `groups`. */
    single?: Section;
    expanded: ReadonlySet<string>;
    /** Whether hidden folders are listed with the rest. */
    showHidden: boolean;
    /** `folderKey` of the open folder. */
    openKey: string | null;
    /** A folder just created, to scroll the tree to once its row is there. */
    reveal: TreeReveal | null;
    /** Whether the overlay is showing while the sidebar is collapsed; has no effect once it docks. */
    open: boolean;
    /** Whether the docked sidebar is hidden; has no effect while it's collapsed. */
    hidden: boolean;
    /**
     * Whether the hidden docked sidebar shows over the content for a drag, as the overlay does
     * while it's collapsed, leaving it hidden once the drag ends.
     */
    peek: boolean;
    /** The docked sidebar's width, in px, which it's narrower than while the content needs the room. */
    width: number;
    /** The width a double click on the docked sidebar's edge puts back. */
    defaultWidth: number;
    /** How wide the docked sidebar can be made now, in px, beside the content and the docked properties. */
    widest: () => number;
    /** The user resized the docked sidebar, by its edge, to `width`. */
    onWidthChange: (width: number) => void;
    /** What the open search searches, or null; the magnifier at the top is for searching everywhere. */
    searchScope: SearchScope | null;
    /** Whether any section can be searched everywhere, without which the magnifier isn't there. */
    canSearchEverywhere: boolean;
    /** Opens a search everywhere, switches to it, or closes it when it's the one open. */
    onSearchEverywhere: () => void;
    /** The consumer's main menu items, above the file manager's own. */
    mainMenu: MainMenuGroup[];
    /** The main menu's Undo and Redo; missing when nothing the file manager does can be undone. */
    undoItems?: UndoItems;
    /** Opens the keyboard shortcuts from the main menu, giving the focus back to `opener` after. */
    onShowShortcuts: (opener: HTMLElement | null) => void;
    onToggle: (key: string) => void;
    /** Called once `reveal` has been scrolled to, or given up on. */
    onRevealed: () => void;
    /** Expands a collapsed folder or section that a drag rests on. */
    onExpand: (key: string) => void;
    onNavigate: (place: FileManagerLocation) => void;
    /** Whether the consumer has any actions, without which the selection bar has no menu. */
    hasActions: boolean;
    onOpenMenu: OpenMenu;
    onShortcut: RunShortcut;
    onPasteFiles: PasteFiles;
    onClose: () => void;
}

const sidebarSx: SxProps<Theme> = (theme) => ({
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    bgcolor: "background.default",
    outline: "none",
    // Only a docked sidebar's edge resizes it.
    '& > [role="separator"]': { display: "none" },

    // Collapsed: an overlay drawer that slides in over the content from the start side, the left
    // or, right to left, the right. It stays inside the file manager rather than portalling to
    // <body>, so an embedded instance overlays only itself. It slides by `translate` rather than
    // `transform`, which Emotion's RTL plugin would flip a second time.
    position: "absolute",
    zIndex: 2,
    top: 0,
    bottom: 0,
    insetInlineStart: 0,
    width: `min(${SIDEBAR_WIDTH + 32}px, 85%)`,
    boxShadow: 8,
    "--closed-shift": "-100%",
    "&:dir(rtl)": { "--closed-shift": "100%" },
    translate: "var(--closed-shift)",
    // Hidden, not just off-screen, so its buttons drop out of the tab order while closed.
    visibility: "hidden",
    transition: theme.transitions.create(["translate", "visibility"], {
        duration: theme.transitions.duration.enteringScreen,
        easing: theme.transitions.easing.easeOut,
    }),
    '&[data-open="true"]': {
        translate: "none",
        visibility: "visible",
    },

    // Docked beside the content, unless it's hidden, as wide as the user made it
    // (`--sidebar-width`), and narrower, down to its least width, while the content needs the room
    // (the main part's `min-width`).
    [rootWide]: {
        position: "relative",
        zIndex: "auto",
        flexShrink: 1,
        width: `var(--sidebar-width, ${SIDEBAR_WIDTH}px)`,
        minWidth: SIDEBAR_MIN_WIDTH,
        boxShadow: "none",
        translate: "none",
        visibility: "visible",
        transition: "none",
        '&[data-hidden="true"]': { display: "none" },
        '&[data-hidden="true"][data-peek="true"]': {
            display: "flex",
            position: "absolute",
            zIndex: 2,
            width: `min(${SIDEBAR_WIDTH + 32}px, 85%)`,
            boxShadow: 8,
        },
        '& > [role="separator"]': { display: "block" },
        '&[data-hidden="true"][data-peek="true"] > [role="separator"]': { display: "none" },
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

const searchButtonSx: SxProps<Theme> = {
    '&[aria-pressed="true"]': { color: "primary.main" },
    [forcedColors]: forcedPressed,
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

// Placed by the tree, like the rows.
const groupTitleSx: SxProps<Theme> = {
    position: "absolute",
    insetInline: 0,
    display: "flex",
    alignItems: "center",
    px: 1.5,
    color: "text.secondary",
    fontWeight: 600,
};

const ruleSx: SxProps<Theme> = {
    position: "absolute",
    insetInline: 0,
};

const dividerSx: SxProps<Theme> = {
    mx: 1.25,
    my: 1,
};

// Only renders the rows in or near view, each placed where it goes, and is as tall as all of them.
// Only shows a ring while it has nothing to hand the focus to, such as a single section still loading.
const treeSx: SxProps<Theme> = {
    position: "relative",
    borderRadius: 2,
    outline: "none",
    "&:focus-visible": focusOutline,
};

// Holds rows placed in the tree, so it takes no room itself. The section groups are still lists,
// so each is a `group` of the tree.
const listSx: SxProps<Theme> = {
    m: 0,
    p: 0,
};

const placeStyle = (row: TreeRow): CSSProperties => ({ top: row.top, height: row.height });

const isItem = (row: TreeRow): row is TreeItemRow =>
    row.kind === "section" || row.kind === "folder" || row.kind === "error";

// The rows that go in a list: the items, and a single section's loading and empty rows.
const isListed = (row: TreeRow): row is TreeItemRow | StatusRow =>
    row.kind !== "caption" && row.kind !== "divider";

// Compares the keys rather than selecting by one: a row's key is a `folderKey`, which holds a NUL,
// and a selector turns that into U+FFFD, so it never matches. Only the rows in or near view are rendered.
const rowElement = (tree: HTMLElement | null, id: string) =>
    Array.from(tree?.querySelectorAll<HTMLElement>("[data-tree-key]") ?? []).find((row) => row.dataset.treeKey === id) ??
    null;

/**
 * The sidebar: the file manager's title and a tree of its sections and their folders, or of a
 * single section's folders. The tree is flattened into the rows it shows (`useTreeRows`), and
 * only those in or near view are rendered (`useVirtualRows`), so a folder of thousands of folders
 * expands as fast as a small one.
 *
 * The tree is one stop in the tab order. Tabbed to, it hands the focus to the row that had it
 * last, or else the open folder's, or the first; while a row has it, the tree steps out of the
 * tab order so Shift+Tab leaves it. Up, Down, Home and End move between the rows shown, Right
 * goes into an expanded row and Left out to the row above, and typing finds a row by its name.
 * These go by the rows rather than the page, which only holds some of them. The rows take the
 * keys that act on them (`TreeItem` in `location-item.tsx`).
 *
 * As an overlay, it takes the focus as it opens, closes on Escape, and closes when the focus
 * moves on to the file manager behind it.
 */
const Sidebar = ({
    ref,
    title,
    groups,
    single,
    expanded,
    showHidden,
    openKey,
    reveal,
    open,
    hidden,
    peek,
    width,
    defaultWidth,
    widest,
    onWidthChange,
    searchScope,
    canSearchEverywhere,
    onToggle,
    onRevealed,
    onExpand,
    onNavigate,
    hasActions,
    onOpenMenu,
    onShortcut,
    onPasteFiles,
    onClose,
    onSearchEverywhere,
    mainMenu,
    undoItems,
    onShowShortcuts,
}: SidebarProps) => {
    // The sidebar's own selection; the content's lives in its folder view, and neither sees the other.
    const { selection, selecting, select, startSelecting, selectKeys, selectSection, reset } =
        useTreeSelection(openKey);
    const typeAhead = useTypeAhead();
    const drag = useContext(DragContext);
    const { text, sameLetters } = useLocale();
    const sidebarRef = useRef<HTMLDivElement>(null);
    const forkedRef = useForkRef(sidebarRef, ref);
    const sidebarId = useId();
    const asked = clampWidth(width, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
    const treeRef = useRef<HTMLDivElement | null>(null);
    const [focusInside, setFocusInside] = useState(false);
    // The row that has the focus, or had it last, which gets it back when the tree is tabbed to.
    const [focusKey, setFocusKey] = useState<string | null>(null);
    // A row to focus once it's rendered.
    const [focusRequest, setFocusRequest] = useState<string | null>(null);
    // The row a drag started from.
    const [grabbedKey, setGrabbedKey] = useState<string | null>(null);

    // A single section that hides its folders still gets its row, so the sidebar isn't left empty.
    const tree = single && single.showFolders !== false ? single : null;
    const { rows, guides, height } = useTreeRows(groups, tree, expanded, showHidden);

    // The focused row stays rendered wherever the tree is scrolled, so it keeps the focus, and so
    // does a row the focus is going to, and the row a drag started from while it's dragged, since
    // the drag ends on it.
    const {
        ref: virtualRef,
        shown,
        span,
    } = useVirtualRows(rows, [focusKey, focusRequest, drag?.dragged ? grabbedKey : null]);

    const treeElement = useCallback(
        (element: HTMLDivElement | null) => {
            treeRef.current = element;
            virtualRef(element);
        },
        [virtualRef],
    );

    // The overlay takes the focus as it slides in.
    useEffect(() => {
        if (open) {
            treeRef.current?.focus();
        }
    }, [open]);

    // The selection mode ends as the sidebar is put away: the overlay closing, by its backdrop,
    // Escape or anything else, and the docked sidebar being hidden. The overlay closing as it docks
    // leaves it, as the sidebar stays in view; it's docked by then, no longer `absolute`.
    const wasShown = useRef({ open, hidden });

    useEffect(() => {
        const before = wasShown.current;
        const sidebar = sidebarRef.current;

        wasShown.current = { open, hidden };

        const closed = before.open && !open && !!sidebar && getComputedStyle(sidebar).position === "absolute";

        if (closed || (!before.hidden && hidden)) {
            reset();
        }
    }, [open, hidden, reset]);

    useEffect(() => {
        if (focusRequest === null) {
            return;
        }

        const element = rowElement(treeRef.current, focusRequest);

        setFocusRequest(null);

        if (element) {
            focusTreeItem(element);
        }
    }, [focusRequest]);

    // A folder just created is scrolled to as soon as its row is there, which is when the folder it
    // was made in has been listed again, wherever it sorts. Its row is placed by the rows, so it
    // needn't be rendered. Nothing is expanded for it: it's given up on unless the folder it was
    // made in shows its folders, since otherwise its row never comes. The focus stays where it is.
    useEffect(() => {
        const list = treeRef.current;

        if (!reveal || !list) {
            return;
        }

        const row = rows.find((candidate) => reveal.keys.includes(candidate.id));

        if (!row) {
            const parentShown =
                (tree !== null && reveal.parentKeys.includes(folderKey(tree.id, tree.rootId))) ||
                rows.some(
                    (candidate) =>
                        (candidate.kind === "folder" || candidate.kind === "section") &&
                        candidate.expanded &&
                        reveal.parentKeys.includes(candidate.id),
                );

            if (!parentShown) {
                onRevealed();
            }

            return;
        }

        const scroller = scrollParent(list);

        if (scroller && scroller.clientHeight > 0) {
            const panelTop = scroller.getBoundingClientRect().top + scroller.clientTop;
            const viewTop = panelTop - list.getBoundingClientRect().top;
            const viewBottom = viewTop + scroller.clientHeight;

            if (row.top < viewTop) {
                scroller.scrollTop += row.top - viewTop;
            } else if (row.top + row.height > viewBottom) {
                scroller.scrollTop += row.top + row.height - viewBottom;
            }
        }

        onRevealed();
    }, [reveal, rows, tree, onRevealed]);

    /** Focuses a row and scrolls to it, rendering it first if it isn't. */
    const focusRow = (id: string) => {
        const element = rowElement(treeRef.current, id);

        if (element) {
            focusTreeItem(element);
        } else {
            setFocusRequest(id);
        }
    };

    // A row that goes while it has the focus, as a folder deleted or moved away does, hands it on
    // to the row shown before it, so the focus isn't dropped to the page. The rows it was among
    // are kept from the render before.
    const previousRows = useRef(rows);

    useEffect(() => {
        const before = previousRows.current;

        previousRows.current = rows;

        if (!focusInside || focusKey === null || !focusLost() || rows.some((row) => row.id === focusKey)) {
            return;
        }

        const ids = new Set(rows.map((row) => row.id));
        const index = before.findIndex((row) => row.id === focusKey);
        const stays = (row: TreeRow) => isItem(row) && ids.has(row.id);
        const neighbour = before.slice(0, Math.max(index, 0)).findLast(stays) ?? before.slice(index + 1).find(stays);

        if (neighbour) {
            focusRow(neighbour.id);
        }
    });

    // Picking a location closes the overlay; expanding or selecting a folder doesn't, so the tree can be browsed in it.
    const handleNavigate = useCallback(
        (place: FileManagerLocation) => {
            reset();
            onNavigate(place);
            onClose();
        },
        [reset, onNavigate, onClose],
    );

    // Escape in the main menu, which portals out of the sidebar but still bubbles here through
    // React's tree, only closes the menu.
    // Escape that calls off a drag of the edge is the edge's.
    // Escape leaves the touch selection mode first, as in the content, and then closes the overlay.
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (
            event.key === "Escape" &&
            !event.defaultPrevented &&
            event.target instanceof Node &&
            event.currentTarget.contains(event.target)
        ) {
            if (selecting) {
                event.preventDefault();
                reset();
            } else {
                onClose();
            }
        }
    };

    // Tabbing out of the overlay onto the file manager behind it closes the overlay, as a click
    // there does. The focus going to a menu or a dialog, which portal out of the file manager, keeps it.
    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
        const to = event.relatedTarget;

        if (
            open &&
            to instanceof Node &&
            !event.currentTarget.contains(to) &&
            event.currentTarget.parentElement?.contains(to)
        ) {
            onClose();
        }
    };

    const handleTreeFocus = (event: FocusEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) {
            const key = event.target instanceof HTMLElement ? event.target.dataset.treeKey : undefined;

            if (key !== undefined) {
                setFocusKey(key);
            }

            setFocusInside(true);

            return;
        }

        const items = rows.filter(isItem);
        const row = items.find((item) => item.id === focusKey) ?? items.find((item) => item.id === openKey) ?? items[0];

        if (row) {
            focusRow(row.id);
        }
    };

    const handleTreeBlur = (event: FocusEvent<HTMLDivElement>) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
            setFocusInside(false);
        }
    };

    // Moving between rows; the rows take the keys that act on them first.
    const handleTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.defaultPrevented || event.altKey) {
            return;
        }

        const key =
            event.target instanceof HTMLElement && event.target.getAttribute("role") === "treeitem"
                ? event.target.dataset.treeKey
                : undefined;
        const items = rows.filter(isItem);
        const index = key === undefined ? -1 : items.findIndex((item) => item.id === key);
        const item = index >= 0 ? items[index] : undefined;
        const rtl = isRtl(event.currentTarget);
        let next: TreeItemRow | undefined;

        switch (event.key) {
            case "ArrowDown":
                next = items[index + 1];
                break;
            case "ArrowUp":
                next = index < 0 ? items[0] : items[index - 1];
                break;
            case "Home":
                next = items[0];
                break;
            case "End":
                next = items.at(-1);
                break;
            // Into an expanded row, to its first folder, and out of a collapsed one, to the row above.
            case rtl ? "ArrowLeft" : "ArrowRight": {
                const below = items[index + 1];

                next =
                    item?.kind !== "error" && item?.expanded && below && below.depth > item.depth ? below : undefined;
                break;
            }
            case rtl ? "ArrowRight" : "ArrowLeft":
                next = item && items.slice(0, index).findLast((row) => row.depth < item.depth);
                break;
            default:
                if (isTypingKey(event)) {
                    const match = matchName(
                        items.map((row) => row.label),
                        Math.max(index, 0),
                        typeAhead.type(event.key),
                        sameLetters,
                    );

                    next = items[match];
                    event.preventDefault();
                }
        }

        if (next) {
            event.preventDefault();
            focusRow(next.id);
        }
    };

    // The row a drag starts from, found once the drag has bubbled up from it.
    const handleDragStart = (event: DragEvent) => {
        const item = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-tree-key]") : null;

        setGrabbedKey(item?.dataset.treeKey ?? null);
    };

    // In the touch selection mode, the folders the selection is among, as the first row shown
    // among them has them. While their parent is collapsed none are, so none count, as in the
    // content selected entries a search leaves out don't, and they come back as it's expanded.
    const among = selecting
        ? rows.find((row): row is FolderRow => row.kind === "folder" && row.parentKey === selection?.parentKey)
        : undefined;
    const selectedFolders = among
        ? among.siblings.filter((_, index) => selection?.ids.has(among.siblingKeys[index]))
        : [];

    const handleSelectionMenu = (button: HTMLElement) => {
        if (among) {
            onOpenMenu(belowElement(button), {
                target: "selection",
                section: among.section,
                trail: among.parentTrail,
                entries: selectedFolders,
            });
        }
    };

    const renderItem = (row: TreeItemRow | StatusRow) => (
        <TreeRowItem
            key={row.id}
            row={row}
            openKey={openKey}
            selection={selection}
            onStartSelecting={startSelecting}
            onToggle={onToggle}
            onExpand={onExpand}
            onNavigate={handleNavigate}
            onSelectFolder={select}
            onSelectSection={selectSection}
            onOpenMenu={onOpenMenu}
            onShortcut={onShortcut}
            onPasteFiles={onPasteFiles}
        />
    );

    return (
        // Focusable but not tabbable, so a press on its empty space keeps the focus in the sidebar:
        // the keys work anywhere in the file manager, F6 goes on to the content, and the overlay
        // stays open.
        <Box
            ref={forkedRef}
            id={sidebarId}
            tabIndex={-1}
            sx={sidebarSx}
            style={{ "--sidebar-width": `${asked}px` } as CSSProperties}
            data-open={open}
            data-hidden={hidden}
            data-peek={peek}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
        >
            <Box sx={headerSx}>
                {/* Keeps the focus in an open search's field as it's pressed, which it closes or
                    switches to searching everywhere. */}
                {canSearchEverywhere && (
                    <TooltipIconButton
                        label={text.searchEverywhere}
                        aria-pressed={searchScope === "everywhere"}
                        aria-keyshortcuts="Control+Shift+F Meta+Shift+F"
                        sx={searchButtonSx}
                        onMouseDown={(event) => searchScope && event.preventDefault()}
                        onClick={onSearchEverywhere}
                    >
                        <Icon name="search" fontSize="small" />
                    </TooltipIconButton>
                )}
                <Typography component="span" noWrap sx={titleSx}>
                    {title}
                </Typography>
                <MainMenu groups={mainMenu} undo={undoItems} onShowShortcuts={onShowShortcuts} />
            </Box>
            <Box component="nav" aria-label={text.sidebar} sx={navSx}>
                <Box
                    ref={treeElement}
                    role="tree"
                    aria-label={tree ? tree.label : text.sections}
                    aria-multiselectable
                    // Shows the check badges on the folders' icons.
                    data-selecting={selecting}
                    // With no section, there's nothing in it to tab to.
                    tabIndex={focusInside || !rows.some(isItem) ? -1 : 0}
                    sx={treeSx}
                    style={{ height }}
                    onFocus={handleTreeFocus}
                    onBlur={handleTreeBlur}
                    onKeyDown={handleTreeKeyDown}
                    onDragStart={handleDragStart}
                >
                    {/* Behind the rows, as they're first in the page. */}
                    {guides
                        .filter((guide) => guide.top < span.bottom && guide.bottom > span.top)
                        .map((guide) => (
                            <GuideLine key={`${guide.depth}:${guide.top}`} guide={guide} />
                        ))}
                    {tree && (
                        <Box component="ul" role="none" sx={listSx}>
                            {shown.filter(isListed).map(renderItem)}
                        </Box>
                    )}
                    {/* Each group is a `group` of the tree, named by its title, which is hidden from screen
                        readers so it isn't read twice. */}
                    {!tree &&
                        groups.map((group, index) => {
                            const inGroup = shown.filter((row) => row.group === index);
                            const items = inGroup.filter(isListed);

                            return (
                                <Fragment key={group.id}>
                                    {inGroup.map((row) => {
                                        if (row.kind === "divider") {
                                            return (
                                                <Box key={row.id} sx={ruleSx} style={placeStyle(row)} aria-hidden>
                                                    <Divider sx={dividerSx} />
                                                </Box>
                                            );
                                        }

                                        if (row.kind === "caption") {
                                            return (
                                                <Typography
                                                    key={row.id}
                                                    variant="caption"
                                                    sx={groupTitleSx}
                                                    style={placeStyle(row)}
                                                    aria-hidden
                                                >
                                                    {row.title}
                                                </Typography>
                                            );
                                        }

                                        return null;
                                    })}
                                    {items.length > 0 && (
                                        <Box component="ul" role="group" aria-label={group.title} sx={listSx}>
                                            {items.map(renderItem)}
                                        </Box>
                                    )}
                                </Fragment>
                            );
                        })}
                </Box>
            </Box>
            {selecting && (
                <SelectionBar
                    count={selectedFolders.length}
                    total={among?.siblings.length ?? 0}
                    hasActions={hasActions}
                    onClose={reset}
                    onSelectAll={() => selectKeys(among?.siblingKeys ?? [])}
                    onSelectNone={() => selectKeys([])}
                    onMenu={handleSelectionMenu}
                />
            )}
            {/* Only there, by CSS, while the sidebar docks and isn't peeking over the content. */}
            <ResizeEdge
                target={sidebarRef}
                label={text.resizeSidebar}
                controls={sidebarId}
                placement="end"
                width={asked}
                defaultWidth={defaultWidth}
                min={SIDEBAR_MIN_WIDTH}
                max={SIDEBAR_MAX_WIDTH}
                step={RESIZE_STEP}
                cssVar="--sidebar-width"
                widest={widest}
                onChange={onWidthChange}
            />
        </Box>
    );
};

export default Sidebar;
