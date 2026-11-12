import { useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, FocusEvent, KeyboardEvent, Ref } from "react";

import { useData } from "../../hooks/use-folder";
import { useForkRef } from "../../hooks/use-fork-ref";
import { useLocale } from "../../hooks/use-locale";
import { folderKey } from "../../store/folder-store";
import { PROPERTIES_MAX_WIDTH, PROPERTIES_MIN_WIDTH, RESIZE_STEP } from "../../styles/layout";
import { runToolbarShortcut, toolbarGroups } from "../../utils/action-groups";
import { groupByFolder, selectionRequest } from "../../utils/groups";
import { joinIsolated } from "../../utils/bidi";
import { folderOf } from "../../utils/navigation";
import { clampWidth } from "../../utils/resize";
import { sectionLocked } from "../../utils/sections";
import { typesInField } from "../../utils/shortcut";
import { inTrashRoot } from "../../utils/trash";
import PropertiesPanel from "../properties/properties-panel";
import styles from "./properties-pane.module.css";
import ResizeEdge from "./resize-edge";

import type { PropertiesCache } from "../../store/properties-cache";
import type {
    ActionContext,
    ActionGroup,
    FileAdapter,
    FileEntry,
    FolderRef,
    MenuRequest,
    PropertiesItem,
    PropertiesSubject,
    Section,
    ToolbarGroup,
    TrashInfo,
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
     * What the context menu's actions get, for the panel's Rename, "Open item location" and "Open
     * original location", and the header's actions.
     */
    contextFor: (request: MenuRequest) => ActionContext;
    /** Where an entry in `trash`'s root was moved there from, written out. */
    locateTrashed: (trash: Section, info: TrashInfo) => string;
    /** Lists folders again, in every section the adapter serves, once an entry's properties are saved. */
    relist: (adapter: FileAdapter, folderIds: string[]) => void;
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

/**
 * How wide the docked pane can be made: what its row leaves it beside the least width of what else
 * is in it (the content's `min-width`), within its own limits. The sidebar is outside the row, so
 * its width is already out of it.
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

    return clampWidth(row.clientWidth - margins - beside, PROPERTIES_MIN_WIDTH, PROPERTIES_MAX_WIDTH);
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
    locateTrashed,
    relist,
    onClose,
    onEscape,
    onFocusOut,
    onDockedChange,
}: PropertiesPaneProps) => {
    const { store, adapter } = useData();
    const { text } = useLocale();
    const listings = useSyncExternalStore(store.subscribe, store.version, store.version);
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
    const asked = clampWidth(width, PROPERTIES_MIN_WIDTH, PROPERTIES_MAX_WIDTH);
    const edgeShown = docked && shown;

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

        // Rename, "Open item location" and "Open original location", as the context menu offers
        // them for the one entry, and whether its fields can be edited: not where its folder can't
        // change, nor while a move is moving it.
        const actionsFor = (request: MenuRequest) => {
            const context = contextFor(request);

            return {
                rename: context.rename,
                openLocation: context.openLocation,
                openOrigin: context.openOrigin,
                readOnly: context.readOnly || context.moving,
            };
        };
        // An entry right in a trash's root is shown where it was moved there from.
        const trashedOf = (section: Section, trail: FolderRef[], entry: FileEntry) =>
            inTrashRoot(section, trail) && entry.trashed
                ? { location: locateTrashed(section, entry.trashed), trashedAt: entry.trashed.trashedAt }
                : undefined;

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
                    trashed: trail.length > 0 ? trashedOf(section, parentTrail, entry) : undefined,
                    // How many entries it holds, once its own listing has all of them.
                    childCount: own?.status === "ready" && !own.partial ? own.entries?.length : undefined,
                    rename: actions?.rename,
                    openOrigin: actions?.openOrigin,
                    // A section's root is the consumer's, and changes as its section allows.
                    readOnly: actions?.readOnly ?? sectionLocked(section),
                    // What lists it, as a saved property may change what's listed of it.
                    onUpdated:
                        trail.length > 0 ? () => relist(served, [folderOf(section, parentTrail).id]) : undefined,
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

            const served = section.adapter ?? adapter;

            return {
                entry: now,
                adapter: served,
                location: locationOf(section, trail),
                trashed: trashedOf(section, trail, now),
                rename: actions?.rename,
                openLocation: actions?.openLocation,
                openOrigin: actions?.openOrigin,
                readOnly: actions?.readOnly,
                onUpdated: () => relist(served, [folderOf(section, trail).id]),
            };
        });
        // `listings` stands for the listings read through the store.
    }, [visible, subject, store, adapter, contextFor, locateTrashed, relist, listings]);

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

    const widestPane = () => (paneRef.current ? widestOf(paneRef.current) : PROPERTIES_MAX_WIDTH);

    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
        const to = event.relatedTarget;

        if (!docked && open && to instanceof Node && !event.currentTarget.contains(to)) {
            onFocusOut(to);
        }
    };

    return (
        <div
            ref={forkedRef}
            id={paneId}
            className={styles.pane}
            style={{ "--properties-width": `${asked}px` } as CSSProperties}
            data-open={open}
            data-shown={shown}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
        >
            {edgeShown && (
                <ResizeEdge
                    target={paneRef}
                    label={text.resizeProperties}
                    controls={paneId}
                    placement="start"
                    width={asked}
                    defaultWidth={defaultWidth}
                    min={PROPERTIES_MIN_WIDTH}
                    max={PROPERTIES_MAX_WIDTH}
                    step={RESIZE_STEP}
                    cssVar="--properties-width"
                    widest={widestPane}
                    onChange={onWidthChange}
                />
            )}
            {visible && (
                <div className={styles.clip}>
                    <PropertiesPanel
                        items={items}
                        changes={changes}
                        showHidden={showHidden}
                        cache={cache}
                        takeFocus={takeFocus}
                        actions={headerActions}
                        onClose={onClose}
                    />
                </div>
            )}
        </div>
    );
};

export default PropertiesPane;
