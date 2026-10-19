import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useFolder } from "../../../hooks/use-folder";
import { useLongPress } from "../../../hooks/use-long-press";
import { useMarquee } from "../../../hooks/use-marquee";
import { useSelection } from "../../../hooks/use-selection";
import { selectedBackground } from "../../../styles/mixins";
import { belowElement, pointerPosition } from "../../../utils/menu-position";
import { folderOf } from "../../../utils/navigation";
import { EMPTY_SELECTION, marqueeSelection, selectModifiers } from "../../../utils/selection";
import { entryComparator } from "../../../utils/sort";
import Icon from "../../icons/icon";
import FileGrid from "./file-grid";
import FileList from "./file-list";
import SelectionBar from "./selection-bar";

import type {
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

// Fills the scroll panel even when the folder is short, so its empty space takes clicks,
// right-clicks and marquee drags. Positioned so the marquee is placed in content coordinates.
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
    // Focused by presses, for the keyboard shortcuts, but never tabbed to, so no ring.
    outline: "none",
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
    revealId,
    onSelectingChange,
    onSortChange,
    onNavigate,
    onOpenMenu,
    onShortcut,
    onRevealed,
}: FolderViewProps) => {
    const { state, reload } = useFolder(section, folderOf(section, trail).id, true);

    // Sorted here rather than in the store, since the sidebar tree shares the listing and keeps its own order.
    const entries = useMemo(
        () => (state?.entries ? [...state.entries].sort(entryComparator(sort)) : undefined),
        [state?.entries, sort],
    );

    const { selection, selectedIds, selected, select, replace, selectAll, clear } = useSelection(entries);

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

    // Waits for the refreshed listing, which arrives after the entry was created or renamed.
    const revealListed = revealId !== undefined && !!entries?.some((entry) => entry.id === revealId);

    useEffect(() => {
        if (revealId === undefined || !revealListed) {
            return;
        }

        replace({ ids: new Set([revealId]), anchor: revealId });
        marquee.surfaceRef.current
            ?.querySelector(`[data-entry-id="${CSS.escape(revealId)}"]`)
            ?.scrollIntoView({ block: "nearest" });
        onRevealed();
    }, [revealId, revealListed, replace, marquee.surfaceRef, onRevealed]);

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
    // "New folder" works with entries selected.
    const handleKeyDown = (event: KeyboardEvent) => {
        const folderRequest: MenuRequest = { target: "folder", section, trail, entries: [] };
        const requests: MenuRequest[] = selected.length
            ? [{ target: "selection", section, trail, entries: selected }, folderRequest]
            : [folderRequest];

        if (onShortcut(event, requests)) {
            event.preventDefault();
        }
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
                selectedIds={selectedIds}
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
            <Box sx={stateSx}>
                <Icon name="folderOpen" sx={stateIconSx} />
                <Typography sx={stateTitleSx}>Folder is empty</Typography>
            </Box>
        );
    } else if (state?.status === "error") {
        content = (
            <Box sx={stateSx}>
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
            <Box sx={stateSx}>
                <CircularProgress size={28} />
            </Box>
        );
    }

    return (
        <Box
            ref={marquee.surfaceRef}
            sx={surfaceSx}
            tabIndex={-1}
            data-selecting={selecting}
            onPointerDownCapture={(event) => {
                pointerType.current = event.pointerType;
            }}
            onPointerDown={handlePointerDown}
            onClickCapture={handleClickCapture}
            onClick={handleBackgroundClick}
            onContextMenuCapture={handleContextMenuCapture}
            onContextMenu={handleBackgroundMenu}
            onKeyDown={handleKeyDown}
        >
            {state?.status === "loading" && entries && <LinearProgress sx={progressSx} />}
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
        </Box>
    );
};

export default FolderView;
