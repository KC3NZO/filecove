import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, SetStateAction } from "react";

import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useAnnouncer } from "../../hooks/use-announcer";
import { useAssetStates } from "../../hooks/use-asset-states";
import { useChosenColumn } from "../../hooks/use-chosen-column";
import { useFilesDrop } from "../../hooks/use-files-drop";
import { useData, useFolder } from "../../hooks/use-folder";
import { useLocale } from "../../hooks/use-locale";
import { useMediaSearch } from "../../hooks/use-media-search";
import { usePicks } from "../../hooks/use-picks";
import { useUploadQueue } from "../../hooks/use-upload-queue";
import { chosenBackdropSx, chosenColumnSx, mediaWide } from "../../styles/media-layout";
import { visuallyHiddenSx } from "../../styles/mixins";
import { isolate } from "../../utils/bidi";
import { firstInView, focusLost } from "../../utils/dom";
import { NO_ERRORS } from "../../utils/field-errors";
import { carriesFiles, takesUploads, uploadPatterns } from "../../utils/files";
import { isHidden } from "../../utils/hidden";
import { countLimit } from "../../utils/limits";
import { byDate, checkMediaUpload, chooseHeldBy, holdOf, layoutsOf, withState, workOf } from "../../utils/media";
import { allows } from "../../utils/permissions";
import { holdsTerms, searchTerms } from "../../utils/search";
import { NO_MODIFIERS, nextSelection } from "../../utils/selection";
import { pressesKey } from "../../utils/shortcut";
import Icon from "../icons/icon";
import UploadPanel from "../uploads/upload-panel";
import { choiceKey } from "./choice-list";
import ChoicesPane from "./choices-pane";
import DropZone from "./drop-zone";
import { MediaFormBody } from "./media-form";
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
    MediaChoice,
    MediaLayout,
    MediaPickerValue,
    MediaPickForm,
    MediaSection,
    MediaUploadCheck,
    MediaUploadForm,
} from "../../types";

export interface PickerFrameProps {
    section: MediaSection;
    adapter: FileAdapter;
    onChoose: ((choices: MediaChoice[]) => void) | undefined;
    pickForm: ((asset: FileEntry, section: MediaSection) => MediaPickForm | null) | undefined;
    onCancel: (() => void) | undefined;
    multiple: boolean;
    maxChoices: number | undefined;
    allowUpload: boolean;
    value: readonly MediaPickerValue[] | undefined;
    defaultValue: readonly MediaPickerValue[] | undefined;
    onChange: ((choices: MediaChoice[]) => void) | undefined;
}

/**
 * An asset selected, with the level it was selected at, none for one the app gave, as that's unknown,
 * and what the app's form holds for it, `NO_VALUES` until it's changed, for the form's defaults.
 */
