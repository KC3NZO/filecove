import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useAnnouncer } from "../../hooks/use-announcer";
import { useAssetStates } from "../../hooks/use-asset-states";
import { useFilesDrop } from "../../hooks/use-files-drop";
import { useData, useFolder } from "../../hooks/use-folder";
import { useLocale } from "../../hooks/use-locale";
import { useMediaSearch } from "../../hooks/use-media-search";
import { useUploadQueue } from "../../hooks/use-upload-queue";
import { visuallyHiddenSx } from "../../styles/mixins";
import { isolate } from "../../utils/bidi";
import { firstInView, focusLost } from "../../utils/dom";
import { carriesFiles, takesUploads, uploadPatterns } from "../../utils/files";
import { isHidden } from "../../utils/hidden";
import { countLimit } from "../../utils/limits";
import { byDate, checkMediaUpload, holdOf, layoutsOf, withState, workOf } from "../../utils/media";
import { allows } from "../../utils/permissions";
import { holdsTerms, searchTerms } from "../../utils/search";
import { NO_MODIFIERS, nextSelection } from "../../utils/selection";
import { pressesKey } from "../../utils/shortcut";
import UploadPanel from "../uploads/upload-panel";
import DropZone from "./drop-zone";
import MediaGrid from "./media-grid";
import MediaHeader from "./media-header";
import MediaUpload from "./media-upload";

import type {
    AssetHold,
    DroppedFiles,
    FileAdapter,
    FileEntry,
    FileUploadItem,
    FollowedAssets,
    MediaAssetDraw,
    MediaLayout,
    MediaSection,
    MediaUploadCheck,
    MediaUploadForm,
} from "../../types";

interface PickerFrameProps {
    section: MediaSection;
    adapter: FileAdapter;
    onChoose: (assets: FileEntry[]) => void;
    onCancel: (() => void) | undefined;
    multiple: boolean;
    maxChoices: number | undefined;
    allowUpload: boolean;
    defaultValue: readonly FileEntry[] | undefined;
}

/** An asset selected, with the level it was selected at; none for one the app gave, as that's unknown. */
interface PickerPick {
    asset: FileEntry;
    folderId?: string;
}

/** Who takes the focus as a level shows: the group left, or with none, the first thing in it. */
interface LevelFocus {
    groupId: string | null;
    /** Whether it had to wait for the listing, when the user may have gone on elsewhere. */
    waited: boolean;
}

/** Files given to the library, as checked before they're sent, and what it asks of them. */
interface UploadStep {
    key: number;
    into: { id: string; name: string };
    check: MediaUploadCheck;
    form: MediaUploadForm | null;
}

/** A file just uploaded, by its entry's id, waiting to be listed, when it's selected. */
interface Arrival {
    key: number;
    uploadId: number;
    folderId: string;
    entryId: string;
}

interface GroupHeaderProps {
    draw: (group: FileEntry, section: MediaSection) => ReactNode;
    group: FileEntry;
    section: MediaSection;
}

const NO_ENTRIES: FileEntry[] = [];
const NO_TRAIL: readonly FileEntry[] = [];
const NO_PICKS: readonly PickerPick[] = [];
const NO_FOLLOWED: readonly FollowedAssets[] = [];
const NO_ARRIVALS: readonly Arrival[] = [];
const NO_UPLOADS: readonly FileUploadItem[] = [];
const NO_HOLDS: ReadonlyMap<string, AssetHold> = new Map();

/** How long a file just uploaded is waited for in the listing, in ms. */
const ARRIVAL_WAIT = 10_000;

const isGroup = (entry: FileEntry) => entry.kind === "folder";

/** What the app draws above a group's contents, as a component of its own, so it may use hooks. */
const GroupHeader = ({ draw, group, section }: GroupHeaderProps) => draw(group, section);

const ignore = () => {};

const frameSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    bgcolor: "background.default",
    color: "text.primary",
};

