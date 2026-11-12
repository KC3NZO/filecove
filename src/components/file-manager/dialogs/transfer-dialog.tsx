import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, ReactNode } from "react";

import { DirectionContext } from "../../../contexts/direction-context";
import { useData, useFolder } from "../../../hooks/use-folder";
import { useFound } from "../../../hooks/use-found";
import { useLocale } from "../../../hooks/use-locale";
import { useMovingIds } from "../../../hooks/use-moving-ids";
import { useTypeAhead } from "../../../hooks/use-type-ahead";
import { useVirtualLines } from "../../../hooks/use-virtual-lines";
import { fmClasses } from "../../../styles/classes";
import marks from "../../../styles/entry.module.css";
import { isolate } from "../../../utils/bidi";
import { cx } from "../../../utils/cx";
import { groupedEntries } from "../../../utils/groups";
import { isHidden } from "../../../utils/hidden";
import { isTypingKey, matchName, pageRows, stepIndex } from "../../../utils/keyboard";
import { folderLeft, folderOf } from "../../../utils/navigation";
import {
    folderWritable,
    heldBy,
    heldText,
    lockedFolder,
    pickerHeldText,
    replaceable,
} from "../../../utils/permissions";
import { nameOrder } from "../../../utils/sort";
import { entryClashes, mergedFolders } from "../../../utils/transfer";
import TooltipIconButton from "../../buttons/tooltip-icon-button";
import { FolderTypeIcon } from "../../icons/file-icon";
import Icon from "../../icons/icon";
import Button from "../../ui/button";
import ButtonBase from "../../ui/button-base";
import CircularProgress from "../../ui/circular-progress";
import Dialog, { DialogActions, DialogContent, DialogTitle } from "../../ui/dialog";
import Text from "../../ui/text";
import PathBar from "../header-bar/path-bar";
import IconSlot from "../../icons/icon-slot";
import LockedIcon from "../../icons/locked-icon";
import FindLayer, { DrawnName } from "../find-layer";
import { ConflictChoices, ConflictMessage } from "./conflict-step";
import NameDialog from "./name-dialog";
import styles from "./transfer-dialog.module.css";

import type {
    Clash,
    ClipboardPart,
    ConflictPolicy,
    EntryClash,
    FileAdapter,
    FileEntry,
    FileManagerLocation,
    FolderRef,
    MovingKind,
    OpenMenu,
    Section,
} from "../../../types";
import type { NameDialogState, NameRequest } from "./name-dialog";

export interface TransferRequest {
    kind: "copy" | "move";
    /** The section the picker starts in. */
    section: Section;
    /** Trail to the folder the picker starts in: the entries', or the nearest holding them all. */
    trail: FolderRef[];
    /**
     * The entries by the folder they're in, each with the adapter serving it: one, or several for a
     * search's results, of one section or more.
     */
    groups: ClipboardPart[];
    /**
     * Sections the entries can go into, of their own adapter or another, which copies them across,
     * that take entries from each of theirs, `section` among them.
     */
    destinations: Section[];
}

export interface TransferDialogState {
    /** False while the dialog plays its closing transition; the rest is kept so it doesn't empty mid-fade. */
    open: boolean;
    /** Counts requests, so each one starts afresh. */
    id: number;
    request: TransferRequest;
}

interface TransferDialogProps {
    open: boolean;
    request: TransferRequest;
    /** Whether hidden folders are listed with the rest. */
    showHidden: boolean;
    onClose: () => void;
    /**
     * Called whenever the picker's New folder button may have changed folders, with their ids, to
     * list them again wherever they're shown.
     */
    onChanged: (adapter: FileAdapter, folderIds: string[]) => void;
    /**
     * Called once a destination is chosen and there's nothing left to ask, with the choice that
     * settles names it already has, the entries to skip, which clash, and after a "replace", the
     * ids of the folders entries are merged into, which may change all the way down. The adapter
     * then copies or moves them in the background.
     */
    onStart: (
        request: TransferRequest,
        destination: FileManagerLocation,
        conflict: ConflictPolicy,
        skipped: FileEntry[],
        mergedIds: string[],
    ) => void;
    /**
     * Called with a folder made with the picker's New folder button, as the adapter returned it,
     * and what made it: its section, adapter and the trail to the folder it was made in.
     */
    onFolderCreated: (request: NameRequest, entry: FileEntry) => void;
}

