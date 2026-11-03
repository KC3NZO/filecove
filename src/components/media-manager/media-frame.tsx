import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, DragEvent, ReactNode, SetStateAction } from "react";

import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useAnnouncer } from "../../hooks/use-announcer";
import { useAssetStates } from "../../hooks/use-asset-states";
import { useData, useFolder } from "../../hooks/use-folder";
import { useLocale } from "../../hooks/use-locale";
import { useTransferQueue } from "../../hooks/use-transfer-queue";
import { useSetting } from "../../hooks/use-setting";
import { useUploadQueue } from "../../hooks/use-upload-queue";
import { CHOICES_WIDTH, mediaMedium, mediaWide } from "../../styles/media-layout";
import { focusOutline, selectedBackground, visuallyHiddenSx } from "../../styles/mixins";
import { isolate } from "../../utils/bidi";
import { firstInView, focusLost } from "../../utils/dom";
import { NO_ERRORS, choiceMessages, countErrorsAt } from "../../utils/field-errors";
import { carriesFiles, filesIn, mayAccept, takesUploads, uploadPatterns } from "../../utils/files";
import { isHidden } from "../../utils/hidden";
import { countLimit } from "../../utils/limits";
import {
    checkMediaUpload,
    groupRule,
    holdOf,
    layoutsOf,
    withState,
    workOf,
} from "../../utils/media";
import { allows } from "../../utils/permissions";
import { holdsTerms, searchTerms } from "../../utils/search";
import { NO_MODIFIERS, nextSelection } from "../../utils/selection";
import { pressesKey } from "../../utils/shortcut";
import Icon from "../icons/icon";
import TransferPanel from "../transfers/transfer-panel";
import UploadPanel from "../uploads/upload-panel";
import { choiceKey } from "./choice-list";
import ChoicesPane from "./choices-pane";
import ChooseBar from "./choose-bar";
import GroupCreate from "./group-create";
import LibraryList from "./library-list";
import MediaAsset from "./media-asset";
import { ChoiceMessages, MediaFormBody } from "./media-form";
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
    MediaAssetDraw,
    MediaAssetParams,
    MediaChoice,
    MediaGroupForm,
    MediaLayout,
    MediaLayouts,
    MediaPickForm,
    MediaProcessForm,
    MediaSection,
    MediaSectionGroup,
    MediaUploadCheck,
    MediaUploadForm,
    PropertyDefinitionGroup,
    PropertyErrorKeyParams,
    TransferItem,
} from "../../types";

export interface MediaFrameProps {
    groups: readonly MediaSectionGroup[];
    adapter: FileAdapter;
    multiple: boolean;
    /** How many can be selected at once with `multiple`. */
    maxChoices: number | undefined;
    /** Whether an asset can be added beside those already picked, for this use. */
    canSelect: ((asset: FileEntry, section: MediaSection, choices: readonly MediaChoice[]) => boolean | string) | undefined;
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
    /** What's selected as it mounts. */
    defaultValue: readonly MediaChoice[] | undefined;
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

/** Who takes the focus as a level shows: the group left, or with none, the first thing in it. */
interface LevelFocus {
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
interface Picks {
    items: readonly Pick[];
    anchor: { sectionId: string; id: string } | null;
}

/** The asset shown in the library's place, by its library's id, as it was when it was opened. */
interface Viewing {
    sectionId: string;
    entry: FileEntry;
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
// The groups each choice was picked among, kept with it this way as it's no business of the app's.
const PICK_TRAILS = new WeakMap<MediaChoice, readonly FileEntry[]>();
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

/** How long a file just uploaded is waited for in its library's listing, in ms. */
const ARRIVAL_WAIT = 10_000;
// Stands in for a library while there's none, so the listing's hook has one to not list.
const NO_SECTION: MediaSection = { id: "", label: "", rootId: "", kind: "image" };

// The newest first, as media libraries show them, then by name.
const byDate = (compareNames: (a: string, b: string) => number) => (a: FileEntry, b: FileEntry) =>
    (b.modifiedAt?.getTime() ?? 0) - (a.modifiedAt?.getTime() ?? 0) || compareNames(a.name, b.name);

const pickOf = (choice: MediaChoice): Pick => ({
    sectionId: choice.section.id,
    asset: choice.asset,
    values: DEFAULTED.has(choice) ? NO_VALUES : choice.values,
    trail: PICK_TRAILS.get(choice),
});

const isGroup = (entry: FileEntry) => entry.kind === "folder";

/** What the app draws above a group's contents, as a component of its own, so it may use hooks. */
const GroupHeader = ({ draw, group, section }: GroupHeaderProps) => draw(group, section);

const picksFrom = (choices: readonly MediaChoice[] | undefined): Picks =>
    choices && choices.length > 0
        ? { items: choices.map((choice) => pickOf({ ...choice, values: choice.values ?? NO_VALUES })), anchor: null }
        : NO_PICKS;

// Positioned, so the selected column's overlay and its backdrop are placed by it.
const frameSx: SxProps<Theme> = {
    position: "relative",
    display: "flex",
    height: "100%",
    bgcolor: "background.default",
    color: "text.primary",
};

const mainSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
};

// The library sits as an inset, rounded panel on the window background, as the file manager's
// content does; beside the docked list of libraries, which has its own inset, it takes no margin.
// Positioned, so the asset view covers it. Without the choose bar under it, as where the selected
// column docks, it keeps a margin of its own below.
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
    [mediaMedium]: { '[data-libraries="true"] &': { marginInlineStart: 0 } },
    '[data-choosing="false"] &': { mb: 0.75 },
    [mediaWide]: { mb: 0.75 },
};

// The grid stays under the asset view, hidden but laid out, so it's scrolled where it was and
// keeps its Tab stop when the view goes back to it.
const gridSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    '&[data-covered="true"]': { visibility: "hidden" },
};

