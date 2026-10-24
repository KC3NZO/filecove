import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, DragEvent, FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";

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
import { useLocale } from "../../../hooks/use-locale";
import { useLongPress } from "../../../hooks/use-long-press";
import { useMarquee } from "../../../hooks/use-marquee";
import { useSelection } from "../../../hooks/use-selection";
import { useTypeAhead } from "../../../hooks/use-type-ahead";
import { useVirtualLines } from "../../../hooks/use-virtual-lines";
import { mirroredBarSx } from "../../../styles/direction";
import { focusOutline, forcedBarSx, selectedBackground, visuallyHiddenSx } from "../../../styles/mixins";
import { focusLost, isRtl } from "../../../utils/dom";
import { isHidden } from "../../../utils/hidden";
import { isMenuKey, isTypingKey, matchName, pageRows, stepIndex } from "../../../utils/keyboard";
import { belowElement, insideElement, pointerPosition } from "../../../utils/menu-position";
import { folderOf } from "../../../utils/navigation";
import { holdsTerms, searchTerms } from "../../../utils/search";
import { EMPTY_SELECTION, NO_MODIFIERS, marqueeSelection, selectModifiers } from "../../../utils/selection";
import { sameIds } from "../../../utils/sets";
import { pressesKey } from "../../../utils/shortcut";
import { entryComparator } from "../../../utils/sort";
import Icon from "../../icons/icon";
import FileGrid from "./file-grid";
import FileList from "./file-list";
import SelectionBar from "./selection-bar";

import type {
    DropTarget,
    EntrySelection,
    FileEntry,
    FileManagerLocation,
    FolderRef,
    MenuPosition,
    MenuRequest,
    OpenMenu,
    PasteFiles,
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
    /** Whether hidden entries are listed with the rest. */
    showHidden: boolean;
    /**
     * What a folder search has typed: only entries whose names hold every word of it are listed,
     * and all of them while it's empty.
     */
    query: string;
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
    /** The selected ids, while the consumer controls them; the view keeps its own otherwise. */
    selectedIds?: ReadonlySet<string>;
    /** The ids the view's own selection starts with. */
    defaultSelectedIds?: readonly string[];
    /**
     * Told the selection as it changes, with the selected entries listed, whether by the user, by
     * the listing changing under it, or by the folder opening with it.
     */
    onSelectionChange: (ids: ReadonlySet<string>, entries: FileEntry[], location: FileManagerLocation) => void;
    onSelectingChange: (selecting: boolean) => void;
    onSortChange: (sort: SortOrder) => void;
    onNavigate: (place: FileManagerLocation) => void;
    /** Opens a file as the file manager says. Returns false when nothing can open it. */
    onOpenFile: (request: MenuRequest) => boolean;
    onOpenMenu: OpenMenu;
    onShortcut: RunShortcut;
    /** Uploads files pasted from the system clipboard into the folder. */
    onPasteFiles: PasteFiles;
    /**
     * Called once `revealId` has been selected, saying whether it takes the focus, or given up on,
     * with `false`.
     */
    onRevealed: (focused: boolean) => void;
    /** Called while `revealId` is listed but left out by `query`, so ending the search shows it. */
    onRevealUnmatched: () => void;
}

/** Where the view's focus is among the entries: the entry, and where it was listed. */
interface EntryFocus {
    id: string;
    index: number;
}

/** An entry to scroll to once it's rendered, and whether to focus it too. */
interface ScrollRequest {
    id: string;
    focus: boolean;
}

/** The entry an event happened on, by its `data-entry-id`. */
const entryIdAt = (target: EventTarget) =>
    target instanceof Element ? target.closest<HTMLElement>("[data-entry-id]")?.dataset.entryId : undefined;

const entryElement = (surface: HTMLElement, id: string) =>
    surface.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(id)}"]`);

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

