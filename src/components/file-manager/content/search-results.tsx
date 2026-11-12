import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { DragEvent, FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";

import { CutContext } from "../../../contexts/cut-context";
import { DragContext } from "../../../contexts/drag-context";
import { MovingContext } from "../../../contexts/moving-context";
import { useDropTarget } from "../../../hooks/use-drop-target";
import { useFound } from "../../../hooks/use-found";
import { useLocale } from "../../../hooks/use-locale";
import { useLongPress } from "../../../hooks/use-long-press";
import { useMarquee } from "../../../hooks/use-marquee";
import { useSearch } from "../../../hooks/use-search";
import { useSelection } from "../../../hooks/use-selection";
import { useTypeAhead } from "../../../hooks/use-type-ahead";
import { useVirtualLines } from "../../../hooks/use-virtual-lines";
import { fmClasses } from "../../../styles/classes";
import { cx } from "../../../utils/cx";
import util from "../../../styles/util.module.css";
import { isolate, joinIsolated } from "../../../utils/bidi";
import { focusLost, isRtl } from "../../../utils/dom";
import { groupByFolder, selectionRequest } from "../../../utils/groups";
import { isHidden } from "../../../utils/hidden";
import { isMenuKey, isTypingKey, matchName, pageRows, stepIndex } from "../../../utils/keyboard";
import { belowElement, pressPosition } from "../../../utils/menu-position";
import { folderOf } from "../../../utils/navigation";
import { heldBy } from "../../../utils/permissions";
import { EMPTY_SELECTION, NO_MODIFIERS, marqueeSelection, selectModifiers } from "../../../utils/selection";
import { pressesKey } from "../../../utils/shortcut";
import { relevanceOf, resultKey, searchTerms } from "../../../utils/search";
import { entryComparator } from "../../../utils/sort";
import { canCarry, movingThrough } from "../../../utils/transfer";
import Icon from "../../icons/icon";
import Button from "../../ui/button";
import CircularProgress from "../../ui/circular-progress";
import LinearProgress from "../../ui/linear-progress";
import Text from "../../ui/text";
import FindLayer from "../find-layer";
import FileGrid from "./file-grid";
import FileList from "./file-list";
import styles from "./search-results.module.css";
import SearchTabs, { tabId } from "./search-tabs";

import type {
    AdapterIds,
    DropTarget,
    EntryOrigin,
    EntrySelection,
    FileEntry,
    FileManagerLocation,
    MenuPosition,
    MenuRequest,
    OpenMenu,
    RunShortcut,
    SearchHit,
    SearchTarget,
    SelectModifiers,
    SortOrder,
    ViewMode,
} from "../../../types";
import type { ResultTab } from "./search-tabs";

interface SearchResultsProps {
    /** The sections searched, with their adapters, in the sidebar's order. */
    targets: readonly SearchTarget[];
    /** What's typed, trimmed; never empty. */
    query: string;
    /** Changes whenever the file manager changes something, which searches again. */
    version: number;
    /** How long the typing has to stop for before the sections are searched, in ms; `useSearch`'s when omitted. */
    delay?: number;
    view: ViewMode;
    /** How far the view is zoomed, in steps from the size it starts at. */
    zoom: number;
    sort: SortOrder;
    showHidden: boolean;
    hasActions: boolean;
    /** Takes the focus, or as soon as there's something to focus, as `FolderView`'s does. */
    takeFocus: boolean;
    onSortChange: (sort: SortOrder) => void;
    onNavigate: (place: FileManagerLocation) => void;
    /** Opens a file as the file manager says. Returns false when nothing can open it. */
    onOpenFile: (request: MenuRequest) => boolean;
    onOpenMenu: OpenMenu;
    onShortcut: RunShortcut;
    /** Told the selected results as they change, which the properties show. */
    onSelectionChange: (hits: SearchHit[]) => void;
}

/** Where the view's focus is among the results: the result's key, and where it was listed. */
interface ResultFocus {
    id: string;
    index: number;
}

/** A result to scroll to once it's rendered, and whether to focus it too. */
interface ScrollRequest {
    id: string;
    focus: boolean;
}

const NO_HITS: SearchHit[] = [];

/** The result an event happened on, by its `data-entry-id`, which is the result's key. */
const keyAt = (target: EventTarget) =>
    target instanceof Element ? target.closest<HTMLElement>("[data-entry-id]")?.dataset.entryId : undefined;

const resultElement = (surface: HTMLElement, key: string) =>
    surface.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(key)}"]`);

