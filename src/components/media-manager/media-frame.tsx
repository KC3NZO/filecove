import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, DragEvent } from "react";

import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";

import { useData, useFolder } from "../../hooks/use-folder";
import { useLocale } from "../../hooks/use-locale";
import { useUploadQueue } from "../../hooks/use-upload-queue";
import { CHOICES_WIDTH, mediaMedium, mediaWide } from "../../styles/media-layout";
import { focusOutline, selectedBackground } from "../../styles/mixins";
import { isolate } from "../../utils/bidi";
import { focusLost } from "../../utils/dom";
import { NO_ERRORS, choiceMessages, countFieldErrors } from "../../utils/field-errors";
import { carriesFiles, filesIn, mayAccept, takesUploads, uploadPatterns } from "../../utils/files";
import { isHidden } from "../../utils/hidden";
import { asksAnything, checkMediaUpload, uploadFieldsFor } from "../../utils/media";
import { allows } from "../../utils/permissions";
import { holdsTerms, searchTerms } from "../../utils/search";
import { NO_MODIFIERS, nextSelection } from "../../utils/selection";
import Icon from "../icons/icon";
import UploadPanel from "../uploads/upload-panel";
import ChoiceFields from "./choice-fields";
import { choiceKey } from "./choice-list";
import ChoicesPane from "./choices-pane";
import ChooseBar from "./choose-bar";
import LibraryList from "./library-list";
import MediaAsset from "./media-asset";
import MediaGrid from "./media-grid";
import MediaHeader from "./media-header";
import MediaUpload from "./media-upload";

import type { PropertiesCache } from "../../store/properties-cache";
import type {
    DroppedFiles,
    EntrySelection,
    FileAdapter,
    FileEntry,
    FilePreviewer,
    FileUploadItem,
    FieldErrors,
    MediaChoice,
    MediaSection,
    MediaSectionGroup,
    MediaUploadCheck,
    PropertyDefinitionGroup,
    PropertyErrorKeyParams,
} from "../../types";

interface MediaFrameProps {
    groups: readonly MediaSectionGroup[];
    adapter: FileAdapter;
    multiple: boolean;
    onChoose: ((choices: MediaChoice[]) => void) | undefined;
    fields: ((asset: FileEntry, section: MediaSection) => PropertyDefinitionGroup[]) | undefined;
    /** What an asset shows as it's opened, where its library has no `properties` of its own. */
    properties: ((asset: FileEntry, section: MediaSection) => PropertyDefinitionGroup[]) | undefined;
    /** The media manager's own previewers, asked after a library's. */
    previewers: readonly FilePreviewer[] | undefined;
    /** What's selected as it mounts. */
    defaultValue: readonly MediaChoice[] | undefined;
    /** The app's backend's errors, for the picks and their fields, as the app passed them. */
    errors: FieldErrors;
    /** Where a pick's own errors are in `errors`, about it as a whole. */
    choiceErrorKey: ((params: PropertyErrorKeyParams) => string | readonly string[]) | undefined;
    propertiesCache: PropertiesCache;
}

