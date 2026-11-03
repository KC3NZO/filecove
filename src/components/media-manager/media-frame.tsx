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
import UploadPanel from "../uploads/upload-panel";
import { choiceKey } from "./choice-list";
import ChoicesPane from "./choices-pane";
import ChooseBar from "./choose-bar";
import LibraryList from "./library-list";
import MediaAsset from "./media-asset";
import { ChoiceMessages, MediaFormBody } from "./media-form";
import MediaGrid from "./media-grid";
import MediaHeader from "./media-header";
import MediaProcess from "./media-process";
import MediaUpload from "./media-upload";

import type { PropertiesCache } from "../../store/properties-cache";
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
 * defaults.
 */
interface Pick {
    sectionId: string;
    asset: FileEntry;
    values: Record<string, unknown>;
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
    check: MediaUploadCheck;
    form: MediaUploadForm | null;
}

/** An asset of a library being asked what's to be made of it, with what can be asked as it opened. */
interface ProcessStep {
    sectionId: string;
    entry: FileEntry;
    form: MediaProcessForm;
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
const NO_PICKS: Picks = { items: [], anchor: null };
const NO_VALUES: Record<string, unknown> = {};
const NO_ERROR_KEYS: readonly string[] = [];
// The choices made from a pick's form's defaults, nothing being changed yet, so what's made from them
// again is too, and they go on following the form.
const DEFAULTED = new WeakSet<MediaChoice>();
const NO_PREVIEWERS: readonly FilePreviewer[] = [];
const NO_LAYOUTS: MediaLayouts = {};
// What's offered with no library to show.
const NO_SECTION_LAYOUTS: readonly MediaLayout[] = ["grid"];
const NO_ARRIVALS: readonly Arrival[] = [];
const NO_UPLOADS: readonly FileUploadItem[] = [];
const NO_LIBRARIES: ReadonlyMap<number, string> = new Map();
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
});

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
    const { state, reload } = useFolder(section ?? NO_SECTION, section?.rootId ?? "", !!section, true);
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
    // The order the app was last handed the picks in, at Choose, by their keys, which the keys of
    // the errors its backend answers go by.
    const [handedOrder, setHandedOrder] = useState<readonly string[] | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    // The asset the view went back from, whose tile takes the focus back.
    const backFromRef = useRef<string | null>(null);
    const { store } = useData();

    // Uploading: the step before files are sent, files dragged over the library, the library each
    // upload went into, by its id, and what's just arrived, waiting to be listed.
    const [uploadStep, setUploadStep] = useState<UploadStep | null>(null);
    const uploadStepCount = useRef(0);
    const [dropping, setDropping] = useState(false);
    const [uploadLibraries, setUploadLibraries] = useState(NO_LIBRARIES);
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

    // The library's assets, as its adapter lists them under its root: they're all of its kind, so
    // nothing is sorted into kinds here.
    const listed = useMemo(
        () =>
            (state?.entries ?? NO_ENTRIES)
                .filter((entry) => entry.kind === "file" && !isHidden(entry))
                .sort(byDate(compareNames)),
        [state?.entries, compareNames],
    );

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
    // has may have changed with it.
    const relistAll = useCallback(
        (served: FileAdapter) =>
            relist(
                served,
                sections.filter((item) => adapterOf(item) === served).map(({ rootId }) => rootId),
            ),
        [relist, sections, adapterOf],
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

    // The library's assets with what their backend has said since of their processing.
    const library = useMemo(() => {
        const own = assetStates.get(sectionAdapter);

        return own ? listed.map((entry) => withState(entry, own.get(entry.id))) : listed;
    }, [listed, assetStates, sectionAdapter]);

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

    const shownEntries = useMemo(
        () =>
            terms.length === 0 ? library : library.filter((entry) => holdsTerms(foldLetters(entry.name), terms)),
        [library, terms, foldLetters],
    );

    const order = useMemo(() => shownEntries.map(({ id }) => id), [shownEntries]);

    // Why assets shown can't be chosen now, by their ids: being processed, failed, or refused by
    // their library. They're shown and opened, but not selected.
    const assetHolds = useMemo(() => {
        if (!section) {
            return NO_HOLDS;
        }

        const held = new Map<string, AssetHold>();

        shownEntries.forEach((entry) => {
            const hold = holdOf(entry, section, { text, formatPercent });

            if (hold) {
                held.set(entry.id, hold);
            }
        });

        return held.size > 0 ? held : NO_HOLDS;
    }, [shownEntries, section, text, formatPercent]);

    // The backend's work on assets shown that can be chosen all the same, which their tiles show.
    const works = useMemo(() => {
        const working = new Map<string, AssetHold>();

        shownEntries.forEach((entry) => {
            const work = workOf(entry, { text, formatPercent });

            if (work) {
                working.set(entry.id, work);
            }
        });

        return working.size > 0 ? working : NO_HOLDS;
    }, [shownEntries, text, formatPercent]);

    const uploads = useUploadQueue(relist, text.keptBothName);

    // Whether the open library takes files: its adapter has `upload`, it isn't `readOnly` nor
    // refusing them (`acceptUploads`), and it could be listed, its listing not saying it can't be
    // written to.
    const takesFiles =
        !!section &&
        !!sectionAdapter.upload &&
        takesUploads(section) &&
        state?.status !== "error" &&
        allows("write", state?.permissions);

    // What the app's form holds for a pick until it's changed.
    const defaultsOf = useCallback(
        (asset: FileEntry, from: MediaSection) => (pickForm?.(asset, from)?.defaults as Record<string, unknown>) ?? NO_VALUES,
        [pickForm],
    );

    // What's selected, as it is now: in a library that's gone, it goes; picked in the open library,
    // once that's listed, as it's listed now, and gone when it isn't any more; picked in another,
    // as the open library lists it when it does, through the same adapter, or else as it was picked.
    const choices = useMemo<MediaChoice[]>(() => {
        const listedById = state?.status === "ready" ? new Map(library.map((entry) => [entry.id, entry])) : undefined;

        return picks.items.flatMap(({ sectionId: pickedIn, asset, values }) => {
            const from = sectionsById.get(pickedIn);

            if (!from) {
                return [];
            }

            const served = adapterOf(from);
            const listedNow = listedById && served === sectionAdapter ? listedById.get(asset.id) : undefined;
            const now =
                listedById && pickedIn === sectionId
                    ? listedNow
                    : (listedNow ?? withState(asset, assetStates.get(served)?.get(asset.id)));

            if (!now) {
                return [];
            }

            if (values !== NO_VALUES) {
                return [{ asset: now, section: from, values }];
            }

            const defaulted = { asset: now, section: from, values: defaultsOf(now, from) };

            DEFAULTED.add(defaulted);

            return [defaulted];
        });
    }, [picks.items, sectionsById, state?.status, library, sectionId, adapterOf, sectionAdapter, assetStates, defaultsOf]);

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

        shownEntries.forEach((entry) => {
            if (!held.has(entry.id) && !selectedIds.has(entry.id)) {
                const refusal = refusalOf(entry, section, multiple ? choices : NO_CHOICES);

                if (refusal) {
                    held.set(entry.id, refusal);
                }
            }
        });

        return held.size > 0 ? held : NO_HOLDS;
    }, [section, rule, assetHolds, shownEntries, selectedIds, refusalOf, multiple, choices]);

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

    // The asset shown in the library's place, as it's listed now while it is.
    const viewed = useMemo(() => {
        if (!viewing || viewing.sectionId !== sectionId || !section) {
            return undefined;
        }

        const entry = library.find(({ id }) => id === viewing.entry.id) ?? viewing.entry;

        return { entry, index: shownEntries.findIndex(({ id }) => id === entry.id) };
    }, [viewing, sectionId, section, library, shownEntries]);

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
                items: [...kept.map(pickOf), ...fit.map((asset) => ({ sectionId, asset, values: NO_VALUES }))],
                anchor: anchor === null ? null : { sectionId, id: anchor },
            };
        },
        [sectionId, section, choices, inOpen, multiple, shownEntries, selectedIds, fitting, sayFull],
    );

    // The open library's share as `ids` would make it, without those it adds that can't be chosen
    // now, as a Shift-click's range or Select all may hold.
    const selectable = useCallback(
        (ids: ReadonlySet<string>) =>
            holds.size === 0 ? ids : new Set([...ids].filter((id) => selectedIds.has(id) || !holds.has(id))),
        [holds, selectedIds],
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
        [order, holds, selectedIds, full, sayFull, picks.anchor, sectionId, multiple, picksWith, selectable],
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
        if (!viewed || !section) {
            return;
        }

        const choice = { asset: viewed.entry, section, values: NO_VALUES };

        if (selectedIds.has(viewed.entry.id)) {
            removeChoice(choice);
        } else if (!holdOf(viewed.entry, section, { text, formatPercent }) && !refusedNow(viewed.entry, section)) {
            setPicks((previous) => ({
                items: multiple ? [...previous.items, pickOf(choice)] : [pickOf(choice)],
                anchor: { sectionId: section.id, id: viewed.entry.id },
            }));
        }
    }, [viewed, section, selectedIds, removeChoice, multiple, text, formatPercent, refusedNow]);

    const openAsset = useCallback(
        (index: number) => {
            const entry = shownEntries[index];

            if (entry && section) {
                setViewing({ sectionId: section.id, entry });
            }
        },
        [shownEntries, section],
    );

    // Back to the library, the asset's tile taking the focus when the view had it.
    const closeAsset = useCallback(() => {
        const view = panelRef.current?.querySelector("section");

        backFromRef.current = view?.contains(document.activeElement) || focusLost() ? (viewing?.entry.id ?? null) : null;
        setViewing(null);
    }, [viewing]);

    useLayoutEffect(() => {
        const id = backFromRef.current;

        backFromRef.current = null;

        if (viewed || id === null) {
            return;
        }

        const index = shownEntries.findIndex((entry) => entry.id === id);
        const tile = panelRef.current?.querySelector<HTMLElement>(`[role="listbox"] [data-index="${index}"]`);

        tile?.focus();
        tile?.scrollIntoView({ block: "nearest" });
    }, [viewed, shownEntries]);

    // A double click or Enter: chooses the asset, with the rest selected when several can be; without
    // `onChoose`, opens it in the library's place.
    const activate = useCallback(
        (index: number) => {
            const entry = shownEntries[index];

            if (!entry || !section) {
                return;
            }

            if (!onChoose) {
                setPicks({
                    items: [{ sectionId: section.id, asset: entry, values: NO_VALUES }],
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
        setOpenId(choice.section.id);
        setQuery("");
        setSearching(false);
        setViewing({ sectionId: choice.section.id, entry: choice.asset });
        setUploadStep(null);
        setProcessStep(null);
        setChosenOverlay(false);
    }, []);

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

    // Sends files into a library, each its own upload, kept both with what's there of its name, as a
    // library is listed flat, with what its upload form held.
    const sendUpload = useCallback(
        (target: MediaSection, files: File[], values: Readonly<Record<string, unknown>> | undefined) => {
            const into = { id: target.rootId, name: target.label };
            const ids = uploads.queue.add(adapterOf(target), into, files, "keepBoth", values);

            setUploadLibraries((previous) => new Map([...previous, ...ids.map((id): [number, string] => [id, target.id])]));
        },
        [uploads.queue, adapterOf],
    );

    // What was picked, dropped or pasted into the open library: checked first, and sent at once when
    // there's nothing to ask or say; otherwise the upload step shows in the library's place.
    const askUpload = useCallback(
        (dropped: DroppedFiles) => {
            if (!section || !takesFiles || dropped.files.length + dropped.folders.length === 0) {
                return;
            }

            const check = checkMediaUpload(section, sectionAdapter, dropped);
            const form = check.files.length > 0 ? (section.uploadForm?.(check.files) ?? null) : null;
            const leftOut = check.refused.length + check.folders.length + check.misnamed.length > 0;

            if (!leftOut && !form) {
                sendUpload(section, check.files, undefined);

                return;
            }

            setViewing(null);
            uploadStepCount.current += 1;
            setUploadStep({ key: uploadStepCount.current, sectionId: section.id, check, form });
        },
        [section, takesFiles, sectionAdapter, sendUpload],
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
    const searchable = !!section && !viewed && !shownStep;

    // Files dragged over the library are taken there while it's shown and takes them, of the types
    // it takes as far as a drag tells; otherwise the frame refuses them.
    const dropsFiles = takesFiles && !viewed && !shownStep;
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
            const target = uploadLibraries.get(id);

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
    }, [uploads.items, uploadLibraries]);

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
                    items: [{ sectionId: section.id, asset: last, values: NO_VALUES }],
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
                          ...added.map((asset) => ({ sectionId: section.id, asset, values: NO_VALUES })),
                      ],
                  };
        });
    }, [section, state?.status, library, arrivals, onChoose, multiple, samePick, refusalOf, fitting, choices, inOpen, sayFull]);

    // The open library's uploads, before its assets: those waiting or being sent, and those done
    // until they're listed.
    const shownUploads = useMemo(() => {
        if (sectionId === undefined) {
            return NO_UPLOADS;
        }

        const waiting = new Set(arrivals.map((arrival) => arrival.uploadId));
        const shown = uploads.items.filter(
            (item): item is FileUploadItem =>
                item.kind === "file" &&
                uploadLibraries.get(item.id) === sectionId &&
                (item.status === "queued" || item.status === "uploading" || waiting.has(item.id)),
        );

        return shown.length > 0 ? shown : NO_UPLOADS;
    }, [sectionId, arrivals, uploads.items, uploadLibraries]);

    // Forgets the ended uploads, and the libraries they went into.
    const clearUploads = useCallback(() => {
        uploads.queue.clear();

        const kept = new Set(uploads.queue.getItems().map((item) => item.id));

        setUploadLibraries((previous) => new Map([...previous].filter(([id]) => kept.has(id))));
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

    // What the asset shown shows: its library's own definitions, as its backend's data is its own,
    // or else the media manager's, by the asset; without either, the adapter's own groups.
    const viewedEntry = viewed?.entry;
    const viewedDefinitions = useMemo(
        () => (viewedEntry && section ? (section.properties ?? properties?.(viewedEntry, section)) : undefined),
        [viewedEntry, section, properties],
    );

    // Why the asset shown can't be chosen now, which its view shows, with Select held.
    const viewedHold = useMemo(
        () =>
            viewedEntry && section
                ? (holdOf(viewedEntry, section, { text, formatPercent }) ??
                  (selectedIds.has(viewedEntry.id) ? undefined : refusedNow(viewedEntry, section)))
                : undefined,
        [viewedEntry, section, text, formatPercent, selectedIds, refusedNow],
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
            section &&
            sectionAdapter.process &&
            !section.readOnly &&
            allows("write", state?.permissions, viewedEntry.permissions)
                ? (section.processForm?.(viewedEntry) ?? null)
                : null,
        [viewedEntry, section, sectionAdapter, state?.permissions],
    );

    const shownProcess =
        processStep && processStep.sectionId === sectionId && processStep.entry.id === viewedEntry?.id
            ? processStep
            : null;

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

    const errorMessage =
        state?.status === "error" && state.error instanceof Error && state.error.message
            ? isolate(state.error.message)
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
                    otherLayout={viewed || shownStep ? undefined : otherLayout}
                    onSwitchLayout={switchLayout}
                    onUpload={takesFiles ? () => pickerRef.current?.click() : undefined}
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
                    <Box sx={gridSx} data-covered={!!viewed || !!shownStep}>
                        {section ? (
                            <MediaGrid
                                // Each library's own, as another's `renderAsset`, with hooks of its
                                // own, may draw an asset of the same id.
                                key={section.id}
                                entries={shownEntries}
                                uploads={shownUploads}
                                kind={section.kind}
                                layout={layout}
                                adapter={sectionAdapter}
                                drawAsset={drawAsset}
                                label={section.label}
                                selectedIds={selectedIds}
                                holds={holds}
                                works={works}
                                full={full}
                                multiple={multiple}
                                status={state?.status ?? "loading"}
                                hasMedia={library.length > 0}
                                busy={state?.status === "loading" || !!state?.checking}
                                error={errorMessage}
                                onRetry={reloadLibrary}
                                onPress={press}
                                onActivate={activate}
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
                            choosing={choosing}
                            selected={selectedIds.has(viewed.entry.id)}
                            hold={viewedHold}
                            work={viewedWork}
                            previewers={sectionPreviewers}
                            definitions={viewedDefinitions}
                            propertiesCache={propertiesCache}
                            onBack={closeAsset}
                            onPrevious={viewed.index > 0 ? () => openAsset(viewed.index - 1) : undefined}
                            onNext={
                                viewed.index !== -1 && viewed.index < shownEntries.length - 1
                                    ? () => openAsset(viewed.index + 1)
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
                            covered={!!shownProcess}
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
                    {shownStep && section && (
                        <MediaUpload
                            key={shownStep.key}
                            section={section}
                            adapter={sectionAdapter}
                            check={shownStep.check}
                            form={shownStep.form}
                            onCancel={closeUploadStep}
                            onUpload={(values) => {
                                sendUpload(section, shownStep.check.files, values);
                                closeUploadStep();
                            }}
                        />
                    )}
                    {dropping && dropsFiles && section && (
                        <Box sx={dropZoneSx}>
                            <Typography sx={dropLabelSx}>{text.mediaDropToUpload(isolate(section.label))}</Typography>
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