/** A row of the folder list: a section, on the list of sections, or a folder. */
interface PickerItem {
    id: string;
    name: string;
    /** The section the row opens, on the list of sections. */
    section?: Section;
    /**
     * One of the entries being copied or moved, or a folder a move under way is moving, or the
     * trash's work holds, which can't be opened.
     */
    disabled?: boolean;
    /** A folder nothing can be put in, shown with a lock, which can be gone through but not chosen. */
    locked?: boolean;
    /** What holds a folder, a move under way or the trash's work, which it says. */
    moving?: MovingKind;
}

const NO_MENU: OpenMenu = () => false;

const NO_CLASHES: Clash[] = [];

// Long names are cut short, since every row must be as tall for the list to place them.

// One column of rows, which never runs right to left, for `stepIndex`.
const ROWS = { columns: 1, horizontal: false, rtl: false };

const isFolder = (entry: FileEntry) => entry.kind === "folder";

/**
 * Asks where to copy or move entries, then has the adapter do it. It browses folders only, across
 * the sections that can take them, served by their adapter or another, which they're copied into
 * across, starting in the entries' own folder, or for a search's results from several, the nearest
 * holding them all. The entries themselves can't be opened, so a folder can never go into itself,
 * and a folder that can't change (`folderWritable`) can be gone through but not chosen. Names the
 * destination already has are settled in a second step: replace or merge, keep both, or skip. Then
 * it closes, and the copy or move runs in the background, shown in the transfer panel.
 *
 * The list of folders is one stop in the tab order, focused once the dialog has faded in. The
 * arrows, Home, End, PageUp and PageDown move between the rows that can be opened, and typing
 * finds one by name; Enter or Space opens the focused folder, and Backspace or Alt+Up goes up, as
 * the Back button does. Opening a folder or going up from the list keeps the focus in it, on the
 * first row, or going up on the folder left through. Only the rows in or near view are rendered,
 * and the focused one, so a folder of thousands of folders opens as fast as a small one.
 *
 * When the adapter can create folders, the New folder button asks for a name over the picker, and
 * the new folder is opened, as the destination it was made to be. Going back up lands on it.
 */
