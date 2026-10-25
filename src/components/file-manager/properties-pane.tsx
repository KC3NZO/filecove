import { useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, FocusEvent, KeyboardEvent, PointerEvent, Ref } from "react";

import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { useForkRef } from "@mui/material/utils";

import { useData } from "../../hooks/use-folder";
import { useLocale } from "../../hooks/use-locale";
import { folderKey } from "../../store/folder-store";
import {
    PROPERTIES_MAX_WIDTH,
    PROPERTIES_MIN_WIDTH,
    PROPERTIES_WIDTH,
    PROPERTIES_WIDTH_STEP,
    rootExtraWide,
} from "../../styles/layout";
import { forcedColors } from "../../styles/mixins";
import { runToolbarShortcut, toolbarGroups } from "../../utils/action-groups";
import { groupByFolder, selectionRequest } from "../../utils/groups";
import { joinIsolated } from "../../utils/bidi";
import { isRtl } from "../../utils/dom";
import { folderOf } from "../../utils/navigation";
import { typesInField } from "../../utils/shortcut";
import PropertiesPanel from "../properties/properties-panel";

import type { PropertiesCache } from "../../store/properties-cache";
import type {
    ActionContext,
    ActionGroup,
    FileEntry,
    FolderRef,
    MenuRequest,
    PropertiesItem,
    PropertiesSubject,
    Section,
    ToolbarGroup,
} from "../../types";

interface PropertiesPaneProps {
    ref?: Ref<HTMLDivElement>;
    subject: PropertiesSubject;
    /** Whether the docked panel shows; has no effect while there's no room to dock it. */
    shown: boolean;
    /** Whether the overlay shows while there's no room to dock; has no effect once it docks. */
    open: boolean;
    /** The docked panel's width, in px, which it's narrower than while the content needs the room. */
    width: number;
    /** The width a double click on the docked panel's edge puts back. */
    defaultWidth: number;
    /** The user resized the docked panel, by its edge, to `width`. */
    onWidthChange: (width: number) => void;
    /** The file manager's count of its changes, which counts what's in folders again. */
    changes: number;
    showHidden: boolean;
    cache: PropertiesCache;
    /** Takes the focus, for one render, e.g. as the context menu's Properties opens it. */
    takeFocus: boolean;
    /** The app's actions for the panel's header (`propertiesActions`). */
    actions: ActionGroup[];
    /**
     * What the context menu's actions get, for the panel's Rename and "Open item location", and
     * the header's actions.
     */
    contextFor: (request: MenuRequest) => ActionContext;
    /** The panel's close button. */
    onClose: () => void;
    /** Escape in the panel. */
    onEscape: () => void;
    /** The focus left the overlay, for `to`. */
    onFocusOut: (to: Node) => void;
    /** It docked, or no longer does, as the space it's in changed size. */
    onDockedChange: (docked: boolean) => void;
}

/** A drag of the docked panel's edge under way. */
interface EdgeDrag {
    pointerId: number;
    /** Where the pointer went down, from the viewport's left. */
    startX: number;
    /** The width shown as it went down. */
    from: number;
    /** The widest it can go, as the content leaves it room. */
    widest: number;
    /** Whether the panel docks on the left, so dragging right widens it. */
    rtl: boolean;
    /** The width it's dragged to so far. */
    width: number;
}

const NO_ITEMS: PropertiesItem[] = [];
const NO_TOOLBAR: ToolbarGroup[] = [];

/** How many made-up entries of folders are kept, for folders no listing holds, such as a section's root. */
const MAX_BARE = 50;