// Over the library while files dragged over it can be dropped there: an outline inside its edge,
// and what a drop does, in its middle.
const dropZoneSx: SxProps<Theme> = (theme) => ({
    position: "absolute",
    inset: 0,
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    p: 3,
    borderRadius: "inherit",
    bgcolor: selectedBackground(theme),
    pointerEvents: "none",
    ...focusOutline,
});

const dropLabelSx: SxProps<Theme> = {
    px: 2,
    py: 1,
    borderRadius: 2,
    bgcolor: "background.paper",
    boxShadow: 2,
    fontSize: "0.875rem",
    fontWeight: 600,
    textAlign: "center",
};

// Under the library, an inset panel as it is, above the choose bar; where the library has no
// margin of its own below, as above the choose bar, it takes one above.
const uploadsSx: SxProps<Theme> = {
    flexShrink: 0,
    marginInline: 0.75,
    mb: 0.75,
    [mediaMedium]: { '[data-libraries="true"] &': { marginInlineStart: 0 } },
    '[data-choosing="true"] &': { mt: 0.75 },
    [mediaWide]: { '[data-choosing="true"] &': { mt: 0 } },
};

const backdropSx: SxProps<Theme> = {
    position: "absolute",
    zIndex: 2,
    [mediaWide]: { display: "none" },
};

const librariesBackdropSx: SxProps<Theme> = {
    position: "absolute",
    zIndex: 2,
    [mediaMedium]: { display: "none" },
};

// Below `mediaWide`, an overlay at the end side while it's opened (`data-overlay`); from it, docked
// beside the library, from the top, as a sidebar.
const chosenSx: SxProps<Theme> = {
    display: "none",
    flexDirection: "column",
    position: "absolute",
    zIndex: 3,
    top: 0,
    bottom: 0,
    insetInlineEnd: 0,
    width: `min(${CHOICES_WIDTH + 40}px, 90%)`,
    overflow: "hidden",
    bgcolor: "background.paper",
    boxShadow: 8,
    '&[data-overlay="true"]': { display: "flex" },
    // One at a time with nothing selected, there's nothing to show, so it isn't there.
    '&[data-empty="true"]': { display: "none" },
    [mediaWide]: {
        display: "flex",
        position: "relative",
        zIndex: "auto",
        flexShrink: 0,
        width: CHOICES_WIDTH,
        my: 0.75,
        marginInlineEnd: 0.75,
        borderRadius: 3,
        boxShadow: "none",
        '&[data-empty="true"]': { display: "none" },
    },
};

const noLibrariesSx: SxProps<Theme> = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1.5,
    flex: 1,
    color: "text.secondary",
    "& > svg": { fontSize: 56, opacity: 0.6 },
};

// Whether the selected column, or the libraries, are an overlay, as the container queries lay them
// out, read from their style.
const overlays = (pane: HTMLElement) => getComputedStyle(pane).position === "absolute";

