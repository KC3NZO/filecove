import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, Ref, SetStateAction } from "react";

import { useAnnouncer } from "../../hooks/use-announcer";
import { useAssetStates } from "../../hooks/use-asset-states";
import { overlays, useChosenColumn } from "../../hooks/use-chosen-column";
import { useData, useFolder } from "../../hooks/use-folder";
import { useFilesDrop } from "../../hooks/use-files-drop";
import { useLevelSearch } from "../../hooks/use-level-search";
import { useLocale } from "../../hooks/use-locale";
import { useMatchCount } from "../../hooks/use-match-count";
import { useMediaSearch } from "../../hooks/use-media-search";
import { usePicks } from "../../hooks/use-picks";
import type { PicksState } from "../../hooks/use-picks";
import { useTransferQueue } from "../../hooks/use-transfer-queue";
import { useSetting } from "../../hooks/use-setting";
import { useUploadQueue } from "../../hooks/use-upload-queue";
import mediaLayout from "../../styles/media-layout.module.css";
import util from "../../styles/util.module.css";
import { runToolbarShortcut } from "../../utils/action-groups";
import { isolate } from "../../utils/bidi";
import { focusLost } from "../../utils/dom";
import { NO_ERRORS, choiceMessages, countErrorsAt } from "../../utils/field-errors";
import { carriesFiles, takesUploads, uploadPatterns } from "../../utils/files";
import { isHidden } from "../../utils/hidden";
import { countLimit } from "../../utils/limits";
import {
    byDate,
    checkMediaUpload,
    chooseHeldBy,
    groupPicksOf,
    groupRule,
    groupsOfTrail,
    holdOf,
    layoutsOf,
    mediaToolbarGroups,
    NO_GROUP_PICKS,
    pickFormOf,
    withState,
    workOf,
} from "../../utils/media";
import { allows } from "../../utils/permissions";
import { holdsTerms, searchTerms } from "../../utils/search";
import { NO_MODIFIERS, nextSelection } from "../../utils/selection";
import { pressesKey, typesInField } from "../../utils/shortcut";
import Icon from "../icons/icon";
import TransferPanel from "../transfers/transfer-panel";
import Backdrop from "../ui/backdrop";
import Text from "../ui/text";
import UploadPanel from "../uploads/upload-panel";
import { choiceKey } from "./choice-list";
import ChoicesPane from "./choices-pane";
import ChooseBar from "./choose-bar";
import DropZone from "./drop-zone";
import GroupCreate from "./group-create";
import LibraryList from "./library-list";
import MediaAsset from "./media-asset";
import { ChoiceMessages, MediaFormBody } from "./media-form";
import styles from "./media-frame.module.css";
import MediaGrid from "./media-grid";
import MediaGroup from "./media-group";
import MediaHeader from "./media-header";
import MediaMove from "./media-move";
import MediaProcess from "./media-process";
import MediaUpload from "./media-upload";

import type { PropertiesCache } from "../../store/properties-cache";
import type { TransferEnded } from "../../store/transfer-queue";
import type {
    AssetHold,
    DroppedFiles,
    EntrySelection,
    FileAdapter,
    FileEntry,
    FilePreviewer,
    FileUploadItem,
    FieldErrors,
    FollowedAssets,
    MediaActionGroup,
    MediaAssetDraw,
    MediaGridHandle,
    MediaAssetParams,
    MediaChoice,
    MediaGroupForm,
    MediaLayout,
    MediaLayouts,
    MediaLocation,
    MediaLocationChangeReason,
    MediaManagerApi,
    MediaPickForm,
    MediaProcessForm,
    MediaSearch,
    MediaSection,
    MediaSectionGroup,
    MediaUploadCheck,
    MediaUploadForm,
    MediaViewed,
    PropertyDefinitionGroup,
    PropertyErrorKeyParams,
    ToolbarGroup,
    TransferItem,
} from "../../types";

export interface MediaFrameProps {
    groups: readonly MediaSectionGroup[];
    adapter: FileAdapter;
    multiple: boolean;
    /** How many can be selected at once with `multiple`. */
    maxChoices: number | undefined;
    /** Whether an asset can be added beside those already picked, for this use. */
    canSelect:
        | ((
              asset: FileEntry,
              section: MediaSection,
              choices: readonly MediaChoice[],
              trail: readonly FileEntry[] | undefined,
          ) => boolean | string)
        | undefined;
    /** Whether groups can be selected as well as assets, while the app takes a pick. */
    selectGroups: boolean;
    /** The app's actions in the header. */
    actions: readonly MediaActionGroup[] | undefined;
    onChoose: ((choices: MediaChoice[]) => void) | undefined;
    pickForm: ((asset: FileEntry, section: MediaSection) => MediaPickForm | null) | undefined;
    /** What an asset shows as it's opened, where its library has no `properties` of its own. */
    properties: ((asset: FileEntry, section: MediaSection) => PropertyDefinitionGroup[]) | undefined;
    /** The media manager's own previewers, asked after a library's. */
    previewers: readonly FilePreviewer[] | undefined;
    /** Draws the assets of the libraries with no `renderAsset` of their own. */
    renderAsset: ((params: MediaAssetParams) => ReactNode) | undefined;
    /** Draws the groups of the libraries with no `renderGroup` of their own. */
    renderGroup: ((params: MediaAssetParams) => ReactNode) | undefined;
    /** Draws what's above an open group's contents, in the libraries with no `groupHeader` of their own. */
    groupHeader: ((group: FileEntry, section: MediaSection) => ReactNode) | undefined;
    /** The layout each library is shown in, when the app keeps them. */
    layout: MediaLayouts | undefined;
    /** Where the libraries' layouts start, while it doesn't. */
    defaultLayout: MediaLayouts | undefined;
    onLayoutChange: ((layout: MediaLayouts) => void) | undefined;
    /** The library shown and the group open in it, when the app keeps it; null for the first library's root. */
    location: MediaLocation | null | undefined;
    /** Where it starts, while the app doesn't keep it. */
    defaultLocation: MediaLocation | undefined;
    onLocationChange: ((location: MediaLocation, reason: MediaLocationChangeReason) => void) | undefined;
    /** What's shown in the library's place, when the app keeps it; null for the library itself. */
    viewed: MediaViewed | null | undefined;
    /** What's shown in the library's place as it mounts, while the app doesn't keep it. */
    defaultViewed: MediaViewed | undefined;
    onViewedChange: ((viewed: MediaViewed | null) => void) | undefined;
    /** The search, when the app keeps it; null while closed. */
    search: MediaSearch | null | undefined;
    /** The search as it mounts, while the app doesn't keep it. */
    defaultSearch: MediaSearch | undefined;
    onSearchChange: ((search: MediaSearch | null) => void) | undefined;
    /** Uploads at once, from `limits`, or the queue's default. */
    uploadLimit: number | undefined;
    /** Moves at once, from `limits`, or the queue's default. */
    transferLimit: number | undefined;
    /** How long the typing stops before the adapter's `search` is asked, from `limits`, or the default. */
    searchDelay: number | undefined;
    apiRef: Ref<MediaManagerApi> | undefined;
    /** What's selected, when the app keeps it. */
    value: readonly MediaChoice[] | undefined;
    /** What's selected as it mounts, while it doesn't. */
    defaultValue: readonly MediaChoice[] | undefined;
    /** Told what's selected, as it changes. */
    onChange: ((choices: MediaChoice[]) => void) | undefined;
    /** The app's backend's errors, for the picks and their forms, as the app passed them. */
    errors: FieldErrors;
    /** Where a pick's own errors are in `errors`, about it as a whole. */
    choiceErrorKey: ((params: PropertyErrorKeyParams) => string | readonly string[]) | undefined;
    propertiesCache: PropertiesCache;
}

/**
 * An asset selected, by the id of the library it was picked in, as it was listed when it was picked,
 * with what the app's form holds for this use of it: `NO_VALUES` until it's changed, for the form's
 * defaults, and the groups it was picked among, unknown for one the app gave.
 */
interface Pick {
    sectionId: string;
    asset: FileEntry;
    values: Record<string, unknown>;
    trail?: readonly FileEntry[];
}

/**
 * The groups a library is open at, gone into from its root, for the root and the adapter they were
 * walked from, as ids mean nothing under another of either.
 */
interface OpenLevel {
    rootId: string;
    adapter: FileAdapter;
    trail: readonly FileEntry[];
}

/**
 * Who takes the focus as a level shows: the group left, or with none, the first thing in it, once the
 * level it was asked for (`key`) shows, which an app keeping the location may pass back later.
 */
interface LevelFocus {
    key: string;
    groupId: string | null;
    /** Whether it had to wait for the listing, when the user may have gone on elsewhere. */
    waited: boolean;
}

interface GroupHeaderProps {
    draw: (group: FileEntry, section: MediaSection) => ReactNode;
    group: FileEntry;
    section: MediaSection;
}

/**
 * What's selected, in every library, in the order set, which is the order it's handed over in,
 * and the last asset picked without Shift, where a Shift-click's range starts in its library.
 */
type Picks = PicksState<Pick, { sectionId: string; id: string }>;

/** The asset shown in the library's place, by its library's id, as it was when it was opened. */
interface Viewing {
    sectionId: string;
    entry: FileEntry;
    /** Whether it's the group that was open, opened from inside it, so going back goes back in. */
    fromInside?: boolean;
    /** The groups it's in, from the library's root, as it was opened; without it, those open. */
    among?: readonly FileEntry[];
}

/**
 * Files given to a library, as checked before they're sent, and what it asks of them. Its `key` is its
 * own, so what another batch's form held doesn't carry over to this one.
 */
interface UploadStep {
    key: number;
    sectionId: string;
    /** The level they go into, as it was when they were given. */
    into: { id: string; name: string };
    check: MediaUploadCheck;
    form: MediaUploadForm | null;
}

/** An asset of a library being asked what's to be made of it, with what can be asked as it opened. */
interface ProcessStep {
    sectionId: string;
    entry: FileEntry;
    form: MediaProcessForm;
}

/** An asset or group being asked where it goes, by its library's id, as it was when that opened. */
interface MoveStep {
    sectionId: string;
    entry: FileEntry;
}

/** A group being edited in its details, by its library's id, with its form as it opened. */
interface EditStep {
    sectionId: string;
    entry: FileEntry;
    form: MediaGroupForm;
}

/** Where a move under way is taking its asset or group: its library, and the groups open there. */
interface MovePlace {
    sectionId: string;
    trail: readonly FileEntry[];
}

/** Where an upload went: its library, and the root or group in it. */
interface UploadLevel {
    sectionId: string;
    folderId: string;
}

/**
 * A file just uploaded into a library, by its entry's id, waiting to be listed there: until it is,
 * its tile stands in for it, and while the app takes a choice, it's then selected.
 */
interface Arrival {
    key: number;
    uploadId: number;
    sectionId: string;
    entryId: string;
}

const NO_ENTRIES: FileEntry[] = [];
const NO_IDS: ReadonlySet<string> = new Set();
const NO_PICKS: Picks = { items: [], anchor: null };
const NO_VALUES: Record<string, unknown> = {};
const NO_ERROR_KEYS: readonly string[] = [];
const NO_FOLDER_IDS: readonly string[] = [];
// The choices made from a pick's form's defaults, nothing being changed yet, so what's made from them
// again is too, and they go on following the form.
const DEFAULTED = new WeakSet<MediaChoice>();
const NO_TRAIL: readonly FileEntry[] = [];
const NO_LEVELS: Readonly<Record<string, OpenLevel>> = {};
const NO_PREVIEWERS: readonly FilePreviewer[] = [];
const NO_LAYOUTS: MediaLayouts = {};
// What's offered with no library to show.
const NO_SECTION_LAYOUTS: readonly MediaLayout[] = ["grid"];
const NO_ARRIVALS: readonly Arrival[] = [];
const NO_UPLOADS: readonly FileUploadItem[] = [];
const NO_UPLOAD_LEVELS: ReadonlyMap<number, UploadLevel> = new Map();
const NO_HOLDS: ReadonlyMap<string, AssetHold> = new Map();
const NO_CHOICES: readonly MediaChoice[] = [];
const NO_ACTIONS: readonly ToolbarGroup[] = [];

/** How long a file just uploaded is waited for in its library's listing, in ms. */
const ARRIVAL_WAIT = 10_000;
// Stands in for a library while there's none, so the listing's hook has one to not list.
const NO_SECTION: MediaSection = { id: "", label: "", rootId: "", kind: "image" };

const pickOf = (choice: MediaChoice): Pick => ({
    sectionId: choice.section.id,
    asset: choice.asset,
    values: DEFAULTED.has(choice) ? NO_VALUES : (choice.values ?? NO_VALUES),
    trail: choice.trail,
});

// The same format as `choiceKey`, so a pick can be found among the choices made from it.
const pickKey = ({ sectionId, asset }: Pick) => `${sectionId}\u0000${asset.id}`;

/** Whether two picks are one to the app, which a new listing's entry for the asset doesn't change. */
const sameToApp = (a: Pick, b: Pick) => pickKey(a) === pickKey(b) && a.values === b.values;

/**
 * The picks the app's list means. A choice says where it was picked; one the app made without that
 * takes it from what's known, or has no known level. One it made or copied has its values count as
 * changed, as nothing says they were the form's defaults.
 */
const picksGiven = (list: readonly MediaChoice[], known: readonly Pick[]) =>
    list.map((choice) => {
        const pick = pickOf(choice);

        return pick.trail ? pick : { ...pick, trail: known.find((item) => pickKey(item) === pickKey(pick))?.trail };
    });

/**
 * A choice as the app is handed it, its values its own, as what a form's defaults gave may be one
 * object, the form's. It's known for what it is if the app hands it back as `value`.
 */
const handedCopy = (choice: MediaChoice): MediaChoice => {
    const copy = { ...choice, values: { ...choice.values } };

    if (DEFAULTED.has(choice)) {
        DEFAULTED.add(copy);
    }

    return copy;
};

