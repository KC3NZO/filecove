import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent, ReactNode } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { DirectionContext } from "../../../contexts/direction-context";
import { useFolder } from "../../../hooks/use-folder";
import { useLocale } from "../../../hooks/use-locale";
import { clashingNames, useTransfer } from "../../../hooks/use-transfer";
import { useTypeAhead } from "../../../hooks/use-type-ahead";
import { useVirtualLines } from "../../../hooks/use-virtual-lines";
import { dialogActionsSx } from "../../../styles/direction";
import { dialogPaperSx, focusOutline, focusRing, hoverBackground } from "../../../styles/mixins";
import { isolate } from "../../../utils/bidi";
import { isHidden } from "../../../utils/hidden";
import { isTypingKey, matchName, pageRows, stepIndex } from "../../../utils/keyboard";
import { folderLeft, folderOf } from "../../../utils/navigation";
import { nameOrder } from "../../../utils/sort";
import { FolderTypeIcon } from "../../icons/file-icon";
import Icon from "../../icons/icon";
import PathBar from "../header-bar/path-bar";
import IconSlot from "../icon-slot";
import { ConflictChoices, ConflictMessage } from "./conflict-step";

import type { ConflictPolicy, FileAdapter, FileEntry, FolderRef, OpenMenu, Place, Section } from "../../../types";

export interface TransferRequest {
    kind: "copy" | "move";
    section: Section;
    /** The section's adapter, already known to support the request. */
    adapter: FileAdapter;
    /** Trail to the folder the entries are in. */
    trail: FolderRef[];
    entries: FileEntry[];
    /**
     * Sections served by the same adapter, the only ones whose ids it understands, that take
     * entries from `section`, which is always among them.
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
     * Called whenever the adapter may have changed folders, done, failed or cancelled, with their
     * ids, to list them again wherever they're shown.
     */
    onChanged: (adapter: FileAdapter, folderIds: string[]) => void;
    /** Called once the adapter has copied or moved the entries into `destination`. */
    onDone: (request: TransferRequest, destination: Place) => void;
}

/** A row of the folder list: a section, on the list of sections, or a folder. */
interface PickerItem {
    id: string;
    name: string;
    /** The section the row opens, on the list of sections. */
    section?: Section;
    /** One of the entries being copied or moved, which can't be opened. */
    disabled?: boolean;
}

const NO_MENU: OpenMenu = () => false;

// Long names are cut short, since every row must be as tall for the list to place them.
const TEXT_SLOTS = { primary: { noWrap: true } };

// One column of rows, which never runs right to left, for `stepIndex`.
const ROWS = { columns: 1, horizontal: false, rtl: false };

const contentSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    height: "min(24rem, 60vh)",
};

const toolbarSx: SxProps<Theme> = {
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    minHeight: 34,
};

const locationSx: SxProps<Theme> = {
    flex: 1,
    minWidth: 0,
};

// The bordered box the folders fill, shared by the list and its loading, empty and error states.
// It takes the content panel's surface, as the dialog takes the window's, so it reads as the same view.
const frame = {
    flex: 1,
    minHeight: 0,
    border: 1,
    borderColor: "divider",
    borderRadius: 2,
    bgcolor: "background.paper",
};

const scrollerSx: SxProps<Theme> = {
    ...frame,
    overflowY: "auto",
    py: 0.5,
};

// Only the rows in or near view are rendered, each placed at its line, and the list is as tall as
// all of them (`useVirtualLines`). It's a grid of one track for the hook to read. It only takes the
// focus itself while no row can.
const listSx: SxProps<Theme> = {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    outline: "none",
    "&:focus-visible": focusOutline,
};

// Placed at its line by `top`, set in `style`. MUI aligns a list item's text with `text-align: left`.
const itemSx: SxProps<Theme> = {
    position: "absolute",
    insetInline: 0,
    textAlign: "start",
};

// Holds the focus in place of the list while the folder loads, or when it has no folders.
const emptySx: SxProps<Theme> = {
    ...frame,
    display: "flex",
    outline: "none",
    "&:focus-visible": focusOutline,
};

