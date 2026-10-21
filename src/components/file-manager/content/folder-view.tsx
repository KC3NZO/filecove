import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { DragEvent, FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { DataContext } from "../../../contexts/data-context";
import { DragContext } from "../../../contexts/drag-context";
import { useCutIds } from "../../../hooks/use-cut-ids";
import { useDraggedIds } from "../../../hooks/use-dragged-ids";
import { useDropTarget } from "../../../hooks/use-drop-target";
import { useFolder } from "../../../hooks/use-folder";
import { useLongPress } from "../../../hooks/use-long-press";
import { useMarquee } from "../../../hooks/use-marquee";
import { useSelection } from "../../../hooks/use-selection";
import { useTypeAhead } from "../../../hooks/use-type-ahead";
import { focusOutline, selectedBackground, visuallyHiddenSx } from "../../../styles/mixins";
import { gridColumns, isMenuKey, isRtl, isTypingKey, matchName, pageRows, stepIndex } from "../../../utils/keyboard";
import { belowElement, insideElement, pointerPosition } from "../../../utils/menu-position";
import { folderOf } from "../../../utils/navigation";
import { EMPTY_SELECTION, NO_MODIFIERS, marqueeSelection, selectModifiers } from "../../../utils/selection";
import { entryComparator } from "../../../utils/sort";
import Icon from "../../icons/icon";
import FileGrid from "./file-grid";
import FileList from "./file-list";
import SelectionBar from "./selection-bar";

import type {
    DropTarget,
    EntrySelection,
    FileEntry,
    FolderRef,
    MenuPosition,
    MenuRequest,
    OpenMenu,
    Place,
    RunShortcut,
    Section,
    SelectModifiers,
    SortOrder,
    ViewMode,
} from "../../../types";

interface FolderViewProps {
    section: Section;
    trail: FolderRef[];
    view: ViewMode;
    sort: SortOrder;
    hasActions: boolean;
    /** Touch selection mode: taps toggle entries, and the selection bar shows. */
    selecting: boolean;
    /** Something is being pasted into the folder, so the progress bar shows. */
    busy: boolean;
    /**
     * Takes the focus, or as soon as there is something to focus once the folder is listed. Set
     * for one render, e.g. as the folder opens from a key press in the one before, whose view went
     * away with the focus in it.
     */
    takeFocus: boolean;
    /** An entry to select and scroll to once the listing has it, e.g. a folder just created. */
    revealId?: string;
    onSelectingChange: (selecting: boolean) => void;
    onSortChange: (sort: SortOrder) => void;
    onNavigate: (place: Place) => void;
    onOpenMenu: OpenMenu;
    onShortcut: RunShortcut;
    /** Called once `revealId` has been selected. */
    onRevealed: () => void;
}

/** Where the view's focus is among the entries: the entry, and where it was listed. */
interface EntryFocus {
    id: string;
    index: number;
}

/** The entry an event happened on, by its `data-entry-id`. */
const entryIdAt = (target: EventTarget) =>
    target instanceof Element ? target.closest<HTMLElement>("[data-entry-id]")?.dataset.entryId : undefined;

const entryElement = (surface: HTMLElement, id: string) =>
    surface.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(id)}"]`);

/** Whether the focus has left the page, as it does when the focused element is removed. */
const focusLost = () => !document.activeElement || document.activeElement === document.body;

// Fills the scroll panel even when the folder is short, so its empty space takes clicks,
// right-clicks, marquee drags and drops. Positioned so the marquee is placed in content coordinates.
// On touch, a long-press selects, so iOS's callout and the tap flash are turned off, and a double
// tap doesn't zoom.
const surfaceSx: SxProps<Theme> = {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    minHeight: "100%",
    WebkitTouchCallout: "none",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
    // Focused by presses, for the keyboard shortcuts, with no ring. It's only tabbed to while it
    // lists nothing, and then rings the panel, rounded like it.
    outline: "none",
    "&:focus-visible": { ...focusOutline, borderRadius: 3 },
};