/** Everything inside the media manager's root, below the contexts it provides. */
const MediaFrame = ({
    groups,
    adapter,
    multiple,
    maxChoices,
    canSelect,
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
    defaultValue,
    errors,
    choiceErrorKey,
    propertiesCache,
}: MediaFrameProps) => {
    const { text, foldLetters, compareNames, formatNumber, formatPercent } = useLocale();
    const sections = useMemo(() => groups.flatMap((group) => group.sections), [groups]);
    const sectionsById = useMemo(() => new Map(sections.map((item) => [item.id, item])), [sections]);
    const [openId, setOpenId] = useState<string>();
    const section = sections.find(({ id }) => id === openId) ?? sections[0];
    const sectionAdapter = section?.adapter ?? adapter;
    const several = sections.length > 1;
    // Each library stays at the group it was left at, going by the root and the adapter it was walked
    // from, as an app may change either.
    const [levels, setLevels] = useState(NO_LEVELS);
    const kept = section && levels[section.id];
    const trail = kept && kept.rootId === section.rootId && kept.adapter === sectionAdapter ? kept.trail : NO_TRAIL;
    const openGroup = trail.at(-1);
    const inGroup = !!openGroup;
    const folderId = openGroup?.id ?? section?.rootId ?? "";
    const levelName = openGroup?.name ?? section?.label ?? "";
    const levelKey = `${section?.id}/${folderId}`;
    const { state, reload } = useFolder(section ?? NO_SECTION, folderId, !!section, true);
    const choosing = !!onChoose;
    // Limits are on what's chosen, so they're nothing while the media manager is only looked through.
    const limit = choosing && multiple ? (countLimit(maxChoices, 1) ?? Infinity) : Infinity;
    const rule = choosing ? canSelect : undefined;
    const { announcement, announce } = useAnnouncer();

    const [query, setQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchButtonRef = useRef<HTMLButtonElement>(null);
    // What had the focus as the search opened, to give it back to as it closes.
    const searchOpenerRef = useRef<HTMLElement | null>(null);
    // Asks the field to take the focus once it's there, as it's only drawn by the render that follows.
    const focusSearchAsked = useRef(false);
    const [picks, setPicks] = useState<Picks>(() => picksFrom(defaultValue));
    const [viewing, setViewing] = useState<Viewing | null>(null);
    const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(NO_IDS);
    // The order the app was last handed the picks in, at Choose, by their keys, which the keys of
    // the errors its backend answers go by.
    const [handedOrder, setHandedOrder] = useState<readonly string[] | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    // The asset the view went back from, whose tile takes the focus back.
    const backFromRef = useRef<string | null>(null);
    const deletedAtRef = useRef<number | null>(null);
    const levelFocusRef = useRef<LevelFocus | null>(null);
    const levelUpRef = useRef<HTMLButtonElement>(null);
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
    const [dropping, setDropping] = useState(false);
    const [uploadLevels, setUploadLevels] = useState(NO_UPLOAD_LEVELS);
    const [arrivals, setArrivals] = useState(NO_ARRIVALS);
    const arrivedRef = useRef(new Set<number>());
    const arrivalCount = useRef(0);
    const pickerRef = useRef<HTMLInputElement>(null);
    const uploadButtonRef = useRef<HTMLButtonElement>(null);
    const [processStep, setProcessStep] = useState<ProcessStep | null>(null);

    // The selected column: docked where there's room, or an overlay while opened.
    const [chosenOverlay, setChosenOverlay] = useState(false);
    const [docked, setDocked] = useState(true);
    const frameRef = useRef<HTMLDivElement>(null);
    const chosenRef = useRef<HTMLDivElement>(null);
    const openerRef = useRef<HTMLButtonElement>(null);

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

    // Follows the column docking as the root's width changes, and closes the overlay as it docks,
    // so narrowing again doesn't bring it back unasked.
    useEffect(() => {
        const frame = frameRef.current;
        const pane = chosenRef.current;

        if (!frame || !pane) {
            return;
        }

        const observer = new ResizeObserver(() => {
            const nowDocked = !overlays(pane);

            setDocked(nowDocked);

            if (nowDocked) {
                setChosenOverlay(false);
            }
        });

        observer.observe(frame);

        return () => observer.disconnect();
    }, [choosing]);

    // The overlay takes the focus as it opens.
    useEffect(() => {
        if (chosenOverlay) {
            chosenRef.current?.querySelector<HTMLElement>("section")?.focus();
        }
    }, [chosenOverlay]);

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

    // Assets just deleted are gone at once, until the listing comes back without them. Forgotten then,
    // as a backend whose ids are paths may give the id to a file uploaded later.
    useEffect(() => setDeletedIds(NO_IDS), [state?.entries]);

    const sectionId = section?.id;

    // The same asset is the same wherever it's listed: from the same adapter, with the same id. Ids
    // are only unique within an adapter, so two adapters never share one.
    const adapterOf = useCallback((item: MediaSection) => item.adapter ?? adapter, [adapter]);

    // Uploads run in the background, a few at a time, while the user goes on; the libraries they
    // end in, every one on the adapter rooted there, are listed again.
    const relist = useCallback(
        (served: FileAdapter, folderIds: string[]) => {
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

    // Assets their listing says are being processed, in the library shown and among the picks, each
    // through its adapter, followed until they're done; a pick of the library shown as it's listed.
    const processed = useMemo<FollowedAssets[]>(() => {
        const byAdapter = new Map<FileAdapter, Map<string, FileEntry>>();
        const listedIds = new Set(listed.map(({ id }) => id));
        const add = (served: FileAdapter, entry: FileEntry) => {
            if (entry.processing?.status === "processing") {
                byAdapter.set(served, (byAdapter.get(served) ?? new Map()).set(entry.id, entry));
            }
        };

        listed.forEach((entry) => add(sectionAdapter, entry));
        picks.items.forEach(({ sectionId: pickedIn, asset }) => {
            const from = sectionsById.get(pickedIn);
            const served = from && adapterOf(from);

            if (served && !(served === sectionAdapter && listedIds.has(asset.id))) {
                add(served, asset);
            }
        });

        return [...byAdapter].map(([served, entries]) => ({ adapter: served, entries: [...entries.values()] }));
    }, [listed, picks.items, sectionsById, adapterOf, sectionAdapter]);

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

    // A pick keeps its entry as last listed, so what's handed over while another library is shown has
    // what's been made of it since, and it's followed there as what it's listed as.
    useEffect(() => {
        const listedById = new Map(listed.map((entry) => [entry.id, entry]));

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
    }, [listed, sectionsById, adapterOf, sectionAdapter]);

    const terms = useMemo(() => searchTerms(query, foldLetters), [query, foldLetters]);

    // What's shown of the open level, by the search: what the grid's indexes go by, and the focus.
    const shownEntries = useMemo(
        () =>
            terms.length === 0 ? leveled : leveled.filter((entry) => holdsTerms(foldLetters(entry.name), terms)),
        [leveled, terms, foldLetters],
    );

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

    // What the app's form holds for a pick until it's changed.
    const defaultsOf = useCallback(
        (asset: FileEntry, from: MediaSection) => (pickForm?.(asset, from)?.defaults as Record<string, unknown>) ?? NO_VALUES,
        [pickForm],
    );

    // What's selected, as it is now: in a library that's gone, it goes; picked at the open level of the
    // open library, once that's listed, as it's listed now, and gone when it isn't any more; picked
    // anywhere else, as the open level lists it when it does, through the same adapter, or else as it
    // was picked. One the app gave has no known level, so it's only known to be gone from a library
    // whose root holds no groups, where it can only have been. One on its way elsewhere isn't listed
    // only for that, so it stays as it was.
    const choices = useMemo<MediaChoice[]>(() => {
        const listedById = state?.status === "ready" ? new Map(library.map((entry) => [entry.id, entry])) : undefined;
        const flat = !inGroup && library.length === leveled.length;

        return picks.items.flatMap(({ sectionId: pickedIn, asset, values, trail: pickedAmong }) => {
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

            const choice = { asset: now, section: from, values: values === NO_VALUES ? defaultsOf(now, from) : values };

            if (values === NO_VALUES) {
                DEFAULTED.add(choice);
            }

            if (pickedAmong) {
                PICK_TRAILS.set(choice, pickedAmong);
            }

            return [choice];
        });
    }, [
        picks.items,
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
    ]);

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

    // Hands the picks to the app, keeping the order they went in, each with its values to itself, as
    // what its form's defaults gave may be one object, the form's.
    const handOver = useCallback(
        (handed: MediaChoice[]) => {
            setHandedOrder(handed.map(choiceKey));
            onChoose?.(handed.map((choice) => ({ ...choice, values: { ...choice.values } })));
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
            const answer = pickForm?.(choice.asset, choice.section)?.ready?.(pickState(choice, index, all)) ?? true;

            return answer === true
                ? undefined
                : { status: "unfilled", text: typeof answer === "string" && answer ? answer : text.mediaChoiceUnfilled };
        },
        [pickForm, pickState, text],
    );

    // Why the app's `canSelect` refuses an asset beside those picked; nothing when it allows it.
    const refusalOf = useCallback(
        (asset: FileEntry, from: MediaSection, picked: readonly MediaChoice[]): AssetHold | undefined => {
            const allowed = rule?.(asset, from, picked) ?? true;

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

                if (!refusalOf(asset, from, growing)) {
                    fit.push(asset);
                    growing.push({ asset, section: from, values: defaultsOf(asset, from) });
                }
            }

            return { fit, cut: false };
        },
        [limit, refusalOf, defaultsOf],
    );

    // Why an asset that isn't selected can't be added now, for its view: the app's rule, or no room.
    const refusedNow = useCallback(
        (asset: FileEntry, from: MediaSection): AssetHold | undefined =>
            refusalOf(asset, from, multiple ? choices : NO_CHOICES) ??
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

    // Why assets shown can't be added now: as above, or refused by the app's rule beside those picked,
    // one at a time none, as it would replace them. Those selected already stay as they are, as they
    // can be taken out, and their rows say it.
    const holds = useMemo(() => {
        if (!section || !rule) {
            return assetHolds;
        }

        const held = new Map(assetHolds);

        shownAssets.forEach((entry) => {
            if (!held.has(entry.id) && !selectedIds.has(entry.id)) {
                const refusal = refusalOf(entry, section, multiple ? choices : NO_CHOICES);

                if (refusal) {
                    held.set(entry.id, refusal);
                }
            }
        });

        return held.size > 0 ? held : NO_HOLDS;
    }, [section, rule, assetHolds, shownAssets, selectedIds, refusalOf, multiple, choices]);

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
                      refusalOf(choice.asset, choice.section, choices.slice(0, index)) ??
                      unfilledOf(choice, index, choices));

            if (hold) {
                held.set(choiceKey(choice), hold);
            }
        });

        return held.size > 0 ? held : NO_HOLDS;
    }, [choices, limit, text, formatNumber, formatPercent, refusalOf, unfilledOf]);

    const holdOfChoice = useCallback((choice: MediaChoice) => choiceHolds.get(choiceKey(choice)), [choiceHolds]);

    // What holds Choose back, said beside it: those to take out first, then those to fill in, by why
    // when there's one, else those still processed.
    const chooseHeld = useMemo(() => {
        if (choiceHolds.size === 0) {
            return undefined;
        }

        const held = [...choiceHolds.values()];
        const waiting = held.filter(({ status }) => status === "processing").length;
        const unfilled = held.filter(({ status }) => status === "unfilled");
        const refused = held.length - waiting - unfilled.length;

        if (refused > 0) {
            return text.mediaChoicesUnavailable(refused);
        }

        if (unfilled.length > 0) {
            return unfilled.length === 1 ? unfilled[0].text : text.mediaChoicesUnfilled(unfilled.length);
        }

        return text.mediaChoicesProcessing(waiting);
    }, [choiceHolds, text]);

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

        const entry = leveled.find(({ id }) => id === viewing.entry.id) ?? viewing.entry;

        return {
            entry,
            index: shownEntries.findIndex(({ id }) => id === entry.id),
            step: shownAssets.findIndex(({ id }) => id === entry.id),
        };
    }, [viewing, sectionId, section, leveled, shownEntries, shownAssets]);

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
                shownAssets.filter((entry) => ids.has(entry.id) && !selectedIds.has(entry.id)),
                section,
                kept,
            );

            if (cut) {
                sayFull();
            }

            return {
                items: [...kept.map(pickOf), ...fit.map((asset) => ({ sectionId, asset, values: NO_VALUES, trail }))],
                anchor: anchor === null ? null : { sectionId, id: anchor },
            };
        },
        [sectionId, section, choices, inOpen, multiple, shownAssets, selectedIds, fitting, sayFull, trail],
    );

    // The open library's share as `ids` would make it, without the groups and those it adds that can't
    // be chosen now, as a Shift-click's range or Select all may hold.
    const selectable = useCallback(
        (ids: ReadonlySet<string>) =>
            new Set([...ids].filter((id) => !shownGroupIds.has(id) && (selectedIds.has(id) || !holds.has(id)))),
        [shownGroupIds, holds, selectedIds],
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

            // A group isn't selected, though a range may run through it.
            if (shownGroupIds.has(id) && !(multiple && keys.range)) {
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
            const next = multiple
                ? nextSelection(base, id, { toggle: true, range: keys.range }, order)
                : nextSelection(base, id, NO_MODIFIERS, order);

            setPicks(picksWith(selectable(next.ids), next.anchor));
        },
        [order, holds, shownGroupIds, selectedIds, full, sayFull, picks.anchor, sectionId, multiple, picksWith, selectable],
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
        if (!viewed || !section || isGroup(viewed.entry)) {
            return;
        }

        const choice = { asset: viewed.entry, section, values: NO_VALUES };

        if (selectedIds.has(viewed.entry.id)) {
            removeChoice(choice);
        } else if (!holdOf(viewed.entry, section, { text, formatPercent }) && !refusedNow(viewed.entry, section)) {
            const pick = { ...pickOf(choice), trail };

            setPicks((previous) => ({
                items: multiple ? [...previous.items, pick] : [pick],
                anchor: { sectionId: section.id, id: viewed.entry.id },
            }));
        }
    }, [viewed, section, selectedIds, removeChoice, multiple, text, formatPercent, refusedNow, trail]);

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

    // Opens an asset, or a group's details, in the library's place.
    const openAsset = useCallback(
        (index: number) => {
            const entry = shownEntries[index];

            if (entry && section && (!isGroup(entry) || opensGroups)) {
                setViewing({ sectionId: section.id, entry });
            }
        },
        [shownEntries, section, opensGroups],
    );

    // Shows another level of the open library, with what was over this one gone, as opening a folder
    // ends a search in the file manager, and says where it is, as the focus only says what it's on.
    const showLevel = useCallback(
        (next: readonly FileEntry[], groupId: string | null) => {
            if (!section) {
                return;
            }

            levelFocusRef.current = { groupId, waited: false };
            setLevels((previous) => ({
                ...previous,
                [section.id]: { rootId: section.rootId, adapter: sectionAdapter, trail: next },
            }));
            setQuery("");
            setSearching(false);
            setViewing(null);
            setUploadStep(null);
            setProcessStep(null);
            setMoveStep(null);
            setEditStep(null);
            setCreatingAt(null);
            announce(text.mediaInGroup(isolate(next.at(-1)?.name ?? section.label)));
        },
        [section, sectionAdapter, announce, text],
    );

    const enterGroup = useCallback((group: FileEntry) => showLevel([...trail, group], null), [showLevel, trail]);

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
            (levelUpRef.current ?? searchButtonRef.current)?.focus();
        }
    }, [shownEntries, state?.status, folderId]);

    // A group just made, with no details to open, takes the focus from the button once it's listed.
    useLayoutEffect(() => {
        const id = createdRef.current;
        const index = id === null ? -1 : shownEntries.findIndex((entry) => entry.id === id);

        if (index === -1) {
            return;
        }

        createdRef.current = null;

        if (focusLost() || document.activeElement === newGroupRef.current) {
            const tile = panelRef.current?.querySelector<HTMLElement>(`[role="listbox"] [data-index="${index}"]`);

            tile?.focus();
            tile?.scrollIntoView({ block: "nearest" });
        }
    }, [shownEntries]);

    // Back to the library, the asset's tile taking the focus when the view had it.
    const closeAsset = useCallback(() => {
        const view = panelRef.current?.querySelector("section");

        backFromRef.current = view?.contains(document.activeElement) || focusLost() ? (viewing?.entry.id ?? null) : null;
        setViewing(null);
    }, [viewing]);

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
        const tile = panelRef.current?.querySelector<HTMLElement>(`[role="listbox"] [data-index="${index}"]`);

        // With no tile to go to, as the last one in it was deleted, the way back, or the search.
        if (tile) {
            tile.focus();
            tile.scrollIntoView({ block: "nearest" });
        } else {
            (levelUpRef.current ?? searchButtonRef.current)?.focus();
        }
    }, [viewed, shownEntries]);

    // A double click or Enter: chooses the asset, with the rest selected when several can be; without
    // `onChoose`, opens it in the library's place.
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
                setPicks({
                    items: [{ sectionId: section.id, asset: entry, values: NO_VALUES, trail }],
                    anchor: { sectionId: section.id, id: entry.id },
                });
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
            trail,
        ],
    );

    const closeLibraries = useCallback(() => {
        setLibrariesOpen(false);
        librariesOpenerRef.current?.focus();
    }, []);

    // Opening a library from the drawer closes it, the focus going back to its button.
    const openSection = useCallback(
        (id: string) => {
            setOpenId(id);
            setQuery("");
            setSearching(false);
            setViewing(null);
            setUploadStep(null);
            setProcessStep(null);
            setMoveStep(null);
            setEditStep(null);
            setCreatingAt(null);

            if (librariesOpen) {
                closeLibraries();
            }
        },
        [librariesOpen, closeLibraries],
    );

    const closeChosen = useCallback(() => {
        setChosenOverlay(false);
        openerRef.current?.focus();
    }, []);

    // A pick's "Show in library": its library, open at it, the overlay closing so it shows.
    const showInLibrary = useCallback((choice: MediaChoice) => {
        const pickedAmong = PICK_TRAILS.get(choice);

        // Among the groups it was picked in, so back from it goes to its fellows.
        if (pickedAmong) {
            setLevels((previous) => ({
                ...previous,
                [choice.section.id]: {
                    rootId: choice.section.rootId,
                    adapter: adapterOf(choice.section),
                    trail: pickedAmong,
                },
            }));
        }

        setOpenId(choice.section.id);
        setQuery("");
        setSearching(false);
        setViewing({ sectionId: choice.section.id, entry: choice.asset });
        setUploadStep(null);
        setProcessStep(null);
        setMoveStep(null);
        setEditStep(null);
        setCreatingAt(null);
        setChosenOverlay(false);
    }, [adapterOf]);

    const reloadLibrary = useCallback(() => reload(), [reload]);

    useLayoutEffect(() => {
        if (focusSearchAsked.current) {
            focusSearchAsked.current = false;
            searchInputRef.current?.focus();
            searchInputRef.current?.select();
        }
    });

    // Opens the search field and focuses it, or, open already, focuses it with what's typed selected.
    const openSearch = () => {
        if (!searching) {
            searchOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }

        focusSearchAsked.current = true;
        setSearching(true);

        const input = searchInputRef.current;

        if (input) {
            focusSearchAsked.current = false;
            input.focus();
            input.select();
        }
    };

    const stopSearching = () => {
        setSearching(false);
        setQuery("");
        searchOpenerRef.current = null;
    };

    // Closing with the focus in the field gives it back to what had it before the search opened, or
    // else to the search button, as when that was an asset the search has left out since.
    const closeSearch = () => {
        const opener = searchOpenerRef.current;

        if (searchInputRef.current?.closest('[role="search"]')?.contains(document.activeElement)) {
            if (opener && opener !== document.body) {
                opener.focus();
            }

            if (document.activeElement !== opener) {
                searchButtonRef.current?.focus();
            }
        }

        stopSearching();
    };

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
        [section, takesFiles, sectionAdapter, folderId, levelName, sendUpload],
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

    // Files dragged over the library are taken there while it's shown and takes them, of the types
    // it takes as far as a drag tells; otherwise the frame refuses them.
    const dropsFiles = takesFiles && !viewed && !shownStep && !formingGroup;
    const patterns = useMemo(() => (section ? uploadPatterns(section) : null), [section]);

    const offerDrop = (event: DragEvent<HTMLElement>) => {
        if (carriesFiles(event) && dropsFiles && mayAccept(patterns, event.dataTransfer.items)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setDropping(true);
        }
    };

    const leaveDrop = (event: DragEvent<HTMLElement>) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) {
            setDropping(false);
        }
    };

    const takeDrop = (event: DragEvent<HTMLElement>) => {
        setDropping(false);

        if (carriesFiles(event) && dropsFiles) {
            event.preventDefault();
            askUpload(filesIn(event.dataTransfer));
        }
    };

    // Files pasted in the library, with the browser's paste key, as the file manager takes them.
    const pasteFiles = (event: ClipboardEvent<HTMLElement>) => {
        if (!dropsFiles) {
            return;
        }

        const pasted = filesIn(event.clipboardData);

        if (pasted.files.length + pasted.folders.length > 0) {
            event.preventDefault();
            askUpload(pasted);
        }
    };

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
        const last = (multiple ? assets : assets.filter((asset) => !refusalOf(asset, section, NO_CHOICES))).at(-1);

        setArrivals((previous) => previous.filter((waiting) => !keys.has(waiting.key)));

        if (!onChoose || !last) {
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
        onChoose,
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
            (pickForm || choiceErrorKey) &&
            ((choice: MediaChoice, index: number) => {
                const state = pickState(choice, index, choices);
                const form = pickForm?.(choice.asset, choice.section);

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
            }),
        [pickForm, choiceErrorKey, pickState, choices, setChoiceValues],
    );

    // How much of a pick there is to fix, for its row in the list, whose form isn't open: each field
    // its form has now with an error, and its own errors as one more.
    const problemsOf = useMemo(
        () =>
            (pickForm || choiceErrorKey) && errors !== NO_ERRORS
                ? (choice: MediaChoice) => {
                      const place = errorPlaces.get(choiceKey(choice));

                      if (place === undefined) {
                          return 0;
                      }

                      const own = choiceMessages(choiceErrorKey, errors, place, choice.asset).length > 0 ? 1 : 0;
                      const form = pickForm?.(choice.asset, choice.section);

                      return (
                          own +
                          countErrorsAt(errors, form?.errorKeys?.(pickState(choice, place, choices)) ?? NO_ERROR_KEYS)
                      );
                  }
                : undefined,
        [pickForm, choiceErrorKey, errors, errorPlaces, pickState, choices],
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
    // The asset at the top of the library as its layout is switched, to scroll back to in the new one.
    const layoutAnchorRef = useRef<number | null>(null);

    const switchLayout = () => {
        if (section && otherLayout) {
            layoutAnchorRef.current = firstInView(panelRef.current?.querySelector('[role="listbox"]'));
            setLayouts((current) => ({ ...current, [section.id]: otherLayout }));
        }
    };

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
            viewedEntry && section && !viewedGroup
                ? (holdOf(viewedEntry, section, { text, formatPercent }) ??
                  (selectedIds.has(viewedEntry.id) ? undefined : refusedNow(viewedEntry, section)))
                : undefined,
        [viewedEntry, viewedGroup, section, text, formatPercent, selectedIds, refusedNow],
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
            allows("write", state?.permissions, viewedEntry.permissions)
                ? (section.processForm?.(viewedEntry) ?? null)
                : null,
        [viewedEntry, viewedGroup, section, sectionAdapter, state?.permissions],
    );

    // Whether the asset or group shown can be deleted: where what's open can be, and it allows it.
    const viewedDeletable = !!viewedEntry && deletes && allows("delete", viewedEntry.permissions);

    // Whether the asset or group shown can be moved: where what's open can be, it allows it, and there's
    // somewhere for it to go, a level above or another group here, so a flat library offers nothing.
    const viewedMovable =
        !!viewedEntry &&
        moves &&
        allows("move", viewedEntry.permissions) &&
        (inGroup || leveled.some((entry) => isGroup(entry) && entry.id !== viewedEntry.id));

    const shownProcess =
        processStep && processStep.sectionId === sectionId && processStep.entry.id === viewedEntry?.id
            ? processStep
            : null;

    // What can be edited of the group shown: its library's form for it, where its adapter takes what it
    // holds and it can be changed.
    const viewedEdit = useMemo(
        () =>
            viewedEntry && viewedGroup && editsGroups && allows("write", viewedEntry.permissions)
                ? (section?.groupForm?.({ group: viewedEntry, parent: openGroup ?? null }) ?? null)
                : null,
        [viewedEntry, viewedGroup, editsGroups, section, openGroup],
    );

    const shownEdit =
        editStep && editStep.sectionId === sectionId && editStep.entry.id === viewedEntry?.id ? editStep : null;

    const shownMove =
        moveStep && moveStep.sectionId === sectionId && moveStep.entry.id === viewedEntry?.id ? moveStep : null;

    // The backend took it on: what was said of the asset before no longer stands, as it may have
    // failed, and its listings say how it stands now.
    const processSent = useCallback(
        (entry: FileEntry) => {
            forgetStates(sectionAdapter, [entry.id]);
            relistAll(sectionAdapter);
            setProcessStep(null);
        },
        [forgetStates, sectionAdapter, relistAll],
    );

    // A group gone from where it was, by a delete or a move: any library left open inside it goes back to
    // where it was gone into from, and what's kept of its listings goes, as their ids may mean nothing now.
    const leaveGroup = useCallback(
        (group: FileEntry, served: FileAdapter) => {
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
        [sections, adapterOf, store],
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
            forgetStates(sectionAdapter, [entry.id]);
            propertiesCache.forgetDetails(entry, sectionAdapter);
            relistAll(sectionAdapter);
            deletedAtRef.current = index;
            setViewing(null);
            setProcessStep(null);
            setMoveStep(null);
            setEditStep(null);
            announce(text.deleteDone(1, isolate(entry.name)));
        },
        [
            section,
            sectionsById,
            adapterOf,
            leaveGroup,
            samePick,
            forgetStates,
            propertiesCache,
            sectionAdapter,
            relistAll,
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
            { id: folderId, name: levelName },
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
            setPicks((previous) => ({
                ...previous,
                items: previous.items.map((pick) =>
                    sameAdapter(pick.sectionId) && pick.trail ? { ...pick, trail: swapped(pick.trail) } : pick,
                ),
            }));
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

        if (now && section) {
            setViewing({ sectionId: section.id, entry: now });
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
        setQuery("");
        setSearching(false);
        relistAll(sectionAdapter);
        announce(text.mediaGroupCreated(isolate(group.name)));

        // A form has asked what it has to, so there's nothing to go on filling in.
        if (hasDetails && !newGroupForm) {
            setViewing({ sectionId: section.id, entry: group });
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
            data-libraries={several}
            data-choosing={choosing}
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
                    <Backdrop open={librariesOpen} sx={librariesBackdropSx} onClick={closeLibraries} />
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
            <Box sx={mainSx}>
                <MediaHeader
                    section={section}
                    trail={trail}
                    onGoToLevel={goToLevel}
                    showsLevelUp={!viewed && !shownStep && !formingGroup}
                    levelUpRef={levelUpRef}
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
                    onUpload={takesFiles && !formingGroup ? () => pickerRef.current?.click() : undefined}
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
                <Box
                    ref={panelRef}
                    sx={panelSx}
                    onDragEnter={offerDrop}
                    onDragOver={offerDrop}
                    onDragLeave={leaveDrop}
                    onDrop={takeDrop}
                    onPaste={pasteFiles}
                >
                    <Box sx={gridSx} data-covered={!!viewed || !!shownStep || formingGroup}>
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
                                entries={shownEntries}
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
                                full={full}
                                multiple={multiple}
                                status={state?.status ?? "loading"}
                                hasMedia={leveled.length > 0}
                                busy={state?.status === "loading" || !!state?.checking}
                                error={errorMessage}
                                onRetry={reloadLibrary}
                                onPress={press}
                                onActivate={activate}
                                onEnterGroup={enterGroupAt}
                                onLevelUp={inGroup ? levelUp : undefined}
                                onOpen={openAsset}
                                onSelectAll={selectAll}
                            />
                        ) : (
                            <Box role="status" sx={noLibrariesSx}>
                                <Icon name="pictures" />
                                <Typography variant="body1">{text.mediaNoLibraries}</Typography>
                            </Box>
                        )}
                    </Box>
                    {viewed && section && (
                        <MediaAsset
                            entry={viewed.entry}
                            section={section}
                            layout={layout}
                            adapter={sectionAdapter}
                            backTo={levelName}
                            choosing={choosing}
                            selected={selectedIds.has(viewed.entry.id)}
                            hold={viewedHold}
                            work={viewedWork}
                            previewers={sectionPreviewers}
                            definitions={viewedDefinitions}
                            propertiesCache={propertiesCache}
                            onBack={closeAsset}
                            onPrevious={
                                viewed.step > 0
                                    ? () => setViewing({ sectionId: section.id, entry: shownAssets[viewed.step - 1] })
                                    : undefined
                            }
                            onNext={
                                viewed.step !== -1 && viewed.step < shownAssets.length - 1
                                    ? () => setViewing({ sectionId: section.id, entry: shownAssets[viewed.step + 1] })
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
                            onSent={() => processSent(shownProcess.entry)}
                        />
                    )}
                    {shownEdit && section && (
                        <MediaGroup
                            key={shownEdit.entry.id}
                            group={viewed?.entry ?? shownEdit.entry}
                            parent={openGroup ?? null}
                            parentId={folderId}
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
                            from={trail}
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
                    {dropping && dropsFiles && section && (
                        <Box sx={dropZoneSx}>
                            <Typography sx={dropLabelSx}>{text.mediaDropToUpload(isolate(levelName))}</Typography>
                        </Box>
                    )}
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
                {shownMoves.length > 0 && (
                    <Box sx={uploadsSx}>
                        <TransferPanel
                            items={shownMoves}
                            onCancel={transfers.queue.cancel}
                            onRetry={retryMove}
                            onCancelAll={transfers.queue.cancelAll}
                            onClear={clearMoves}
                        />
                    </Box>
                )}
                {onChoose && (
                    <ChooseBar
                        count={count}
                        selectedText={selectedText}
                        note={limitNote}
                        held={chooseHeld}
                        chosenOpen={chosenOverlay}
                        showOpener={!chosenEmpty}
                        openerRef={openerRef}
                        onOpenChosen={() => setChosenOverlay(true)}
                        onChoose={() => !chooseHeld && handOver(choices)}
                    />
                )}
            </Box>
            {onChoose && (
                <>
                    <Backdrop open={chosenOverlay && !docked && !chosenEmpty} sx={backdropSx} onClick={closeChosen} />
                    <Box
                        ref={chosenRef}
                        sx={chosenSx}
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
                            held={chooseHeld}
                            badge={badge}
                            selectedText={selectedText}
                            note={limitNote}
                            onRemove={removeChoice}
                            onMove={moveChoice}
                            onClear={clearSelection}
                            onChoose={() => !chooseHeld && handOver(choices)}
                            onShowInLibrary={showInLibrary}
                            onClose={closeChosen}
                        />
                    </Box>
                </>
            )}
            <Box role="status" sx={visuallyHiddenSx}>
                {/* A space every other time, so the same message said again is heard again. */}
                {announcement && `${announcement.message}${announcement.id % 2 === 0 ? "\u00A0" : ""}`}
            </Box>
        </Box>
    );
};

export default MediaFrame;