// Placed and sized in its inline style, which `useMarquee` sets while dragging.
const marqueeSx: SxProps<Theme> = (theme) => ({
    display: "none",
    position: "absolute",
    zIndex: 3,
    border: "1px solid",
    borderColor: "primary.main",
    borderRadius: 0.5,
    bgcolor: selectedBackground(theme),
    pointerEvents: "none",
    '&[data-active="true"]': { display: "block" },
});

// Overlays the top edge while a loaded folder refreshes, without pushing the content down, and runs
// from the start side.
const progressSx: SxProps<Theme> = [{ position: "sticky", top: 0, zIndex: 2, mb: "-4px" }, mirroredBarSx, forcedBarSx];

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
 * selection mode in which taps toggle entries. Outside it, a tap opens a folder or a file.
 */
const FolderView = ({
    section,
    trail,
    view,
    sort,
    showHidden,
    query,
    hasActions,
    selecting,
    busy,
    takeFocus,
    revealId,
    selectedIds: controlledIds,
    defaultSelectedIds,
    onSelectionChange,
    onSelectingChange,
    onSortChange,
    onNavigate,
    onOpenFile,
    onOpenMenu,
    onShortcut,
    onPasteFiles,
    onRevealed,
    onRevealUnmatched,
}: FolderViewProps) => {
    const folder = folderOf(section, trail);
    const { state, reload } = useFolder(section, folder.id, true, true);
    // All of the folder has come, or listing it failed: not still coming in pages, nor being checked
    // again in the background, which may bring entries the listing saved doesn't have yet.
    const listingSettled = state?.status === "error" || (state?.status === "ready" && !state.checking);
    const cutIds = useCutIds(section);
    const draggedIds = useDraggedIds(section);
    const data = useContext(DataContext);
    const drag = useContext(DragContext);
    const locale = useLocale();
    const { text } = locale;

    // A drag moves or copies, so it needs an adapter that does one or the other.
    const adapter = section.adapter ?? data?.adapter;
    const draggable = !!(adapter?.move || adapter?.copy);

    // Hidden entries are left out here rather than in the store, since clashing names are looked for
    // among all of them. Sorted here too, since the sidebar tree shares the listing and keeps its own order.
    const shown = useMemo(() => {
        if (!state?.entries) {
            return undefined;
        }

        const listed = showHidden ? [...state.entries] : state.entries.filter((entry) => !isHidden(entry));

        return listed.sort(entryComparator(sort, locale));
    }, [state?.entries, showHidden, sort, locale]);

    // A folder search lists only the entries whose names hold every word typed, so everything that
    // goes by what's listed goes by the results. Names are folded once per listing rather than per
    // letter typed, and the sorted entries are filtered rather than sorted again.
    const terms = useMemo(() => searchTerms(query, locale.foldLetters), [query, locale]);
    const searching = terms.length > 0;

    const foldedNames = useMemo(
        () =>
            searching && state?.entries
                ? new Map(state.entries.map((entry) => [entry.id, locale.foldLetters(entry.name)] as const))
                : undefined,
        [searching, state?.entries, locale],
    );

    const entries = useMemo(
        () =>
            shown && foldedNames
                ? shown.filter((entry) => holdsTerms(foldedNames.get(entry.id) ?? "", terms))
                : shown,
        [shown, foldedNames, terms],
    );

    // Where each entry is listed, to find entries by id without searching a large folder.
    const indexById = useMemo(() => new Map(entries?.map((entry, index) => [entry.id, index] as const)), [entries]);

    // Where the selection is, as the consumer is told it.
    const place = useMemo(() => ({ sectionId: section.id, trail }), [section.id, trail]);

    const reportSelection = useCallback(
        (ids: ReadonlySet<string>, listed: FileEntry[]) => onSelectionChange(ids, listed, place),
        [onSelectionChange, place],
    );

    const { selection, selectedIds, selected, requestedIds, select, replace, selectAll, clear, retain } =
        useSelection(entries, { ids: controlledIds, initialIds: defaultSelectedIds, onChange: reportSelection });
    const typeAhead = useTypeAhead();
    const stateId = useId();

    // The entry with the view's Tab stop, which the arrow keys move from. Where it was listed is
    // kept up to date, so the entry after it takes its place if it goes.
    const [focus, setFocus] = useState<EntryFocus | null>(null);
    const focusIndex = focus ? (indexById.get(focus.id) ?? -1) : -1;

    if (focus && focusIndex >= 0 && focusIndex !== focus.index) {
        setFocus({ id: focus.id, index: focusIndex });
    }

    // What's searched for changing starts the results over: the Tab stop goes back to the first
    // match, or the first one selected, and the panel scrolls back to the top (below). Once nothing
    // is, the whole folder shows with the Tab stop where it was, on what was found.
    const searchKey = terms.join(" ");
    const [searchedFor, setSearchedFor] = useState(searchKey);

    if (searchedFor !== searchKey) {
        setSearchedFor(searchKey);

        if (searchKey) {
            setFocus(null);
        }
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

    // The entry a drag started from. Its element has to stay rendered while it's dragged, since the
    // drag ends on it.
    const [grabbedId, setGrabbedId] = useState<string | null>(null);

    // Only the entries in or near view are rendered. The focused one stays rendered wherever the
    // panel is scrolled, so it keeps the focus and the view's Tab stop.
    const { lines, indexesIn, settled } = useVirtualLines(entries?.length ?? 0, [
        focusId === null ? -1 : (indexById.get(focusId) ?? -1),
        grabbedId !== null && draggedIds.has(grabbedId) ? (indexById.get(grabbedId) ?? -1) : -1,
    ]);

    // Whether the focus is in the view. Removing the focused entry, as deleting or moving it away
    // does, drops the focus to the page without a blur, so this stays set and the entry taking its
    // place gets the focus back.
    const focusWithin = useRef(false);
    // Set while the view is to take the focus once it has something to focus.
    const pendingFocus = useRef(false);
    // Set when the arrow keys move to an entry or one is revealed, which may not be rendered yet.
    const pendingScroll = useRef<ScrollRequest | null>(null);

    // Leaving selection mode, however it is left, drops the selection made in it. That's done after
    // rendering, since a controlled selection is the consumer's to change.
    const wasSelecting = useRef(selecting);

    useEffect(() => {
        if (wasSelecting.current && !selecting) {
            clear();
        }

        wasSelecting.current = selecting;
    }, [selecting, clear]);

    // The pointer of the latest press, which the click and contextmenu that follow it come from.
    // Read per press rather than from the device, so a tablet with a trackpad gets both behaviours.
    const pointerType = useRef("mouse");

    // Shift and Ctrl marquees build on what was selected when the drag began.
    const marqueeBase = useRef<EntrySelection>(EMPTY_SELECTION);
    const marquee = useMarquee({
        enabled: Boolean(entries?.length),
        entriesIn: (box) => (entries ? indexesIn(box).map((index) => entries[index].id) : []),
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

    // Results start at the top. The whole folder, back from a search, is scrolled to the entry with
    // the Tab stop, without taking the focus.
    const scrolledFor = useRef(searchKey);

    useEffect(() => {
        if (scrolledFor.current === searchKey) {
            return;
        }

        scrolledFor.current = searchKey;

        if (searchKey) {
            marquee.surfaceRef.current?.parentElement?.scrollTo({ top: 0 });
        } else if (focusId !== null) {
            pendingScroll.current = { id: focusId, focus: false };
        }
    }, [searchKey, focusId, marquee.surfaceRef]);

    // Waits for the refreshed listing, which arrives after the entry was created or renamed. The
    // entry takes the focus too while the view has it, or is to take it.
    const revealIndex = revealId === undefined ? -1 : (indexById.get(revealId) ?? -1);

    useEffect(() => {
        if (revealId === undefined || revealIndex < 0) {
            return;
        }

        replace({ ids: new Set([revealId]), anchor: revealId });
        setFocus({ id: revealId, index: revealIndex });
        const focused = pendingFocus.current || focusWithin.current;

        pendingScroll.current = { id: revealId, focus: focused };
        pendingFocus.current = false;
        onRevealed(focused);
    }, [revealId, revealIndex, replace, onRevealed]);

    // A selection set from outside, which the consumer's `selectedIds` (other than what the view
    // asked them for) or `defaultSelectedIds` makes, is revealed: the first of its entries the view
    // lists takes the focus there, and is scrolled to, once the whole folder has come.
    const [revealSelected, setRevealSelected] = useState(() => selection.ids.size > 0);
    const [passedIds, setPassedIds] = useState(controlledIds);

    if (controlledIds !== passedIds) {
        setPassedIds(controlledIds);

        if (controlledIds && controlledIds.size > 0 && !sameIds(controlledIds, requestedIds)) {
            setRevealSelected(true);
        }
    }

    useEffect(() => {
        if (!revealSelected || !listingSettled) {
            return;
        }

        const [first] = selected;
        const index = first ? (indexById.get(first.id) ?? -1) : -1;

        setRevealSelected(false);

        if (index >= 0) {
            setFocus({ id: first.id, index });
            pendingScroll.current = { id: first.id, focus: pendingFocus.current || focusWithin.current };
            pendingFocus.current = false;
        }
    }, [revealSelected, listingSettled, selected, indexById]);

    // Ids the folder doesn't list drop out of the selection, such as entries deleted or moved away,
    // once all of the folder has come, so a selection passed in isn't cut short by a listing still
    // coming, or by the listing saved from before while it's checked again. Hidden entries are
    // listed, so they stay selected while they're hidden.
    const listedIds = useMemo(
        () =>
            state?.status === "ready" && !state.checking && state.entries
                ? new Set(state.entries.map((entry) => entry.id))
                : undefined,
        [state],
    );

    useEffect(() => {
        if (listedIds) {
            retain(listedIds);
        }
    }, [listedIds, selectedIds, retain]);

    // The file manager hears the selection as it is, whatever changed it, and passes on what changed.
    useEffect(() => {
        reportSelection(selectedIds, selected);
    }, [reportSelection, selectedIds, selected]);

    // An entry to reveal that is hidden is never listed, so it's given up on, and so is one the
    // whole folder has come without, such as one asked for from outside that isn't there, once
    // it's been checked again.
    const revealLost = useMemo(() => {
        if (revealId === undefined || !state?.entries) {
            return false;
        }

        const entry = state.entries.find((candidate) => candidate.id === revealId);

        return entry ? !showHidden && isHidden(entry) : state.status === "ready" && !state.checking;
    }, [revealId, showHidden, state]);

    useEffect(() => {
        if (revealLost) {
            onRevealed(false);
        }
    }, [revealLost, onRevealed]);

    // One a folder search leaves out, the only other reason a listed entry isn't shown, is waited
    // for while the search is ended, rather than given up on.
    const revealUnmatched = revealId !== undefined && revealIndex < 0 && !revealLost && !!foldedNames?.has(revealId);

    useEffect(() => {
        if (revealUnmatched) {
            onRevealUnmatched();
        }
    }, [revealUnmatched, onRevealUnmatched]);

    // Scrolls to the entry asked for, focusing it if asked to, once it's rendered, which it is once
    // it has the view's focus, and once the entries are in their places. An entry that's gone from
    // the listing is given up on.
    useEffect(() => {
        const surface = marquee.surfaceRef.current;
        const request = pendingScroll.current;

        if (!surface || !request || !settled()) {
            return;
        }

        const element = entryElement(surface, request.id);

        if (element || !indexById.has(request.id)) {
            pendingScroll.current = null;

            if (request.focus) {
                element?.focus({ preventScroll: true });
            }

            element?.scrollIntoView({ block: "nearest" });
        }
    });

    // Gives the focus to the focused entry, or to the view while it lists nothing, when the view is
    // to take it, or when the focused entry was removed, once the entries are in their places.
    // While the folder loads, the view holds it.
    useEffect(() => {
        const surface = marquee.surfaceRef.current;

        if (!surface || !settled() || (!pendingFocus.current && !(focusWithin.current && focusLost()))) {
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
        const index = id === undefined ? undefined : indexById.get(id);

        return index === undefined ? undefined : entries?.[index];
    };

    // A drag carries the selection when it starts on a selected entry, or else selects the entry and
    // carries it alone, as the context menu does.
    const handleDragStart = (event: DragEvent) => {
        drag?.start(event, () => {
            const entry = entryAt(event);

            if (!entry) {
                return null;
            }

            setGrabbedId(entry.id);

            if (selectedIds.has(entry.id)) {
                return { section, trail, entries: selected, grabbed: entry };
            }

            select(entry.id);

            return { section, trail, entries: [entry], grabbed: entry };
        });
    };

    // Dragged entries already listed here came from this folder, or are its folders dragged from the
    // sidebar, so its empty space doesn't take them and a drag that ends where it began does nothing.
    // That goes for those hidden or left out by a search too.
    const listsDragged = useMemo(
        () => !!state?.entries?.some((entry) => draggedIds.has(entry.id)),
        [state?.entries, draggedIds],
    );

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

    // Opens a folder here, and a file as the file manager says, with the view's order for the
    // preview to step through. Returns false when nothing can open the file.
    const handleOpen = useCallback(
        (entry: FileEntry) => {
            if (entry.kind === "folder") {
                onNavigate({ sectionId: section.id, trail: [...trail, { id: entry.id, name: entry.name }] });

                return true;
            }

            return onOpenFile({ target: "selection", section, trail, entries: [entry], listing: entries });
        },
        [onNavigate, onOpenFile, section, trail, entries],
    );

    // In selection mode every tap toggles. Outside it, a touch tap opens the entry, as double-click
    // does with a mouse, and selects a file nothing can open, as a click does.
    const handleSelect = useCallback(
        (id: string, modifiers: SelectModifiers) => {
            if (selecting) {
                select(id, { toggle: true, range: modifiers.range });

                return;
            }

            const entry = pointerType.current === "mouse" ? undefined : entries?.find((item) => item.id === id);

            if (!entry || !handleOpen(entry)) {
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
                listing: entries,
            });
        },
        [selectedIds, selected, select, onOpenMenu, section, trail, entries],
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
    // Files pasted from the system clipboard go into the open folder, where Ctrl+V pastes.
    const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => onPasteFiles(event, section, trail);

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
            ? [{ target: "selection", section, trail, entries: selected, listing: entries }, folderRequest]
            : [folderRequest];
        // A space typed in the middle of a name is part of it, not a shortcut.
        const typingSpace = event.key === " " && isTypingKey(event) && typeAhead.typing();

        if (!typingSpace && onShortcut(event, requests)) {
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
        } else if (toggle && !event.altKey && !event.shiftKey && pressesKey(event, "a")) {
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
        const index = id === undefined ? -1 : (indexById.get(id) ?? -1);

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

    /**
     * Focuses an entry and scrolls it into view, below the sticky column header. It may be far from
     * what's rendered, so that's done once it is, as the focused entry always is.
     */
    const focusEntry = (id: string, index: number) => {
        setFocus({ id, index });
        pendingScroll.current = { id, focus: true };
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
     * - Enter and Alt+Down open the focused entry; Backspace and Alt+Up go up to the folder above.
     * - Typing finds the next entry whose name starts with what was typed.
     */
    const handleViewKey = (event: KeyboardEvent<HTMLDivElement>, onEntry: boolean) => {
        const toggle = event.ctrlKey || event.metaKey;
        const index = focusId === null ? -1 : (indexById.get(focusId) ?? -1);
        const current = index >= 0 ? entries?.[index] : undefined;

        if (event.altKey) {
            if (toggle || event.shiftKey) {
                return false;
            }

            if (event.key === "ArrowUp") {
                goUp();

                return true;
            }

            if (event.key === "ArrowDown" && current) {
                return handleOpen(current);
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
            return handleOpen(current);
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
        const element = entryElement(surface, current.id);
        const step = stepIndex(event.key, index, entries.length, {
            columns: lines.columns,
            horizontal: view === "grid",
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
                locale.sameLetters,
            );

            if (match >= 0) {
                moveFocus(match, NO_MODIFIERS);
            }

            return true;
        }

        return false;
    };

    const handleSelectionMenu = (button: HTMLElement) => {
        onOpenMenu(belowElement(button), { target: "selection", section, trail, entries: selected, listing: entries });
    };

    const handleBackgroundMenu = (event: MouseEvent) => {
        clear();

        if (onOpenMenu(pointerPosition(event), { target: "folder", section, trail, entries: [] })) {
            event.preventDefault();
        }
    };

    const ContentView = view === "list" ? FileList : FileGrid;
    // Until something shows, a folder still coming in page by page waits with the spinner, so
    // neither "Folder is empty" nor "No results found" shows before all of it has come.
    const shownSoFar = entries?.length || !state?.partial ? entries : undefined;
    let content: ReactNode;

    if (entries?.length) {
        content = (
            <ContentView
                entries={entries}
                lines={lines}
                label={folder.name}
                focusId={focusId}
                selectedIds={selectedIds}
                cutIds={cutIds}
                adapter={adapter}
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
    } else if (shownSoFar && searching) {
        content = (
            <Box id={stateId} sx={stateSx}>
                <Icon name="search" sx={stateIconSx} />
                <Typography sx={stateTitleSx}>{text.searchNoResults}</Typography>
                <Typography variant="body2">{text.searchNoResultsHint}</Typography>
            </Box>
        );
    } else if (shownSoFar) {
        content = (
            <Box id={stateId} sx={stateSx}>
                <Icon name="folderOpen" sx={stateIconSx} />
                <Typography sx={stateTitleSx}>{text.folderEmpty}</Typography>
            </Box>
        );
    } else if (state?.status === "error") {
        content = (
            <Box id={stateId} sx={stateSx} role="alert">
                <Icon name="info" sx={stateIconSx} />
                <Typography sx={stateTitleSx}>{text.folderOpenFailed}</Typography>
                {state.error instanceof Error && (
                    <Typography variant="body2">
                        <bdi>{state.error.message}</bdi>
                    </Typography>
                )}
                <Button
                    size="small"
                    variant="outlined"
                    onClick={(event) => {
                        event.stopPropagation();
                        reload();
                    }}
                >
                    {text.tryAgain}
                </Button>
            </Box>
        );
    } else {
        content = (
            <Box id={stateId} sx={stateSx}>
                <CircularProgress size={28} aria-label={text.loading} />
            </Box>
        );
    }

    // Screen readers hear how many entries are selected as it changes, e.g. with Shift+arrows or Ctrl+A,
    // and how many a folder search finds, from the field, once all of the folder has come.
    const status = selected.length > 0 ? text.selectedCount(selected.length) : "";
    const results = searching && entries && !state?.partial ? text.searchResultCount(entries.length) : "";

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
            onPaste={handlePaste}
            onDragStart={handleDragStart}
            {...drop.handlers}
        >
            {(busy || state?.status === "loading") && shownSoFar && (
                <LinearProgress sx={progressSx} aria-label={text.loading} />
            )}
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
            <Box sx={visuallyHiddenSx} role="status">
                {results}
            </Box>
        </Box>
    );
};

export default FolderView;