/** The key of the folder a result is in, to tell whether results share one. */
const folderOfHit = (hit: SearchHit) => resultKey(hit.section.id, folderOf(hit.section, hit.trail).id);

/**
 * A search everywhere's results, in the content panel in place of the open folder: every section's
 * together, sorted as a folder is, with where each is in a Location column, and, with several
 * sections searched, a tab for each above them. Results are selected as entries are, and acted on
 * together, by the folder each is in when they're in several (`MenuRequest.groups`), of one
 * section or more.
 */
const SearchResults = ({
    targets,
    query,
    version,
    delay,
    view,
    zoom,
    sort,
    showHidden,
    hasActions,
    takeFocus,
    onSortChange,
    onNavigate,
    onOpenFile,
    onOpenMenu,
    onShortcut,
    onSelectionChange,
}: SearchResultsProps) => {
    const { searches, retry } = useSearch(targets, query, showHidden, version, delay);
    const cut = useContext(CutContext);
    const drag = useContext(DragContext);
    const moving = useContext(MovingContext);
    const locale = useLocale();
    const { text } = locale;
    const idPrefix = useId();
    const panelId = useId();
    const stateId = useId();

    // The open tab: a section's id, or null for every section's. A section no longer searched
    // leaves its tab, and every section's shows.
    const [tab, setTab] = useState<string | null>(null);
    const tabbed = targets.length > 1;
    const tabTarget = tabbed && tab !== null ? targets.find((target) => target.section.id === tab) : undefined;

    if (tab !== null && !tabTarget) {
        setTab(null);
    }

    const shownTargets = useMemo(() => (tabTarget ? [tabTarget] : targets), [tabTarget, targets]);

    // Sorted as a folder is, or by relevance (folders among the files, the adapter's score when it
    // gives one, else how the name answers the words, ties by name), hidden entries left out while
    // they don't show, by what the adapter says of the entry itself; what's in a hidden folder is
    // the adapter's to leave out.
    const hits = useMemo(() => {
        const found = shownTargets.flatMap((target) => searches.get(target.section.id)?.matches ?? NO_HITS);
        const listed = showHidden ? found : found.filter((hit) => !isHidden(hit.entry));

        if (sort.key === "relevance") {
            const terms = searchTerms(query, locale.foldLetters);
            const scored = listed.map((hit) => ({
                hit,
                score: hit.score ?? relevanceOf(locale.foldLetters(hit.entry.name), terms),
            }));

            return scored
                .sort((a, b) => b.score - a.score || locale.compareNames(a.hit.entry.name, b.hit.entry.name))
                .map(({ hit }) => hit);
        }

        // Ordered by location, as the column shows it, with the section first even inside its tab.
        const places = new Map(
            listed.map((hit) => [hit.entry, [hit.section.label, ...hit.trail.map(({ name }) => name)].join(" / ")]),
        );
        const compare = entryComparator(sort, locale, (entry) => places.get(entry) ?? "");

        return listed.sort((a, b) => compare(a.entry, b.entry));
    }, [shownTargets, searches, showHidden, sort, query, locale]);

    // The views go by the results' keys, since entries of different sections may share ids, and
    // show each result's own entry, adapter and location from `origins`. Inside a section's tab,
    // the location leaves the section out.
    const entries = useMemo(() => hits.map((hit) => ({ ...hit.entry, id: hit.key })), [hits]);
    // Every result's name, for the browser's find in page, as only some are rendered.
    const names = useMemo(() => hits.map((hit) => hit.entry.name), [hits]);

    const origins = useMemo(
        () =>
            hits.map((hit): EntryOrigin => {
                const folders = hit.trail.map((folder) => folder.name);
                const parts = tabTarget && folders.length > 0 ? folders : [hit.section.label, ...folders];

                return { entry: hit.entry, adapter: hit.adapter, location: joinIsolated(parts, " / ") };
            }),
        [hits, tabTarget],
    );

    const hitByKey = useMemo(() => new Map(hits.map((hit) => [hit.key, hit] as const)), [hits]);
    const indexByKey = useMemo(() => new Map(hits.map((hit, index) => [hit.key, index] as const)), [hits]);

    // Cut and dragged entries are marked by their adapter and id, as the views mark them by key.
    const marked = useCallback(
        (by: AdapterIds | null | undefined) =>
            new Set(by ? hits.filter((hit) => by.get(hit.adapter)?.has(hit.entry.id)).map((hit) => hit.key) : []),
        [hits],
    );
    const cutKeys = useMemo(() => marked(cut), [marked, cut]);
    const draggedKeys = useMemo(() => marked(drag?.dragged), [marked, drag?.dragged]);
    // Results being moved, or moved to the trash, themselves or with a folder they're in, with what
    // holds each.
    const movingKeys = useMemo(
        () =>
            new Map(
                hits.flatMap((hit) => {
                    const kind = heldBy(hit.section, hit.trail, hit.entry, movingThrough(moving, hit.adapter));

                    return kind ? [[hit.key, kind] as const] : [];
                }),
            ),
        [hits, moving],
    );
    const draggable = targets.some((target) => canCarry(target.adapter));

    const { selection, selectedIds, selected, select, replace, selectAll, clear } = useSelection(entries);
    const selectedHits = useMemo(
        () => selected.flatMap((entry) => hitByKey.get(entry.id) ?? []),
        [selected, hitByKey],
    );

    useEffect(() => {
        onSelectionChange(selectedHits);
    }, [onSelectionChange, selectedHits]);

    const typeAhead = useTypeAhead();

    // A menu, a shortcut or the preview acts on results of one folder, there, with that folder's
    // results to step through, or on those of several, by folder. An entry found in two sections
    // sharing an adapter is acted on once.
    const requestFor = useCallback(
        (acted: SearchHit[]): MenuRequest => {
            const groups = groupByFolder(acted);

            if (groups.length > 1) {
                return { ...selectionRequest(groups), inResults: true };
            }

            const [{ section, trail, entries: own }] = groups;
            const folder = folderOfHit(acted[0]);

            return {
                target: "selection",
                section,
                trail,
                entries: own,
                listing: hits.filter((hit) => folderOfHit(hit) === folder).map((hit) => hit.entry),
                inResults: true,
            };
        },
        [hits],
    );

    // The result with the view's Tab stop, as in the folder view.
    const [focus, setFocus] = useState<ResultFocus | null>(null);
    const focusIndex = focus ? (indexByKey.get(focus.id) ?? -1) : -1;

    if (focus && focusIndex >= 0 && focusIndex !== focus.index) {
        setFocus({ id: focus.id, index: focusIndex });
    }

    // Another search, or another tab, starts the results over, at the first of them and the top.
    const shownFor = JSON.stringify([query, tabTarget?.section.id ?? null]);
    const [focusedFor, setFocusedFor] = useState(shownFor);

    if (focusedFor !== shownFor) {
        setFocusedFor(shownFor);
        setFocus(null);
    }

    let focusId: string | null = null;

    if (entries.length > 0) {
        if (focus && focusIndex >= 0) {
            focusId = focus.id;
        } else if (focus) {
            focusId = entries[Math.min(focus.index, entries.length - 1)].id;
        } else {
            focusId = selected[0]?.id ?? entries[0].id;
        }
    }

    const [grabbedId, setGrabbedId] = useState<string | null>(null);

    const { lines, indexesIn, settled, reveal, drift } = useVirtualLines(entries.length, [
        focusId === null ? -1 : (indexByKey.get(focusId) ?? -1),
        grabbedId !== null && draggedKeys.has(grabbedId) ? (indexByKey.get(grabbedId) ?? -1) : -1,
    ]);

    const focusWithin = useRef(false);
    const pendingFocus = useRef(false);
    const pendingScroll = useRef<ScrollRequest | null>(null);
    const pointerType = useRef("mouse");
    const { foundId, markFound } = useFound();

    const marqueeBase = useRef<EntrySelection>(EMPTY_SELECTION);
    const marquee = useMarquee({
        enabled: entries.length > 0,
        entriesIn: (box) => indexesIn(box).map((index) => entries[index].id),
        drift,
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

    const scrolledFor = useRef(shownFor);

    useEffect(() => {
        if (scrolledFor.current !== shownFor) {
            scrolledFor.current = shownFor;
            marquee.surfaceRef.current?.parentElement?.scrollTo({ top: 0 });
        }
    }, [shownFor, marquee.surfaceRef]);

    // Zooming with the focus in the results keeps the focused one in view, as in a folder.
    const zoomedFrom = useRef(zoom);

    useEffect(() => {
        if (zoomedFrom.current === zoom) {
            return;
        }

        zoomedFrom.current = zoom;

        if (focusWithin.current && focusId !== null) {
            pendingScroll.current = { id: focusId, focus: false };
        }
    }, [zoom, focusId]);

    // Scrolls to the result asked for once it's rendered and the results are in their places.
    useEffect(() => {
        const surface = marquee.surfaceRef.current;
        const request = pendingScroll.current;

        if (!surface || !request || !settled()) {
            return;
        }

        const element = resultElement(surface, request.id);
        const index = indexByKey.get(request.id);

        if (element || index === undefined) {
            pendingScroll.current = null;

            if (request.focus) {
                element?.focus({ preventScroll: true });
            }

            if (index !== undefined) {
                reveal(index, element);
            }
        }
    });

    // Gives the focus to the focused result, or to the view while it lists none, when it's to take
    // it, or when the focused result went, as the folder view does.
    useEffect(() => {
        const surface = marquee.surfaceRef.current;

        if (!surface || !settled() || (!pendingFocus.current && !(focusWithin.current && focusLost()))) {
            return;
        }

        const element = focusId === null ? null : resultElement(surface, focusId);
        const index = focusId === null ? undefined : indexByKey.get(focusId);

        pendingFocus.current = false;
        (element ?? surface).focus({ preventScroll: true });

        if (element && index !== undefined) {
            reveal(index, element);
        }
    });

    const hitAt = (event: DragEvent) => {
        const key = keyAt(event.target);

        return key === undefined ? undefined : hitByKey.get(key);
    };

    // A drag carries the selection, by folder, when it starts on a selected result; otherwise the
    // result is selected and dragged alone.
    const handleDragStart = (event: DragEvent) => {
        drag?.start(event, () => {
            const hit = hitAt(event);

            if (!hit) {
                return null;
            }

            setGrabbedId(hit.key);

            const carried = selectedIds.has(hit.key) ? selectedHits : [hit];

            if (carried.length === 1) {
                select(hit.key);
            }

            return { parts: groupByFolder(carried), grabbed: hit.entry };
        });
    };

    // Folders among the results take drops, by the same rules as pasting. Their empty space takes
    // none, since the results are no folder. A drag resting on a folder opens it, as opening one does,
    // ending the search, but for one of those dragged, and goes on there.
    const drop = useDropTarget({
        targetsAt: (event) => {
            const hit = hitAt(event);

            if (hit?.entry.kind !== "folder") {
                return [];
            }

            const target: DropTarget = {
                key: hit.key,
                section: hit.section,
                trail: [...hit.trail, { id: hit.entry.id, name: hit.entry.name }],
            };

            return [target];
        },
        onHold: (key) => {
            const hit = hitByKey.get(key);

            if (hit?.entry.kind === "folder" && !draggedKeys.has(key)) {
                onNavigate({
                    sectionId: hit.section.id,
                    trail: [...hit.trail, { id: hit.entry.id, name: hit.entry.name }],
                });
            }
        },
    });

    // Opens a folder, which ends the search, and a file as the file manager says, stepping through
    // the results of its folder. Returns false when nothing can open the file.
    const handleOpen = useCallback(
        (entry: FileEntry) => {
            const hit = hitByKey.get(entry.id);

            if (!hit) {
                return false;
            }

            if (hit.entry.kind === "folder") {
                onNavigate({
                    sectionId: hit.section.id,
                    trail: [...hit.trail, { id: hit.entry.id, name: hit.entry.name }],
                });

                return true;
            }

            return onOpenFile(requestFor([hit]));
        },
        [hitByKey, onNavigate, onOpenFile, requestFor],
    );

    // A touch tap opens, as in a folder outside selection mode, which results don't have.
    const handleSelect = useCallback(
        (id: string, modifiers: SelectModifiers) => {
            const entry = pointerType.current === "mouse" ? undefined : entries.find((item) => item.id === id);

            if (!entry || !handleOpen(entry)) {
                select(id, modifiers);
            }
        },
        [entries, handleOpen, select],
    );

    // The menu of a selected result acts on the whole selection. Any other result is selected alone
    // first.
    const handleEntryMenu = useCallback(
        (position: MenuPosition, entry: FileEntry) => {
            const hit = hitByKey.get(entry.id);

            if (!hit) {
                return false;
            }

            const whole = selectedIds.has(entry.id);

            if (!whole) {
                select(entry.id);
            }

            return onOpenMenu(position, requestFor(whole ? selectedHits : [hit]));
        },
        [hitByKey, selectedIds, selectedHits, select, onOpenMenu, requestFor],
    );

    // Results have no selection mode, so a long-press opens the result's menu once the finger
    // lifts, as a right-click would. The finger moving on instead drags it, or the selection it's
    // in, as a mouse drag does.
    const longPress = useLongPress({
        onLongPress: (key, press) => {
            const hit = hitByKey.get(key);
            const entry = entries.find((item) => item.id === key);

            if (!hit || !entry) {
                return;
            }

            const position = pressPosition(press);
            const carried = selectedIds.has(key) ? selectedHits : [hit];
            const pick = () => {
                setGrabbedId(key);

                if (carried.length === 1) {
                    select(key);
                }

                return { parts: groupByFolder(carried), grabbed: hit.entry };
            };
            drag?.touch(press, canCarry(hit.adapter) ? pick : null, () => handleEntryMenu(position, entry));
        },
    });

    const handleBackgroundClick = (event: MouseEvent) => {
        const { toggle, range } = selectModifiers(event);

        if (!toggle && !range) {
            clear();
        }
    };

    const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
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

    const focusResult = (id: string, index: number) => {
        setFocus({ id, index });
        pendingScroll.current = { id, focus: true };
    };

    const moveFocus = (index: number, { toggle, range }: SelectModifiers) => {
        const entry = entries[index];

        if (!entry) {
            return;
        }

        if (range) {
            select(entry.id, { toggle, range: true }, focusId ?? entry.id);
        } else if (!toggle) {
            select(entry.id);
        }

        focusResult(entry.id, index);
    };

    // Shortcuts run for the selection; results have no folder of their own
    // for the rest. Then the view's keys, as in a folder, but for going up, which leads nowhere.
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const key = keyAt(event.target);
        const own = event.target === event.currentTarget || key !== undefined;

        if (!own && (event.key === "Enter" || event.key === " ")) {
            return;
        }

        if (own && isMenuKey(event)) {
            const surface = event.currentTarget;
            const entry = key === undefined ? undefined : entries.find((item) => item.id === key);
            const element = entry && resultElement(surface, entry.id);

            event.preventDefault();

            if (entry && element) {
                handleEntryMenu(belowElement(element.querySelector("[data-menu-button]") ?? element), entry);
            }

            return;
        }

        const typingSpace = event.key === " " && isTypingKey(event) && typeAhead.typing();

        if (!typingSpace && selectedHits.length > 0 && onShortcut(event, [requestFor(selectedHits)])) {
            event.preventDefault();

            return;
        }

        const toggle = event.ctrlKey || event.metaKey;
        let handled = false;

        if (event.key === "Escape" && selected.length > 0) {
            clear();
            handled = true;
        } else if (toggle && !event.altKey && !event.shiftKey && pressesKey(event, "a")) {
            selectAll();
            handled = true;
        } else if (own) {
            handled = handleViewKey(event, key !== undefined);
        }

        if (handled) {
            event.preventDefault();
        }
    };

    // As the folder view's: the arrows, Home, End, PageUp and PageDown move, Space selects, Enter and
    // Alt+Down open, and typing finds a result by name.
    const handleViewKey = (event: KeyboardEvent<HTMLDivElement>, onEntry: boolean) => {
        const toggle = event.ctrlKey || event.metaKey;
        const index = focusId === null ? -1 : (indexByKey.get(focusId) ?? -1);
        const current = index >= 0 ? entries[index] : undefined;

        if (!current) {
            return false;
        }

        if (event.altKey) {
            return !toggle && !event.shiftKey && event.key === "ArrowDown" && handleOpen(current);
        }

        if (event.key === "Enter" && !toggle && !event.shiftKey) {
            return handleOpen(current);
        }

        if (event.key === " " && !(isTypingKey(event) && typeAhead.typing())) {
            if (event.shiftKey) {
                select(current.id, { toggle, range: true }, current.id);
            } else {
                select(current.id, { toggle: true, range: false });
            }

            return true;
        }

        const surface = event.currentTarget;
        const element = resultElement(surface, current.id);
        const step = stepIndex(event.key, index, entries.length, {
            columns: lines.columns,
            horizontal: view === "grid",
            page: element && surface.parentElement ? pageRows(surface.parentElement, element) : 1,
            rtl: isRtl(surface),
        });

        if (step !== null) {
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

    const handleFocus = (event: FocusEvent) => {
        const key = keyAt(event.target);
        const index = key === undefined ? -1 : (indexByKey.get(key) ?? -1);

        focusWithin.current = true;

        if (key !== undefined && index >= 0 && (focus?.id !== key || focus.index !== index)) {
            setFocus({ id: key, index });
        }
    };

    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
            focusWithin.current = false;
            pendingFocus.current = false;
        }
    };

    // The tabs: every section's results, then each section's, with how its search stands.
    const tabs = useMemo((): ResultTab[] => {
        if (!tabbed) {
            return [];
        }

        const states = targets.map((target) => searches.get(target.section.id));
        const counted = (matches: SearchHit[]) =>
            showHidden ? matches.length : matches.filter((hit) => !isHidden(hit.entry)).length;

        return [
            {
                id: null,
                label: text.searchAll,
                status: states.some((state) => !state || state.status === "searching") ? "searching" : "ready",
                count: states.reduce((sum, state) => sum + counted(state?.matches ?? NO_HITS), 0),
            },
            ...targets.map((target, index): ResultTab => {
                const state = states[index];

                return {
                    id: target.section.id,
                    label: target.section.label,
                    status: state?.status ?? "searching",
                    count: counted(state?.matches ?? NO_HITS),
                };
            }),
        ];
    }, [tabbed, targets, searches, showHidden, text.searchAll]);

    const shownStates = shownTargets.map((target) => searches.get(target.section.id));
    const searching = shownStates.some((state) => !state || state.status === "searching");
    const failed = shownTargets.filter((target) => searches.get(target.section.id)?.status === "error");

    // The browser's find in page came to a result, in the find layer, as in a folder.
    const handleFound = (index: number) => {
        const entry = entries[index];

        if (entry) {
            setFocus({ id: entry.id, index });
            pendingScroll.current = { id: entry.id, focus: false };
            markFound(entry.id);
        }
    };

    const ContentView = view === "list" ? FileList : FileGrid;
    const listed = entries.length > 0;
    let content: ReactNode;

    if (listed) {
        content = (
            <ContentView
                entries={entries}
                origins={origins}
                lines={lines}
                zoom={zoom}
                label={tabTarget?.section.label ?? text.searchResults}
                focusId={focusId}
                selectedIds={selectedIds}
                cutIds={cutKeys}
                movingIds={movingKeys}
                foundId={foundId}
                adapter={undefined}
                draggable={draggable}
                draggedIds={draggedKeys}
                dropTargetId={drop.dropKey}
                hasActions={hasActions}
                sort={sort}
                onSelect={handleSelect}
                onOpen={handleOpen}
                onMenu={handleEntryMenu}
                onSortChange={onSortChange}
            />
        );
    } else if (searching) {
        content = (
            <div id={stateId} className={cx(styles.state, fmClasses.state)}>
                <CircularProgress size={28} aria-label={text.loading} />
            </div>
        );
    } else if (failed.length > 0) {
        // One section that failed says so, with the adapter's message; several, or some among
        // others that found nothing, are summed up.
        const [only] = failed;
        const error = failed.length === 1 ? searches.get(only.section.id)?.error : undefined;

        content = (
            <div id={stateId} className={cx(styles.state, fmClasses.state)} role="alert">
                <Icon name="info" className={styles.stateIcon} />
                <Text className={styles.stateTitle}>
                    {failed.length === 1 && shownTargets.length === 1
                        ? text.searchFailed(isolate(only.section.label))
                        : text.searchSomeFailed}
                </Text>
                {error instanceof Error && (
                    <Text variant="body2">
                        <bdi>{error.message}</bdi>
                    </Text>
                )}
                <Button
                    size="small"
                    variant="outlined"
                    onClick={(event) => {
                        event.stopPropagation();
                        retry(failed.map((target) => target.section.id));
                    }}
                >
                    {text.tryAgain}
                </Button>
            </div>
        );
    } else {
        content = (
            <div id={stateId} className={cx(styles.state, fmClasses.state)}>
                <Icon name="search" className={styles.stateIcon} />
                <Text className={styles.stateTitle}>{text.searchNoResults}</Text>
                <Text variant="body2">{text.searchNoResultsHint}</Text>
            </div>
        );
    }

    const status = selected.length > 0 ? text.selectedCount(selected.length) : "";
    const results = searching ? "" : text.searchResultCount(entries.length);
    const openTab = tabs.findIndex((candidate) => candidate.id === (tabTarget?.section.id ?? null));

    return (
        <>
            {tabbed && (
                <SearchTabs
                    tabs={tabs}
                    value={tabTarget?.section.id ?? null}
                    idPrefix={idPrefix}
                    panelId={panelId}
                    onChange={setTab}
                />
            )}
            <div
                id={panelId}
                className={styles.scroll}
                role={tabbed ? "tabpanel" : undefined}
                aria-labelledby={tabbed ? tabId(idPrefix, Math.max(openTab, 0)) : undefined}
            >
                <div
                    ref={marquee.surfaceRef}
                    className={styles.surface}
                    tabIndex={listed ? -1 : 0}
                    role={listed ? undefined : "group"}
                    aria-label={listed ? undefined : text.searchResults}
                    aria-describedby={listed ? undefined : stateId}
                    onPointerDownCapture={(event) => {
                        pointerType.current = event.pointerType;
                    }}
                    onPointerDown={handlePointerDown}
                    onClickCapture={handleClickCapture}
                    onClick={handleBackgroundClick}
                    onContextMenuCapture={handleContextMenuCapture}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    onDragStart={handleDragStart}
                    {...drop.handlers}
                >
                    {listed && <FindLayer names={names} onFound={handleFound} />}
                    {searching && listed && <LinearProgress className={styles.progress} aria-label={text.loading} />}
                    {content}
                    <div ref={marquee.marqueeRef} className={cx(styles.marquee, fmClasses.marquee)} />
                    <div className={util.visuallyHidden} role="status">
                        {status}
                    </div>
                    <div className={util.visuallyHidden} role="status">
                        {results}
                    </div>
                </div>
            </div>
        </>
    );
};

export default SearchResults;