// Geometry comes from custom properties that `useMarquee` sets while dragging.
const marqueeSx: SxProps<Theme> = (theme) => ({
    display: "none",
    position: "absolute",
    zIndex: 3,
    left: "var(--marquee-left)",
    top: "var(--marquee-top)",
    width: "var(--marquee-width)",
    height: "var(--marquee-height)",
    border: "1px solid",
    borderColor: "primary.main",
    borderRadius: 0.5,
    bgcolor: selectedBackground(theme),
    pointerEvents: "none",
    '&[data-active="true"]': { display: "block" },
});

// Overlays the top edge while a loaded folder refreshes, without pushing the content down.
const progressSx: SxProps<Theme> = {
    position: "sticky",
    top: 0,
    zIndex: 2,
    mb: "-4px",
};

const stateSx: SxProps<Theme> = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    p: 3,
    textAlign: "center",
    color: "text.secondary",
};

const stateIconSx: SxProps<Theme> = {
    fontSize: "3rem",
    opacity: 0.6,
};

const stateTitleSx: SxProps<Theme> = {
    color: "text.primary",
    fontWeight: 600,
};

/**
 * The open folder's contents. It owns the selection, so the selection starts empty in every
 * folder (the file manager remounts this per folder) and is never shared with the sidebar.
 *
 * On touch there are no modifier keys, so a long-press (or the header's Select button) starts a
 * selection mode in which taps toggle entries. Outside it, a tap opens a folder.
 */