const isGroup = (entry: FileEntry) => entry.kind === "folder";

/** Whether two ways through a library are the same groups, by their ids and names. */
const sameTrail = (a: readonly FileEntry[] | undefined, b: readonly FileEntry[] | undefined) =>
    a === b ||
    (!!a &&
        !!b &&
        a.length === b.length &&
        a.every((group, index) => group.id === b[index].id && group.name === b[index].name));

/** Whether two locations are the same place, as the app would see it, which telling it again would not change. */
const sameLocation = (a: MediaLocation | null, b: MediaLocation | null) =>
    a === b || (!!a && !!b && a.sectionId === b.sectionId && sameTrail(a.trail, b.trail));

/**
 * Whether two things shown in a library's place are the same: the same entry, as listed, so one saved
 * since, as a group edited, takes its place, among the same groups.
 */
const sameViewed = (a: MediaViewed | null, b: MediaViewed | null) =>
    a === b || (!!a && !!b && a.sectionId === b.sectionId && a.entry === b.entry && sameTrail(a.trail, b.trail));

/**
 * A way through a library as the app gave it, each group the fullest entry known of it: one of those
 * walked or asked for, which an app rebuilding the location from ids and names, as from a URL, lacks.
 */
const fullestTrail = (given: readonly FileEntry[], ...known: (readonly FileEntry[] | undefined)[]) =>
    given.map((group) => {
        for (const trail of known) {
            const fuller = trail?.find(({ id }) => id === group.id);

            if (fuller) {
                return fuller;
            }
        }

        return group;
    });

/** What the app draws above a group's contents, as a component of its own, so it may use hooks. */
const GroupHeader = ({ draw, group, section }: GroupHeaderProps) => draw(group, section);