/**
 * An asset selected, by the id of the library it was picked in, as it was listed when it was picked,
 * with what the app's fields hold for this use of it.
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

/** Files given to a library, as checked before they're sent, and what it asks of them. */
interface UploadStep {
    sectionId: string;
    check: MediaUploadCheck;
    groups: readonly PropertyDefinitionGroup[];
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
const NO_GROUPS: PropertyDefinitionGroup[] = [];
const NO_PREVIEWERS: readonly FilePreviewer[] = [];
const NO_ARRIVALS: readonly Arrival[] = [];
const NO_UPLOADS: readonly FileUploadItem[] = [];
const NO_LIBRARIES: ReadonlyMap<number, string> = new Map();

/** How long a file just uploaded is waited for in its library's listing, in ms. */
const ARRIVAL_WAIT = 10_000;
// Stands in for a library while there's none, so the listing's hook has one to not list.
const NO_SECTION: MediaSection = { id: "", label: "", rootId: "", kind: "image" };

// The newest first, as media libraries show them, then by name.
const byDate = (compareNames: (a: string, b: string) => number) => (a: FileEntry, b: FileEntry) =>
    (b.modifiedAt?.getTime() ?? 0) - (a.modifiedAt?.getTime() ?? 0) || compareNames(a.name, b.name);

const pickOf = ({ asset, section, values }: MediaChoice): Pick => ({ sectionId: section.id, asset, values });

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
    onChoose,
    fields,
    properties,
    previewers = NO_PREVIEWERS,
    defaultValue,
    errors,
    choiceErrorKey,
    propertiesCache,
}: MediaFrameProps) => {
    const { text, foldLetters, compareNames } = useLocale();
    const sections = useMemo(() => groups.flatMap((group) => group.sections), [groups]);
    const sectionsById = useMemo(() => new Map(sections.map((item) => [item.id, item])), [sections]);
    const [openId, setOpenId] = useState<string>();
    const section = sections.find(({ id }) => id === openId) ?? sections[0];
    const sectionAdapter = section?.adapter ?? adapter;
    const several = sections.length > 1;
    const { state, reload } = useFolder(section ?? NO_SECTION, section?.rootId ?? "", !!section, true);
    const choosing = !!onChoose;

    const [query, setQuery] = useState("");
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
    const [dropping, setDropping] = useState(false);
    const [uploadLibraries, setUploadLibraries] = useState(NO_LIBRARIES);
    const [arrivals, setArrivals] = useState(NO_ARRIVALS);
    const arrivedRef = useRef(new Set<number>());
    const arrivalCount = useRef(0);
    const pickerRef = useRef<HTMLInputElement>(null);
    const uploadButtonRef = useRef<HTMLButtonElement>(null);

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
    const library = useMemo(
        () =>
            (state?.entries ?? NO_ENTRIES)
                .filter((entry) => entry.kind === "file" && !isHidden(entry))
                .sort(byDate(compareNames)),
        [state?.entries, compareNames],
    );

    const terms = useMemo(() => searchTerms(query, foldLetters), [query, foldLetters]);

    const shownEntries = useMemo(
        () =>
            terms.length === 0 ? library : library.filter((entry) => holdsTerms(foldLetters(entry.name), terms)),
        [library, terms, foldLetters],
    );

    const order = useMemo(() => shownEntries.map(({ id }) => id), [shownEntries]);

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

    // What's selected, as it is now: in a library that's gone, it goes; picked in the open library,
    // once that's listed, as it's listed now, and gone when it isn't any more; picked in another,
    // as the open library lists it when it does, through the same adapter, or else as it was picked.
    const choices = useMemo<MediaChoice[]>(() => {
        const listed = state?.status === "ready" ? new Map(library.map((entry) => [entry.id, entry])) : undefined;

        return picks.items.flatMap(({ sectionId: pickedIn, asset, values }) => {
            const from = sectionsById.get(pickedIn);

            if (!from) {
                return [];
            }

            const listedNow = listed && adapterOf(from) === sectionAdapter ? listed.get(asset.id) : undefined;
            const now = listed && pickedIn === sectionId ? listedNow : (listedNow ?? asset);

            return now ? [{ asset: now, section: from, values }] : [];
        });
    }, [picks.items, sectionsById, state?.status, library, sectionId, adapterOf, sectionAdapter]);

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

    // Hands the picks to the app, keeping the order they went in.
    const handOver = useCallback(
        (handed: MediaChoice[]) => {
            setHandedOrder(handed.map(choiceKey));
            onChoose?.(handed);
        },
        [onChoose],
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
    // can be chosen, in their place, and those `ids` adds go at the end, in the order shown.
    const picksWith = useCallback(
        (ids: ReadonlySet<string>, anchor: string | null): Picks => {
            if (sectionId === undefined) {
                return NO_PICKS;
            }

            const kept = choices.filter((choice) => (inOpen(choice) ? ids.has(choice.asset.id) : multiple));
            const added = shownEntries.filter((entry) => ids.has(entry.id) && !selectedIds.has(entry.id));

            return {
                items: [...kept.map(pickOf), ...added.map((asset) => ({ sectionId, asset, values: NO_VALUES }))],
                anchor: anchor === null ? null : { sectionId, id: anchor },
            };
        },
        [sectionId, choices, inOpen, multiple, shownEntries, selectedIds],
    );

    // Several at once, a click adds or takes away the asset, as a media picker does, and Shift adds
    // those from the last one clicked; what's selected in other libraries stays. One at a time, it
    // selects the asset alone, in place of what was selected in any library.
    const press = useCallback(
        (index: number, keys: { toggle: boolean; range: boolean }) => {
            const id = order[index];

            if (id === undefined) {
                return;
            }

            const base: EntrySelection = {
                ids: selectedIds,
                anchor: picks.anchor?.sectionId === sectionId ? picks.anchor.id : null,
            };
            const next = multiple
                ? nextSelection(base, id, { toggle: true, range: keys.range }, order)
                : nextSelection(base, id, NO_MODIFIERS, order);

            setPicks(picksWith(next.ids, next.anchor));
        },
        [order, selectedIds, picks.anchor, sectionId, multiple, picksWith],
    );

    const selectAll = useCallback(() => {
        setPicks(picksWith(new Set([...selectedIds, ...order]), order[0] ?? null));
    }, [picksWith, selectedIds, order]);

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

    // What one of the app's fields holds for one pick, kept with it.
    const setChoiceValue = useCallback(
        (choice: MediaChoice, key: string, value: unknown) => {
            setPicks((previous) => ({
                ...previous,
                items: previous.items.map((item) =>
                    samePick(item, choice) ? { ...item, values: { ...item.values, [key]: value } } : item,
                ),
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
        } else {
            setPicks((previous) => ({
                items: multiple ? [...previous.items, pickOf(choice)] : [pickOf(choice)],
                anchor: { sectionId: section.id, id: viewed.entry.id },
            }));
        }
    }, [viewed, section, selectedIds, removeChoice, multiple]);

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

            const chosen = choices.find((choice) => inOpen(choice) && choice.asset.id === entry.id) ?? {
                asset: entry,
                section,
                values: NO_VALUES,
            };

            handOver(multiple ? [...choices.filter((choice) => choice !== chosen), chosen] : [chosen]);
        },
        [shownEntries, onChoose, handOver, multiple, choices, inOpen, section, openAsset],
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
            setViewing(null);
            setUploadStep(null);

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
        setViewing({ sectionId: choice.section.id, entry: choice.asset });
        setUploadStep(null);
        setChosenOverlay(false);
    }, []);

    const reloadLibrary = useCallback(() => reload(), [reload]);

    // Sends files into a library, each its own upload, kept both with what's there of its name, as a
    // library is listed flat, with what its upload fields held.
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
            const groups = check.files.length > 0 ? uploadFieldsFor(section, check.files) : NO_GROUPS;
            const leftOut = check.refused.length + check.folders.length + check.misnamed.length > 0;

            if (!leftOut && !asksAnything(groups)) {
                sendUpload(section, check.files, section.uploadDefaults);

                return;
            }

            setViewing(null);
            setUploadStep({ sectionId: section.id, check, groups });
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
    // one at a time, the last to arrive in place of it.
    useEffect(() => {
        if (!section || state?.status !== "ready") {
            return;
        }

        const listed = new Map(library.map((entry) => [entry.id, entry]));
        const here = arrivals.filter((waiting) => waiting.sectionId === section.id && listed.has(waiting.entryId));

        if (here.length === 0) {
            return;
        }

        const keys = new Set(here.map((waiting) => waiting.key));
        const assets = here.flatMap((waiting) => listed.get(waiting.entryId) ?? []);
        const last = assets[assets.length - 1];

        setArrivals((previous) => previous.filter((waiting) => !keys.has(waiting.key)));

        if (!onChoose || !last) {
            return;
        }

        setPicks((previous) => {
            if (!multiple) {
                return {
                    items: [{ sectionId: section.id, asset: last, values: NO_VALUES }],
                    anchor: { sectionId: section.id, id: last.id },
                };
            }

            const added = assets.filter(
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
    }, [section, state?.status, library, arrivals, onChoose, multiple, samePick]);

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

    // One pick's details: its own errors, then the app's fields for it, drawn with what it holds,
    // with the errors the app's backend answered, found by its place in the order the app was
    // handed the picks in. One added since has none, as the backend never saw it, and its place now.
    const renderDetails = useMemo(
        () =>
            (fields || choiceErrorKey) &&
            ((choice: MediaChoice, index: number) => {
                const place = errorPlaces.get(choiceKey(choice));
                const answered = place === undefined ? NO_ERRORS : errors;
                const at = place ?? index;

                return (
                    <ChoiceFields
                        groups={fields?.(choice.asset, choice.section) ?? NO_GROUPS}
                        values={choice.values}
                        asset={choice.asset}
                        adapter={adapterOf(choice.section)}
                        errors={answered}
                        index={at}
                        messages={choiceMessages(choiceErrorKey, answered, at, choice.asset)}
                        onChange={(key, value) => setChoiceValue(choice, key, value)}
                    />
                );
            }),
        [fields, choiceErrorKey, errorPlaces, adapterOf, setChoiceValue, errors],
    );

    // How much of a pick there is to fix, for its row in the list: each of its fields with an
    // error, and its own errors as one more.
    const problemsOf = useMemo(
        () =>
            (fields || choiceErrorKey) && errors !== NO_ERRORS
                ? (choice: MediaChoice) => {
                      const place = errorPlaces.get(choiceKey(choice));

                      if (place === undefined) {
                          return 0;
                      }

                      const own = choiceMessages(choiceErrorKey, errors, place, choice.asset).length > 0 ? 1 : 0;
                      const groups = fields?.(choice.asset, choice.section) ?? NO_GROUPS;

                      return own + countFieldErrors(groups, errors, place, choice.asset);
                  }
                : undefined,
        [fields, choiceErrorKey, errors, errorPlaces],
    );

    // A library's own previewers first, as its backend delivers what it holds, then the media
    // manager's.
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
                    query={query}
                    onQueryChange={setQuery}
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
                                entries={shownEntries}
                                uploads={shownUploads}
                                kind={section.kind}
                                adapter={sectionAdapter}
                                label={section.label}
                                selectedIds={selectedIds}
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
                            adapter={sectionAdapter}
                            choosing={choosing}
                            selected={selectedIds.has(viewed.entry.id)}
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
                            onUpdated={reloadLibrary}
                        />
                    )}
                    {shownStep && section && (
                        <MediaUpload
                            section={section}
                            adapter={sectionAdapter}
                            check={shownStep.check}
                            groups={shownStep.groups}
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
                        count={choices.length}
                        chosenOpen={chosenOverlay}
                        showOpener={!chosenEmpty}
                        openerRef={openerRef}
                        onOpenChosen={() => setChosenOverlay(true)}
                        onChoose={() => handOver(choices)}
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
                            onRemove={removeChoice}
                            onMove={moveChoice}
                            onClear={clearSelection}
                            onChoose={() => handOver(choices)}
                            onShowInLibrary={showInLibrary}
                            onClose={closeChosen}
                        />
                    </Box>
                </>
            )}
        </Box>
    );
};

export default MediaFrame;
