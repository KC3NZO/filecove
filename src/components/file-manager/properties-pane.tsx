import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { FocusEvent, KeyboardEvent, Ref } from "react";

import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { useForkRef } from "@mui/material/utils";

import { useData } from "../../hooks/use-folder";
import { folderKey } from "../../store/folder-store";
import { PROPERTIES_WIDTH, rootExtraWide } from "../../styles/layout";
import { runToolbarShortcut, toolbarGroups } from "../../utils/action-groups";
import { joinIsolated } from "../../utils/bidi";
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

    [rootExtraWide]: {
        position: "relative",
        zIndex: "auto",
        flexShrink: 0,
        width: PROPERTIES_WIDTH,
        marginInlineEnd: 0.75,
        mb: 0.75,
        borderRadius: 3,
        overflow: "hidden",
        boxShadow: "none",
        translate: "none",
        visibility: "visible",
        transition: "none",
        '&[data-shown="false"]': { display: "none" },
    },
});

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

    useLayoutEffect(() => {
        onDockedChangeRef.current = onDockedChange;
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

    // The app's actions in the header, for what the panel shows: its entries, which must share a
    // folder, as the context menu's do, or else the folder it shows.
    const headerActions = useMemo(() => {
        if (!visible || actions.length === 0 || subject.kind === "none") {
            return NO_TOOLBAR;
        }

        if (subject.kind === "folder") {
            const { section, trail } = subject;

            return toolbarGroups(actions, contextFor({ target: "folder", section, trail, entries: [] }));
        }

        const [first] = subject.entries;
        const folderId = folderOf(first.section, first.trail).id;
        const together = subject.entries.every(
            ({ section, trail }) => section === first.section && folderOf(section, trail).id === folderId,
        );

        return together
            ? toolbarGroups(
                  actions,
                  contextFor({
                      target: "selection",
                      section: first.section,
                      trail: first.trail,
                      entries: items.map((item) => item.entry),
                      inResults: subject.inResults,
                  }),
              )
            : NO_TOOLBAR;
    }, [visible, actions, subject, items, contextFor]);

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

    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
        const to = event.relatedTarget;

        if (!docked && open && to instanceof Node && !event.currentTarget.contains(to)) {
            onFocusOut(to);
        }
    };

    return (
        <Box
            ref={forkedRef}
            sx={paneSx}
            data-open={open}
            data-shown={shown}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
        >
            {visible && (
                <PropertiesPanel
                    items={items}
                    changes={changes}
                    showHidden={showHidden}
                    cache={cache}
                    takeFocus={takeFocus}
                    actions={headerActions}
                    onClose={onClose}
                />
            )}
        </Box>
    );
};

export default PropertiesPane;