const rowSx: SxProps<Theme> = (theme) => ({
    mx: 0.5,
    borderRadius: 1.5,
    textAlign: "start",
    "&:hover": { bgcolor: hoverBackground(theme) },
    ...focusRing,
});

const rowIconSx: SxProps<Theme> = {
    minWidth: 36,
};

const stateSx: SxProps<Theme> = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    p: 2,
    textAlign: "center",
    color: "text.secondary",
};

const spacerSx: SxProps<Theme> = {
    flex: 1,
};

const isFolder = (entry: FileEntry) => entry.kind === "folder";

/**
 * Asks where to copy or move entries, then has the adapter do it. It browses folders only, across
 * the sections the adapter serves that take entries from theirs, starting in the entries' own
 * folder. The entries themselves can't be opened, so a folder can never go into itself. Names the
 * destination already has are settled in a second step: replace, keep both, or skip.
 *
 * The list of folders is one stop in the tab order, focused once the dialog has faded in. The
 * arrows, Home, End, PageUp and PageDown move between the rows that can be opened, and typing
 * finds one by name; Enter or Space opens the focused folder, and Backspace or Alt+Up goes up, as
 * the Back button does. Opening a folder or going up from the list keeps the focus in it, on the
 * first row, or going up on the folder left through. Only the rows in or near view are rendered,
 * and the focused one, so a folder of thousands of folders opens as fast as a small one.
 */