/** Everything inside the media manager's root, below the contexts it provides. */
const MediaFrame = ({
    groups,
    adapter,
    multiple,
    maxChoices,
    canSelect,
    selectGroups,
    actions,
    onChoose,
    pickForm,
    properties,
    previewers = NO_PREVIEWERS,
    renderAsset,
    renderGroup,
    groupHeader,
    layout: layoutProp,
    defaultLayout = NO_LAYOUTS,
    onLayoutChange,
    location: locationProp,
    defaultLocation,
    onLocationChange,
    viewed: viewedProp,
    defaultViewed,
    onViewedChange,
    search: searchProp,
    defaultSearch,
    onSearchChange,
    uploadLimit,
    transferLimit,
    searchDelay,
    apiRef,
    value,
    defaultValue,
    onChange,
    errors,
    choiceErrorKey,
    propertiesCache,
}: MediaFrameProps) => {
    const { text, foldLetters, compareNames, formatNumber, formatPercent } = useLocale();
    const sections = useMemo(() => groups.flatMap((group) => group.sections), [groups]);
    const sectionsById = useMemo(() => new Map(sections.map((item) => [item.id, item])), [sections]);
    // Where it is, which the app may keep: the library shown and the groups gone into in it, or null
    // for the first library's root. Each change says why, which `goTo` sets as it asks for it.
    const changeReason = useRef<MediaLocationChangeReason>("navigate");
    const [location, setLocation] = useSetting<MediaLocation | null>({
        name: "location",
        component: "MediaManager",
        value: locationProp,
        defaultValue: defaultLocation ?? null,
        onChange: (next) => next && onLocationChange?.(next, changeReason.current),
        equal: sameLocation,
    });
    // A location in a library that isn't there shows the first library's root, until it's replaced.
    const placed = location && sectionsById.has(location.sectionId) ? location : null;
    const section = (placed && sectionsById.get(placed.sectionId)) || sections[0];
    const sectionAdapter = section?.adapter ?? adapter;
    const several = sections.length > 1;
    // Each library stays at the group it was left at, going by the root and the adapter it was walked
    // from, as an app may change either: the location says where the one shown is, and each other's is
    // remembered while mounted, to go back to.
    const [levels, setLevels] = useState(NO_LEVELS);
    // The location last asked for, whose groups are the fullest known of them should the app hand back
    // only their ids and names.
    const askedLocation = useRef<MediaLocation | null>(null);
    const [recorded, setRecorded] = useState<MediaLocation | null>(null);

    // A new location is remembered as its library's level, as it's shown, with the root and the adapter
    // it's shown under, each group the fullest entry known of it.
    if (placed && section && !sameLocation(placed, recorded)) {
        setRecorded(placed);
        setLevels((previous) => {
            const memo = previous[section.id];
            const fits = !!memo && memo.rootId === section.rootId && memo.adapter === sectionAdapter;

            return fits && sameTrail(memo.trail, placed.trail)
                ? previous
                : {
                      ...previous,
                      [section.id]: {
                          rootId: section.rootId,
                          adapter: sectionAdapter,
                          trail: fullestTrail(
                              placed.trail,
                              askedLocation.current?.sectionId === section.id ? askedLocation.current.trail : undefined,
                              fits ? memo.trail : undefined,
                          ),
                      },
                  };
        });
    }

    const kept = placed && section && levels[section.id];
    const trail = kept && kept.rootId === section.rootId && kept.adapter === sectionAdapter ? kept.trail : NO_TRAIL;
    const openGroup = trail.at(-1);
    const inGroup = !!openGroup;
    const folderId = openGroup?.id ?? section?.rootId ?? "";
    const levelName = openGroup?.name ?? section?.label ?? "";
    const levelKey = `${section?.id}/${folderId}`;
    const { state, reload } = useFolder(section ?? NO_SECTION, folderId, !!section, true);
    // Whether the app takes a pick at all, which Choose finishing or not doesn't change.
    const choosing = !!onChoose || !!onChange || value !== undefined || defaultValue !== undefined;
    // Limits are on what's chosen, so they're nothing while the media manager is only looked through.
    const limit = choosing && multiple ? (countLimit(maxChoices, 1) ?? Infinity) : Infinity;
    const rule = choosing ? canSelect : undefined;
    const { announcement, announce } = useAnnouncer();

    const {
        search: searchValue,
        query,
        setQuery,
        searching,
        searchInputRef,
        searchButtonRef,
        openSearch,
        stopSearching,
        closeSearch,
    } = useMediaSearch({
        component: "MediaManager",
        value: searchProp,
        defaultValue: defaultSearch,
        onChange: onSearchChange,
    });
    // Each time something here changes the backend, which a search through it is asked again after.
    const [changes, setChanges] = useState(0);
    const search = useLevelSearch(section, sectionAdapter, folderId, query, changes, searchDelay);
    // What a search found that's been deleted or moved, gone at once until it's answered again.
    const [goneHits, setGoneHits] = useState<ReadonlySet<string>>(NO_IDS);

    useEffect(() => setGoneHits(NO_IDS), [search.hits]);

    // The groups an entry shown is in, from the library's root: those open, and any a search found it
    // below them.
    const placeOf = useCallback(
        (id: string) => {
            const below = search.trails.get(id);

            return below ? [...trail, ...groupsOfTrail(below)] : trail;
        },
        [search.trails, trail],
    );
    // What the app is told is made as `choices` is, which needs the listing, and more below that needs
    // the picks, so it's reached through this.
    const choicesOfRef = useRef<(items: readonly Pick[]) => MediaChoice[]>(() => []);
    const { picks, setPicks, dropGone } = usePicks<Pick, NonNullable<Picks["anchor"]>, MediaChoice>({
        component: "MediaManager",
        value,
        defaultValue,
        onChange,
        given: picksGiven,
        told: (items) => choicesOfRef.current(items).map(handedCopy),
        sameItem: sameToApp,
        keyOf: pickKey,
    });
    // What's shown in the library's place, which the app may keep, and whether it's the group that was
    // open, opened from inside it, which is the media manager's own.
    const [viewedValue, setViewedValue] = useSetting<MediaViewed | null>({
        name: "viewed",
        component: "MediaManager",
        value: viewedProp,
        defaultValue: defaultViewed ?? null,
        onChange: onViewedChange,
        equal: sameViewed,
    });
    const [insideOf, setInsideOf] = useState<string | null>(null);
    const viewing = useMemo<Viewing | null>(
        () =>
            viewedValue && {
                sectionId: viewedValue.sectionId,
                entry: viewedValue.entry,
                among: viewedValue.trail,
                fromInside: insideOf === viewedValue.entry.id,
            },
        [viewedValue, insideOf],
    );
    // Shows something in a library's place, among the groups it's in, or nothing.
    const setViewing = useCallback(
        (next: (Viewing & { among: readonly FileEntry[] }) | null) => {
            setInsideOf(next?.fromInside ? next.entry.id : null);
            setViewedValue(next && { sectionId: next.sectionId, entry: next.entry, trail: next.among });
        },
        [setViewedValue],
    );
    const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(NO_IDS);
    // The order the app was last handed the picks in, at Choose, by their keys, which the keys of
    // the errors its backend answers go by.
    const [handedOrder, setHandedOrder] = useState<readonly string[] | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    // The grid of the level shown, which focuses an asset wherever it is, rendered or not.
    const gridRef = useRef<MediaGridHandle>(null);
    // The asset the view went back from, whose tile takes the focus back.
    const backFromRef = useRef<string | null>(null);
    const deletedAtRef = useRef<number | null>(null);
    const levelFocusRef = useRef<LevelFocus | null>(null);
    const groupDetailsRef = useRef<HTMLButtonElement>(null);
    // Going back into a group from its details, which gives the focus back to the button they opened from.
    const backInsideRef = useRef(false);
    // The level a new group's name is being asked at, the button asking it, and the group just made,
    // whose tile takes the focus once it's listed, with no details to open.
    const [creatingAt, setCreatingAt] = useState<string | null>(null);
    const newGroupRef = useRef<HTMLButtonElement>(null);
    const createdRef = useRef<string | null>(null);
    const { store } = useData();
    // Moves run in the background, as the file manager's do, whose queue and panel these are.
    const [moveStep, setMoveStep] = useState<MoveStep | null>(null);
    const [editStep, setEditStep] = useState<EditStep | null>(null);
    const movePlaces = useRef(new Map<number, MovePlace>());
    const moveEnded = useRef<TransferEnded | null>(null);
    const transfers = useTransferQueue(
        (item, outcome, items, made) => moveEnded.current?.(item, outcome, items, made),
        text,
    );

    useLayoutEffect(() => transfers.queue.setMaxActive(transferLimit), [transfers.queue, transferLimit]);

    // What's on its way elsewhere is gone from where it was, until it's back should it not go.
    const movingIds = useMemo(() => {
        const moving = transfers.items.filter(
            (item) => item.adapter === sectionAdapter && (item.status === "queued" || item.status === "running"),
        );

        return moving.length > 0 ? new Set(moving.flatMap((item) => item.entries.map(({ id }) => id))) : NO_IDS;
    }, [transfers.items, sectionAdapter]);

    // Uploading: the step before files are sent, files dragged over the library, the level each
    // upload went into, by its id, and what's just arrived, waiting to be listed.
    const [uploadStep, setUploadStep] = useState<UploadStep | null>(null);
    const uploadStepCount = useRef(0);
    const [uploadLevels, setUploadLevels] = useState(NO_UPLOAD_LEVELS);
    const [arrivals, setArrivals] = useState(NO_ARRIVALS);
    const arrivedRef = useRef(new Set<number>());
    const arrivalCount = useRef(0);
    const pickerRef = useRef<HTMLInputElement>(null);
    const uploadButtonRef = useRef<HTMLButtonElement>(null);
    const [processStep, setProcessStep] = useState<ProcessStep | null>(null);

    const { chosenOverlay, setChosenOverlay, docked, frameRef, chosenRef, openerRef, closeChosen } =
        useChosenColumn(choosing);

    // The libraries: docked where there's room, or a drawer while opened.
    const [librariesOpen, setLibrariesOpen] = useState(false);
    const librariesRef = useRef<HTMLElement>(null);
    const librariesOpenerRef = useRef<HTMLButtonElement>(null);

    // Closes the drawer as the libraries dock, so narrowing again doesn't bring it back unasked.
    useEffect(() => {
        const frame = frameRef.current;
        const list = librariesRef.current;

        if (!frame || !list) {
            return;
        }

        const observer = new ResizeObserver(() => {
            if (!overlays(list)) {
                setLibrariesOpen(false);
            }
        });

        observer.observe(frame);

        return () => observer.disconnect();
    }, [several]);

    // The drawer takes the focus as it opens, on the library shown.
    useEffect(() => {
        const list = librariesRef.current;

        if (librariesOpen && list) {
            (list.querySelector<HTMLElement>('[aria-current="page"]') ?? list).focus();
        }
    }, [librariesOpen]);

    // What the open level holds, as its adapter lists it: inside a group, in the backend's order, as an
    // album's tracks have theirs; at the root, the newest first. Groups aren't put first, so one coming
    // on a later page doesn't jump.
    const level = useMemo(() => {
        const shown = (state?.entries ?? NO_ENTRIES).filter(
            (entry) => !isHidden(entry) && !deletedIds.has(entry.id) && !movingIds.has(entry.id),
        );

        return inGroup ? shown : shown.sort(byDate(compareNames));
    }, [state?.entries, deletedIds, movingIds, compareNames, inGroup]);

    // Its assets: they're all of the library's kind, so nothing is sorted into kinds here.
    const listed = useMemo(() => level.filter((entry) => !isGroup(entry)), [level]);

    // What the adapter's search found, in its order, but for what's since gone or on its way elsewhere.
    const found = useMemo(
        () => search.hits.map(({ entry }) => entry).filter(({ id }) => !goneHits.has(id) && !movingIds.has(id)),
        [search.hits, goneHits, movingIds],
    );

    // Assets just deleted are gone at once, until the listing comes back without them. Forgotten then,
    // as a backend whose ids are paths may give the id to a file uploaded later.
    useEffect(() => setDeletedIds(NO_IDS), [state?.entries]);

    const sectionId = section?.id;

    // The same asset is the same wherever it's listed: from the same adapter, with the same id. Ids
    // are only unique within an adapter, so two adapters never share one.
    const adapterOf = useCallback((item: MediaSection) => item.adapter ?? adapter, [adapter]);

    // Where a library was left, under the root and the adapter it has now; its root otherwise.
    const rememberedTrail = useCallback(
        (target: MediaSection) => {
            const memo = levels[target.id];

            return memo && memo.rootId === target.rootId && memo.adapter === adapterOf(target) ? memo.trail : NO_TRAIL;
        },
        [levels, adapterOf],
    );

    // Goes somewhere, as the user or the media manager itself does, which the app keeping the location is
    // only asked for, and told why.
    const goTo = useCallback(
        (next: MediaLocation, reason: MediaLocationChangeReason = "navigate") => {
            askedLocation.current = next;
            changeReason.current = reason;
            setLocation(next);
            changeReason.current = "navigate";
        },
        [setLocation],
    );

    // A location in a library that's gone is replaced by the first library's root, and one in a library
    // now rooted elsewhere or served by another adapter by its root, as its groups lead nowhere there.
    // Once a location, so an app passing it again isn't asked again and again.
    const replacedLocation = useRef<MediaLocation | null>(null);

    useLayoutEffect(() => {
        if (!location || sections.length === 0 || replacedLocation.current === location) {
            return;
        }

        if (!sectionsById.has(location.sectionId)) {
            replacedLocation.current = location;
            goTo({ sectionId: sections[0].id, trail: NO_TRAIL }, "replace");
        } else if (location.trail.length > 0 && trail === NO_TRAIL) {
            replacedLocation.current = location;
            goTo({ sectionId: location.sectionId, trail: NO_TRAIL }, "replace");
        }
    }, [location, sections, sectionsById, trail, goTo]);

    // Uploads run in the background, a few at a time, while the user goes on; the libraries they
    // end in, every one on the adapter rooted there, are listed again.
    const relist = useCallback(
        (served: FileAdapter, folderIds: string[]) => {
            setChanges((count) => count + 1);
            sections.forEach((item) => {
                if (adapterOf(item) === served) {
                    store.relist(item.id, served, folderIds);
                }
            });
        },
        [sections, adapterOf, store],
    );

    // An asset done with being processed: every library on its adapter is listed again, as what it
    // has may have changed with it, and any other folders asked for.
    const relistAll = useCallback(
        (served: FileAdapter, others: readonly string[] = NO_FOLDER_IDS) =>
            relist(served, [
                ...others,
                ...sections
                    .filter((item) => adapterOf(item) === served)
                    .flatMap(({ id, rootId }) => {
                        const groupId = levels[id]?.trail.at(-1)?.id;

                        return groupId === undefined ? [rootId] : [rootId, groupId];
                    }),
            ]),
        [relist, sections, adapterOf, levels],
    );

    // Assets their listing says are being processed, in the library shown, among what its search found
    // and among the picks, each through its adapter, followed until they're done; a pick of the library
    // shown as it's listed.
    const processed = useMemo<FollowedAssets[]>(() => {
        const byAdapter = new Map<FileAdapter, Map<string, FileEntry>>();
        const assets = [...listed, ...found.filter((entry) => !isGroup(entry))];
        const listedIds = new Set(assets.map(({ id }) => id));
        const add = (served: FileAdapter, entry: FileEntry) => {
            if (entry.processing?.status === "processing") {
                byAdapter.set(served, (byAdapter.get(served) ?? new Map()).set(entry.id, entry));
            }
        };

        assets.forEach((entry) => add(sectionAdapter, entry));
        picks.items.forEach(({ sectionId: pickedIn, asset }) => {
            const from = sectionsById.get(pickedIn);
            const served = from && adapterOf(from);

            if (served && !(served === sectionAdapter && listedIds.has(asset.id))) {
                add(served, asset);
            }
        });

        return [...byAdapter].map(([served, entries]) => ({ adapter: served, entries: [...entries.values()] }));
    }, [listed, found, picks.items, sectionsById, adapterOf, sectionAdapter]);

    const { states: assetStates, forget: forgetStates } = useAssetStates(processed, relistAll);

    // The open level with what the backend has said since of its assets' processing.
    const leveled = useMemo(() => {
        const own = assetStates.get(sectionAdapter);

        return own ? level.map((entry) => withState(entry, own.get(entry.id))) : level;
    }, [level, assetStates, sectionAdapter]);

    const library = useMemo(() => leveled.filter((entry) => !isGroup(entry)), [leveled]);

    // Once the listing has caught up, what was said of its assets' processing is forgotten, so one
    // processed again later is followed afresh.
    useEffect(() => {
        if (state?.status === "ready") {
            forgetStates(
                sectionAdapter,
                listed.filter((entry) => !entry.processing).map(({ id }) => id),
            );
        }
    }, [state?.status, listed, sectionAdapter, forgetStates]);

    // And once the search has, for what it found elsewhere.
    useEffect(() => {
        if (search.on && search.status === "ready") {
            forgetStates(
                sectionAdapter,
                found.filter((entry) => !entry.processing).map(({ id }) => id),
            );
        }
    }, [search.on, search.status, found, sectionAdapter, forgetStates]);

    // A pick keeps its entry as last listed, so what's handed over while another library is shown has
    // what's been made of it since, and it's followed there as what it's listed as.
    useEffect(() => {
        const listedById = new Map([...found, ...level].map((entry) => [entry.id, entry]));

        setPicks((previous) => {
            let changed = false;
            const items = previous.items.map((item) => {
                const from = sectionsById.get(item.sectionId);
                const now = from && adapterOf(from) === sectionAdapter ? listedById.get(item.asset.id) : undefined;

                if (!now || now === item.asset) {
                    return item;
                }

                changed = true;

                return { ...item, asset: now };
            });

            return changed ? { ...previous, items } : previous;
        });
    }, [level, found, sectionsById, adapterOf, sectionAdapter]);

    const terms = useMemo(() => searchTerms(query, foldLetters), [query, foldLetters]);

    // What's shown: what the adapter's search found, or without one, the open level filtered by name.
    // It's what the grid's indexes go by, and the focus.
    const shownEntries = useMemo(() => {
        if (search.on) {
            const own = assetStates.get(sectionAdapter);

            return own ? found.map((entry) => withState(entry, own.get(entry.id))) : found;
        }

        return terms.length === 0 ? leveled : leveled.filter((entry) => holdsTerms(foldLetters(entry.name), terms));
    }, [search.on, found, assetStates, sectionAdapter, leveled, terms, foldLetters]);

    const shownAssets = useMemo(() => shownEntries.filter((entry) => !isGroup(entry)), [shownEntries]);
    const shownGroupIds = useMemo(
        () => new Set(shownEntries.filter(isGroup).map(({ id }) => id)),
        [shownEntries],
    );

    const order = useMemo(() => shownEntries.map(({ id }) => id), [shownEntries]);

    // Why assets shown can't be chosen now, by their ids: being processed, failed, or refused by
    // their library. They're shown and opened, but not selected.
    const assetHolds = useMemo(() => {
        if (!section) {
            return NO_HOLDS;
        }

        const held = new Map<string, AssetHold>();

        shownAssets.forEach((entry) => {
            const hold = holdOf(entry, section, { text, formatPercent });

            if (hold) {
                held.set(entry.id, hold);
            }
        });

        return held.size > 0 ? held : NO_HOLDS;
    }, [shownAssets, section, text, formatPercent]);

    // The backend's work on assets shown that can be chosen all the same, which their tiles show.
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

    const uploads = useUploadQueue(relist, text.keptBothName);

    useLayoutEffect(() => uploads.queue.setMaxActive(uploadLimit), [uploads.queue, uploadLimit]);

    // Whether the open level can be changed, as far as its listing and the group's own entry say.
    const writable = allows("write", state?.permissions, openGroup?.permissions);

    // Whether the open level takes files: its library's adapter has `upload`, it isn't `readOnly` nor
    // refusing them (`acceptUploads`), and it could be listed and written to.
    const takesFiles =
        !!section && !!sectionAdapter.upload && takesUploads(section) && state?.status !== "error" && writable;

    // Whether a group can be made at the open level: its library says so, for this level, as an
    // adapter's `createFolder` alone doesn't say a library holds groups, it can be changed, and it could
    // be listed, its listing not saying it can't be written to.
    // A new group is asked of by the library's form, where its adapter takes what it holds, or else only
    // named, where its adapter makes one from a name.
    const newGroupForm = useMemo(
        () =>
            section?.groupForm && sectionAdapter.createGroup
                ? section.groupForm({ group: null, parent: openGroup ?? null })
                : null,
        [section, sectionAdapter, openGroup],
    );
    const createsGroups =
        !!section &&
        !!groupRule(section, openGroup ?? null) &&
        (!!newGroupForm || !!sectionAdapter.createFolder) &&
        !section.readOnly &&
        state?.status !== "error" &&
        writable;
    const creatingGroup = createsGroups && creatingAt === levelKey;
    // Its form is a step in the library's place; a name alone is asked above it.
    const formingGroup = creatingGroup && !!newGroupForm;

    // The app's form for a pick, its library's or else the media manager's, and whether there can be any.
    const formOf = useCallback(
        (asset: FileEntry, from: MediaSection) => pickFormOf(asset, from, pickForm),
        [pickForm],
    );
    const asksPicks = !!pickForm || sections.some((item) => item.pickForm);

    // What the app's form holds for a pick until it's changed.
    const defaultsOf = useCallback(
        (asset: FileEntry, from: MediaSection) => (formOf(asset, from)?.defaults as Record<string, unknown>) ?? NO_VALUES,
        [formOf],
    );

    // What picks are, as they are now: in a library that's gone, one goes; picked at the open level of the
    // open library, once that's listed, as it's listed now, and gone when it isn't any more; picked
    // anywhere else, as the open level lists it when it does, through the same adapter, or else as it
    // was picked. One the app gave has no known level, so it's only known to be gone from a library
    // whose root holds no groups, where it can only have been. One on its way elsewhere isn't listed
    // only for that, so it stays as it was.
    const choicesOf = useCallback(
        (items: readonly Pick[]): MediaChoice[] => {
            // Groups too, as one may be picked.
            const listedById = state?.status === "ready" ? new Map(leveled.map((entry) => [entry.id, entry])) : undefined;
            const flat = !inGroup && library.length === leveled.length;

            return items.flatMap(({ sectionId: pickedIn, asset, values, trail: pickedAmong }) => {
                const from = sectionsById.get(pickedIn);

                if (!from) {
                    return [];
                }

                const served = adapterOf(from);
                const listedNow = listedById && served === sectionAdapter ? listedById.get(asset.id) : undefined;
                const atOpenLevel =
                    pickedIn === sectionId && (pickedAmong ? (pickedAmong.at(-1)?.id ?? from.rootId) === folderId : flat);
                const now =
                    listedById && atOpenLevel && !(served === sectionAdapter && movingIds.has(asset.id))
                        ? listedNow
                        : (listedNow ?? withState(asset, assetStates.get(served)?.get(asset.id)));

                if (!now) {
                    return [];
                }

                const choice = {
                    asset: now,
                    section: from,
                    values: values === NO_VALUES ? defaultsOf(now, from) : values,
                    trail: pickedAmong,
                };

                if (values === NO_VALUES) {
                    DEFAULTED.add(choice);
                }

                return [choice];
            });
        },
        [
            sectionsById,
            state?.status,
            library,
            leveled,
            inGroup,
            folderId,
            sectionId,
            adapterOf,
            sectionAdapter,
            assetStates,
            defaultsOf,
            movingIds,
        ],
    );

    const choices = useMemo(() => choicesOf(picks.items), [choicesOf, picks.items]);

    useLayoutEffect(() => {
        choicesOfRef.current = choicesOf;
    });

    // What's found to be gone, its library or its listing no longer having it, is taken out and told,
    // so the app isn't left holding a pick nothing shows. A listing still loading finds nothing gone.
    useEffect(() => {
        const shown = new Set(choices.map(choiceKey));

        dropGone(picks.items.map(pickKey).filter((key) => !shown.has(key)));
    }, [choices, picks.items, dropGone]);

    // Until the app has been handed any, as with errors for the picks it gave as `defaultValue`, the
    // order of the picks as the errors came.
    const [errorsCame, setErrorsCame] = useState(() => ({ errors, order: choices.map(choiceKey) }));

    if (errorsCame.errors !== errors) {
        setErrorsCame({ errors, order: choices.map(choiceKey) });
    }

    // Each pick's place in the order the errors' keys go by, by its key, so its errors stay with it
    // as it's moved; one added since has none.
    const errorsOrder = handedOrder ?? errorsCame.order;
    const errorPlaces = useMemo(() => new Map(errorsOrder.map((key, place) => [key, place])), [errorsOrder]);

    // Hands the picks to the app, keeping the order they went in, each with its values to itself.
    const handOver = useCallback(
        (handed: MediaChoice[]) => {
            setHandedOrder(handed.map(choiceKey));
            onChoose?.(handed.map(handedCopy));
        },
        [onChoose],
    );

    // What a pick's form is drawn from and its functions read: its errors, found by its place in the
    // order the app was handed the picks in. One added since has none, as the backend never saw it,
    // and its place now.
    const pickState = useCallback(
        (choice: MediaChoice, index: number, all: readonly MediaChoice[]) => {
            const place = errorPlaces.get(choiceKey(choice));

            return {
                asset: choice.asset,
                section: choice.section,
                adapter: adapterOf(choice.section),
                values: choice.values,
                errors: place === undefined ? NO_ERRORS : errors,
                index: place ?? index,
                choices: all,
            };
        },
        [errorPlaces, errors, adapterOf],
    );

    // Why a pick's form isn't ready, by its `ready`; nothing once it is.
    const unfilledOf = useCallback(
        (choice: MediaChoice, index: number, all: readonly MediaChoice[]): AssetHold | undefined => {
            const answer = formOf(choice.asset, choice.section)?.ready?.(pickState(choice, index, all)) ?? true;

            return answer === true
                ? undefined
                : { status: "unfilled", text: typeof answer === "string" && answer ? answer : text.mediaChoiceUnfilled };
        },
        [formOf, pickState, text],
    );

    // Why the app's `canSelect` refuses an asset beside those picked, given the groups it's in, unknown
    // for a pick the app gave without them; nothing when it allows it.
    const refusalOf = useCallback(
        (
            asset: FileEntry,
            from: MediaSection,
            picked: readonly MediaChoice[],
            among: readonly FileEntry[] | undefined,
        ): AssetHold | undefined => {
            const allowed = rule?.(asset, from, picked, among) ?? true;

            return allowed === true
                ? undefined
                : { status: "refused", text: typeof allowed === "string" && allowed ? allowed : text.mediaUnavailable };
        },
        [rule, text],
    );

    const full = choices.length >= limit;
    const sayFull = useCallback(() => announce(text.mediaChoicesFull), [announce, text]);

    // Those of `assets` that can join `picked`, in their order, each asked with those before it, and
    // whether the limit left some out, which is said, as no tile says it.
    const fitting = useCallback(
        (assets: readonly FileEntry[], from: MediaSection, picked: readonly MediaChoice[]) => {
            const growing = [...picked];
            const fit: FileEntry[] = [];

            for (const asset of assets) {
                if (growing.length >= limit) {
                    return { fit, cut: true };
                }

                const among = placeOf(asset.id);

                if (!refusalOf(asset, from, growing, among)) {
                    fit.push(asset);
                    growing.push({ asset, section: from, values: defaultsOf(asset, from), trail: among });
                }
            }

            return { fit, cut: false };
        },
        [limit, refusalOf, defaultsOf, placeOf],
    );

    // Why an asset that isn't selected can't be added now, for its view: the app's rule, or no room.
    const refusedNow = useCallback(
        (asset: FileEntry, from: MediaSection, among: readonly FileEntry[]): AssetHold | undefined =>
            refusalOf(asset, from, multiple ? choices : NO_CHOICES, among) ??
            (full ? { status: "refused", text: text.mediaChoicesFull } : undefined),
        [refusalOf, multiple, choices, full, text],
    );

    // One at a time with nothing selected, the column has nothing to show, so it's left out.
    const chosenEmpty = !multiple && choices.length === 0;

    // Whether a pick is of an asset the open library could list, through its adapter.
    const inOpen = useCallback(
        (choice: MediaChoice) => adapterOf(choice.section) === sectionAdapter,
        [adapterOf, sectionAdapter],
    );

    // The open library's share of it, which its grid shows selected: what was picked through its
    // adapter, in whichever library.
    const selectedIds = useMemo(
        () => new Set(choices.filter(inOpen).map(({ asset }) => asset.id)),
        [choices, inOpen],
    );

    // The groups shown that can be selected, while the app takes them.
    const groupPicks = useMemo(
        () =>
            choosing && selectGroups && section
                ? groupPicksOf(
                      shownEntries.filter(isGroup),
                      section,
                      selectedIds,
                      rule && ((group) => rule(group, section, multiple ? choices : NO_CHOICES, placeOf(group.id))),
                  )
                : NO_GROUP_PICKS,
        [choosing, selectGroups, section, shownEntries, selectedIds, rule, multiple, choices, placeOf],
    );

    // Why assets shown can't be added now: as above, or refused by the app's rule beside those picked,
    // one at a time none, as it would replace them. Those selected already stay as they are, as they
    // can be taken out, and their rows say it.
    const holds = useMemo(() => {
        if (!section || (!rule && groupPicks.refusals.size === 0)) {
            return assetHolds;
        }

        const held = new Map([...assetHolds, ...groupPicks.refusals]);

        shownAssets.forEach((entry) => {
            if (rule && !held.has(entry.id) && !selectedIds.has(entry.id)) {
                const refusal = refusalOf(entry, section, multiple ? choices : NO_CHOICES, placeOf(entry.id));

                if (refusal) {
                    held.set(entry.id, refusal);
                }
            }
        });

        return held.size > 0 ? held : NO_HOLDS;
    }, [section, rule, assetHolds, groupPicks, shownAssets, selectedIds, refusalOf, multiple, choices, placeOf]);

    // Why picks can't be chosen now, by their keys, which holds Choose back until they can, or are
    // taken out: past the limit, still being processed, failed, refused by their library or the app's
    // rule beside those before them, or their form not ready.
    const choiceHolds = useMemo(() => {
        const held = new Map<string, AssetHold>();

        choices.forEach((choice, index) => {
            const hold: AssetHold | undefined =
                index >= limit
                    ? { status: "refused", text: text.mediaOverLimit(formatNumber(limit)) }
                    : (holdOf(choice.asset, choice.section, { text, formatPercent }) ??
                      refusalOf(choice.asset, choice.section, choices.slice(0, index), choice.trail) ??
                      unfilledOf(choice, index, choices));

            if (hold) {
                held.set(choiceKey(choice), hold);
            }
        });

        return held.size > 0 ? held : NO_HOLDS;
    }, [choices, limit, text, formatNumber, formatPercent, refusalOf, unfilledOf]);

    const holdOfChoice = useCallback((choice: MediaChoice) => choiceHolds.get(choiceKey(choice)), [choiceHolds]);

    const chooseHeld = useMemo(() => chooseHeldBy([...choiceHolds.values()], text), [choiceHolds, text]);

    // Whether a pick kept is of the same asset as a choice.
    const samePick = useCallback(
        (pick: Pick, { section, asset }: MediaChoice) => {
            const pickedIn = sectionsById.get(pick.sectionId);

            return pick.asset.id === asset.id && !!pickedIn && adapterOf(pickedIn) === adapterOf(section);
        },
        [sectionsById, adapterOf],
    );

    // The asset or group shown in the library's place, as it's listed now while it is: where it is among
    // what's shown, and among the assets, which Previous and Next go through.
    const viewed = useMemo(() => {
        if (!viewing || viewing.sectionId !== sectionId || !section) {
            return undefined;
        }

        const entry =
            leveled.find(({ id }) => id === viewing.entry.id) ??
            shownEntries.find(({ id }) => id === viewing.entry.id) ??
            viewing.entry;

        return {
            entry,
            index: shownEntries.findIndex(({ id }) => id === entry.id),
            step: shownAssets.findIndex(({ id }) => id === entry.id),
        };
    }, [viewing, sectionId, section, leveled, shownEntries, shownAssets]);

    // Where it is, which a search may have found it below what's open: what it's picked among, moved
    // from and listed in. There, what's open says nothing of what can be done to it, and it's asked of
    // the group it's in as far as that's known, and then the backend.
    const viewedTrail = viewing?.among ?? trail;
    const viewedFolderId = viewedTrail.at(-1)?.id ?? section?.rootId ?? "";
    const viewedElsewhere = viewedFolderId !== folderId;
    const viewedChangeable =
        !!section &&
        !section.readOnly &&
        (viewedElsewhere ? allows("write", viewedTrail.at(-1)?.permissions) : writable);

    // The picks with the open library's share made `ids`: those of other libraries stay when several
    // can be chosen, in their place, and those `ids` adds go at the end, in the order shown, as many
    // as the limit and the app's rule let in.
    const picksWith = useCallback(
        (ids: ReadonlySet<string>, anchor: string | null): Picks => {
            if (sectionId === undefined || !section) {
                return NO_PICKS;
            }

            const kept = choices.filter((choice) => (inOpen(choice) ? ids.has(choice.asset.id) : multiple));
            const { fit, cut } = fitting(
                shownEntries.filter((entry) => ids.has(entry.id) && !selectedIds.has(entry.id)),
                section,
                kept,
            );

            if (cut) {
                sayFull();
            }

            return {
                items: [
                    ...kept.map(pickOf),
                    ...fit.map((asset) => ({ sectionId, asset, values: NO_VALUES, trail: placeOf(asset.id) })),
                ],
                anchor: anchor === null ? null : { sectionId, id: anchor },
            };
        },
        [sectionId, section, choices, inOpen, multiple, shownEntries, selectedIds, fitting, sayFull, placeOf],
    );

    // The open library's share as `ids` would make it, without the groups that can't be selected and
    // those it adds that can't be chosen now, as a Shift-click's range or Select all may hold.
    const selectable = useCallback(
        (ids: ReadonlySet<string>) =>
            new Set(
                [...ids].filter((id) =>
                    shownGroupIds.has(id) ? groupPicks.checks.has(id) : selectedIds.has(id) || !holds.has(id),
                ),
            ),
        [shownGroupIds, groupPicks, holds, selectedIds],
    );

    // Several at once, a click adds or takes away the asset, as a media picker does, and Shift adds
    // those from the last one clicked; what's selected in other libraries stays. One at a time, it
    // selects the asset alone, in place of what was selected in any library.
    const press = useCallback(
        (index: number, keys: { toggle: boolean; range: boolean }) => {
            const id = order[index];

            // One that can't be chosen now isn't selected; one selected already can be taken out.
            if (id === undefined || (holds.has(id) && !selectedIds.has(id))) {
                return;
            }

            // A group is only selected by its check, though a range may run through one without.
            if (shownGroupIds.has(id) && !groupPicks.checks.has(id) && !(multiple && keys.range)) {
                return;
            }

            // With no room for it, nothing changes, and it's said, as its tile says nothing.
            if (full && !selectedIds.has(id) && !keys.range) {
                sayFull();

                return;
            }

            const base: EntrySelection = {
                ids: selectedIds,
                anchor: picks.anchor?.sectionId === sectionId ? picks.anchor.id : null,
            };
            // A group's check takes it out again, one at a time too, as nothing else on it could.
            const next =
                multiple || (shownGroupIds.has(id) && selectedIds.has(id))
                    ? nextSelection(base, id, { toggle: true, range: multiple && keys.range }, order)
                    : nextSelection(base, id, NO_MODIFIERS, order);

            setPicks(picksWith(selectable(next.ids), next.anchor));
        },
        [
            order,
            holds,
            shownGroupIds,
            groupPicks,
            selectedIds,
            full,
            sayFull,
            picks.anchor,
            sectionId,
            multiple,
            picksWith,
            selectable,
        ],
    );

    const selectAll = useCallback(() => {
        setPicks(picksWith(selectable(new Set([...selectedIds, ...order])), order[0] ?? null));
    }, [picksWith, selectable, selectedIds, order]);

    const clearSelection = useCallback(() => setPicks(NO_PICKS), []);

    // Moves one in the order they're handed over in, from the selected column.
    const moveChoice = useCallback(
        (from: number, to: number) => {
            const items = choices.map(pickOf);
            const [moved] = items.splice(from, 1);

            if (moved) {
                items.splice(to, 0, moved);
                setPicks((previous) => ({ ...previous, items }));
            }
        },
        [choices],
    );

    const removeChoice = useCallback(
        (choice: MediaChoice) => {
            setPicks((previous) => ({ ...previous, items: previous.items.filter((item) => !samePick(item, choice)) }));
        },
        [samePick],
    );

    // What the app's form holds for one pick, kept with it.
    const setChoiceValues = useCallback(
        (choice: MediaChoice, next: SetStateAction<Record<string, unknown>>) => {
            setPicks((previous) => ({
                ...previous,
                items: previous.items.map((item) => {
                    if (!samePick(item, choice)) {
                        return item;
                    }

                    const held = item.values === NO_VALUES ? choice.values : item.values;

                    return { ...item, values: typeof next === "function" ? next(held) : next };
                }),
            }));
        },
        [samePick],
    );

    // The asset view's Select: adds the asset, or with one at a time puts it in place of what was
    // selected, or takes it out.
    const toggleViewed = useCallback(() => {
        if (!viewed || !section || (isGroup(viewed.entry) && !groupPicks.checks.has(viewed.entry.id))) {
            return;
        }

        const choice = { asset: viewed.entry, section, values: NO_VALUES };

        if (selectedIds.has(viewed.entry.id)) {
            removeChoice(choice);
        } else if (!holdOf(viewed.entry, section, { text, formatPercent }) && !refusedNow(viewed.entry, section, viewedTrail)) {
            const pick = { ...pickOf(choice), trail: viewedTrail };

            setPicks((previous) => ({
                items: multiple ? [...previous.items, pick] : [pick],
                anchor: { sectionId: section.id, id: viewed.entry.id },
            }));
        }
    }, [viewed, section, groupPicks, selectedIds, removeChoice, multiple, text, formatPercent, refusedNow, viewedTrail]);

    // Whether what's open can be deleted from: its adapter does, its library can be changed, and it can
    // be written to. A listing's own `delete` is about the folder, not what's in it.
    const deletes = !!section && !!sectionAdapter.delete && !section.readOnly && writable;
    // Whether a group has details: what the app defines, or the adapter's own.
    const hasDetails = !!section && (!!section.properties || !!properties || !!sectionAdapter.properties);
    // Whether what's open can be moved from: as for deleting, by its adapter's `move`.
    const moves = !!section && !!sectionAdapter.move && !section.readOnly && writable;
    // Whether a group may have a form to edit it by.
    const editsGroups = !!section?.groupForm && !!sectionAdapter.updateGroup && !section.readOnly && writable;
    // A group opens for those, or to be edited, moved or deleted, the one way there is to.
    const opensGroups = hasDetails || deletes || moves || editsGroups;
    // Whether a group of a library opens for its details where what's allowed at the level it's in isn't
    // known until it's there, as from inside it, or from outside the media manager: what the app defines,
    // or anything to do to it.
    const groupOpensIn = useCallback(
        (target: MediaSection) => {
            const served = adapterOf(target);

            return (
                !!target.properties ||
                !!properties ||
                !!served.properties ||
                (!target.readOnly && (!!served.delete || !!served.move || (!!target.groupForm && !!served.updateGroup)))
            );
        },
        [adapterOf, properties],
    );
    const opensOpenGroup = !!section && groupOpensIn(section);

    // Opens an asset, or a group's details, in the library's place, where it is.
    const viewAt = useCallback(
        (entry: FileEntry) => {
            if (section) {
                setViewing({ sectionId: section.id, entry, among: placeOf(entry.id) });
            }
        },
        [section, placeOf, setViewing],
    );

    const openAsset = useCallback(
        (index: number) => {
            const entry = shownEntries[index];

            if (entry && (!isGroup(entry) || opensGroups)) {
                viewAt(entry);
            }
        },
        [shownEntries, opensGroups, viewAt],
    );

    // Goes to a level of a library, with what was over the library gone, as opening a folder ends a
    // search in the file manager, and says where it is, as the focus only says what it's on.
    const leaveFor = useCallback(
        (target: MediaSection, next: readonly FileEntry[]) => {
            goTo({ sectionId: target.id, trail: next });
            stopSearching();
            setViewing(null);
            setUploadStep(null);
            setProcessStep(null);
            setMoveStep(null);
            setEditStep(null);
            setCreatingAt(null);
            announce(text.mediaInGroup(isolate(next.at(-1)?.name ?? target.label)));
        },
        [goTo, stopSearching, setViewing, announce, text],
    );

    // Another level of the open library, the group left or the first thing in it taking the focus.
    const showLevel = useCallback(
        (next: readonly FileEntry[], groupId: string | null) => {
            if (!section) {
                return;
            }

            levelFocusRef.current = {
                key: `${section.id}/${next.at(-1)?.id ?? section.rootId}`,
                groupId,
                waited: false,
            };
            leaveFor(section, next);
        },
        [section, leaveFor],
    );

    // Into a group, from wherever it's shown, as a search may have found it far below what's open.
    const enterGroup = useCallback(
        (group: FileEntry) => showLevel([...placeOf(group.id), group], null),
        [showLevel, placeOf],
    );

    // Back to a level on the way here, the group left through it taking the focus.
    const goToLevel = useCallback(
        (depth: number) => showLevel(trail.slice(0, depth), trail[depth]?.id ?? null),
        [showLevel, trail],
    );

    // A click on a group in the grid, and Alt+Up there.
    const enterGroupAt = useCallback(
        (index: number) => {
            const group = shownEntries[index];

            if (group) {
                enterGroup(group);
            }
        },
        [shownEntries, enterGroup],
    );

    const levelUp = useCallback(() => goToLevel(trail.length - 1), [goToLevel, trail.length]);

    // The focus goes in and comes back with the user, once what it goes to is listed: the group left,
    // or the first thing in the level; or with nothing to take it, the way back, or the search. If
    // that took a moment and the focus went elsewhere meanwhile, it stays there.
    useLayoutEffect(() => {
        const asked = levelFocusRef.current;

        // Not before the level asked for shows, which an app keeping the location may pass back later.
        if (!asked || asked.key !== levelKey) {
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

        if (!found || !gridRef.current?.focusAt(index)) {
            (groupDetailsRef.current ?? searchButtonRef.current)?.focus();
        }
    }, [shownEntries, state?.status, levelKey]);

    // A group just made, with no details to open, takes the focus from the button once it's listed.
    useLayoutEffect(() => {
        const id = createdRef.current;
        const index = id === null ? -1 : shownEntries.findIndex((entry) => entry.id === id);

        if (index === -1) {
            return;
        }

        createdRef.current = null;

        if (focusLost() || document.activeElement === newGroupRef.current) {
            gridRef.current?.focusAt(index);
        }
    }, [shownEntries]);

    // The details of the group open, shown from the level it's in, as it's that level it's moved from,
    // deleted from and listed in. The view takes the focus, so no tile is asked to.
    const openGroupDetails = useCallback(() => {
        if (!section || !openGroup) {
            return;
        }

        const parent = trail.slice(0, -1);

        goTo({ sectionId: section.id, trail: parent });
        stopSearching();
        setCreatingAt(null);
        setViewing({ sectionId: section.id, entry: openGroup, fromInside: true, among: parent });
    }, [section, openGroup, trail, goTo, stopSearching, setViewing]);

    // Back to the library, the asset's tile taking the focus when the view had it; or back into the
    // group its details were opened from, as it was left.
    const closeAsset = useCallback(() => {
        const view = panelRef.current?.querySelector("section");
        const hadFocus = view?.contains(document.activeElement) || focusLost();

        if (viewing?.fromInside) {
            showLevel([...trail, viewed?.entry ?? viewing.entry], null);
            levelFocusRef.current = null;
            backInsideRef.current = hadFocus;

            return;
        }

        backFromRef.current = hadFocus ? (viewing?.entry.id ?? null) : null;
        setViewing(null);
    }, [viewing, viewed, trail, showLevel, setViewing]);

    useLayoutEffect(() => {
        if (backInsideRef.current && groupDetailsRef.current) {
            backInsideRef.current = false;
            groupDetailsRef.current.focus();
        }
    }, [viewed, trail]);

    useLayoutEffect(() => {
        const id = backFromRef.current;
        const deletedAt = deletedAtRef.current;

        backFromRef.current = null;
        deletedAtRef.current = null;

        if (viewed || (id === null && deletedAt === null)) {
            return;
        }

        // The asset deleted leaves its place to the next one, or the last when it was the last.
        const index =
            deletedAt !== null
                ? Math.min(Math.max(deletedAt, 0), shownEntries.length - 1)
                : shownEntries.findIndex((entry) => entry.id === id);
        // With no tile to go to, as the last one in it was deleted, the way back, or the search.
        if (!gridRef.current?.focusAt(index)) {
            (groupDetailsRef.current ?? searchButtonRef.current)?.focus();
        }
    }, [viewed, shownEntries]);

    // A double click or Enter: chooses the asset, with the rest selected when several can be. Without
    // `onChoose` there's no choosing to finish, so it opens it in the library's place, selecting it
    // alone only when browsing, as what the app is taking picks for isn't to be replaced by opening one.
    const activate = useCallback(
        (index: number) => {
            const entry = shownEntries[index];

            if (!entry || !section) {
                return;
            }

            if (isGroup(entry)) {
                enterGroup(entry);

                return;
            }

            if (!onChoose) {
                if (!choosing) {
                    setPicks({
                        items: [{ sectionId: section.id, asset: entry, values: NO_VALUES, trail: placeOf(entry.id) }],
                        anchor: { sectionId: section.id, id: entry.id },
                    });
                }

                openAsset(index);

                return;
            }

            // One that can't be chosen now opens instead, to see how it stands.
            if (holds.has(entry.id)) {
                openAsset(index);

                return;
            }

            const picked = choices.find((choice) => inOpen(choice) && choice.asset.id === entry.id);

            // With no room for it, it opens too, as there's nothing to add it to.
            if (!picked && full) {
                openAsset(index);

                return;
            }

            const chosen = picked ?? { asset: entry, section, values: defaultsOf(entry, section) };
            const handed = multiple ? [...choices.filter((choice) => choice !== chosen), chosen] : [chosen];

            // Its form asks for more first: it's selected instead, its row saying what.
            if (!picked && unfilledOf(chosen, handed.length - 1, handed)) {
                press(index, { toggle: false, range: false });

                return;
            }

            // The others selected hold it back as they hold Choose.
            if (!handed.some((choice) => choiceHolds.has(choiceKey(choice)))) {
                handOver(handed);
            }
        },
        [
            shownEntries,
            onChoose,
            choosing,
            handOver,
            multiple,
            choices,
            inOpen,
            section,
            openAsset,
            holds,
            choiceHolds,
            defaultsOf,
            unfilledOf,
            press,
            full,
            enterGroup,
            placeOf,
        ],
    );

    const closeLibraries = useCallback(() => {
        setLibrariesOpen(false);
        librariesOpenerRef.current?.focus();
    }, []);

    // A library, at the group it was left at, said as a level is, as the list of libraries keeps the
    // focus or gives it back to the button opening it. Opening it from the drawer closes it.
    const openSection = useCallback(
        (id: string) => {
            const target = sectionsById.get(id);

            if (target) {
                leaveFor(target, rememberedTrail(target));
            }

            if (librariesOpen) {
                closeLibraries();
            }
        },
        [sectionsById, leaveFor, rememberedTrail, librariesOpen, closeLibraries],
    );

    // A pick's "Show in library": its library, open at it, the overlay closing so it shows.
    const showInLibrary = useCallback((choice: MediaChoice) => {
        const pickedAmong = choice.trail;

        // A group is shown by going in, as it may have no details, and what's in it is what it's picked for.
        if (isGroup(choice.asset)) {
            const next = [...(pickedAmong ?? NO_TRAIL), choice.asset];

            levelFocusRef.current = { key: `${choice.section.id}/${choice.asset.id}`, groupId: null, waited: false };
            leaveFor(choice.section, next);
            setChosenOverlay(false);

            return;
        }

        // Among the groups it was picked in, so back from it goes to its fellows, or else where its
        // library was left.
        const among = pickedAmong ?? rememberedTrail(choice.section);

        goTo({ sectionId: choice.section.id, trail: among });
        stopSearching();
        setViewing({ sectionId: choice.section.id, entry: choice.asset, among });
        setUploadStep(null);
        setProcessStep(null);
        setMoveStep(null);
        setEditStep(null);
        setCreatingAt(null);
        setChosenOverlay(false);
    }, [leaveFor, rememberedTrail, goTo, stopSearching, setViewing]);

    // A location the app changed of itself, as when its URL goes back: what was over the library goes, as
    // when the user goes to a level, but for what the app changed along with it, and where it is now is
    // said, the focus staying where it is. One the media manager asked for has seen to all that itself.
    const seenLocation = useRef(location);
    const lastViewed = useRef(viewedValue);
    const lastSearch = useRef(searchValue);

    useLayoutEffect(() => {
        const before = seenLocation.current;

        seenLocation.current = location;

        if (sameLocation(before, location)) {
            return;
        }

        if (askedLocation.current && sameLocation(askedLocation.current, location)) {
            askedLocation.current = null;

            return;
        }

        if (viewedValue === lastViewed.current) {
            setViewing(null);
        }

        if (searchValue === lastSearch.current) {
            stopSearching();
        }

        setUploadStep(null);
        setProcessStep(null);
        setMoveStep(null);
        setEditStep(null);
        setCreatingAt(null);
        announce(text.mediaInGroup(isolate(levelName)));
    }, [location, viewedValue, searchValue, setViewing, stopSearching, announce, text, levelName]);

    // What was shown and searched as of the last render, to tell what the app changed with the location.
    useLayoutEffect(() => {
        lastViewed.current = viewedValue;
        lastSearch.current = searchValue;
    });

    // What the library is listed again by, a search through it being asked again too.
    const reloadLibrary = useCallback(() => {
        setChanges((count) => count + 1);
        reload();
    }, [reload]);

    // Down or Enter in the field goes on to the assets shown, staying in the field with none.
    const focusAssets = () => {
        panelRef.current?.querySelector<HTMLElement>('[role="listbox"] [role="option"][tabindex="0"]')?.focus();
    };

    // Sends files into a level of a library, each its own upload, kept both with what's there of its
    // name, with what its upload form held.
    const sendUpload = useCallback(
        (
            target: MediaSection,
            into: UploadStep["into"],
            files: File[],
            values: Readonly<Record<string, unknown>> | undefined,
        ) => {
            const ids = uploads.queue.add(adapterOf(target), into, files, "keepBoth", values);
            const level: UploadLevel = { sectionId: target.id, folderId: into.id };

            setUploadLevels((previous) => new Map([...previous, ...ids.map((id): [number, UploadLevel] => [id, level])]));
        },
        [uploads.queue, adapterOf],
    );

    // What was picked, dropped or pasted into the open level: checked first, and sent at once when
    // there's nothing to ask or say; otherwise the upload step shows in the library's place.
    const askUpload = useCallback(
        (dropped: DroppedFiles) => {
            if (!section || !takesFiles || dropped.files.length + dropped.folders.length === 0) {
                return;
            }

            const into = { id: folderId, name: levelName };
            const check = checkMediaUpload(section, sectionAdapter, dropped, folderId);
            const form = check.files.length > 0 ? (section.uploadForm?.(check.files) ?? null) : null;
            const leftOut = check.refused.length + check.folders.length + check.misnamed.length > 0;

            if (!leftOut && !form) {
                sendUpload(section, into, check.files, undefined);

                return;
            }

            setViewing(null);
            uploadStepCount.current += 1;
            setUploadStep({ key: uploadStepCount.current, sectionId: section.id, into, check, form });
        },
        [section, takesFiles, sectionAdapter, folderId, levelName, sendUpload, setViewing],
    );

    // Leaves the upload step, the focus going to Upload when the step had it.
    const closeUploadStep = useCallback(() => {
        const step = panelRef.current?.querySelector("section");

        if (step?.contains(document.activeElement) || focusLost()) {
            uploadButtonRef.current?.focus();
        }

        setUploadStep(null);
    }, []);

    const shownStep = uploadStep && uploadStep.sectionId === sectionId ? uploadStep : null;
    // Nothing to search while an asset or a step is shown in the library's place; a search under way
    // comes back with the library.
    const searchable = !!section && !viewed && !shownStep && !formingGroup;

    // How many the search found once it's answered, said for each new query, as nothing else says it.
    const matchCount =
        searching && searchable && (search.on ? search.status === "ready" : state?.status === "ready")
            ? shownEntries.length
            : null;

    useMatchCount(query, matchCount, announce, text.searchResultCount);

    // Files dragged over the library are taken there while it's shown and takes them, of the types
    // it takes as far as a drag tells; otherwise the frame refuses them.
    const dropsFiles = takesFiles && !viewed && !shownStep && !formingGroup;
    const patterns = useMemo(() => (section ? uploadPatterns(section) : null), [section]);

    const { dropping, offerDrop, leaveDrop, takeDrop, pasteFiles } = useFilesDrop(dropsFiles, patterns, askUpload);

    // Each upload done, by its entry's id, waits to be listed in its library.
    useEffect(() => {
        uploads.items.forEach((item) => {
            const { id, status, entryId } = item;
            const target = uploadLevels.get(id)?.sectionId;

            if (status !== "done" || arrivedRef.current.has(id)) {
                return;
            }

            arrivedRef.current.add(id);

            if (target === undefined || entryId === undefined) {
                return;
            }

            const key = (arrivalCount.current += 1);

            setArrivals((previous) => [...previous, { key, uploadId: id, sectionId: target, entryId }]);
            window.setTimeout(
                () => setArrivals((previous) => previous.filter((waiting) => waiting.key !== key)),
                ARRIVAL_WAIT,
            );
        });
    }, [uploads.items, uploadLevels]);

    // Once the open library lists what arrived, its tile takes the place of the upload's, and while
    // the app takes a choice, it's selected, as a media picker does: added to what's selected, or
    // one at a time, the last to arrive in place of it. One still being processed is selected too,
    // holding Choose back until it's done, as it was uploaded to be chosen; one whose processing
    // failed, or its library or the app's rule refuses, isn't, nor any there's no room for, which only
    // show.
    useEffect(() => {
        if (!section || state?.status !== "ready") {
            return;
        }

        const listedById = new Map(library.map((entry) => [entry.id, entry]));
        const here = arrivals.filter(
            (waiting) => waiting.sectionId === section.id && listedById.has(waiting.entryId),
        );

        if (here.length === 0) {
            return;
        }

        const keys = new Set(here.map((waiting) => waiting.key));
        const assets = here
            .flatMap((waiting) => listedById.get(waiting.entryId) ?? [])
            .filter(({ processing }) => processing?.status !== "failed" || processing.usable)
            .filter((asset) => (section.selectable?.(asset) ?? true) === true);
        const last = (multiple ? assets : assets.filter((asset) => !refusalOf(asset, section, NO_CHOICES, trail))).at(-1);

        setArrivals((previous) => previous.filter((waiting) => !keys.has(waiting.key)));

        if (!choosing || !last) {
            return;
        }

        const { fit, cut } = multiple
            ? fitting(
                  assets.filter((asset) => !choices.some((choice) => inOpen(choice) && choice.asset.id === asset.id)),
                  section,
                  choices,
              )
            : { fit: assets, cut: false };

        if (cut) {
            sayFull();
        }

        setPicks((previous) => {
            if (!multiple) {
                return {
                    items: [{ sectionId: section.id, asset: last, values: NO_VALUES, trail }],
                    anchor: { sectionId: section.id, id: last.id },
                };
            }

            const added = fit.filter(
                (asset) => !previous.items.some((item) => samePick(item, { asset, section, values: NO_VALUES })),
            );

            return added.length === 0
                ? previous
                : {
                      ...previous,
                      items: [
                          ...previous.items,
                          ...added.map((asset) => ({ sectionId: section.id, asset, values: NO_VALUES, trail })),
                      ],
                  };
        });
    }, [
        section,
        state?.status,
        library,
        arrivals,
        choosing,
        multiple,
        samePick,
        refusalOf,
        fitting,
        choices,
        inOpen,
        sayFull,
        trail,
    ]);

    // The open level's uploads, before what it holds: those waiting or being sent, and those done until
    // they're listed. Each shows only where it's going.
    const shownUploads = useMemo(() => {
        if (sectionId === undefined) {
            return NO_UPLOADS;
        }

        const waiting = new Set(arrivals.map((arrival) => arrival.uploadId));
        const shown = uploads.items.filter((item): item is FileUploadItem => {
            const level = uploadLevels.get(item.id);

            return (
                item.kind === "file" &&
                level?.sectionId === sectionId &&
                level.folderId === folderId &&
                (item.status === "queued" || item.status === "uploading" || waiting.has(item.id))
            );
        });

        return shown.length > 0 ? shown : NO_UPLOADS;
    }, [sectionId, folderId, arrivals, uploads.items, uploadLevels]);

    // Forgets the ended uploads, and the levels they went into.
    const clearUploads = useCallback(() => {
        uploads.queue.clear();

        const kept = new Set(uploads.queue.getItems().map((item) => item.id));

        setUploadLevels((previous) => new Map([...previous].filter(([id]) => kept.has(id))));
        arrivedRef.current.forEach((id) => !kept.has(id) && arrivedRef.current.delete(id));
    }, [uploads.queue]);

    // One pick's details: its own errors, then the app's form for it, drawn with what it holds, and
    // what can read and change the others.
    const renderDetails = useMemo(
        () =>
            asksPicks || choiceErrorKey
                ? (choice: MediaChoice, index: number) => {
                      const state = pickState(choice, index, choices);
                      const form = formOf(choice.asset, choice.section);

                      return (
                          <>
                              <ChoiceMessages
                                  messages={choiceMessages(choiceErrorKey, state.errors, state.index, choice.asset)}
                              />
                              {form && (
                                  <MediaFormBody
                                      form={form}
                                      params={{
                                          ...state,
                                          setValues: (next) => setChoiceValues(choice, next),
                                          setChoiceValues,
                                      }}
                                  />
                              )}
                          </>
                      );
                  }
                : undefined,
        [asksPicks, formOf, choiceErrorKey, pickState, choices, setChoiceValues],
    );

    // How much of a pick there is to fix, for its row in the list, whose form isn't open: each field
    // its form has now with an error, and its own errors as one more.
    const problemsOf = useMemo(
        () =>
            (asksPicks || choiceErrorKey) && errors !== NO_ERRORS
                ? (choice: MediaChoice) => {
                      const place = errorPlaces.get(choiceKey(choice));

                      if (place === undefined) {
                          return 0;
                      }

                      const own = choiceMessages(choiceErrorKey, errors, place, choice.asset).length > 0 ? 1 : 0;
                      const form = formOf(choice.asset, choice.section);

                      return (
                          own +
                          countErrorsAt(errors, form?.errorKeys?.(pickState(choice, place, choices)) ?? NO_ERROR_KEYS)
                      );
                  }
                : undefined,
        [asksPicks, formOf, choiceErrorKey, errors, errorPlaces, pickState, choices],
    );

    // A library's own previewers first, as its backend delivers what it holds, then the media
    // manager's.
    // Only a library drawn by the app has its assets depend on the section's object, which an app may
    // make afresh each render, so the media manager's own tiles don't all draw again as it does.
    const sectionRenderAsset = section?.renderAsset ?? renderAsset;
    const drawAsset = useMemo<MediaAssetDraw | undefined>(
        () => (section && sectionRenderAsset ? (params) => sectionRenderAsset({ ...params, section }) : undefined),
        [section, sectionRenderAsset],
    );
    const sectionRenderGroup = section?.renderGroup ?? renderGroup;
    const drawGroup = useMemo<MediaAssetDraw | undefined>(
        () => (section && sectionRenderGroup ? (params) => sectionRenderGroup({ ...params, section }) : undefined),
        [section, sectionRenderGroup],
    );
    const drawHeader = section?.groupHeader ?? groupHeader;
    const [layouts, setLayouts] = useSetting<MediaLayouts>({
        name: "layout",
        component: "MediaManager",
        value: layoutProp,
        defaultValue: defaultLayout,
        onChange: onLayoutChange,
    });
    const offeredLayouts = section ? layoutsOf(section) : NO_SECTION_LAYOUTS;
    const chosenLayout = section ? layouts[section.id] : undefined;
    const layout = chosenLayout && offeredLayouts.includes(chosenLayout) ? chosenLayout : offeredLayouts[0];
    const otherLayout = offeredLayouts.find((each) => each !== layout);

    // What was at the top stays there in the other layout, as rows and tiles aren't the same height,
    // which the grid's lines see to (`useVirtualLines`).
    const switchLayout = () => {
        if (section && otherLayout) {
            setLayouts((current) => ({ ...current, [section.id]: otherLayout }));
        }
    };

    const sectionPreviewers = useMemo(
        () => (section?.previewers ? [...section.previewers, ...previewers] : previewers),
        [section?.previewers, previewers],
    );

    // What the asset or group shown shows: its library's own definitions, as its backend's data is its
    // own, or else the media manager's, by the entry; without either, the adapter's own groups.
    const viewedEntry = viewed?.entry;
    const viewedGroup = !!viewedEntry && isGroup(viewedEntry);
    const viewedDefinitions = useMemo(() => {
        if (!viewedEntry || !section) {
            return undefined;
        }

        const own = section.properties;

        return (typeof own === "function" ? own(viewedEntry) : own) ?? properties?.(viewedEntry, section);
    }, [viewedEntry, section, properties]);

    // Why the asset shown can't be chosen now, which its view shows, with Select held.
    const viewedHold = useMemo(
        () =>
            viewedEntry && section && (!viewedGroup || groupPicks.checks.has(viewedEntry.id))
                ? (holdOf(viewedEntry, section, { text, formatPercent }) ??
                  (selectedIds.has(viewedEntry.id) ? undefined : refusedNow(viewedEntry, section, viewedTrail)))
                : undefined,
        [viewedEntry, viewedGroup, groupPicks, section, text, formatPercent, selectedIds, refusedNow, viewedTrail],
    );

    // The backend's work on it while it can be chosen all the same, which its view shows.
    const viewedWork = useMemo(
        () => (viewedEntry ? workOf(viewedEntry, { text, formatPercent }) : undefined),
        [viewedEntry, text, formatPercent],
    );

    // What can be asked of the asset shown: its library's process form for it, where its adapter
    // takes them and it can be changed.
    const viewedProcess = useMemo(
        () =>
            viewedEntry &&
            !viewedGroup &&
            section &&
            sectionAdapter.process &&
            !section.readOnly &&
            allows("write", viewedElsewhere ? undefined : state?.permissions, viewedEntry.permissions)
                ? (section.processForm?.(viewedEntry) ?? null)
                : null,
        [viewedEntry, viewedGroup, section, sectionAdapter, viewedElsewhere, state?.permissions],
    );

    // Whether the asset or group shown can be deleted: where what's open can be, and it allows it.
    const viewedDeletable =
        !!viewedEntry && !!sectionAdapter.delete && viewedChangeable && allows("delete", viewedEntry.permissions);

    // Whether the asset or group shown can be moved: where what's open can be, it allows it, and there's
    // somewhere for it to go, a level above or another group here, so a flat library offers nothing.
    const viewedMovable =
        !!viewedEntry &&
        !!sectionAdapter.move &&
        viewedChangeable &&
        allows("move", viewedEntry.permissions) &&
        (viewedTrail.length > 0 || leveled.some((entry) => isGroup(entry) && entry.id !== viewedEntry.id));

    const shownProcess =
        processStep && processStep.sectionId === sectionId && processStep.entry.id === viewedEntry?.id
            ? processStep
            : null;

    const viewedParent = viewedTrail.at(-1) ?? null;

    // What can be edited of the group shown: its library's form for it, where its adapter takes what it
    // holds and it can be changed.
    const viewedEdit = useMemo(
        () =>
            viewedEntry &&
            viewedGroup &&
            !!sectionAdapter.updateGroup &&
            viewedChangeable &&
            allows("write", viewedEntry.permissions)
                ? (section?.groupForm?.({ group: viewedEntry, parent: viewedParent }) ?? null)
                : null,
        [viewedEntry, viewedGroup, sectionAdapter, viewedChangeable, section, viewedParent],
    );

    const shownEdit =
        editStep && editStep.sectionId === sectionId && editStep.entry.id === viewedEntry?.id ? editStep : null;

    const shownMove =
        moveStep && moveStep.sectionId === sectionId && moveStep.entry.id === viewedEntry?.id ? moveStep : null;

    // After an app's action: what's open and what a search found, on this library's adapter, where what's
    // shown is, and what's kept of it, as the action may have changed any of them.
    const refreshForAction = useCallback(() => {
        if (viewedEntry) {
            propertiesCache.forgetDetails(viewedEntry, sectionAdapter);
        }

        relistAll(sectionAdapter, viewedElsewhere ? [viewedFolderId] : NO_FOLDER_IDS);
    }, [viewedEntry, viewedElsewhere, viewedFolderId, sectionAdapter, propertiesCache, relistAll]);

    // The app's actions for what's shown, none while a step is in the library's place, as what they'd act
    // on is under it.
    const actionGroups = useMemo(
        () =>
            !actions || !section || shownStep || formingGroup || shownProcess || shownEdit || shownMove
                ? NO_ACTIONS
                : mediaToolbarGroups(actions, {
                      section,
                      adapter: sectionAdapter,
                      group: openGroup ?? null,
                      trail,
                      viewed: viewedEntry ? { entry: viewedEntry, trail: viewedTrail } : null,
                      choices: choices.map(handedCopy),
                      readOnly: !viewedChangeable,
                      refresh: refreshForAction,
                  }),
        [
            actions,
            section,
            shownStep,
            formingGroup,
            shownProcess,
            shownEdit,
            shownMove,
            sectionAdapter,
            openGroup,
            trail,
            viewedEntry,
            viewedTrail,
            choices,
            viewedChangeable,
            refreshForAction,
        ],
    );

    // The backend took it on: what was said of the asset before no longer stands, as it may have
    // failed, and its listings say how it stands now.
    // Said only once the backend has answered, as the step closing with the focus on Process says nothing
    // of it; left while it was sent, it may have been taken on all the same, which isn't known.
    const processSent = useCallback(
        (entry: FileEntry, taken: boolean) => {
            forgetStates(sectionAdapter, [entry.id]);
            relistAll(sectionAdapter);
            setProcessStep(null);

            if (taken) {
                announce(text.mediaProcessSent(isolate(entry.name)));
            }
        },
        [forgetStates, sectionAdapter, relistAll, announce, text],
    );

    // A group gone from where it was, by a delete or a move: any library left open inside it goes back to
    // where it was gone into from, the one shown at once, which the app keeping the location is asked to
    // replace, and what's kept of its listings goes, as their ids may mean nothing now.
    const leaveGroup = useCallback(
        (group: FileEntry, served: FileAdapter) => {
            const at = section && sectionAdapter === served ? trail.findIndex((walked) => walked.id === group.id) : -1;

            if (section && at !== -1) {
                goTo({ sectionId: section.id, trail: trail.slice(0, at) }, "replace");
            }

            setLevels((previous) =>
                Object.fromEntries(
                    Object.entries(previous).map(([id, open]) => {
                        const at = open.trail.findIndex((walked) => walked.id === group.id);

                        return [
                            id,
                            at === -1 || open.adapter !== served ? open : { ...open, trail: open.trail.slice(0, at) },
                        ];
                    }),
                ),
            );
            sections
                .filter((item) => adapterOf(item) === served)
                .forEach(({ id }) => store.forget(id, [group.id]));
        },
        [section, sectionAdapter, trail, goTo, sections, adapterOf, store],
    );

    // Deleted: back to the library, the asset gone from it and from what's selected, wherever it was
    // picked through this adapter, and its libraries listed again. A group goes with what's known to be
    // in it: what was picked among it, a library left open inside it, which goes back to where it was
    // gone into from, and its listings. What the app gave as `defaultValue` has no known level, so it
    // stays for the backend to refuse.
    const assetDeleted = useCallback(
        (entry: FileEntry, index: number) => {
            const group = isGroup(entry);
            const sameAdapter = (id: string) => {
                const from = sectionsById.get(id);

                return !!from && adapterOf(from) === sectionAdapter;
            };

            if (section) {
                const gone: MediaChoice = { asset: entry, section, values: NO_VALUES };
                const wasIn = (item: Pick) =>
                    group && sameAdapter(item.sectionId) && !!item.trail?.some(({ id }) => id === entry.id);

                setPicks((previous) => ({
                    ...previous,
                    items: previous.items.filter((item) => !samePick(item, gone) && !wasIn(item)),
                }));
            }

            if (group) {
                leaveGroup(entry, sectionAdapter);
            }

            setDeletedIds((previous) => new Set(previous).add(entry.id));
            setGoneHits((previous) => new Set(previous).add(entry.id));
            forgetStates(sectionAdapter, [entry.id]);
            propertiesCache.forgetDetails(entry, sectionAdapter);
            relistAll(sectionAdapter, [viewedFolderId]);
            deletedAtRef.current = index;
            setViewing(null);
            setProcessStep(null);
            setMoveStep(null);
            setEditStep(null);
            announce(text.deleteDone(1, isolate(entry.name)));
        },
        [
            setViewing,
            section,
            sectionsById,
            adapterOf,
            leaveGroup,
            samePick,
            forgetStates,
            propertiesCache,
            sectionAdapter,
            relistAll,
            viewedFolderId,
            announce,
            text,
        ],
    );

    // Sent off into the level with these groups open, back to the library, the next one taking the
    // focus, as it's gone from here at once.
    const startMove = (to: readonly FileEntry[]) => {
        if (!section || !viewed) {
            return;
        }

        const id = transfers.queue.add(
            "move",
            sectionAdapter,
            sectionAdapter,
            [viewed.entry],
            { id: viewedFolderId, name: viewedParent?.name ?? section.label },
            { id: to.at(-1)?.id ?? section.rootId, name: to.at(-1)?.name ?? section.label },
            "keepBoth",
        );

        movePlaces.current.set(id, { sectionId: section.id, trail: to });
        deletedAtRef.current = viewed.index;
        setViewing(null);
        setMoveStep(null);
        setEditStep(null);
    };

    const retryMove = (item: TransferItem) => {
        const place = movePlaces.current.get(item.id);

        transfers.queue.forget(item.id);
        movePlaces.current.delete(item.id);

        const id = transfers.queue.add(
            "move",
            item.adapter,
            item.targetAdapter,
            item.entries,
            item.source,
            item.target,
            item.conflict,
        );

        if (place) {
            movePlaces.current.set(id, place);
        }
    };

    const clearMoves = () => {
        transfers.queue.clear();

        const kept = new Set(transfers.queue.getItems().map(({ id }) => id));

        movePlaces.current.forEach((_, id) => !kept.has(id) && movePlaces.current.delete(id));
    };

    // A move ended: the levels it touched are listed again, whatever came of it once it reached the
    // backend. Gone, what's selected of it follows it there, with the entry as it now is: without one its
    // id may be dead, so it's dropped, as are the picks inside a group whose id changed, those inside one
    // keeping its own staying, with the way to them through where it went. The way there is only known
    // in the library it was moved in, so another library's picks just don't know their level.
    useLayoutEffect(() => {
        moveEnded.current = (item, outcome, _items, made) => {
            const place = movePlaces.current.get(item.id);
            const [entry] = item.entries;
            const now = made?.[0] ?? item.went[0]?.made;
            const went = outcome === "done" || item.went.length > 0;

            if (outcome !== "failed") {
                movePlaces.current.delete(item.id);
            }

            if (outcome !== "cancelled" || item.status === "running") {
                relistAll(item.adapter, [item.source.id, item.target.id]);
            }

            if (!went) {
                if (outcome === "failed") {
                    announce(text.moveFailedNotice(1, isolate(entry.name), isolate(item.target.name)));
                }

                return;
            }

            const group = isGroup(entry);
            const kept = group && now?.id === entry.id;
            const trailIn = (sectionIdOf: string) => (place?.sectionId === sectionIdOf ? place.trail : undefined);

            setPicks((previous) => ({
                ...previous,
                items: previous.items.flatMap((pick) => {
                    const from = sectionsById.get(pick.sectionId);

                    if (!from || adapterOf(from) !== item.adapter) {
                        return [pick];
                    }

                    if (pick.asset.id === entry.id) {
                        return now ? [{ ...pick, asset: now, trail: trailIn(pick.sectionId) }] : [];
                    }

                    const at = group ? (pick.trail?.findIndex(({ id }) => id === entry.id) ?? -1) : -1;

                    if (at === -1 || !pick.trail) {
                        return [pick];
                    }

                    const to = trailIn(pick.sectionId);

                    return kept && now
                        ? [{ ...pick, trail: to && [...to, now, ...pick.trail.slice(at + 1)] }]
                        : [];
                }),
            }));

            if (group) {
                leaveGroup(entry, item.adapter);
            }

            setGoneHits((previous) => new Set(previous).add(entry.id));

            // Gone from here at once, as what's on its way was, until the listing comes back without it.
            if (item.source.id === folderId && item.adapter === sectionAdapter) {
                setDeletedIds((previous) => new Set(previous).add(entry.id));
            }

            forgetStates(item.adapter, [entry.id]);
            propertiesCache.forgetDetails(entry, item.adapter);
            announce(text.moveDone(1, isolate(now?.name ?? entry.name), isolate(item.target.name)));
        };
    });

    // Saved: the group as it now is takes its place in any way through it and what's selected inside it,
    // or with an id of its own now, those go, as what's inside may have new ids too. What's shown of it is
    // asked for again, and it's listed again.
    const groupEdited = (group: FileEntry, now: FileEntry | undefined) => {
        const swapped = (trail: readonly FileEntry[]) =>
            now && trail.some(({ id }) => id === group.id)
                ? trail.map((walked) => (walked.id === group.id ? now : walked))
                : trail;
        const inGroup = (trail: readonly FileEntry[] | undefined) => !!trail?.some(({ id }) => id === group.id);
        const sameAdapter = (id: string) => {
            const from = sectionsById.get(id);

            return !!from && adapterOf(from) === sectionAdapter;
        };

        if (now && now.id !== group.id) {
            setPicks((previous) => ({
                ...previous,
                items: previous.items.filter((pick) => !(sameAdapter(pick.sectionId) && inGroup(pick.trail))),
            }));
            leaveGroup(group, sectionAdapter);
        } else if (now) {
            const shown = swapped(trail);

            setPicks((previous) => ({
                ...previous,
                items: previous.items.map((pick) =>
                    sameAdapter(pick.sectionId) && pick.trail ? { ...pick, trail: swapped(pick.trail) } : pick,
                ),
            }));

            // The app is told only of a new name, which is all it sees of a way through a library.
            if (section && shown !== trail) {
                goTo({ sectionId: section.id, trail: shown }, "replace");
            }

            setLevels((previous) =>
                Object.fromEntries(
                    Object.entries(previous).map(([id, open]) => [
                        id,
                        open.adapter === sectionAdapter ? { ...open, trail: swapped(open.trail) } : open,
                    ]),
                ),
            );
        }

        propertiesCache.forgetDetails(group, sectionAdapter);
        relistAll(sectionAdapter);
        setEditStep(null);

        if (now) {
            setViewedValue((current) =>
                current?.entry.id === group.id
                    ? { ...current, entry: now, trail: current.trail && swapped(current.trail) }
                    : current,
            );
            setInsideOf((inside) => (inside === group.id ? now.id : inside));
        }

        announce(text.mediaGroupSaved(isolate((now ?? group).name)));
    };

    const closeNewGroup = () => {
        setCreatingAt(null);
        newGroupRef.current?.focus();
    };

    // Made: listed where it is, with what was over the level gone, so it shows; its details open next,
    // for the rest of what the app defines, or with none, its tile takes the focus once it's listed.
    const groupCreated = (group: FileEntry) => {
        if (!section) {
            return;
        }

        setCreatingAt(null);
        stopSearching();
        relistAll(sectionAdapter);
        announce(text.mediaGroupCreated(isolate(group.name)));

        // A form has asked what it has to, so there's nothing to go on filling in.
        if (hasDetails && !newGroupForm) {
            setViewing({ sectionId: section.id, entry: group, among: trail });
        } else {
            createdRef.current = group.id;
            newGroupRef.current?.focus();
        }
    };

    // How many are selected, of how many may be, and that there's no room left, once there's exactly
    // none: past it, what holds Choose back says more.
    const count = choices.length;
    const limited = limit !== Infinity;
    const selectedText = limited
        ? text.mediaSelectedOf(formatNumber(count), formatNumber(limit))
        : count > 0
          ? text.mediaSelected(count)
          : undefined;
    const badge = limited
        ? text.mediaCountOf(formatNumber(count), formatNumber(limit))
        : multiple && count > 0
          ? formatNumber(count)
          : undefined;
    const limitNote = count === limit ? text.mediaChoicesFull : undefined;

    const shownMoves = transfers.items.filter((item) => item.shown);

    // What the app's `apiRef` does, as of the latest render, which its methods, the same while mounted, call.
    const api = useRef<MediaManagerApi | null>(null);

    useLayoutEffect(() => {
        api.current = {
            navigate: ({ sectionId: id, trail: way }) => {
                const target = sectionsById.get(id);

                if (!target) {
                    return false;
                }

                leaveFor(target, way ?? rememberedTrail(target));

                return true;
            },
            view: (entry, at) => {
                const target = at ? sectionsById.get(at.sectionId) : section;
                const elsewhere = !!at && (target !== section || !sameTrail(at.trail, trail));

                if (!target || (isGroup(entry) && !(elsewhere ? groupOpensIn(target) : opensGroups))) {
                    return false;
                }

                if (at) {
                    goTo({ sectionId: target.id, trail: at.trail });
                    stopSearching();
                }

                setViewing({ sectionId: target.id, entry, among: at ? at.trail : placeOf(entry.id) });
                setUploadStep(null);
                setProcessStep(null);
                setMoveStep(null);
                setEditStep(null);
                setCreatingAt(null);

                return true;
            },
            closeView: () => {
                if (viewing) {
                    closeAsset();
                }
            },
            search: (typed) => {
                if (!searchable) {
                    return false;
                }

                openSearch(typed);

                return true;
            },
            closeSearch,
            select: (next) =>
                setPicks((previous) => ({
                    items: picksGiven(
                        typeof next === "function"
                            ? next(choicesOfRef.current(previous.items).map(handedCopy))
                            : next,
                        previous.items,
                    ),
                    anchor: null,
                })),
            choose: () => {
                if (!onChoose || chooseHeld || choices.length === 0) {
                    return false;
                }

                handOver(choices);

                return true;
            },
            upload: (files) => {
                if (!takesFiles || formingGroup || shownStep || viewing?.fromInside) {
                    return false;
                }

                if (files) {
                    askUpload({ files: [...files], folders: [] });
                } else {
                    pickerRef.current?.click();
                }

                return true;
            },
            refresh: (folderIds, options) => {
                const served = options?.adapter;

                setChanges((count) => count + 1);
                sections.forEach((item) => {
                    if (!served || adapterOf(item) === served) {
                        store.relist(item.id, adapterOf(item), folderIds);
                    }
                });

                if (viewedEntry && (!served || served === sectionAdapter)) {
                    propertiesCache.forgetDetails(viewedEntry, sectionAdapter);
                }
            },
            focus: () => {
                const panel = panelRef.current;
                const over = panel
                    ? Array.from(panel.querySelectorAll<HTMLElement>(":scope > section")).at(-1)
                    : undefined;
                const target =
                    over ??
                    panel?.querySelector<HTMLElement>('[role="listbox"] [role="option"][tabindex="0"]') ??
                    panel?.querySelector<HTMLElement>("button, [tabindex='0']") ??
                    groupDetailsRef.current ??
                    searchButtonRef.current;

                target?.focus();
            },
        };
    });

    useImperativeHandle(
        apiRef,
        (): MediaManagerApi => ({
            navigate: (target) => api.current?.navigate(target) ?? false,
            view: (entry, at) => api.current?.view(entry, at) ?? false,
            closeView: () => api.current?.closeView(),
            search: (typed) => api.current?.search(typed) ?? false,
            closeSearch: () => api.current?.closeSearch(),
            select: (next) => api.current?.select(next),
            choose: () => api.current?.choose() ?? false,
            upload: (files) => api.current?.upload(files) ?? false,
            refresh: (folderIds, options) => api.current?.refresh(folderIds, options),
            focus: () => api.current?.focus(),
        }),
        [],
    );

    const failure = search.on ? search.error : state?.error;
    const errorMessage =
        (search.on ? search.status : state?.status) !== "error"
            ? undefined
            : failure instanceof Error && failure.message
              ? isolate(failure.message)
              : search.on
                ? text.searchFailed(isolate(levelName))
                : inGroup
                  ? text.mediaGroupLoadFailed
                  : undefined;

    return (
        <div
            ref={frameRef}
            className={styles.frame}
            data-libraries={several}
            // Whether there's something under the library where the column doesn't dock.
            data-choosing={!!onChoose || (choosing && !chosenEmpty)}
            onKeyDown={(event) => {
                // Ctrl+F or ⌘F opens the search, in place of the browser's find while the focus is in
                // here, as in the file manager, but for what's over the header or hides the library.
                if (
                    pressesKey(event, "f") &&
                    (event.ctrlKey || event.metaKey) &&
                    !event.shiftKey &&
                    !event.altKey &&
                    !event.defaultPrevented &&
                    // Not from an app's dialog, which portals out but whose presses still bubble here.
                    event.target instanceof Node &&
                    event.currentTarget.contains(event.target) &&
                    searchable &&
                    !librariesOpen &&
                    !chosenOverlay
                ) {
                    event.preventDefault();
                    openSearch();
                } else if (
                    // An app's action, as above, a press something in here took staying with it.
                    !event.defaultPrevented &&
                    event.target instanceof Node &&
                    event.currentTarget.contains(event.target) &&
                    !librariesOpen &&
                    !chosenOverlay &&
                    !typesInField(event) &&
                    runToolbarShortcut(event, actionGroups)
                ) {
                    event.preventDefault();
                }
            }}
            // Files dropped anywhere the library doesn't take them are refused, or the browser would
            // open them in place of the page.
            onDragOver={(event) => {
                if (carriesFiles(event) && !event.defaultPrevented) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "none";
                }
            }}
            onDrop={(event) => {
                if (carriesFiles(event) && !event.defaultPrevented) {
                    event.preventDefault();
                }
            }}
        >
            {several && (
                <>
                    <Backdrop open={librariesOpen} className={styles.librariesBackdrop} onClick={closeLibraries} />
                    <LibraryList
                        ref={librariesRef}
                        groups={groups}
                        openId={section?.id}
                        open={librariesOpen}
                        onOpen={openSection}
                        onClose={closeLibraries}
                    />
                </>
            )}
            <div className={styles.main}>
                <MediaHeader
                    section={section}
                    trail={trail}
                    onGoToLevel={goToLevel}
                    onGroupDetails={opensOpenGroup && !viewed && !shownStep && !formingGroup ? openGroupDetails : undefined}
                    groupDetailsRef={groupDetailsRef}
                    several={several}
                    librariesOpen={librariesOpen}
                    librariesOpenerRef={librariesOpenerRef}
                    onOpenLibraries={() => setLibrariesOpen(true)}
                    searchable={searchable}
                    searching={searching && searchable}
                    query={query}
                    searchInputRef={searchInputRef}
                    searchButtonRef={searchButtonRef}
                    onQueryChange={setQuery}
                    onToggleSearch={() => (searching ? closeSearch() : openSearch())}
                    onCloseSearch={closeSearch}
                    onDismissSearch={stopSearching}
                    onFocusAssets={focusAssets}
                    // Nothing to switch while an asset or a step is shown in the library's place.
                    otherLayout={viewed || shownStep || formingGroup ? undefined : otherLayout}
                    onSwitchLayout={switchLayout}
                    onNewGroup={
                        createsGroups && !viewed && !shownStep
                            ? () => (creatingGroup ? closeNewGroup() : setCreatingAt(levelKey))
                            : undefined
                    }
                    newGroupLabel={newGroupForm?.title ?? text.mediaNewGroup}
                    creatingGroup={creatingGroup}
                    newGroupRef={newGroupRef}
                    actions={actionGroups}
                    // Not from a group's details opened from inside it, where it would go in the level above.
                    onUpload={
                        takesFiles && !formingGroup && !viewing?.fromInside
                            ? () => pickerRef.current?.click()
                            : undefined
                    }
                    uploadRef={uploadButtonRef}
                />
                <input
                    ref={pickerRef}
                    type="file"
                    multiple
                    hidden
                    tabIndex={-1}
                    accept={typeof section?.acceptUploads === "string" ? section.acceptUploads : undefined}
                    onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);

                        // Emptied, so picking the same files again still changes it.
                        event.target.value = "";
                        askUpload({ files, folders: [] });
                    }}
                />
                <div
                    ref={panelRef}
                    className={styles.panel}
                    onDragEnter={offerDrop}
                    onDragOver={offerDrop}
                    onDragLeave={leaveDrop}
                    onDrop={takeDrop}
                    onPaste={pasteFiles}
                >
                    <div className={styles.grid} data-covered={!!viewed || !!shownStep || formingGroup}>
                        {creatingGroup && !newGroupForm && (
                            <GroupCreate
                                // Beside the grid, so it can't have the same key, which would leave it behind.
                                key={`new/${levelKey}`}
                                adapter={sectionAdapter}
                                parentId={folderId}
                                onCancel={closeNewGroup}
                                onCreated={groupCreated}
                                onLeft={() => relistAll(sectionAdapter)}
                            />
                        )}
                        {section ? (
                            <MediaGrid
                                // Each level's own, as another library's `renderAsset`, with hooks of
                                // its own, may draw an asset of the same id, and each starts at its top.
                                key={levelKey}
                                ref={gridRef}
                                entries={shownEntries}
                                trails={search.trails}
                                uploads={shownUploads}
                                kind={section.kind}
                                layout={layout}
                                adapter={sectionAdapter}
                                drawAsset={drawAsset}
                                drawGroup={drawGroup}
                                opensGroups={opensGroups}
                                header={
                                    openGroup &&
                                    drawHeader && <GroupHeader draw={drawHeader} group={openGroup} section={section} />
                                }
                                label={levelName}
                                selectedIds={selectedIds}
                                holds={holds}
                                works={works}
                                groupChecks={groupPicks.checks}
                                full={full}
                                multiple={multiple}
                                status={search.on ? search.status : (state?.status ?? "loading")}
                                hasMedia={search.on || leveled.length > 0}
                                busy={search.on ? search.searching : state?.status === "loading" || !!state?.checking}
                                error={errorMessage}
                                onRetry={search.on ? search.retry : reloadLibrary}
                                onPress={press}
                                onActivate={activate}
                                onEnterGroup={enterGroupAt}
                                onLevelUp={inGroup ? levelUp : undefined}
                                onOpen={openAsset}
                                onSelectAll={selectAll}
                            />
                        ) : (
                            <div role="status" className={styles.noLibraries}>
                                <Icon name="pictures" />
                                <Text variant="body1">{text.mediaNoLibraries}</Text>
                            </div>
                        )}
                    </div>
                    {viewed && section && (
                        <MediaAsset
                            entry={viewed.entry}
                            section={section}
                            layout={layout}
                            adapter={sectionAdapter}
                            backTo={viewing?.fromInside ? viewed.entry.name : levelName}
                            choosing={choosing && (!viewedGroup || groupPicks.checks.has(viewed.entry.id))}
                            selected={selectedIds.has(viewed.entry.id)}
                            hold={viewedHold}
                            work={viewedWork}
                            previewers={sectionPreviewers}
                            definitions={viewedDefinitions}
                            propertiesCache={propertiesCache}
                            onBack={closeAsset}
                            onPrevious={
                                viewed.step > 0 ? () => viewAt(shownAssets[viewed.step - 1]) : undefined
                            }
                            onNext={
                                viewed.step !== -1 && viewed.step < shownAssets.length - 1
                                    ? () => viewAt(shownAssets[viewed.step + 1])
                                    : undefined
                            }
                            onToggleSelected={toggleViewed}
                            onProcess={
                                viewedProcess
                                    ? () =>
                                          setProcessStep({
                                              sectionId: section.id,
                                              entry: viewed.entry,
                                              form: viewedProcess,
                                          })
                                    : undefined
                            }
                            onEdit={
                                viewedEdit
                                    ? () =>
                                          setEditStep({ sectionId: section.id, entry: viewed.entry, form: viewedEdit })
                                    : undefined
                            }
                            onMove={
                                viewedMovable
                                    ? () => setMoveStep({ sectionId: section.id, entry: viewed.entry })
                                    : undefined
                            }
                            covered={!!shownProcess || !!shownMove || !!shownEdit}
                            deletable={viewedDeletable}
                            onDeleted={() => assetDeleted(viewed.entry, viewed.index)}
                            onDeleteLeft={() => relistAll(sectionAdapter)}
                            onUpdated={reloadLibrary}
                        />
                    )}
                    {shownProcess && section && (
                        <MediaProcess
                            key={shownProcess.entry.id}
                            entry={viewed?.entry ?? shownProcess.entry}
                            section={section}
                            adapter={sectionAdapter}
                            form={viewedProcess ?? shownProcess.form}
                            unavailable={!viewedProcess}
                            onCancel={() => setProcessStep(null)}
                            onSent={(taken) => processSent(shownProcess.entry, taken)}
                        />
                    )}
                    {shownEdit && section && (
                        <MediaGroup
                            key={shownEdit.entry.id}
                            group={viewed?.entry ?? shownEdit.entry}
                            parent={viewedParent}
                            parentId={viewedFolderId}
                            section={section}
                            adapter={sectionAdapter}
                            form={viewedEdit ?? shownEdit.form}
                            backLabel={text.mediaBackToAsset(isolate(shownEdit.entry.name))}
                            onCancel={() => setEditStep(null)}
                            onDone={(now) => groupEdited(viewed?.entry ?? shownEdit.entry, now)}
                            onLeft={() => {
                                propertiesCache.forgetDetails(shownEdit.entry, sectionAdapter);
                                relistAll(sectionAdapter);
                            }}
                        />
                    )}
                    {formingGroup && newGroupForm && section && (
                        <MediaGroup
                            key={`new/${levelKey}`}
                            group={null}
                            parent={openGroup ?? null}
                            parentId={folderId}
                            section={section}
                            adapter={sectionAdapter}
                            form={newGroupForm}
                            backLabel={text.mediaBackToLibrary(levelName)}
                            onCancel={closeNewGroup}
                            onDone={(made) => made && groupCreated(made)}
                            onLeft={() => relistAll(sectionAdapter)}
                        />
                    )}
                    {shownMove && section && (
                        <MediaMove
                            key={shownMove.entry.id}
                            entry={viewed?.entry ?? shownMove.entry}
                            section={section}
                            from={viewedTrail}
                            movingIds={movingIds}
                            onCancel={() => setMoveStep(null)}
                            onMove={startMove}
                        />
                    )}
                    {shownStep && section && (
                        <MediaUpload
                            key={shownStep.key}
                            section={section}
                            levelName={shownStep.into.name}
                            adapter={sectionAdapter}
                            check={shownStep.check}
                            form={shownStep.form}
                            onCancel={closeUploadStep}
                            onUpload={(values) => {
                                sendUpload(section, shownStep.into, shownStep.check.files, values);
                                closeUploadStep();
                            }}
                        />
                    )}
                    {dropping && section && <DropZone label={text.mediaDropToUpload(isolate(levelName))} />}
                </div>
                {uploads.items.length > 0 && (
                    <div className={styles.uploads}>
                        <UploadPanel
                            items={uploads.items}
                            onCancel={uploads.queue.cancel}
                            onRetry={uploads.queue.retry}
                            onCancelAll={uploads.queue.cancelAll}
                            onClear={clearUploads}
                        />
                    </div>
                )}
                {shownMoves.length > 0 && (
                    <div className={styles.uploads}>
                        <TransferPanel
                            items={shownMoves}
                            onCancel={transfers.queue.cancel}
                            onRetry={retryMove}
                            onCancelAll={transfers.queue.cancelAll}
                            onClear={clearMoves}
                        />
                    </div>
                )}
                {choosing && (
                    <ChooseBar
                        count={count}
                        selectedText={selectedText}
                        note={limitNote}
                        held={onChoose ? chooseHeld : undefined}
                        chosenOpen={chosenOverlay}
                        showOpener={!chosenEmpty}
                        openerRef={openerRef}
                        onOpenChosen={() => setChosenOverlay(true)}
                        onChoose={onChoose && (() => !chooseHeld && handOver(choices))}
                    />
                )}
            </div>
            {choosing && (
                <>
                    <Backdrop open={chosenOverlay && !docked && !chosenEmpty} className={mediaLayout.chosenBackdrop} onClick={closeChosen} />
                    <div
                        ref={chosenRef}
                        className={mediaLayout.chosenColumn}
                        data-overlay={chosenOverlay}
                        data-empty={chosenEmpty}
                        onKeyDown={(event) => {
                            if (event.key === "Escape" && !docked && !event.defaultPrevented) {
                                event.preventDefault();
                                closeChosen();
                            }
                        }}
                    >
                        <ChoicesPane
                            choices={choices}
                            adapter={adapter}
                            multiple={multiple}
                            renderDetails={renderDetails}
                            problemsOf={problemsOf}
                            holdOf={holdOfChoice}
                            held={onChoose ? chooseHeld : undefined}
                            badge={badge}
                            selectedText={selectedText}
                            note={limitNote}
                            onRemove={removeChoice}
                            onMove={moveChoice}
                            onClear={clearSelection}
                            onChoose={onChoose && (() => !chooseHeld && handOver(choices))}
                            onShowInLibrary={showInLibrary}
                            onClose={closeChosen}
                        />
                    </div>
                </>
            )}
            <div role="status" className={util.visuallyHidden}>
                {/* A space every other time, so the same message said again is heard again. */}
                {announcement && `${announcement.message}${announcement.id % 2 === 0 ? "\u00A0" : ""}`}
            </div>
        </div>
    );
};

export default MediaFrame;