const FolderView = ({
    section,
    trail,
    view,
    sort,
    hasActions,
    selecting,
    busy,
    takeFocus,
    revealId,
    onSelectingChange,
    onSortChange,
    onNavigate,
    onOpenMenu,
    onShortcut,
    onRevealed,
}: FolderViewProps) => {
    const folder = folderOf(section, trail);
    const { state, reload } = useFolder(section, folder.id, true);
    const cutIds = useCutIds(section);
    const draggedIds = useDraggedIds(section);
    const data = useContext(DataContext);
    const drag = useContext(DragContext);

    // A drag moves or copies, so it needs an adapter that does one or the other.
    const adapter = section.adapter ?? data?.adapter;
    const draggable = !!(adapter?.move || adapter?.copy);

    // Sorted here rather than in the store, since the sidebar tree shares the listing and keeps its own order.
    const entries = useMemo(
        () => (state?.entries ? [...state.entries].sort(entryComparator(sort)) : undefined),
        [state?.entries, sort],
    );

    const { selection, selectedIds, selected, select, replace, selectAll, clear } = useSelection(entries);
    const typeAhead = useTypeAhead();
    const stateId = useId();

    // The entry with the view's Tab stop, which the arrow keys move from. Where it was listed is
    // kept up to date, so the entry after it takes its place if it goes.
    const [focus, setFocus] = useState<EntryFocus | null>(null);
    const focusIndex = focus && entries ? entries.findIndex((entry) => entry.id === focus.id) : -1;

    if (focus && focusIndex >= 0 && focusIndex !== focus.index) {
        setFocus({ id: focus.id, index: focusIndex });
    }

    let focusId: string | null = null;

    if (entries?.length) {
        if (focus && focusIndex >= 0) {
            focusId = focus.id;
        } else if (focus) {
            focusId = entries[Math.min(focus.index, entries.length - 1)].id;
        } else {
            focusId = selected[0]?.id ?? entries[0].id;
        }
    }

    // Whether the focus is in the view. Removing the focused entry, as deleting or moving it away
    // does, drops the focus to the page without a blur, so this stays set and the entry taking its
    // place gets the focus back.
    const focusWithin = useRef(false);
    // Set while the view is to take the focus once it has something to focus.
    const pendingFocus = useRef(false);

    // Leaving selection mode, however it is left, drops the selection made in it.
    const [wasSelecting, setWasSelecting] = useState(selecting);

    if (selecting !== wasSelecting) {
        setWasSelecting(selecting);

        if (!selecting) {
            clear();
        }
    }

    // The pointer of the latest press, which the click and contextmenu that follow it come from.
    // Read per press rather than from the device, so a tablet with a trackpad gets both behaviours.
    const pointerType = useRef("mouse");

    // Shift and Ctrl marquees build on what was selected when the drag began.
    const marqueeBase = useRef<EntrySelection>(EMPTY_SELECTION);
    const marquee = useMarquee({
        enabled: Boolean(entries?.length),
        onStart: () => {
            marqueeBase.current = selection;
        },
        onChange: (ids, modifiers) => replace(marqueeSelection(marqueeBase.current, ids, modifiers)),
    });

    useEffect(() => {
        if (takeFocus) {
            pendingFocus.current = true;
        }
    }, [takeFocus]);

    // Waits for the refreshed listing, which arrives after the entry was created or renamed. The
    // entry takes the focus too while the view has it, or is to take it.
    const revealIndex = revealId === undefined || !entries ? -1 : entries.findIndex((entry) => entry.id === revealId);

    useEffect(() => {
        const surface = marquee.surfaceRef.current;

        if (revealId === undefined || revealIndex < 0 || !surface) {
            return;
        }

        const element = entryElement(surface, revealId);

        replace({ ids: new Set([revealId]), anchor: revealId });
        setFocus({ id: revealId, index: revealIndex });

        if (pendingFocus.current || focusWithin.current) {
            pendingFocus.current = false;
            element?.focus({ preventScroll: true });
        }

        element?.scrollIntoView({ block: "nearest" });
        onRevealed();
    }, [revealId, revealIndex, replace, marquee.surfaceRef, onRevealed]);

    // Gives the focus to the focused entry, or to the view while it lists nothing, when the view is
    // to take it, or when the focused entry was removed. While the folder loads, the view holds it.
    useEffect(() => {
        const surface = marquee.surfaceRef.current;

        if (!surface || (!pendingFocus.current && !(focusWithin.current && focusLost()))) {
            return;
        }

        if (!entries && state?.status !== "error") {
            surface.focus({ preventScroll: true });

            return;
        }

        const element = focusId === null ? null : entryElement(surface, focusId);

        pendingFocus.current = false;
        (element ?? surface).focus({ preventScroll: true });
        element?.scrollIntoView({ block: "nearest" });
    });

    // The entry an event happened on.
    const entryAt = (event: DragEvent) => {
        const id = entryIdAt(event.target);

        return id === undefined ? undefined : entries?.find((entry) => entry.id === id);
    };

    // A drag carries the selection when it starts on a selected entry, or else selects the entry and
    // carries it alone, as the context menu does.
    const handleDragStart = (event: DragEvent) => {
        drag?.start(event, () => {
            const entry = entryAt(event);

            if (!entry) {
                return null;
            }

            if (selectedIds.has(entry.id)) {
                return { section, trail, entries: selected, grabbed: entry };
            }

            select(entry.id);

            return { section, trail, entries: [entry], grabbed: entry };
        });
    };

    // Dragged entries already listed here came from this folder, or are its folders dragged from the
    // sidebar, so its empty space doesn't take them and a drag that ends where it began does nothing.
    const listsDragged = useMemo(() => !!entries?.some((entry) => draggedIds.has(entry.id)), [entries, draggedIds]);

    // Dropped onto a folder, the entries go into it, by the same rules as pasting. Dropped anywhere
    // else, a file included, they go into the open folder, keyed by its id, which none of its
    // entries has.
    const drop = useDropTarget({
        targetsAt: (event) => {
            const entry = entryAt(event);
            const targets: DropTarget[] = [];

            if (entry?.kind === "folder") {
                targets.push({ key: entry.id, section, trail: [...trail, { id: entry.id, name: entry.name }] });
            }

            if (!listsDragged) {
                targets.push({ key: folder.id, section, trail });
            }

            return targets;
        },
    });

    const longPress = useLongPress({
        onLongPress: (id) => {
            if (selecting) {
                select(id, { toggle: true, range: false });
            } else {
                replace({ ids: new Set([id]), anchor: id });
                onSelectingChange(true);
            }
        },
    });

    const handleOpen = useCallback(
        (entry: FileEntry) => {
            if (entry.kind === "folder") {
                onNavigate({ sectionId: section.id, trail: [...trail, { id: entry.id, name: entry.name }] });
            }
        },
        [onNavigate, section.id, trail],
    );

    // In selection mode every tap toggles. Outside it, a touch tap opens a folder, as double-click
    // does with a mouse, and otherwise selects as a click does.
    const handleSelect = useCallback(
        (id: string, modifiers: SelectModifiers) => {
            if (selecting) {
                select(id, { toggle: true, range: modifiers.range });

                return;
            }

            const entry = pointerType.current === "mouse" ? undefined : entries?.find((item) => item.id === id);

            if (entry?.kind === "folder") {
                handleOpen(entry);
            } else {
                select(id, modifiers);
            }
        },
        [selecting, select, entries, handleOpen],
    );

    // A double tap in selection mode is two toggles, not an open.
    const handleDoubleOpen = useCallback(
        (entry: FileEntry) => {
            if (!selecting) {
                handleOpen(entry);
            }
        },
        [selecting, handleOpen],
    );

    // As in desktop file managers, the menu of a selected entry acts on the whole selection, while
    // any other entry is selected on its own first and the menu acts on it alone.
    const handleEntryMenu = useCallback(
        (position: MenuPosition, entry: FileEntry) => {
            const inSelection = selectedIds.has(entry.id);

            if (!inSelection) {
                select(entry.id);
            }

            return onOpenMenu(position, {
                target: "selection",
                section,
                trail,
                entries: inSelection ? selected : [entry],
            });
        },
        [selectedIds, selected, select, onOpenMenu, section, trail],
    );

    // Clicking empty space clears the selection, unless Ctrl or Shift is held: a modifier click
    // that just misses an entry shouldn't throw a built-up selection away.
    const handleBackgroundClick = (event: MouseEvent) => {
        const { toggle, range } = selectModifiers(event);

        if (!toggle && !range && !selecting) {
            clear();
        }
    };

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        // Any press focuses the view, so the shortcuts work after clicking an entry or empty space.
        if (!event.currentTarget.contains(document.activeElement)) {
            event.currentTarget.focus({ preventScroll: true });
        }

        marquee.onPointerDown(event);
        longPress.onPointerDown(event);
    };

    const handleClickCapture = (event: MouseEvent) => {
        marquee.onClickCapture(event);
        longPress.onClickCapture(event);
    };

    // A touch long-press is ours, so neither the browser's menu nor ours opens on top of it.
    const handleContextMenuCapture = (event: MouseEvent) => {
        if (pointerType.current !== "mouse") {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    // A shortcut acts on the selection when it applies there, or else on the open folder, so
    // "New folder" works with entries selected. The consumer's shortcuts come before the view's own
    // keys, so an action can take a key such as Enter. A control in the view, such as a column
    // header, keeps Enter and Space, and the view's own keys only work on the entries and the view.
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const entryId = entryIdAt(event.target);
        const own = event.target === event.currentTarget || entryId !== undefined;

        if (!own && (event.key === "Enter" || event.key === " ")) {
            return;
        }

        if (own && isMenuKey(event)) {
            event.preventDefault();
            openKeyboardMenu(event.currentTarget, entryId);

            return;
        }

        const folderRequest: MenuRequest = { target: "folder", section, trail, entries: [] };
        const requests: MenuRequest[] = selected.length
            ? [{ target: "selection", section, trail, entries: selected }, folderRequest]
            : [folderRequest];

        if (onShortcut(event, requests)) {
            event.preventDefault();

            return;
        }

        // Escape leaves selection mode, or else clears the selection; Ctrl+A selects everything.
        // Both work wherever the focus is in the view.
        const toggle = event.ctrlKey || event.metaKey;
        let handled = false;

        if (event.key === "Escape" && (selecting || selected.length > 0)) {
            if (selecting) {
                onSelectingChange(false);
            } else {
                clear();
            }

            handled = true;
        } else if (toggle && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "a") {
            selectAll();
            handled = true;
        } else if (own) {
            handled = handleViewKey(event, entryId !== undefined);
        }

        if (handled) {
            event.preventDefault();
        }
    };

    const handleFocus = (event: FocusEvent) => {
        const id = entryIdAt(event.target);
        const index = id === undefined || !entries ? -1 : entries.findIndex((entry) => entry.id === id);

        focusWithin.current = true;

        if (id !== undefined && index >= 0 && (focus?.id !== id || focus.index !== index)) {
            setFocus({ id, index });
        }
    };

    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
            focusWithin.current = false;
            pendingFocus.current = false;
        }
    };

    /** Focuses an entry and scrolls it into view, below the sticky column header. */
    const focusEntry = (id: string, index: number) => {
        const element = marquee.surfaceRef.current && entryElement(marquee.surfaceRef.current, id);

        setFocus({ id, index });
        element?.focus({ preventScroll: true });
        element?.scrollIntoView({ block: "nearest" });
    };

    /**
     * Moves the focus to the entry at `index`. On its own it selects that entry alone, as a click
     * does; with `range` (Shift) it selects from the anchor, or from the entry focused until now,
     * adding to the selection with `toggle` too; `toggle` alone (Ctrl or ⌘) leaves the selection be,
     * as does selection mode, where Space picks entries.
     */
    const moveFocus = (index: number, { toggle, range }: SelectModifiers) => {
        const entry = entries?.[index];

        if (!entry) {
            return;
        }

        if (range) {
            select(entry.id, { toggle, range: true }, focusId ?? entry.id);
        } else if (!toggle && !selecting) {
            select(entry.id);
        }

        focusEntry(entry.id, index);
    };

    const goUp = () => {
        if (trail.length > 0) {
            onNavigate({ sectionId: section.id, trail: trail.slice(0, -1) });
        }
    };

    const openKeyboardMenu = (surface: HTMLElement, entryId: string | undefined) => {
        const entry = entryId === undefined ? undefined : entries?.find((item) => item.id === entryId);
        const element = entry && entryElement(surface, entry.id);

        // At the row's menu button, as a click on it would open it, or else below the tile. The
        // folder's menu opens in the top corner of the panel, which stays put as the folder scrolls.
        if (entry && element) {
            handleEntryMenu(belowElement(element.querySelector("[data-menu-button]") ?? element), entry);
        } else {
            onOpenMenu(insideElement(surface.parentElement ?? surface), {
                target: "folder",
                section,
                trail,
                entries: [],
            });
        }
    };

    /**
     * The view's own keys, for when the focus is on an entry or on the view itself. Returns
     * whether the key was taken.
     *
     * - Arrows, Home, End, PageUp and PageDown move the focus, selecting as `moveFocus` says. In the
     *   grid, Left and Right move along a row and Up and Down between rows.
     * - Space selects or deselects the focused entry; Shift+Space selects from the anchor to it.
     * - Enter and Alt+Down open the focused folder; Backspace and Alt+Up go up to the folder above.
     * - Typing finds the next entry whose name starts with what was typed.
     */
    const handleViewKey = (event: KeyboardEvent<HTMLDivElement>, onEntry: boolean) => {
        const toggle = event.ctrlKey || event.metaKey;
        const index = focusId === null || !entries ? -1 : entries.findIndex((entry) => entry.id === focusId);
        const current = index >= 0 ? entries?.[index] : undefined;

        if (event.altKey) {
            if (toggle || event.shiftKey) {
                return false;
            }

            if (event.key === "ArrowUp") {
                goUp();

                return true;
            }

            if (event.key === "ArrowDown" && current?.kind === "folder") {
                handleOpen(current);

                return true;
            }

            return false;
        }

        if (event.key === "Backspace" && !toggle && !event.shiftKey) {
            goUp();

            return true;
        }

        if (!entries || !current || index < 0) {
            return false;
        }

        if (event.key === "Enter" && !toggle && !event.shiftKey) {
            if (current.kind !== "folder") {
                return false;
            }

            handleOpen(current);

            return true;
        }

        // A space typed in the middle of a name is part of it.
        if (event.key === " " && !(isTypingKey(event) && typeAhead.typing())) {
            if (event.shiftKey) {
                select(current.id, { toggle, range: true }, current.id);
            } else {
                select(current.id, { toggle: true, range: false });
            }

            return true;
        }

        const surface = event.currentTarget;
        const listbox = surface.querySelector<HTMLElement>('[role="listbox"]');
        const element = entryElement(surface, current.id);
        const grid = view === "grid";
        const step = stepIndex(event.key, index, entries.length, {
            columns: grid && listbox ? gridColumns(listbox) : 1,
            horizontal: grid,
            page: element && surface.parentElement ? pageRows(surface.parentElement, element) : 1,
            rtl: isRtl(surface),
        });

        if (step !== null) {
            // With the focus on the view rather than an entry, as after a click on its empty space,
            // the first key only brings the focus to the entry that has the Tab stop.
            moveFocus(onEntry ? step : index, { toggle, range: event.shiftKey });

            return true;
        }

        if (isTypingKey(event)) {
            const match = matchName(
                entries.map((entry) => entry.name),
                index,
                typeAhead.type(event.key),
            );

            if (match >= 0) {
                moveFocus(match, NO_MODIFIERS);
            }

            return true;
        }

        return false;
    };

    const handleSelectionMenu = (button: HTMLElement) => {
        onOpenMenu(belowElement(button), { target: "selection", section, trail, entries: selected });
    };

    const handleBackgroundMenu = (event: MouseEvent) => {
        clear();

        if (onOpenMenu(pointerPosition(event), { target: "folder", section, trail, entries: [] })) {
            event.preventDefault();
        }
    };

    const ContentView = view === "list" ? FileList : FileGrid;
    let content: ReactNode;

    if (entries?.length) {
        content = (
            <ContentView
                entries={entries}
                label={folder.name}
                focusId={focusId}
                selectedIds={selectedIds}
                cutIds={cutIds}
                draggable={draggable}
                draggedIds={draggedIds}
                dropTargetId={drop.dropKey}
                hasActions={hasActions}
                sort={sort}
                onSelect={handleSelect}
                onOpen={handleDoubleOpen}
                onMenu={handleEntryMenu}
                onSortChange={onSortChange}
            />
        );
    } else if (entries) {
        content = (
            <Box id={stateId} sx={stateSx}>
                <Icon name="folderOpen" sx={stateIconSx} />
                <Typography sx={stateTitleSx}>Folder is empty</Typography>
            </Box>
        );
    } else if (state?.status === "error") {
        content = (
            <Box id={stateId} sx={stateSx} role="alert">
                <Icon name="info" sx={stateIconSx} />
                <Typography sx={stateTitleSx}>Couldn't open this folder</Typography>
                {state.error instanceof Error && <Typography variant="body2">{state.error.message}</Typography>}
                <Button
                    size="small"
                    variant="outlined"
                    onClick={(event) => {
                        event.stopPropagation();
                        reload();
                    }}
                >
                    Try again
                </Button>
            </Box>
        );
    } else {
        content = (
            <Box id={stateId} sx={stateSx}>
                <CircularProgress size={28} aria-label="Loading" />
            </Box>
        );
    }

    // Screen readers hear how many entries are selected as it changes, e.g. with Shift+arrows or Ctrl+A.
    let status = "";

    if (selected.length > 0) {
        status = selected.length === 1 ? "1 item selected" : `${selected.length} items selected`;
    }

    // While it lists nothing, the view is tabbed to itself, so the shortcuts and the menu key work
    // there, and it's named for the folder and described by why it's empty.
    const listed = !!entries?.length;

    return (
        <Box
            ref={marquee.surfaceRef}
            sx={surfaceSx}
            tabIndex={listed ? -1 : 0}
            role={listed ? undefined : "group"}
            aria-label={listed ? undefined : folder.name}
            aria-describedby={listed ? undefined : stateId}
            data-folder-view
            data-selecting={selecting}
            // Read by the panel around the view, which outlines itself while the open folder would take the drop.
            data-drop-target={drop.dropKey === folder.id}
            onPointerDownCapture={(event) => {
                pointerType.current = event.pointerType;
            }}
            onPointerDown={handlePointerDown}
            onClickCapture={handleClickCapture}
            onClick={handleBackgroundClick}
            onContextMenuCapture={handleContextMenuCapture}
            onContextMenu={handleBackgroundMenu}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onDragStart={handleDragStart}
            {...drop.handlers}
        >
            {(busy || state?.status === "loading") && entries && <LinearProgress sx={progressSx} aria-label="Loading" />}
            {content}
            {selecting && (
                <SelectionBar
                    count={selected.length}
                    total={entries?.length ?? 0}
                    hasActions={hasActions}
                    onClose={() => onSelectingChange(false)}
                    onSelectAll={selectAll}
                    onSelectNone={clear}
                    onMenu={handleSelectionMenu}
                />
            )}
            <Box ref={marquee.marqueeRef} sx={marqueeSx} />
            <Box sx={visuallyHiddenSx} role="status">
                {status}
            </Box>
        </Box>
    );
};

export default FolderView;