// Collapsed: an overlay over the content from the end side, as the sidebar's comes from the start,
// staying inside the file manager. Docked: an inset panel on the content's end side, as the content
// is one, under the header bar.
const paneSx: SxProps<Theme> = (theme) => ({
    display: "flex",
    flexDirection: "column",
    bgcolor: "background.paper",
    outline: "none",

    position: "absolute",
    zIndex: 2,
    top: 0,
    bottom: 0,
    insetInlineEnd: 0,
    width: `min(${PROPERTIES_WIDTH + 20}px, 85%)`,
    boxShadow: 8,
    "--closed-shift": "100%",
    "&:dir(rtl)": { "--closed-shift": "-100%" },
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

    // Docked, it's as wide as the user made it (`--properties-width`), and narrower, down to its
    // least width, while the content beside it needs the room (its `min-width`).
    [rootExtraWide]: {
        position: "relative",
        zIndex: "auto",
        flexShrink: 1,
        width: `var(--properties-width, ${PROPERTIES_WIDTH}px)`,
        minWidth: PROPERTIES_MIN_WIDTH,
        marginInlineEnd: 0.75,
        mb: 0.75,
        borderRadius: 3,
        boxShadow: "none",
        translate: "none",
        visibility: "visible",
        transition: "none",
        '&[data-shown="false"]': { display: "none" },
    },
});

// Clips the panel to the docked pane's rounded corners, leaving the pane itself unclipped, so its
// edge can reach out over the gap beside it.
const clipSx: SxProps<Theme> = {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    borderRadius: "inherit",
    overflow: "hidden",
};

// The docked panel's edge, which resizes it: a strip over the gap between the content and the
// panel, wider on a touch screen, showing a grip as it's pointed at, held, dragged or focused.
const edgeSx: SxProps<Theme> = {
    position: "absolute",
    zIndex: 1,
    top: 0,
    bottom: 0,
    insetInlineStart: -9,
    width: 12,
    cursor: "col-resize",
    touchAction: "none",
    userSelect: "none",
    outline: "none",
    "@media (hover: none)": { insetInlineStart: -14, width: 22 },
    "&::after": {
        content: '""',
        position: "absolute",
        top: "50%",
        insetInlineStart: "calc(50% - 2px)",
        width: 4,
        height: 48,
        translate: "0 -50%",
        borderRadius: 2,
        bgcolor: "text.disabled",
        opacity: 0,
        transition: "opacity 150ms, height 150ms",
    },
    "&:hover::after": { opacity: 1 },
    '&:focus-visible::after, &[data-dragging="true"]::after': {
        opacity: 1,
        height: 72,
        bgcolor: "primary.main",
    },
    [forcedColors]: {
        "&::after": { backgroundColor: "CanvasText" },
        '&:focus-visible::after, &[data-dragging="true"]::after': { backgroundColor: "Highlight" },
    },
};

/** A width within the docked panel's limits, and no wider than `widest`. */
const fitWidth = (width: number, widest: number) =>
    Math.round(Math.max(PROPERTIES_MIN_WIDTH, Math.min(width, widest, PROPERTIES_MAX_WIDTH)));

/**
 * How wide the docked pane can be: what its row leaves it beside the least width of what else is
 * in it (the content's `min-width`), within its own limits.
 */
const widestOf = (pane: HTMLElement) => {
    const row = pane.parentElement;

    if (!row) {
        return PROPERTIES_MAX_WIDTH;
    }

    const own = getComputedStyle(pane);
    const margins = (parseFloat(own.marginInlineStart) || 0) + (parseFloat(own.marginInlineEnd) || 0);
    const beside = Array.from(row.children)
        .filter((child) => child !== pane)
        .reduce((sum, child) => sum + (parseFloat(getComputedStyle(child).minWidth) || 0), 0);

    return fitWidth(row.clientWidth - margins - beside, PROPERTIES_MAX_WIDTH);
};

/** Where a folder is, as a search's results show it: the section, then the folders below its root. */
const locationOf = (section: Section, trail: FolderRef[]) =>
    joinIsolated([section.label, ...trail.map((folder) => folder.name)], " / ");

/**
 * The properties panel in the file manager: docked beside the content where there's room, and an
 * overlay over it where there isn't, as the sidebar is on the other side. It shows the entries or the
 * folder the file manager says, as they're listed now, so a change made meanwhile shows, and hands
 * the panel the file manager's Rename and "Open item location". The panel is only there while it
 * shows, so nothing is asked of the adapter while it's hidden.
 */