// The library, an inset panel as the media manager's is. Positioned, so the upload step covers it.
const panelSx: SxProps<Theme> = {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    marginInline: 0.75,
    borderRadius: 3,
    overflow: "hidden",
    bgcolor: "background.paper",
};

const gridSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    '&[data-covered="true"]': { visibility: "hidden" },
};

const uploadsSx: SxProps<Theme> = {
    flexShrink: 0,
    marginInline: 0.75,
    mt: 0.75,
};

const footSx: SxProps<Theme> = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 1,
    flexShrink: 0,
    minHeight: 52,
    px: 1.5,
    py: 0.75,
};

const countSx: SxProps<Theme> = {
    color: "text.secondary",
    fontSize: "0.8125rem",
};

// What holds Choose back, or that there's no room, pushing the buttons to the end side.
const noteSx: SxProps<Theme> = {
    flex: "1 1 8rem",
    minWidth: 0,
    color: "text.secondary",
    fontSize: "0.75rem",
};

/** Everything inside the picker's root, below the contexts it provides. */
const PickerFrame = ({
    section,
    adapter,
    onChoose,
    onCancel,
    multiple,
    maxChoices,
    allowUpload,
    defaultValue,
}: PickerFrameProps) => {
    const { text, foldLetters, compareNames, formatNumber, formatPercent } = useLocale();
    const { store } = useData();
    const { announcement, announce } = useAnnouncer();
    const { query, setQuery, searching, setSearching, searchInputRef, searchButtonRef, openSearch, stopSearching, closeSearch } =
        useMediaSearch();
    const [trail, setTrail] = useState(NO_TRAIL);
    const openGroup = trail.at(-1);
    const inGroup = !!openGroup;
    const folderId = openGroup?.id ?? section.rootId;
    const levelName = openGroup?.name ?? section.label;
    const { state, reload } = useFolder(section, folderId, true, true);
    const [picks, setPicks] = useState<readonly PickerPick[]>(() =>
        defaultValue?.length ? defaultValue.map((asset) => ({ asset })) : NO_PICKS,
    );
    const [anchor, setAnchor] = useState<string | null>(null);
    const limit = multiple ? (countLimit(maxChoices, 1) ?? Infinity) : Infinity;
    const panelRef = useRef<HTMLDivElement>(null);
    const levelFocusRef = useRef<LevelFocus | null>(null);
    const noteId = useId();

    const [uploadStep, setUploadStep] = useState<UploadStep | null>(null);
    const uploadStepCount = useRef(0);
    const [uploadLevels, setUploadLevels] = useState<ReadonlyMap<number, string>>(() => new Map());
    const [arrivals, setArrivals] = useState(NO_ARRIVALS);
    const arrivedRef = useRef(new Set<number>());
    const arrivalCount = useRef(0);
    const pickerRef = useRef<HTMLInputElement>(null);
    const uploadButtonRef = useRef<HTMLButtonElement>(null);

    const relist = useCallback(
        (served: FileAdapter, folderIds: string[]) => store.relist(section.id, served, folderIds),
        [store, section.id],
    );

    // An asset done with being processed: the root and the level open are listed again.
    const relistOpen = useCallback(
        (served: FileAdapter) => relist(served, [section.rootId, folderId]),
        [relist, section.rootId, folderId],
    );

    // What the open level holds: inside a group, in the backend's order; at the root, the newest first.
    const level = useMemo(() => {
        const shown = (state?.entries ?? NO_ENTRIES).filter((entry) => !isHidden(entry));

        return inGroup ? shown : shown.sort(byDate(compareNames));
    }, [state?.entries, compareNames, inGroup]);

    const listed = useMemo(() => level.filter((entry) => !isGroup(entry)), [level]);

    // Assets being processed, here and among the picks, followed until they're done.
    const processed = useMemo<readonly FollowedAssets[]>(() => {
        const entries = new Map<string, FileEntry>();

        [...listed, ...picks.map(({ asset }) => asset)].forEach((entry) => {
            if (entry.processing?.status === "processing" && !entries.has(entry.id)) {
                entries.set(entry.id, entry);
            }
        });

        return entries.size > 0 ? [{ adapter, entries: [...entries.values()] }] : NO_FOLLOWED;
    }, [listed, picks, adapter]);

    const { states, forget } = useAssetStates(processed, relistOpen);
    const said = states.get(adapter);

    const leveled = useMemo(
        () => (said ? level.map((entry) => withState(entry, said.get(entry.id))) : level),
        [level, said],
    );

    const library = useMemo(() => leveled.filter((entry) => !isGroup(entry)), [leveled]);

    // Once the listing has caught up, what was said of its assets is forgotten, so one processed again
    // later is followed afresh.
    useEffect(() => {
        if (state?.status === "ready") {
            forget(
                adapter,
                listed.filter((entry) => !entry.processing).map(({ id }) => id),
            );
        }
    }, [state?.status, listed, adapter, forget]);

    // A pick keeps its entry as last listed, so what's handed over from another level has what's been
    // made of it since.
    useEffect(() => {
        const byId = new Map(listed.map((entry) => [entry.id, entry]));

        setPicks((previous) => {
            let changed = false;
            const next = previous.map((pick) => {
                const now = byId.get(pick.asset.id);

                if (!now || now === pick.asset) {
                    return pick;
                }

                changed = true;

                return { ...pick, asset: now };
            });

            return changed ? next : previous;
        });
    }, [listed]);

    // What's selected, as it is now: as the open level lists it when it does; picked at this level and
    // listed without it, gone; or else as it was picked.
    const chosen = useMemo(() => {
        const byId = state?.status === "ready" ? new Map(library.map((entry) => [entry.id, entry])) : undefined;

        return picks.flatMap(({ asset, folderId: pickedAt }) => {
            const now = byId?.get(asset.id);

            if (now) {
                return [now];
            }

            return byId && pickedAt === folderId ? [] : [withState(asset, said?.get(asset.id))];
        });
    }, [picks, state?.status, library, folderId, said]);

    const selectedIds = useMemo(() => new Set(chosen.map(({ id }) => id)), [chosen]);
    const full = chosen.length >= limit;
    const sayFull = useCallback(() => announce(text.mediaChoicesFull), [announce, text]);

    const terms = useMemo(() => searchTerms(query, foldLetters), [query, foldLetters]);
    const shownEntries = useMemo(
        () => (terms.length === 0 ? leveled : leveled.filter((entry) => holdsTerms(foldLetters(entry.name), terms))),
        [leveled, terms, foldLetters],
    );
    const shownAssets = useMemo(() => shownEntries.filter((entry) => !isGroup(entry)), [shownEntries]);
    const shownGroupIds = useMemo(() => new Set(shownEntries.filter(isGroup).map(({ id }) => id)), [shownEntries]);
    const order = useMemo(() => shownEntries.map(({ id }) => id), [shownEntries]);

    const holds = useMemo(() => {
        const held = new Map<string, AssetHold>();

        shownAssets.forEach((entry) => {
            const hold = holdOf(entry, section, { text, formatPercent });

            if (hold) {
                held.set(entry.id, hold);
            }
        });

        return held.size > 0 ? held : NO_HOLDS;
    }, [shownAssets, section, text, formatPercent]);

    const works = useMemo(() => {
        const working = new Map<string, AssetHold>();

        shownAssets.forEach((entry) => {
            const work = workOf(entry, { text, formatPercent });

            if (work) {
                working.set(entry.id, work);
            }
        });

        return working.size > 0 ? working : NO_HOLDS;
    }, [shownAssets, text, formatPercent]);

    // What holds Choose back, said beside it: those past the limit, failed or refused, to take out
    // first, then those still processed.
    const chooseHeld = useMemo(() => {
        const standing = chosen.map((asset, index) =>
            index >= limit
                ? ({ status: "refused", text: text.mediaOverLimit(formatNumber(limit)) } satisfies AssetHold)
                : holdOf(asset, section, { text, formatPercent }),
        );
        const waiting = standing.filter((hold) => hold?.status === "processing").length;
        const refused = standing.filter((hold) => hold && hold.status !== "processing").length;

        return refused > 0
            ? text.mediaChoicesUnavailable(refused)
            : waiting > 0
              ? text.mediaChoicesProcessing(waiting)
              : undefined;
    }, [chosen, limit, section, text, formatNumber, formatPercent]);

    // What's selected made `ids`: those there stay in their place, and those added go at the end, in the
    // order shown, as many as the limit lets in.
    const selectIds = useCallback(
        (ids: ReadonlySet<string>, nextAnchor: string | null) => {
            const kept = picks.filter(({ asset }) => ids.has(asset.id) && selectedIds.has(asset.id));
            const room = limit === Infinity ? Infinity : Math.max(limit - kept.length, 0);
            const adding = shownAssets.filter(
                (entry) => ids.has(entry.id) && !selectedIds.has(entry.id) && !holds.has(entry.id),
            );

            if (adding.length > room) {
                sayFull();
            }

            setPicks([...kept, ...adding.slice(0, room).map((asset) => ({ asset, folderId }))]);
            setAnchor(nextAnchor);
        },
        [picks, selectedIds, limit, shownAssets, holds, sayFull, folderId],
    );

    // Several at once, a click adds or takes away the asset, and Shift adds those from the last one
    // clicked; one at a time, it selects the asset alone. A group isn't selected, nor one held.
    const press = useCallback(
        (index: number, keys: { toggle: boolean; range: boolean }) => {
            const id = order[index];

            if (id === undefined || (holds.has(id) && !selectedIds.has(id))) {
                return;
            }

            if (shownGroupIds.has(id) && !(multiple && keys.range)) {
                return;
            }

            if (full && !selectedIds.has(id) && !keys.range) {
                sayFull();

                return;
            }

            const base = { ids: selectedIds, anchor };
            const next = multiple
                ? nextSelection(base, id, { toggle: true, range: keys.range }, order)
                : nextSelection(base, id, NO_MODIFIERS, order);

            selectIds(new Set([...next.ids].filter((each) => !shownGroupIds.has(each))), next.anchor);
        },
        [order, holds, selectedIds, shownGroupIds, multiple, full, sayFull, anchor, selectIds],
    );

    const selectAll = useCallback(() => {
        selectIds(new Set([...selectedIds, ...shownAssets.map(({ id }) => id)]), order[0] ?? null);
    }, [selectIds, selectedIds, shownAssets, order]);

    const clearSelection = () => {
        setPicks(NO_PICKS);
        setAnchor(null);
    };

    // Shows another level, with what was over this one gone, and says where it is, as the focus only
    // says what it's on.
    const showLevel = useCallback(
        (next: readonly FileEntry[], groupId: string | null) => {
            levelFocusRef.current = { groupId, waited: false };
            setTrail(next);
            setAnchor(null);
            setQuery("");
            setSearching(false);
            setUploadStep(null);
            announce(text.mediaInGroup(isolate(next.at(-1)?.name ?? section.label)));
        },
        [setQuery, setSearching, announce, text, section.label],
    );

    const goToLevel = useCallback(
        (depth: number) => showLevel(trail.slice(0, depth), trail[depth]?.id ?? null),
        [showLevel, trail],
    );

    const enterGroupAt = useCallback(
        (index: number) => {
            const group = shownEntries[index];

            if (group) {
                showLevel([...trail, group], null);
            }
        },
        [shownEntries, showLevel, trail],
    );

    const levelUp = useCallback(() => goToLevel(trail.length - 1), [goToLevel, trail.length]);

    // The focus goes in and comes back with the user, once what it goes to is listed: the group left,
    // or the first thing in the level, or with nothing to take it, the search. If that took a moment
    // and the focus went elsewhere meanwhile, it stays there.
    useLayoutEffect(() => {
        const asked = levelFocusRef.current;

        if (!asked) {
            return;
        }

        const index = asked.groupId === null ? 0 : shownEntries.findIndex(({ id }) => id === asked.groupId);
        const found = index !== -1 && index < shownEntries.length;

        if (!found && state?.status !== "ready" && state?.status !== "error") {
            asked.waited = true;

            return;
        }

        levelFocusRef.current = null;

        if (asked.waited && !focusLost()) {
            return;
        }

        const tile = found && panelRef.current?.querySelector<HTMLElement>(`[role="listbox"] [data-index="${index}"]`);

        if (tile) {
            tile.focus();
            tile.scrollIntoView({ block: "nearest" });
        } else {
            searchButtonRef.current?.focus();
        }
    }, [shownEntries, state?.status, folderId, searchButtonRef]);

    const choose = () => {
        if (chosen.length > 0 && !chooseHeld) {
            onChoose([...chosen]);
        }
    };

    // A double click or Enter: goes into a group, or chooses the asset, with the rest selected when
    // several can be. There's nowhere to open one that can't be chosen, so it only says why.
    const activate = useCallback(
        (index: number) => {
            const entry = shownEntries[index];

            if (!entry) {
                return;
            }

            if (isGroup(entry)) {
                enterGroupAt(index);

                return;
            }

            const hold = holds.get(entry.id);

            if (hold) {
                announce(hold.text);

                return;
            }

            const picked = selectedIds.has(entry.id);

            if (!picked && full) {
                sayFull();

                return;
            }

            const others = multiple ? chosen.filter(({ id }) => id !== entry.id) : [];

            if (others.every((asset) => !holdOf(asset, section, { text, formatPercent })) && others.length < limit) {
                onChoose([...others, entry]);
            } else if (chooseHeld) {
                announce(chooseHeld);
            }
        },
        [
            shownEntries,
            enterGroupAt,
            holds,
            announce,
            selectedIds,
            full,
            sayFull,
            multiple,
            chosen,
            section,
            text,
            formatPercent,
            limit,
            onChoose,
            chooseHeld,
        ],
    );

    // Whether the open level takes files: only when the app allows it here, and its library can have them.
    const takesFiles =
        allowUpload &&
        !!adapter.upload &&
        takesUploads(section) &&
        state?.status !== "error" &&
        allows("write", state?.permissions, openGroup?.permissions);

    const uploads = useUploadQueue(relist, text.keptBothName);

    const sendUpload = useCallback(
        (into: UploadStep["into"], files: File[], values: Readonly<Record<string, unknown>> | undefined) => {
            const ids = uploads.queue.add(adapter, into, files, "keepBoth", values);

            setUploadLevels((previous) => new Map([...previous, ...ids.map((id): [number, string] => [id, into.id])]));
        },
        [uploads.queue, adapter],
    );

    // What was picked, dropped or pasted: checked first, and sent at once when there's nothing to ask or
    // say; otherwise the upload step shows in the library's place.
    const askUpload = useCallback(
        (dropped: DroppedFiles) => {
            if (!takesFiles || dropped.files.length + dropped.folders.length === 0) {
                return;
            }

            const into = { id: folderId, name: levelName };
            const check = checkMediaUpload(section, adapter, dropped, folderId);
            const form = check.files.length > 0 ? (section.uploadForm?.(check.files) ?? null) : null;

            if (check.refused.length + check.folders.length + check.misnamed.length === 0 && !form) {
                sendUpload(into, check.files, undefined);

                return;
            }

            uploadStepCount.current += 1;
            setUploadStep({ key: uploadStepCount.current, into, check, form });
        },
        [takesFiles, folderId, levelName, section, adapter, sendUpload],
    );

    const closeUploadStep = useCallback(() => {
        const step = panelRef.current?.querySelector("section");

        if (step?.contains(document.activeElement) || focusLost()) {
            uploadButtonRef.current?.focus();
        }

        setUploadStep(null);
    }, []);

    const searchable = !uploadStep;
    const patterns = useMemo(() => uploadPatterns(section), [section]);
    const { dropping, offerDrop, leaveDrop, takeDrop, pasteFiles } = useFilesDrop(
        takesFiles && !uploadStep,
        patterns,
        askUpload,
    );

    // Each upload done, by its entry's id, waits to be listed.
    useEffect(() => {
        uploads.items.forEach(({ id, status, entryId }) => {
            const target = uploadLevels.get(id);

            if (status !== "done" || arrivedRef.current.has(id)) {
                return;
            }

            arrivedRef.current.add(id);

            if (target === undefined || entryId === undefined) {
                return;
            }

            const key = (arrivalCount.current += 1);

            setArrivals((previous) => [...previous, { key, uploadId: id, folderId: target, entryId }]);
            window.setTimeout(
                () => setArrivals((previous) => previous.filter((waiting) => waiting.key !== key)),
                ARRIVAL_WAIT,
            );
        });
    }, [uploads.items, uploadLevels]);

    // Once the open level lists what arrived, it's selected, as it was uploaded to be chosen: added to
    // what's selected while there's room, or one at a time, the last to arrive in place of it. One still
    // being processed is selected too, holding Choose back until it's done; one failed or refused isn't.
    useEffect(() => {
        if (state?.status !== "ready") {
            return;
        }

        const byId = new Map(library.map((entry) => [entry.id, entry]));
        const here = arrivals.filter((waiting) => waiting.folderId === folderId && byId.has(waiting.entryId));

        if (here.length === 0) {
            return;
        }

        const keys = new Set(here.map((waiting) => waiting.key));
        const assets = here
            .flatMap((waiting) => byId.get(waiting.entryId) ?? [])
            .filter(({ processing }) => processing?.status !== "failed" || processing.usable)
            .filter((asset) => (section.selectable?.(asset) ?? true) === true);

        setArrivals((previous) => previous.filter((waiting) => !keys.has(waiting.key)));

        const last = assets.at(-1);

        if (!last) {
            return;
        }

        if (!multiple) {
            setPicks([{ asset: last, folderId }]);
            setAnchor(last.id);

            return;
        }

        const adding = assets.filter(({ id }) => !selectedIds.has(id));
        const room = limit === Infinity ? Infinity : Math.max(limit - chosen.length, 0);

        if (adding.length > room) {
            sayFull();
        }

        setPicks((previous) => [...previous, ...adding.slice(0, room).map((asset) => ({ asset, folderId }))]);
    }, [state?.status, library, arrivals, folderId, section, multiple, selectedIds, limit, chosen.length, sayFull]);

    // The open level's uploads, before what it holds: those waiting or being sent, and those done until
    // they're listed.
    const shownUploads = useMemo(() => {
        const waiting = new Set(arrivals.map((arrival) => arrival.uploadId));
        const shown = uploads.items.filter(
            (item): item is FileUploadItem =>
                item.kind === "file" &&
                uploadLevels.get(item.id) === folderId &&
                (item.status === "queued" || item.status === "uploading" || waiting.has(item.id)),
        );

        return shown.length > 0 ? shown : NO_UPLOADS;
    }, [folderId, arrivals, uploads.items, uploadLevels]);

    const clearUploads = useCallback(() => {
        uploads.queue.clear();

        const kept = new Set(uploads.queue.getItems().map((item) => item.id));

        setUploadLevels((previous) => new Map([...previous].filter(([id]) => kept.has(id))));
        arrivedRef.current.forEach((id) => !kept.has(id) && arrivedRef.current.delete(id));
    }, [uploads.queue]);

    const drawAsset = useMemo<MediaAssetDraw | undefined>(() => {
        const draw = section.renderAsset;

        return draw && ((params) => draw({ ...params, section }));
    }, [section]);
    const drawGroup = useMemo<MediaAssetDraw | undefined>(() => {
        const draw = section.renderGroup;

        return draw && ((params) => draw({ ...params, section }));
    }, [section]);

    // The layouts the library offers, the first as it starts, the app keeping nothing of them here.
    const offeredLayouts = layoutsOf(section);
    const [chosenLayout, setChosenLayout] = useState<MediaLayout>();
    const layout = chosenLayout && offeredLayouts.includes(chosenLayout) ? chosenLayout : offeredLayouts[0];
    const otherLayout = offeredLayouts.find((each) => each !== layout);
    const layoutAnchorRef = useRef<number | null>(null);

    const switchLayout = () => {
        layoutAnchorRef.current = firstInView(panelRef.current?.querySelector('[role="listbox"]'));
        setChosenLayout(otherLayout);
    };

    // What was at the top stays there as the layout changes, as rows and tiles aren't the same height.
    useLayoutEffect(() => {
        const index = layoutAnchorRef.current;

        layoutAnchorRef.current = null;

        if (index === null) {
            return;
        }

        const list = panelRef.current?.querySelector('[role="listbox"]');
        const item = list?.querySelector(`[data-index="${index}"]`);
        const scroller = list?.parentElement;

        if (item && scroller) {
            scroller.scrollTop += item.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        }
    }, [layout]);

    const count = chosen.length;
    const limited = limit !== Infinity;
    const selectedText = limited
        ? text.mediaSelectedOf(formatNumber(count), formatNumber(limit))
        : multiple && count > 0
          ? text.mediaSelected(count)
          : undefined;
    const note = chooseHeld ?? (count === limit ? text.mediaChoicesFull : undefined);
    const errorMessage =
        state?.status !== "error"
            ? undefined
            : state.error instanceof Error && state.error.message
              ? isolate(state.error.message)
              : inGroup
                ? text.mediaGroupLoadFailed
                : undefined;

    return (
        <Box
            sx={frameSx}
            onKeyDown={(event) => {
                // Ctrl+F or ⌘F opens the search, in place of the browser's find, as the media manager's does.
                if (
                    pressesKey(event, "f") &&
                    (event.ctrlKey || event.metaKey) &&
                    !event.shiftKey &&
                    !event.altKey &&
                    !event.defaultPrevented &&
                    event.target instanceof Node &&
                    event.currentTarget.contains(event.target) &&
                    searchable
                ) {
                    event.preventDefault();
                    openSearch();
                }
            }}
            // Files dropped where they aren't taken are refused, or the browser would open them. A picker
            // is often in a dialog of a media manager's form, where these would bubble to it through the
            // portal and upload there, so none of them leaves.
            onDragEnter={(event) => event.stopPropagation()}
            onDragOver={(event) => {
                event.stopPropagation();

                if (carriesFiles(event) && !event.defaultPrevented) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "none";
                }
            }}
            onDragLeave={(event) => event.stopPropagation()}
            onDrop={(event) => {
                event.stopPropagation();

                if (carriesFiles(event) && !event.defaultPrevented) {
                    event.preventDefault();
                }
            }}
            onPaste={(event) => event.stopPropagation()}
        >
            <MediaHeader
                section={section}
                trail={trail}
                onGoToLevel={goToLevel}
                onGroupDetails={undefined}
                groupDetailsRef={null}
                several={false}
                librariesOpen={false}
                librariesOpenerRef={null}
                onOpenLibraries={ignore}
                searchable={searchable}
                searching={searching && searchable}
                query={query}
                searchInputRef={searchInputRef}
                searchButtonRef={searchButtonRef}
                onQueryChange={setQuery}
                onToggleSearch={() => (searching ? closeSearch() : openSearch())}
                onCloseSearch={closeSearch}
                onDismissSearch={stopSearching}
                onFocusAssets={() =>
                    panelRef.current?.querySelector<HTMLElement>('[role="listbox"] [role="option"][tabindex="0"]')?.focus()
                }
                otherLayout={uploadStep ? undefined : otherLayout}
                onSwitchLayout={switchLayout}
                onNewGroup={undefined}
                newGroupLabel=""
                creatingGroup={false}
                newGroupRef={null}
                onUpload={takesFiles ? () => pickerRef.current?.click() : undefined}
                uploadRef={uploadButtonRef}
            />
            {takesFiles && (
                <input
                    ref={pickerRef}
                    type="file"
                    multiple={multiple}
                    hidden
                    tabIndex={-1}
                    accept={typeof section.acceptUploads === "string" ? section.acceptUploads : undefined}
                    onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);

                        // Emptied, so picking the same files again still changes it.
                        event.target.value = "";
                        askUpload({ files, folders: [] });
                    }}
                />
            )}
            <Box
                ref={panelRef}
                sx={panelSx}
                onDragEnter={offerDrop}
                onDragOver={offerDrop}
                onDragLeave={leaveDrop}
                onDrop={takeDrop}
                onPaste={pasteFiles}
            >
                <Box sx={gridSx} data-covered={!!uploadStep}>
                    <MediaGrid
                        key={folderId}
                        entries={shownEntries}
                        uploads={shownUploads}
                        kind={section.kind}
                        layout={layout}
                        adapter={adapter}
                        drawAsset={drawAsset}
                        drawGroup={drawGroup}
                        opensGroups={false}
                        opensAssets={false}
                        header={
                            openGroup &&
                            section.groupHeader && (
                                <GroupHeader draw={section.groupHeader} group={openGroup} section={section} />
                            )
                        }
                        label={levelName}
                        selectedIds={selectedIds}
                        holds={holds}
                        works={works}
                        full={full}
                        multiple={multiple}
                        status={state?.status ?? "loading"}
                        hasMedia={leveled.length > 0}
                        busy={state?.status === "loading" || !!state?.checking}
                        error={errorMessage}
                        onRetry={reload}
                        onPress={press}
                        onActivate={activate}
                        onEnterGroup={enterGroupAt}
                        onLevelUp={inGroup ? levelUp : undefined}
                        onOpen={ignore}
                        onSelectAll={selectAll}
                    />
                </Box>
                {uploadStep && (
                    <MediaUpload
                        key={uploadStep.key}
                        section={section}
                        levelName={uploadStep.into.name}
                        adapter={adapter}
                        check={uploadStep.check}
                        form={uploadStep.form}
                        onCancel={closeUploadStep}
                        onUpload={(values) => {
                            sendUpload(uploadStep.into, uploadStep.check.files, values);
                            closeUploadStep();
                        }}
                    />
                )}
                {dropping && <DropZone label={text.mediaDropToUpload(isolate(levelName))} />}
            </Box>
            {uploads.items.length > 0 && (
                <Box sx={uploadsSx}>
                    <UploadPanel
                        items={uploads.items}
                        onCancel={uploads.queue.cancel}
                        onRetry={uploads.queue.retry}
                        onCancelAll={uploads.queue.cancelAll}
                        onClear={clearUploads}
                    />
                </Box>
            )}
            <Box sx={footSx}>
                {selectedText && <Typography sx={countSx}>{selectedText}</Typography>}
                {multiple && count > 0 && (
                    <Button size="small" color="inherit" onClick={clearSelection}>
                        {text.mediaClearSelection}
                    </Button>
                )}
                <Typography id={noteId} sx={noteSx}>
                    {note}
                </Typography>
                {onCancel && (
                    <Button color="inherit" onClick={onCancel}>
                        {text.cancel}
                    </Button>
                )}
                <Button
                    variant="contained"
                    disableElevation
                    disabled={count === 0 || !!chooseHeld}
                    aria-describedby={chooseHeld ? noteId : undefined}
                    onClick={choose}
                >
                    {text.mediaChoose}
                </Button>
            </Box>
            <Box role="status" sx={visuallyHiddenSx}>
                {/* A space every other time, so the same message said again is heard again. */}
                {announcement && `${announcement.message}${announcement.id % 2 === 0 ? " " : ""}`}
            </Box>
        </Box>
    );
};

export default PickerFrame;