const TransferDialog = ({ open, request, showHidden, onClose, onChanged, onDone }: TransferDialogProps) => {
    const { kind, section, adapter, trail, entries, destinations } = request;
    const sourceId = folderOf(section, trail).id;
    const locale = useLocale();
    const { text } = locale;
    const dir = useContext(DirectionContext);

    // Null on the list of sections, which is only reachable with more than one.
    const [place, setPlace] = useState<Place | null>({ sectionId: section.id, trail });
    const [conflicts, setConflicts] = useState<string[] | null>(null);

    const target = destinations.find((candidate) => candidate.id === place?.sectionId) ?? section;
    const targetFolder = folderOf(target, place?.trail ?? []);
    const { state } = useFolder(target, targetFolder.id, place !== null);

    const folders = useMemo(
        () =>
            state?.entries
                ?.filter((entry) => isFolder(entry) && (showHidden || !isHidden(entry)))
                .sort(nameOrder(locale)),
        [state?.entries, showHidden, locale],
    );
    const movingIds = useMemo(() => new Set(entries.map((entry) => entry.id)), [entries]);
    // All of the folder has come, not just some of its pages, so its names can be checked for clashes.
    const listed = !!state?.entries && !state.partial;
    const failed = state?.status === "error";

    // Ids are unique within an adapter, so the same folder is the same id whichever section shows it.
    const sameFolder = place !== null && targetFolder.id === sourceId;
    const title = (kind === "copy" ? text.copyToTitle : text.moveToTitle)(entries.length, isolate(entries[0].name));

    // The adapter can't undo a change it has made, so both folders are listed again however it ended.
    const refresh = () => onChanged(adapter, kind === "move" ? [targetFolder.id, sourceId] : [targetFolder.id]);

    const { pending, failure, run: start, cancel, clearFailure } = useTransfer(request, refresh);

    const typeAhead = useTypeAhead();
    const listRef = useRef<HTMLUListElement | null>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const stateId = useId();
    // The row with the list's Tab stop, which the arrow keys move from.
    const [focusId, setFocusId] = useState<string | null>(null);
    // Set while the list is to take the focus once it has rows to focus.
    const pendingFocus = useRef(false);

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
                      disabled: movingIds.has(folder.id),
                  })),
        [choosingSection, destinations, folders, movingIds],
    );

    // The rows that can be opened. The row last focused has the Tab stop, or else the first.
    const rows = useMemo(() => items.filter((item) => !item.disabled), [items]);
    const tabStop = rows.find((row) => row.id === focusId)?.id ?? rows[0]?.id ?? null;
    const loaded = place === null || listed || failed;
    const listLabel = place ? text.pickerFolders(isolate(targetFolder.name)) : text.pickerLocations;

    // The row with the Tab stop stays rendered wherever the list is scrolled, so it keeps the focus.
    const { lines, settled } = useVirtualLines(items.length, [items.findIndex((item) => item.id === tabStop)]);
    const linesRef = lines.ref;

    const listElement = useCallback(
        (element: HTMLUListElement | null) => {
            listRef.current = element;
            linesRef(element);
        },
        [linesRef],
    );

    // Gives the focus to the row with the Tab stop, read from the page so it works from the
    // transition's callback too, once the rows are in their places. While the folder loads, the
    // box in the list's place holds it.
    const settleFocus = useCallback(() => {
        const body = listRef.current ?? frameRef.current;

        if (!pendingFocus.current || !body || !settled()) {
            return;
        }

        const row = body.querySelector<HTMLElement>('[data-row-id][tabindex="0"]');

        (row ?? body).focus({ preventScroll: true });
        row?.scrollIntoView({ block: "nearest" });

        if (row || body.getAttribute("aria-busy") !== "true") {
            pendingFocus.current = false;
        }
    }, [settled]);

    useEffect(() => settleFocus());

    // The list takes the focus once the dialog has faded in, so the arrows work straight away. The
    // context menu hands the focus back to where it was opened from as it closes, which would win
    // over anything sooner.
    const slotProps = useMemo(
        () => ({
            paper: { sx: dialogPaperSx },
            transition: {
                onEntered: () => {
                    pendingFocus.current = true;
                    settleFocus();
                },
            },
        }),
        [settleFocus],
    );

    // Opening a folder from the list, or going up from it, takes the focused row away, so the list
    // takes the focus again. Going up, the folder left through gets the Tab stop, as in the content.
    const go = (next: Place | null) => {
        if (pending) {
            return;
        }

        const active = document.activeElement;
        const left = place && next ? folderLeft(place, next) : undefined;

        if (listRef.current?.contains(active) || frameRef.current?.contains(active)) {
            pendingFocus.current = true;
        }

        setFocusId(left?.id ?? (next === null ? (place?.sectionId ?? null) : null));
        setPlace(next);
        clearFailure();
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
            element.scrollIntoView({ block: "nearest" });
        } else {
            pendingFocus.current = true;
            setFocusId(nextRow.id);
        }
    };

    const openItem = (item: PickerItem) => {
        if (item.section) {
            go({ sectionId: item.section.id, trail: [] });
        } else if (place) {
            go({ ...place, trail: [...place.trail, { id: item.id, name: item.name }] });
        }
    };

    const run = (conflict: ConflictPolicy) => {
        if (!place) {
            return;
        }

        const destination = place;

        start(targetFolder.id, conflict).then((outcome) => {
            if (outcome === "done") {
                onDone(request, destination);
            } else if (outcome === "failed") {
                setConflicts(null);
            }
        });
    };

    // Copying into the entries' own folder clashes with every one of them, and only makes sense as
    // a duplicate, so it keeps both without asking.
    const confirm = () => {
        const clashes = clashingNames(entries, state?.entries);

        if (clashes.length > 0 && !sameFolder) {
            setConflicts(clashes);
        } else {
            run("keepBoth");
        }
    };

    const close = () => {
        cancel();
        onClose();
    };

    let body: ReactNode;

    if (conflicts) {
        body = (
            <Box sx={stateSx}>
                <ConflictMessage names={conflicts} folderName={targetFolder.name} />
            </Box>
        );
    } else if (items.length > 0) {
        // Keyed by place, so each folder opens scrolled to the top.
        body = (
            <Box key={place ? targetFolder.id : ""} ref={scrollerRef} sx={scrollerSx}>
                <List
                    ref={listElement}
                    dense
                    disablePadding
                    sx={listSx}
                    style={{ height: lines.height }}
                    aria-label={listLabel}
                    tabIndex={tabStop === null ? 0 : -1}
                    onFocus={handleListFocus}
                    onKeyDown={handleListKeyDown}
                >
                    {lines.indexes.map((index) => {
                        const item = items[index];

                        return (
                            <ListItem
                                key={item.id}
                                disablePadding
                                sx={itemSx}
                                style={{ top: index * lines.pitch }}
                                // Only some rows are rendered, so each says where it is among all of them.
                                aria-setsize={items.length}
                                aria-posinset={index + 1}
                            >
                                <ListItemButton
                                    sx={rowSx}
                                    disabled={item.disabled}
                                    tabIndex={item.id === tabStop ? 0 : -1}
                                    data-row-id={item.id}
                                    onClick={() => openItem(item)}
                                >
                                    <ListItemIcon sx={rowIconSx}>
                                        {item.section ? (
                                            <IconSlot icon={item.section.icon ?? "folder"} />
                                        ) : (
                                            <FolderTypeIcon folderName={item.name} size="1.25rem" />
                                        )}
                                    </ListItemIcon>
                                    <ListItemText primary={<bdi>{item.name}</bdi>} slotProps={TEXT_SLOTS} />
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
                </List>
            </Box>
        );
    } else {
        body = (
            <Box
                ref={frameRef}
                sx={emptySx}
                tabIndex={0}
                role="group"
                aria-label={listLabel}
                aria-describedby={stateId}
                aria-busy={!loaded}
                onKeyDown={handleListKeyDown}
            >
                <Box id={stateId} sx={stateSx}>
                    {listed && <Typography variant="body2">{text.noFolders}</Typography>}
                    {failed && (
                        <Typography variant="body2">
                            {text.folderOpenFailed}
                            {state.error instanceof Error && `: ${isolate(state.error.message)}`}
                        </Typography>
                    )}
                    {!loaded && <CircularProgress size={24} aria-label={text.loading} />}
                </Box>
            </Box>
        );
    }

    return (
        <Dialog dir={dir} open={open} fullWidth maxWidth="sm" slotProps={slotProps} onClose={close}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent sx={contentSx}>
                {!conflicts && (
                    <Box sx={toolbarSx}>
                        <IconButton size="small" aria-label={text.back} disabled={!canGoUp} onClick={goUp}>
                            <Icon name="arrowBack" fontSize="small" />
                        </IconButton>
                        <Box sx={locationSx}>
                            {place ? (
                                <PathBar
                                    section={target}
                                    trail={place.trail}
                                    hasActions={false}
                                    onNavigate={go}
                                    onOpenMenu={NO_MENU}
                                />
                            ) : (
                                <Typography variant="body2" fontWeight={600}>
                                    {text.pickerLocations}
                                </Typography>
                            )}
                        </Box>
                    </Box>
                )}
                {body}
                {failure && (
                    <Typography variant="body2" color="error">
                        {failure}
                    </Typography>
                )}
            </DialogContent>
            {conflicts ? (
                <DialogActions sx={dialogActionsSx}>
                    <Button
                        color="inherit"
                        disabled={!!pending}
                        onClick={() => {
                            // The list comes back in place of this button, so it takes the focus.
                            pendingFocus.current = true;
                            setConflicts(null);
                        }}
                    >
                        {text.back}
                    </Button>
                    <Box sx={spacerSx} />
                    <ConflictChoices pending={pending} onChoose={run} />
                </DialogActions>
            ) : (
                <DialogActions sx={dialogActionsSx}>
                    <Button color="inherit" onClick={close}>
                        {text.cancel}
                    </Button>
                    {/* The folder's names are checked for clashes, so it can't be chosen before they've all come. */}
                    <Button
                        variant="contained"
                        disabled={!place || !loaded || (kind === "move" && sameFolder)}
                        loading={!!pending}
                        onClick={confirm}
                    >
                        {kind === "copy" ? text.copyHere : text.moveHere}
                    </Button>
                </DialogActions>
            )}
        </Dialog>
    );
};

export default TransferDialog;