interface PickerPick {
    asset: FileEntry;
    folderId?: string;
    values: Record<string, unknown>;
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
const NO_PICKS = { items: [] as readonly PickerPick[], anchor: null };

const NO_VALUES: Record<string, unknown> = {};
// The choices made from a pick's form's defaults, nothing being changed yet, so what's made from them
// again is too, and they go on following the form.
const DEFAULTED = new WeakSet<object>();

const pickerPickKey = ({ asset }: PickerPick) => asset.id;

/** Whether two picks are one to the app, which a new listing's entry for the asset doesn't change. */
const samePickerPick = (a: PickerPick, b: PickerPick) => a.asset.id === b.asset.id && a.values === b.values;

/** The picks the app's list means, each at the level known of it, or none, with what it holds. */
const pickerPicksGiven = (list: readonly MediaPickerValue[], known: readonly PickerPick[]): PickerPick[] =>
    list.map((given) => ({
        asset: given.asset,
        folderId: known.find((item) => item.asset.id === given.asset.id)?.folderId,
        values: DEFAULTED.has(given) ? NO_VALUES : (given.values ?? NO_VALUES),
    }));

/** A choice as the app is handed it, its values its own, known for what it is if it's handed back. */
const handedCopy = (choice: MediaChoice): MediaChoice => {
    const copy = { ...choice, values: { ...choice.values } };

    if (DEFAULTED.has(choice)) {
        DEFAULTED.add(copy);
    }

    return copy;
};

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

// The library with the selected column beside it, or over it, placed by this so its foot stays
// reachable under the overlay, Choose and Cancel staying where they are.
const bodySx: SxProps<Theme> = {
    position: "relative",
    display: "flex",
    flex: 1,
    minHeight: 0,
};

const mainSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
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
    [mediaWide]: { '[data-column="true"] &': { mb: 0.75 } },
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
    [mediaWide]: { '[data-column="true"] &': { mt: 0, mb: 0.75 } },
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

// Only where the selected column doesn't dock; beside it, there's nothing to open.
const openerSx: SxProps<Theme> = {
    [mediaWide]: { display: "none" },
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
    pickForm,
    onCancel,
    multiple,
    maxChoices,
    allowUpload,
    value,
    defaultValue,
    onChange,
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
    // What the app is told is made as `choices` is, which needs the listing, and more below that needs
    // the picks, so it's reached through this.
    const choicesOfRef = useRef<(items: readonly PickerPick[]) => MediaChoice[]>(() => []);
    const {
        picks: { items: picks, anchor },
        setPicks,
        dropGone,
    } = usePicks<PickerPick, string, MediaChoice, MediaPickerValue>({
        component: "MediaPicker",
        value,
        defaultValue,
        onChange,
        given: pickerPicksGiven,
        told: (items) => choicesOfRef.current(items).map(handedCopy),
        sameItem: samePickerPick,
        keyOf: pickerPickKey,
    });
    const limit = multiple ? (countLimit(maxChoices, 1) ?? Infinity) : Infinity;
    const panelRef = useRef<HTMLDivElement>(null);
    const levelFocusRef = useRef<LevelFocus | null>(null);
    const noteId = useId();
    const { chosenOverlay, setChosenOverlay, docked, frameRef, chosenRef, openerRef, closeChosen } =
        useChosenColumn(!!pickForm);

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
            const items = previous.items.map((pick) => {
                const now = byId.get(pick.asset.id);

                if (!now || now === pick.asset) {
                    return pick;
                }

                changed = true;

                return { ...pick, asset: now };
            });

            return changed ? { ...previous, items } : previous;
        });
    }, [listed, setPicks]);

    // What the app's form holds for a pick until it's changed.
    const defaultsOf = useCallback(
        (asset: FileEntry) => (pickForm?.(asset, section)?.defaults as Record<string, unknown>) ?? NO_VALUES,
        [pickForm, section],
    );

    // What picks are, as they are now: as the open level lists one when it does; picked at this level
    // and listed without it, gone; or else as it was picked.
    const choicesOf = useCallback(
        (items: readonly PickerPick[]) => {
            const byId = state?.status === "ready" ? new Map(library.map((entry) => [entry.id, entry])) : undefined;

            return items.flatMap(({ asset, folderId: pickedAt, values }) => {
                const now =
                    byId?.get(asset.id) ?? (byId && pickedAt === folderId ? undefined : withState(asset, said?.get(asset.id)));

                if (!now) {
                    return [];
                }

                const choice: MediaChoice = { asset: now, section, values: values === NO_VALUES ? defaultsOf(now) : values };

                if (values === NO_VALUES) {
                    DEFAULTED.add(choice);
                }

                return [choice];
            });
        },
        [state?.status, library, folderId, said, section, defaultsOf],
    );

    const choices = useMemo(() => choicesOf(picks), [choicesOf, picks]);

    useLayoutEffect(() => {
        choicesOfRef.current = choicesOf;
    });

    // What's found to be gone is taken out and told, so the app isn't left holding a pick nothing shows.
    // A listing still loading finds nothing gone.
    useEffect(() => {
        const shown = new Set(choices.map(({ asset }) => asset.id));

        dropGone(picks.map(pickerPickKey).filter((id) => !shown.has(id)));
    }, [choices, picks, dropGone]);

    const selectedIds = useMemo(() => new Set(choices.map(({ asset }) => asset.id)), [choices]);
    const full = choices.length >= limit;
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

    // What a pick's form is drawn from and its functions read. The backend's errors have no place here,
    // as what's picked is saved by the app's form around the picker.
    const pickState = useCallback(
        (choice: MediaChoice, index: number, all: readonly MediaChoice[]) => ({
            asset: choice.asset,
            section,
            adapter,
            values: choice.values,
            errors: NO_ERRORS,
            index,
            choices: all,
        }),
        [section, adapter],
    );

    // Why a pick's form isn't ready, by its `ready`; nothing once it is.
    const unfilledOf = useCallback(
        (choice: MediaChoice, index: number, all: readonly MediaChoice[]): AssetHold | undefined => {
            const answer = pickForm?.(choice.asset, section)?.ready?.(pickState(choice, index, all)) ?? true;

            return answer === true
                ? undefined
                : { status: "unfilled", text: typeof answer === "string" && answer ? answer : text.mediaChoiceUnfilled };
        },
        [pickForm, section, pickState, text],
    );

    // Why picks can't be chosen now, by their keys, which holds Choose back until they can, or are taken
    // out: past the limit, still being processed, failed, refused by their library, or their form not ready.
    const choiceHolds = useMemo(() => {
        const held = new Map<string, AssetHold>();

        choices.forEach((choice, index) => {
            const hold: AssetHold | undefined =
                index >= limit
                    ? { status: "refused", text: text.mediaOverLimit(formatNumber(limit)) }
                    : (holdOf(choice.asset, section, { text, formatPercent }) ?? unfilledOf(choice, index, choices));

            if (hold) {
                held.set(choiceKey(choice), hold);
            }
        });

        return held.size > 0 ? held : NO_HOLDS;
    }, [choices, limit, section, text, formatNumber, formatPercent, unfilledOf]);

    const holdOfChoice = useCallback((choice: MediaChoice) => choiceHolds.get(choiceKey(choice)), [choiceHolds]);
    const chooseHeld = useMemo(() => chooseHeldBy([...choiceHolds.values()], text), [choiceHolds, text]);

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

            setPicks({
                items: [...kept, ...adding.slice(0, room).map((asset) => ({ asset, folderId, values: NO_VALUES }))],
                anchor: nextAnchor,
            });
        },
        [picks, selectedIds, limit, shownAssets, holds, sayFull, folderId, setPicks],
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
    };

    // Moves one in the order they're handed over in, from the selected column.
    const moveChoice = useCallback(
        (from: number, to: number) => {
            const byId = new Map(picks.map((pick) => [pick.asset.id, pick]));
            const items = choices.flatMap(({ asset }) => byId.get(asset.id) ?? []);
            const [moved] = items.splice(from, 1);

            if (moved) {
                items.splice(to, 0, moved);
                setPicks((previous) => ({ ...previous, items }));
            }
        },
        [picks, choices, setPicks],
    );

    const removeChoice = useCallback(
        (choice: MediaChoice) => {
            setPicks((previous) => ({
                ...previous,
                items: previous.items.filter(({ asset }) => asset.id !== choice.asset.id),
            }));
        },
        [setPicks],
    );

    // What the app's form holds for one pick, kept with it.
    const setChoiceValues = useCallback(
        (choice: MediaChoice, next: SetStateAction<Record<string, unknown>>) => {
            setPicks((previous) => ({
                ...previous,
                items: previous.items.map((item) => {
                    if (item.asset.id !== choice.asset.id) {
                        return item;
                    }

                    const held = item.values === NO_VALUES ? choice.values : item.values;

                    return { ...item, values: typeof next === "function" ? next(held) : next };
                }),
            }));
        },
        [setPicks],
    );

    // One pick's form, drawn with what it holds, and what can read and change the others.
    const renderDetails = useMemo(
        () =>
            pickForm &&
            ((choice: MediaChoice, index: number) => {
                const form = pickForm(choice.asset, section);

                return (
                    form && (
                        <MediaFormBody
                            form={form}
                            params={{
                                ...pickState(choice, index, choices),
                                setValues: (next: SetStateAction<Record<string, unknown>>) =>
                                    setChoiceValues(choice, next),
                                setChoiceValues,
                            }}
                        />
                    )
                );
            }),
        [pickForm, section, pickState, choices, setChoiceValues],
    );

    // Hands the picks to the app, each with its values to itself.
    const handOver = useCallback(
        (handed: readonly MediaChoice[]) => onChoose?.(handed.map(handedCopy)),
        [onChoose],
    );

    // Shows another level, with what was over this one gone, and says where it is, as the focus only
    // says what it's on.
    const showLevel = useCallback(
        (next: readonly FileEntry[], groupId: string | null) => {
            levelFocusRef.current = { groupId, waited: false };
            setTrail(next);
            setPicks((previous) => (previous.anchor === null ? previous : { ...previous, anchor: null }));
            setQuery("");
            setSearching(false);
            setUploadStep(null);
            announce(text.mediaInGroup(isolate(next.at(-1)?.name ?? section.label)));
        },
        [setQuery, setSearching, announce, text, section.label, setPicks],
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
        if (choices.length > 0 && !chooseHeld) {
            handOver(choices);
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

            const picked = choices.find(({ asset }) => asset.id === entry.id);

            if (!picked && full) {
                sayFull();

                return;
            }

            // There's no choosing to finish, so it's only selected, the one thing it can be.
            if (!onChoose) {
                if (!picked) {
                    press(index, { toggle: false, range: false });
                }

                return;
            }

            const chosen = picked ?? { asset: entry, section, values: defaultsOf(entry) };
            const handed = multiple ? [...choices.filter((choice) => choice !== chosen), chosen] : [chosen];

            // Its form asks for more first: it's selected instead, its form saying what.
            if (!picked && unfilledOf(chosen, handed.length - 1, handed)) {
                press(index, { toggle: false, range: false });

                return;
            }

            // The others selected hold it back as they hold Choose.
            if (!handed.some((choice) => choiceHolds.has(choiceKey(choice)))) {
                handOver(handed);
            } else if (chooseHeld) {
                announce(chooseHeld);
            }
        },
        [
            shownEntries,
            enterGroupAt,
            holds,
            announce,
            full,
            sayFull,
            multiple,
            choices,
            section,
            defaultsOf,
            unfilledOf,
            choiceHolds,
            handOver,
            onChoose,
            press,
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
            setPicks({ items: [{ asset: last, folderId, values: NO_VALUES }], anchor: last.id });

            return;
        }

        const adding = assets.filter(({ id }) => !selectedIds.has(id));
        const room = limit === Infinity ? Infinity : Math.max(limit - choices.length, 0);

        if (adding.length > room) {
            sayFull();
        }

        setPicks((previous) => ({
            ...previous,
            items: [...previous.items, ...adding.slice(0, room).map((asset) => ({ asset, folderId, values: NO_VALUES }))],
        }));
    }, [state?.status, library, arrivals, folderId, section, multiple, selectedIds, limit, choices.length, sayFull]);

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

    const count = choices.length;
    const limited = limit !== Infinity;
    const selectedText = limited
        ? text.mediaSelectedOf(formatNumber(count), formatNumber(limit))
        : multiple && count > 0
          ? text.mediaSelected(count)
          : undefined;
    const badge = limited
        ? text.mediaCountOf(formatNumber(count), formatNumber(limit))
        : multiple && count > 0
          ? formatNumber(count)
          : undefined;
    const note = chooseHeld ?? (count === limit ? text.mediaChoicesFull : undefined);
    // One at a time with nothing selected, there's no column to show.
    const chosenEmpty = !multiple && count === 0;
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
            ref={frameRef}
            sx={frameSx}
            data-column={!!pickForm}
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
                    searchable &&
                    !chosenOverlay
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
            <Box sx={bodySx}>
                <Box sx={mainSx}>
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
                </Box>
                {pickForm && (
                    <>
                        <Backdrop
                            open={chosenOverlay && !docked && !chosenEmpty}
                            sx={chosenBackdropSx}
                            onClick={closeChosen}
                        />
                        <Box
                            ref={chosenRef}
                            sx={chosenColumnSx}
                            data-overlay={chosenOverlay}
                            data-empty={chosenEmpty}
                            onKeyDown={(event) => {
                                // Stopped here, or it would reach a dialog around the picker and close that too.
                                if (event.key === "Escape" && !docked && !event.defaultPrevented) {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    closeChosen();
                                }
                            }}
                        >
                            <ChoicesPane
                                choices={choices}
                                adapter={adapter}
                                multiple={multiple}
                                renderDetails={renderDetails}
                                problemsOf={undefined}
                                holdOf={holdOfChoice}
                                held={undefined}
                                badge={badge}
                                selectedText={selectedText}
                                note={undefined}
                                onRemove={removeChoice}
                                onMove={moveChoice}
                                onClear={clearSelection}
                                onChoose={undefined}
                                onShowInLibrary={undefined}
                                onClose={closeChosen}
                            />
                        </Box>
                    </>
                )}
            </Box>
            <Box sx={footSx}>
                {pickForm ? (
                    !chosenEmpty && (
                        <Button
                            ref={openerRef}
                            color="inherit"
                            aria-expanded={chosenOverlay}
                            endIcon={<Icon name="expand" fontSize="small" />}
                            sx={openerSx}
                            onClick={() => setChosenOverlay(true)}
                        >
                            {selectedText ?? text.mediaChosen}
                        </Button>
                    )
                ) : (
                    <>
                        {selectedText && <Typography sx={countSx}>{selectedText}</Typography>}
                        {multiple && count > 0 && (
                            <Button size="small" color="inherit" onClick={clearSelection}>
                                {text.mediaClearSelection}
                            </Button>
                        )}
                    </>
                )}
                <Typography id={noteId} sx={noteSx}>
                    {note}
                </Typography>
                {onCancel && (
                    <Button color="inherit" onClick={onCancel}>
                        {text.cancel}
                    </Button>
                )}
                {onChoose && (
                    <Button
                        variant="contained"
                        disableElevation
                        disabled={count === 0 || !!chooseHeld}
                        aria-describedby={chooseHeld ? noteId : undefined}
                        onClick={choose}
                    >
                        {text.mediaChoose}
                    </Button>
                )}
            </Box>
            <Box role="status" sx={visuallyHiddenSx}>
                {/* A space every other time, so the same message said again is heard again. */}
                {announcement && `${announcement.message}${announcement.id % 2 === 0 ? " " : ""}`}
            </Box>
        </Box>
    );
};

export default PickerFrame;