const PropertiesPane = ({
    ref,
    subject,
    shown,
    open,
    width,
    defaultWidth,
    onWidthChange,
    changes,
    showHidden,
    cache,
    takeFocus,
    actions,
    contextFor,
    onClose,
    onEscape,
    onFocusOut,
    onDockedChange,
}: PropertiesPaneProps) => {
    const { store, adapter } = useData();
    const { text } = useLocale();
    const listings = useSyncExternalStore(store.subscribe, store.version);
    const paneRef = useRef<HTMLDivElement>(null);
    const forkedRef = useForkRef(paneRef, ref);
    // Whether it docks, as container queries decide, read from its style whenever the space it's in
    // changes size.
    const [docked, setDocked] = useState(false);
    // Entries made up for folders no listing holds, such as a section's root, kept so the same
    // folder is the same object, by which what the adapter hands over is kept.
    const bare = useRef(new Map<string, FileEntry>());
    const visible = docked ? shown : open;
    const onDockedChangeRef = useRef(onDockedChange);
    const paneId = useId();
    const edgeRef = useRef<HTMLDivElement>(null);
    const drag = useRef<EdgeDrag | null>(null);
    // The widest the docked panel can be beside the content, read as the space it's in changes size.
    const [widest, setWidest] = useState(PROPERTIES_MAX_WIDTH);
    // The width asked for, within the panel's limits, and the width shown, narrower while the
    // content needs the room, which CSS works out from the content's `min-width` as well.
    const asked = fitWidth(width, PROPERTIES_MAX_WIDTH);
    const shownWidth = fitWidth(width, widest);
    const askedRef = useRef(asked);
    const shownWidthRef = useRef(shownWidth);
    const edgeShown = docked && shown;

    useLayoutEffect(() => {
        onDockedChangeRef.current = onDockedChange;
        askedRef.current = asked;
        shownWidthRef.current = shownWidth;
    });

    // Shows the docked panel at `width` while its edge is dragged, without rendering anything.
    const showWidth = (width: number) => {
        paneRef.current?.style.setProperty("--properties-width", `${width}px`);
        edgeRef.current?.setAttribute("aria-valuenow", String(width));
    };

    // Ends a drag of the edge: the width it was dragged to is asked for, and until a controlled
    // width comes back with it, or if it never does, the width given shows again.
    const endDrag = (commit: boolean) => {
        const current = drag.current;

        if (!current) {
            return;
        }

        drag.current = null;

        const edge = edgeRef.current;

        if (edge) {
            delete edge.dataset.dragging;

            if (edge.hasPointerCapture(current.pointerId)) {
                edge.releasePointerCapture(current.pointerId);
            }
        }

        paneRef.current?.style.setProperty("--properties-width", `${askedRef.current}px`);
        edge?.setAttribute("aria-valuenow", String(shownWidthRef.current));

        if (commit && current.width !== Math.round(current.from)) {
            onWidthChange(current.width);
        }
    };

    // The edge going while it's dragged, as the panel hides or stops docking, calls the drag off.
    useLayoutEffect(() => {
        if (!edgeShown) {
            endDrag(false);
        }
    });

    useLayoutEffect(() => {
        const pane = paneRef.current;
        const space = pane?.parentElement;

        if (!pane || !space) {
            return;
        }

        let wasDocked: boolean | undefined;

        const check = () => {
            const nowDocked = getComputedStyle(pane).position !== "absolute";

            setDocked(nowDocked);
            setWidest(widestOf(pane));

            if (wasDocked !== undefined && nowDocked !== wasDocked) {
                onDockedChangeRef.current(nowDocked);
            }

            wasDocked = nowDocked;
        };
        const observer = new ResizeObserver(check);

        check();
        observer.observe(space);

        return () => observer.disconnect();
    }, []);

    const items = useMemo(() => {
        if (!visible || subject.kind === "none") {
            return NO_ITEMS;
        }

        // An entry as its folder's listing has it now, when it's still there.
        const listed = (section: Section, trail: FolderRef[], id: string) =>
            store.get(folderKey(section.id, folderOf(section, trail).id))?.entries?.find((entry) => entry.id === id);

        // Rename and "Open item location", as the context menu offers them for the one entry.
        const actionsFor = (request: MenuRequest) => {
            const context = contextFor(request);

            return { rename: context.rename, openLocation: context.openLocation };
        };

        if (subject.kind === "folder") {
            const { section, trail } = subject;
            const folder = folderOf(section, trail);
            const parentTrail = trail.slice(0, -1);
            const served = section.adapter ?? adapter;
            const own = store.get(folderKey(section.id, folder.id));
            let entry = trail.length > 0 ? listed(section, parentTrail, folder.id) : undefined;

            // A root, or a folder whose parent isn't listed, is only known by its id and name.
            if (!entry) {
                const key = JSON.stringify([section.id, folder.id, folder.name]);

                entry = bare.current.get(key);

                if (!entry) {
                    entry = { id: folder.id, name: folder.name, kind: "folder" };
                    bare.current.set(key, entry);

                    if (bare.current.size > MAX_BARE) {
                        bare.current.delete(bare.current.keys().next().value ?? "");
                    }
                }
            }

            // A section's root is the consumer's, so it isn't renamed here.
            const actions =
                trail.length > 0
                    ? actionsFor({ target: "selection", section, trail: parentTrail, entries: [entry] })
                    : undefined;

            return [
                {
                    entry,
                    adapter: served,
                    location: trail.length > 0 ? locationOf(section, parentTrail) : undefined,
                    // How many entries it holds, once its own listing has all of them.
                    childCount: own?.status === "ready" && !own.partial ? own.entries?.length : undefined,
                    rename: actions?.rename,
                },
            ];
        }

        return subject.entries.map(({ entry, section, trail }): PropertiesItem => {
            const now = listed(section, trail, entry.id) ?? entry;
            const actions =
                subject.entries.length === 1
                    ? actionsFor({
                          target: "selection",
                          section,
                          trail,
                          entries: [now],
                          inResults: subject.inResults,
                      })
                    : undefined;

            return {
                entry: now,
                adapter: section.adapter ?? adapter,
                location: locationOf(section, trail),
                rename: actions?.rename,
                openLocation: actions?.openLocation,
            };
        });
        // `listings` stands for the listings read through the store.
    }, [visible, subject, store, adapter, contextFor, listings]);

    // The app's actions in the header, for what the panel shows: its entries, by folder when they're
    // in several, as the context menu's are, or else the folder it shows.
    const headerActions = useMemo(() => {
        if (!visible || actions.length === 0 || subject.kind === "none") {
            return NO_TOOLBAR;
        }

        if (subject.kind === "folder") {
            const { section, trail } = subject;

            return toolbarGroups(actions, contextFor({ target: "folder", section, trail, entries: [] }));
        }

        const groups = groupByFolder(
            subject.entries.map(({ section, trail }, index) => ({
                section,
                adapter: section.adapter ?? adapter,
                trail,
                entry: items[index].entry,
            })),
        );

        return toolbarGroups(actions, contextFor({ ...selectionRequest(groups), inResults: subject.inResults }));
    }, [visible, actions, subject, items, adapter, contextFor]);

    // Escape in a menu or a dialog, which portal out of the pane but still bubble here through
    // React's tree, is theirs, and so are their other keys. The header's actions' shortcuts work
    // anywhere in the panel but a field typed in.
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;

        if (event.defaultPrevented || !(event.target instanceof Node && event.currentTarget.contains(event.target))) {
            return;
        }

        if (event.key === "Escape" && plain) {
            event.preventDefault();
            onEscape();
        } else if (!typesInField(event) && runToolbarShortcut(event, headerActions)) {
            event.preventDefault();
        }
    };

    // The edge is dragged with the mouse, a pen or a finger, the panel following the pointer. A press
    // on it doesn't take the focus from where it is.
    const handleEdgePointerDown = (event: PointerEvent<HTMLDivElement>) => {
        const pane = paneRef.current;

        if (!pane || event.button !== 0 || drag.current) {
            return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.dataset.dragging = "true";

        const from = pane.getBoundingClientRect().width;

        drag.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            from,
            widest: widestOf(pane),
            rtl: isRtl(pane),
            width: Math.round(from),
        };
    };

    // The edge is on the panel's start side, so it widens as the pointer goes towards the start.
    const handleEdgePointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const current = drag.current;

        if (!current || current.pointerId !== event.pointerId) {
            return;
        }

        const moved = event.clientX - current.startX;

        current.width = fitWidth(current.from + (current.rtl ? moved : -moved), current.widest);
        showWidth(current.width);
    };

    const handleEdgePointerUp = (event: PointerEvent<HTMLDivElement>) => {
        if (drag.current?.pointerId === event.pointerId) {
            endDrag(true);
        }
    };

    // A drag the browser takes over, as for a gesture of its own, is called off.
    const handleEdgePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
        if (drag.current?.pointerId === event.pointerId) {
            endDrag(false);
        }
    };

    // The arrow keys move the edge the way they point, a step at a time, and Home and End make the
    // panel as narrow and as wide as it goes. Escape calls a drag off, and otherwise goes back to the
    // content, as anywhere in the panel.
    const handleEdgeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const pane = paneRef.current;

        if (event.key === "Escape" && drag.current) {
            event.preventDefault();
            endDrag(false);

            return;
        }

        if (!pane || drag.current || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
            return;
        }

        const most = widestOf(pane);
        const now = fitWidth(width, most);
        const towardsStart = isRtl(pane) ? "ArrowRight" : "ArrowLeft";
        const towardsEnd = isRtl(pane) ? "ArrowLeft" : "ArrowRight";
        let next: number;

        if (event.key === towardsStart) {
            next = now + PROPERTIES_WIDTH_STEP;
        } else if (event.key === towardsEnd) {
            next = now - PROPERTIES_WIDTH_STEP;
        } else if (event.key === "Home") {
            next = PROPERTIES_MIN_WIDTH;
        } else if (event.key === "End") {
            next = most;
        } else {
            return;
        }

        event.preventDefault();
        next = fitWidth(next, most);

        if (next !== now) {
            onWidthChange(next);
        }
    };

    // A double click puts the width back to where it started.
    const handleEdgeDoubleClick = () => onWidthChange(fitWidth(defaultWidth, PROPERTIES_MAX_WIDTH));

    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
        const to = event.relatedTarget;

        if (!docked && open && to instanceof Node && !event.currentTarget.contains(to)) {
            onFocusOut(to);
        }
    };

    return (
        <Box
            ref={forkedRef}
            id={paneId}
            sx={paneSx}
            style={{ "--properties-width": `${asked}px` } as CSSProperties}
            data-open={open}
            data-shown={shown}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
        >
            {edgeShown && (
                <Box
                    ref={edgeRef}
                    role="separator"
                    tabIndex={0}
                    aria-orientation="vertical"
                    aria-label={text.resizeProperties}
                    aria-controls={paneId}
                    aria-valuenow={shownWidth}
                    aria-valuemin={PROPERTIES_MIN_WIDTH}
                    aria-valuemax={widest}
                    sx={edgeSx}
                    onPointerDown={handleEdgePointerDown}
                    onPointerMove={handleEdgePointerMove}
                    onPointerUp={handleEdgePointerUp}
                    onPointerCancel={handleEdgePointerCancel}
                    onLostPointerCapture={handleEdgePointerCancel}
                    onKeyDown={handleEdgeKeyDown}
                    onDoubleClick={handleEdgeDoubleClick}
                />
            )}
            {visible && (
                <Box sx={clipSx}>
                    <PropertiesPanel
                        items={items}
                        changes={changes}
                        showHidden={showHidden}
                        cache={cache}
                        takeFocus={takeFocus}
                        actions={headerActions}
                        onClose={onClose}
                    />
                </Box>
            )}
        </Box>
    );
};

export default PropertiesPane;