const TransferDialog = ({
    open,
    request,
    showHidden,
    onClose,
    onChanged,
    onStart,
    onFolderCreated,
}: TransferDialogProps) => {
    const { kind, section, trail, groups, destinations } = request;
    const { store, adapter: defaultAdapter } = useData();
    const entries = useMemo(() => groupedEntries(groups), [groups]);
    const locale = useLocale();
    const { text } = locale;
    const dir = useContext(DirectionContext);

    // Null on the list of sections, which is only reachable with more than one.
    const [place, setPlace] = useState<FileManagerLocation | null>({ sectionId: section.id, trail });
    const [conflicts, setConflicts] = useState<EntryClash[] | null>(null);
    const clashes = useMemo(() => conflicts?.map(({ clash }) => clash) ?? NO_CLASHES, [conflicts]);

    const target = destinations.find((candidate) => candidate.id === place?.sectionId) ?? section;
    // The folders shown, and those made, are this adapter's, which may not be the entries'.
    const adapter: FileAdapter = target.adapter ?? defaultAdapter;
    const targetFolder = folderOf(target, place?.trail ?? []);
    const { state } = useFolder(target, targetFolder.id, place !== null, true);

    const folders = useMemo(
        () =>
            state?.entries
                ?.filter((entry) => isFolder(entry) && (showHidden || !isHidden(entry)))
                .sort(nameOrder(locale)),
        [state?.entries, showHidden, locale],
    );
    // Ids only mean something to their own adapter, so only entries the target's adapter serves can
    // be among its folders.
    const pickedIds = useMemo(
        () =>
            new Set(
                groups
                    .filter((group) => group.adapter === adapter)
                    .flatMap((group) => group.entries.map((entry) => entry.id)),
            ),
        [groups, adapter],
    );
    // Folders moves under way are moving, which take nothing in meanwhile, by the target's adapter.
    const movingIds = useMovingIds(target);
    // All of the folder has come, not just some of its pages, so its names can be checked for clashes.
    const listed = !!state?.entries && !state.partial;
    const failed = state?.status === "error";
    // Read as the folder's listing comes, which may bring its own permissions. A folder being moved,
    // or moved to the trash, says so rather than that it's read-only.
    const moving = place === null ? undefined : heldBy(target, place.trail, undefined, movingIds);
    const readOnly = place !== null && !folderWritable(store, target, place.trail, movingIds);

    // Ids are unique within an adapter, so the same folder is the same id whichever section shows it.
    // Entries already in the folder clash with themselves: a copy keeps both, and a move leaves them,
    // so there's nothing to move when they all are. Another adapter's are never there.
    const elsewhere = (group: ClipboardPart) =>
        group.adapter !== adapter || folderOf(group.section, group.trail).id !== targetFolder.id;
    const incoming = place === null ? entries : groupedEntries(groups.filter(elsewhere));
    const allThere = place !== null && incoming.length === 0;
    const title = (kind === "copy" ? text.copyToTitle : text.moveToTitle)(entries.length, isolate(entries[0].name));

    const typeAhead = useTypeAhead();
    const listRef = useRef<HTMLUListElement | null>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const stateId = useId();
    const readOnlyId = useId();
    // The row with the list's Tab stop, which the arrow keys move from.
    const [focusId, setFocusId] = useState<string | null>(null);
    // Set while the list is to take the focus once it has rows to focus.
    const pendingFocus = useRef(false);
    // Set while the row with the Tab stop is to be scrolled to, focused or not.
    const pendingScroll = useRef(false);
    // The New folder button's name dialog, over the picker.
    const [naming, setNaming] = useState<NameDialogState | null>(null);

    // What the list shows, in display order: the sections, or the folders, the entries themselves
    // among them.
    const choosingSection = place === null;
    const items = useMemo<PickerItem[]>(
        () =>
            choosingSection
                ? destinations.map((candidate) => ({ id: candidate.id, name: candidate.label, section: candidate }))
                : (folders ?? []).map((folder) => ({
                      id: folder.id,
                      name: folder.name,
                      disabled: pickedIds.has(folder.id) || movingIds.has(folder.id),
                      locked: lockedFolder(folder),
                      moving: movingIds.get(folder.id),
                  })),
        [choosingSection, destinations, folders, pickedIds, movingIds],
    );

    // The rows that can be opened. The row last focused has the Tab stop, or else the first.
    const rows = useMemo(() => items.filter((item) => !item.disabled), [items]);
    const tabStop = rows.find((row) => row.id === focusId)?.id ?? rows[0]?.id ?? null;
    const loaded = place === null || listed || failed;
    const listLabel = place ? text.pickerFolders(isolate(targetFolder.name)) : text.pickerLocations;

    // The row with the Tab stop stays rendered wherever the list is scrolled, so it keeps the focus.
    const { lines, settled, reveal } = useVirtualLines(items.length, [items.findIndex((item) => item.id === tabStop)]);
    const linesRef = lines.ref;
    // Every row's name, for the browser's find in page, as only some are rendered, and the row it
    // last came to, highlighted for a moment.
    const names = useMemo(() => items.map((item) => item.name), [items]);
    const { foundId, markFound } = useFound();

    const listElement = useCallback(
        (element: HTMLUListElement | null) => {
            listRef.current = element;
            linesRef(element);
        },
        [linesRef],
    );

    // Gives the focus to the row with the Tab stop, or only scrolls to it, read from the page so it
    // works from the transition's callback too, once the rows are in their places. While the
    // folder loads, the box in the list's place holds the focus.
    const settleFocus = useCallback(() => {
        const body = listRef.current ?? frameRef.current;

        if (!(pendingFocus.current || pendingScroll.current) || !body || !settled()) {
            return;
        }

        const row = body.querySelector<HTMLElement>('[data-row-id][tabindex="0"]');

        if (pendingFocus.current) {
            (row ?? body).focus({ preventScroll: true });
        }

        if (row) {
            reveal(Number(row.dataset.index), row);
        }

        if (row || body.getAttribute("aria-busy") !== "true") {
            pendingFocus.current = false;
            pendingScroll.current = false;
        }
    }, [settled, reveal]);

    useEffect(() => settleFocus());

    // The list takes the focus once the dialog has faded in, so the arrows work straight away. The
    // context menu hands the focus back to where it was opened from as it closes, which would win
    // over anything sooner.
    const handleEntered = () => {
        pendingFocus.current = true;
        settleFocus();
    };

    // Opening a folder from the list, or going up from it, takes the focused row away, so the list
    // takes the focus again. Going up, the folder left through gets the Tab stop and is scrolled
    // to, as in the content, by whichever route.
    const go = (next: FileManagerLocation | null) => {
        const active = document.activeElement;
        const left = place && next ? folderLeft(place, next) : undefined;

        if (listRef.current?.contains(active) || frameRef.current?.contains(active)) {
            pendingFocus.current = true;
        }

        const stop = left?.id ?? (next === null ? (place?.sectionId ?? null) : null);

        pendingScroll.current = stop !== null;
        setFocusId(stop);
        setPlace(next);
    };

    // The listing is complete first, so the name starts unused and clashes are caught as it's typed.
    const canCreate = !!adapter.createFolder && !!place && listed && !readOnly;

    const askName = () => {
        if (place && canCreate) {
            const nameRequest: NameRequest = { kind: "create", section: target, adapter, trail: place.trail };

            setNaming((prev) => ({ open: true, id: (prev?.id ?? 0) + 1, request: nameRequest }));
        }
    };

    const closeNaming = () => setNaming((prev) => prev && { ...prev, open: false });

    // The picker's destination is the folder it shows, so a folder made in it is opened, ready for
    // "Copy here" or "Move here", and the list takes the focus. Going back up lands on it, scrolled
    // to, as the folder left through (`folderLeft`). Its id leaves the cache first, so the listing
    // about to load for it isn't dropped with any stale one.
    const handleCreated = (nameRequest: NameRequest, entry: FileEntry) => {
        closeNaming();
        onFolderCreated(nameRequest, entry);

        if (place) {
            pendingFocus.current = true;
            go({ ...place, trail: [...place.trail, { id: entry.id, name: entry.name }] });
        }
    };

    // Up to the folder above, or from a section's root to the list of sections when there are several.
    const canGoUp = !!place && (place.trail.length > 0 || destinations.length > 1);

    const goUp = () => {
        if (!place || !canGoUp) {
            return;
        }

        go(place.trail.length > 0 ? { ...place, trail: place.trail.slice(0, -1) } : null);
    };

    const handleListFocus = (event: FocusEvent) => {
        const id = event.target instanceof HTMLElement ? event.target.dataset.rowId : undefined;

        if (id !== undefined && id !== focusId) {
            setFocusId(id);
        }
    };

    // Enter and Space are left to the rows, which open as a click does.
    const handleListKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.ctrlKey || event.metaKey) {
            return;
        }

        if (
            (event.key === "Backspace" && !event.altKey && !event.shiftKey) ||
            (event.key === "ArrowUp" && event.altKey && !event.shiftKey)
        ) {
            event.preventDefault();
            goUp();

            return;
        }

        if (event.altKey) {
            return;
        }

        const row = event.target instanceof HTMLElement && event.target.dataset.rowId ? event.target : null;
        const index = row ? rows.findIndex((item) => item.id === row.dataset.rowId) : -1;
        const page = row && scrollerRef.current ? pageRows(scrollerRef.current, row) : 1;
        let next = stepIndex(event.key, Math.max(index, 0), rows.length, { ...ROWS, page });

        // From the list itself, the arrows bring the focus to the first row.
        if (next !== null && index < 0) {
            next = event.key === "End" ? rows.length - 1 : 0;
        }

        // A space opens the focused row rather than going into a name.
        if (next === null && isTypingKey(event) && event.key !== " ") {
            event.preventDefault();
            next = matchName(
                rows.map((item) => item.name),
                Math.max(index, 0),
                typeAhead.type(event.key),
                locale.sameLetters,
            );
        }

        const nextRow = next === null ? undefined : rows[next];

        if (!nextRow) {
            return;
        }

        const element = listRef.current?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(nextRow.id)}"]`);

        event.preventDefault();

        // A row that isn't rendered yet is, once it has the Tab stop, and is focused then.
        if (element) {
            element.focus({ preventScroll: true });
            reveal(items.indexOf(nextRow), element);
        } else {
            pendingFocus.current = true;
            setFocusId(nextRow.id);
        }
    };

    // The browser's find in page came to a row, in the find layer: one that can be opened takes the
    // list's Tab stop and is scrolled to, and either is highlighted, the focus staying in the
    // browser's find bar.
    const handleFound = (index: number) => {
        const item = items[index];

        if (!item) {
            return;
        }

        if (item.disabled) {
            reveal(index);
        } else {
            pendingScroll.current = true;
            setFocusId(item.id);
        }

        markFound(item.id);
    };

    const openItem = (item: PickerItem) => {
        if (item.section) {
            go({ sectionId: item.section.id, trail: [] });
        } else if (place) {
            go({ ...place, trail: [...place.trail, { id: item.id, name: item.name }] });
        }
    };

    // Whether an entry the destination has can be replaced or merged into, as its permissions say.
    const changes = (entry: FileEntry) => replaceable(store, target, entry);

    // Folders a Replace or Merge merges others into are listed again all the way down once it ends.
    // The picker closes as it starts, so a second click while it fades out starts nothing.
    const run = (conflict: ConflictPolicy) => {
        if (place && open) {
            onStart(
                request,
                place,
                conflict,
                conflict === "skip" ? (conflicts ?? []).map(({ entry }) => entry) : [],
                conflict === "replace" ? mergedFolders(incoming, state?.entries, changes) : [],
            );
        }
    };

    // Copying into the entries' own folder clashes with every one of them, and only makes sense as
    // a duplicate, so it keeps both without asking.
    const confirm = () => {
        const found = entryClashes(incoming, state?.entries, changes);

        if (found.length > 0) {
            setConflicts(found);
        } else {
            run("keepBoth");
        }
    };

    let body: ReactNode;

    if (conflicts) {
        body = (
            <div className={cx(styles.state, fmClasses.state)}>
                <ConflictMessage clashes={clashes} folderName={targetFolder.name} />
            </div>
        );
    } else if (items.length > 0) {
        // Keyed by place, so each folder opens scrolled to the top.
        body = (
            <div key={place ? targetFolder.id : ""} ref={scrollerRef} className={styles.scroller}>
                <FindLayer names={names} onFound={handleFound} />
                <div className={styles.listClip}>
                    <ul
                        ref={listElement}
                        className={styles.list}
                        style={{ height: lines.height }}
                        aria-label={listLabel}
                        tabIndex={tabStop === null ? 0 : -1}
                        onFocus={handleListFocus}
                        onKeyDown={handleListKeyDown}
                    >
                        {lines.indexes.map((index) => {
                            const item = items[index];

                            return (
                                <li
                                    key={item.id}
                                    className={styles.item}
                                    style={{ top: index * lines.pitch - lines.offset }}
                                    // Only some rows are rendered, so each says where it is among all of them.
                                    aria-setsize={items.length}
                                    aria-posinset={index + 1}
                                >
                                    <ButtonBase
                                        className={cx(styles.row, marks.arrived)}
                                        disabled={item.disabled}
                                        tabIndex={item.id === tabStop ? 0 : -1}
                                        aria-description={
                                            item.moving
                                                ? heldText(text, item.moving)
                                                : item.locked
                                                  ? text.folderLocked
                                                  : undefined
                                        }
                                        data-row-id={item.id}
                                        data-index={index}
                                        data-found={item.id === foundId}
                                        onClick={() => openItem(item)}
                                    >
                                        <span className={styles.rowIcon}>
                                            {item.section ? (
                                                <IconSlot icon={item.section.icon ?? "folder"} />
                                            ) : (
                                                <LockedIcon locked={!!item.locked}>
                                                    <FolderTypeIcon folderName={item.name} size="1.25rem" />
                                                </LockedIcon>
                                            )}
                                        </span>
                                        <span className={styles.rowText}>
                                            <DrawnName name={item.name} />
                                        </span>
                                    </ButtonBase>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        );
    } else {
        body = (
            <div
                ref={frameRef}
                className={styles.empty}
                tabIndex={0}
                role="group"
                aria-label={listLabel}
                aria-describedby={stateId}
                aria-busy={!loaded}
                onKeyDown={handleListKeyDown}
            >
                <div id={stateId} className={cx(styles.state, fmClasses.state)}>
                    {listed && <Text variant="body2">{text.noFolders}</Text>}
                    {failed && (
                        <Text variant="body2">
                            {text.folderOpenFailed}
                            {state.error instanceof Error && `: ${isolate(state.error.message)}`}
                        </Text>
                    )}
                    {!loaded && <CircularProgress size={24} aria-label={text.loading} />}
                </div>
            </div>
        );
    }

    return (
        <>
            <Dialog dir={dir} open={open} fullWidth maxWidth="sm" className={fmClasses.transferDialog} onClose={onClose} onEntered={handleEntered}>
                <DialogTitle>{title}</DialogTitle>
                <DialogContent className={styles.content}>
                    {!conflicts && (
                        <div className={styles.toolbar}>
                            <TooltipIconButton size="small" label={text.back} disabled={!canGoUp} onClick={goUp}>
                                <Icon name="arrowBack" fontSize="small" />
                            </TooltipIconButton>
                            <div className={styles.location}>
                                {place ? (
                                    <PathBar
                                        section={target}
                                        trail={place.trail}
                                        hasActions={false}
                                        onNavigate={go}
                                        onOpenMenu={NO_MENU}
                                    />
                                ) : (
                                    <Text variant="body2" className={styles.locationsTitle}>
                                        {text.pickerLocations}
                                    </Text>
                                )}
                            </div>
                            {adapter.createFolder && (
                                <TooltipIconButton
                                    size="small"
                                    label={text.newFolder}
                                    disabled={!canCreate}
                                    onClick={askName}
                                >
                                    <Icon name="newFolder" fontSize="small" />
                                </TooltipIconButton>
                            )}
                        </div>
                    )}
                    {body}
                </DialogContent>
                {conflicts ? (
                    <DialogActions>
                        <Button
                            color="inherit"
                            onClick={() => {
                                // The list comes back in place of this button, so it takes the focus.
                                pendingFocus.current = true;
                                setConflicts(null);
                            }}
                        >
                            {text.back}
                        </Button>
                        <div className={styles.spacer} />
                        <ConflictChoices clashes={clashes} pending={null} onChoose={run} />
                    </DialogActions>
                ) : (
                    <DialogActions>
                        {readOnly && (
                            <Text id={readOnlyId} variant="body2" className={styles.readOnly}>
                                {moving ? pickerHeldText(text, moving) : text.pickerReadOnly}
                            </Text>
                        )}
                        <Button color="inherit" onClick={onClose}>
                            {text.cancel}
                        </Button>
                        {/* The folder's names are checked for clashes, so it can't be chosen before they've
                            all come. */}
                        <Button
                            variant="contained"
                            disabled={!place || !loaded || readOnly || (kind === "move" && allThere)}
                            aria-describedby={readOnly ? readOnlyId : undefined}
                            onClick={confirm}
                        >
                            {kind === "copy" ? text.copyHere : text.moveHere}
                        </Button>
                    </DialogActions>
                )}
            </Dialog>
            {/* Outside the picker's dialog, so its key presses don't bubble through the picker. */}
            {naming && (
                <NameDialog
                    key={naming.id}
                    open={naming.open}
                    request={naming.request}
                    onClose={closeNaming}
                    onChanged={onChanged}
                    onDone={handleCreated}
                />
            )}
        </>
    );
};

export default TransferDialog;
