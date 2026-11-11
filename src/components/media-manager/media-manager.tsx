import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";

import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { useForkRef } from "@mui/material/utils";

import { DataContext } from "../../contexts/data-context";
import { DirectionContext } from "../../contexts/direction-context";
import { LocaleContext } from "../../contexts/locale-context";
import { useLocaleValue } from "../../hooks/use-locale";
import { useTextDirection } from "../../hooks/use-text-direction";
import { createFolderStore } from "../../store/folder-store";
import { createPropertiesCache } from "../../store/properties-cache";
import { createThumbnailCache } from "../../store/thumbnail-cache";
import { MEDIA_CONTAINER } from "../../styles/media-layout";
import { withSx } from "../../styles/sx";
import { NO_ERRORS } from "../../utils/field-errors";
import { countLimit, delayLimit } from "../../utils/limits";
import MediaFrame from "./media-frame";
import type { MediaFrameProps } from "./media-frame";

import type {
    FieldErrors,
    FileAdapter,
    FileEntry,
    FilePreviewer,
    MediaAssetParams,
    MediaChoice,
    MediaLayouts,
    MediaLocation,
    MediaLocationChangeReason,
    MediaManagerApi,
    MediaManagerLimits,
    MediaManagerLocaleText,
    MediaPickForm,
    MediaSearch,
    MediaSection,
    MediaSectionGroup,
    MediaViewed,
    PropertyDefinitionGroup,
    PropertyErrorKeyParams,
} from "../../types";

// The root element's own attributes, which go on it as they do on a MUI component's root.
type RootAttributes = Omit<ComponentPropsWithoutRef<"div">, "children" | "defaultValue" | "onChange">;

interface BaseProps<V> extends RootAttributes {
    /** Serves the libraries that don't bring their own adapter. */
    adapter: FileAdapter;
    /**
     * Whether several assets can be selected and chosen at once, from any of the libraries, such as
     * pictures and videos for a product's carousel: what's selected stays as another library is
     * shown, listed in the selected column, in an order set there. One at a time when omitted.
     */
    multiple?: boolean;
    /**
     * How many assets can be selected at once with `multiple`, across the libraries. The selected
     * column says how many of them are, and once they all are, nothing more is added until one is
     * taken out: a Shift range or Select all adds what fits, and an upload is selected while there's
     * room. More than this given with `defaultValue`, or left by lowering it, stay selected, those
     * past it holding Choose back until they're taken out. The app's backend still has the last word
     * when it saves the picks. No limit when omitted.
     */
    maxChoices?: number;
    /**
     * Whether an asset can be added, for this use of the media manager, beside what's picked already,
     * such as one video at most for a product's carousel: `true`, or `false`, or why not, in the app's
     * language, which its tile shows in place of its size. `choices` are those before it, without it,
     * in the order set, and none one at a time, as it would replace them. Asked for every asset shown
     * as the picks change, so keep it quick, and outside the component or memoized. A pick that breaks
     * it, as given with `defaultValue`, is told apart by the ones before it: its row says why, and it
     * holds Choose back until it's taken out. A library's own `selectable` is for what depends on the
     * backend, such as an expired licence, and an asset has to pass both.
     *
     * `trail` is the groups it's in, from its library's root, and each of `choices` has its own, so what's
     * inside a group picked, or a group with a pick inside it, can be refused, what that means being the
     * app's: nothing is refused for it otherwise. `trail` is unset for a pick given without one, whose
     * place isn't known. Ids are only unique within an adapter, so compare them within a library's.
     */
    canSelect?: (
        asset: FileEntry,
        section: MediaSection,
        choices: readonly MediaChoice<V>[],
        trail: readonly FileEntry[] | undefined,
    ) => boolean | string;
    /**
     * Whether groups can be selected and chosen as well as assets, such as a whole album or season,
     * while the app takes a pick. A click on a group still goes in, so one that can be has a check of
     * its own, and Space does the same. `canSelect` and a library's `selectable` decide per group, a
     * plain `false` only leaving its check off, and a pick's form is handed the group as its `asset`.
     * What's chosen hands it back as listed, for the backend to expand: nothing walks down to collect
     * what's inside it, and a group picked with something inside it are the backend's to settle. Off
     * when omitted.
     */
    selectGroups?: boolean;
    /**
     * The app's own actions in the header, for what the component leaves to it, such as reordering a group
     * or moving several at once through its API. Those with an icon show as buttons, two at most and from
     * the width the list of libraries docks at, and the rest in a "More actions" menu. Each is told the
     * library, the group open, the asset shown, what's selected and whether it can be changed, and given
     * `refresh()` to list again what it changed. `visible` and `disabled` are asked as any of those change,
     * so keep them quick. None show while a step such as an upload's form is in the library's place.
     */
    actions?: readonly MediaActionGroup<V>[];
    /**
     * Takes what's chosen, with the Choose button, a double click or Enter on an asset: each as it
     * was listed, `meta` and all, with the library it's from, whose `kind` says what it is, and what
     * the app's form holds for it (`values`), in the order set in the selected column. Pass only
     * the libraries of the kinds the app takes. Without it there's no selected column, and the media
     * manager is a library to look through.
     */
    onChoose?: (choices: MediaChoice<V>[]) => void;
    /**
     * The app's own form for each pick, for this use of the asset, by the asset and its library: an
     * alt text and a caption for a picture in a carousel, "Play on its own" for a video, a field per
     * language when the app has several, or `null` for none. It's the use's, not the backend's, so
     * the same library picked from elsewhere may ask for something else. It's drawn in the selected
     * column as a pick's details are opened, with what the media manager keeps with the pick, as it's
     * moved and as other libraries are shown, and hands back with `onChoose` (`values`): its `defaults`
     * from the moment it's picked. Its `ready` holds Choose back, and its `errorKeys` count on the pick's
     * row what there is to fix. A library's own `pickForm`, for what comes with its backend, is used in
     * place of it. Without either, picks have no details. Keep it outside the component, or memoized.
     */
    pickForm?: (asset: FileEntry, section: MediaSection) => MediaPickForm<V> | null;
    /**
     * What an asset or a group shows as it's opened, by the entry and its library (a group is an entry
     * of `kind: "folder"`), for the libraries without `properties` of their own: the app's definitions of the values the adapter's `properties`
     * hands over (`values`), each shown as its type, its kind and its functions say, editable where
     * it's marked so and the library isn't `readOnly`. Without either, the adapter's own groups
     * show. The media manager adds nothing of its own.
     */
    properties?: (asset: FileEntry, section: MediaSection) => PropertyDefinitionGroup[];
    /**
     * Shows assets of any library as one is opened, asked after the library's own `previewers`, in
     * order: a player, a document viewer, the app's own way of showing a kind. The asset's
     * thumbnail when none accepts it, as the media manager plays and renders nothing itself.
     */
    previewers?: FilePreviewer[];
    /**
     * Draws the assets of the libraries without a `renderAsset` of their own, in place of the media
     * manager's look: `MediaTile` or `MediaRow` with what to change, or anything else. See
     * `MediaSection.renderAsset`. Keep it outside the component, or memoized.
     */
    renderAsset?: (params: MediaAssetParams) => ReactNode;
    /**
     * Draws the groups of the libraries without a `renderGroup` of their own, in place of the media
     * manager's look. See `MediaSection.renderGroup`. Keep it outside the component, or memoized.
     */
    renderGroup?: (params: MediaAssetParams) => ReactNode;
    /**
     * Draws what's above a group's contents while it's open, for the libraries without a `groupHeader`
     * of their own. See `MediaSection.groupHeader`.
     */
    groupHeader?: (group: FileEntry, section: MediaSection) => ReactNode;
    /**
     * The layout each library is shown in, of those it offers (`MediaSection.layouts`), by its `id`, for
     * an app keeping what the user switched to across visits. Change it in `onLayoutChange`; leave it
     * out for the media manager to keep it, starting from `defaultLayout`.
     */
    layout?: MediaLayouts;
    /** Where the libraries' layouts start, while `layout` isn't passed. */
    defaultLayout?: MediaLayouts;
    /** Told every library's layout, as the user switches one. */
    onLayoutChange?: (layout: MediaLayouts) => void;
    /**
     * Where the media manager is, for an app keeping it, e.g. in the URL: the library shown and the groups
     * gone into in it. Every change, the user's and the media manager's own, is asked for through
     * `onLocationChange`, and shows once it's passed back. Null shows the first library's root. A location
     * in a library that isn't there shows the first library's root, which is asked for as "replace", and so
     * is a library's root in place of groups in one rooted elsewhere or served by another adapter since.
     * Each other library's level is remembered while mounted, so opening it again goes back there. Changed
     * by the app, what's over the library (an asset shown, a step, the search) goes, as when the user goes
     * to a level, unless the app changed that too, and screen readers hear where it is.
     */
    location?: MediaLocation | null;
    /** Where it starts, while `location` isn't passed: the first library's root when omitted. */
    defaultLocation?: MediaLocation;
    /**
     * Told the location as it changes, and why: the user, or `apiRef`, going there ("navigate"), or
     * what was there changing under it ("replace"), such as a group on the way deleted or renamed.
     */
    onLocationChange?: (location: MediaLocation, reason: MediaLocationChangeReason) => void;
    /**
     * The asset, or the group's details, shown in a library's place, for an app keeping it, e.g. in the
     * URL; null for the library itself. Shown while its library is the one shown. Every change is asked
     * for through `onViewedChange`: opening one, Previous and Next, going back, and anything closing it,
     * such as going to another level or library.
     */
    viewed?: MediaViewed | null;
    /** What's shown in the library's place as it mounts, while `viewed` isn't passed. */
    defaultViewed?: MediaViewed;
    /** Told what's shown in the library's place as it changes, with the groups it's in, or null. */
    onViewedChange?: (viewed: MediaViewed | null) => void;
    /**
     * The search, for an app keeping it, null while it's closed. Every change is asked for through
     * `onSearchChange`: opening it, each key typed, and closing it, which going to another level or
     * library does too. It's focused as it opens once it's passed back.
     */
    search?: MediaSearch | null;
    /** The search as it mounts, while `search` isn't passed: closed when omitted. */
    defaultSearch?: MediaSearch;
    /** Told the search as it opens, as what's typed changes, and as it closes, with null. */
    onSearchChange?: (search: MediaSearch | null) => void;
    /**
     * How old, in ms, a library's or a group's listing may be before showing it lists it again. Listings
     * are kept, so one shown again shows at once, and is listed again in the background meanwhile, so what
     * changed elsewhere shows without a refresh. 0, the default, lists it again every time; `Infinity`
     * never does, for a backend where listing costs, leaving changes made elsewhere to `apiRef.refresh`.
     * Changes made through the media manager show either way.
     */
    relistAfter?: number;
    /**
     * How much the media manager does at once and keeps, for a backend that takes more, or less, than the
     * defaults: uploads, moves and thumbnails at once, thumbnails and listings kept while nothing shows
     * them, and how long the typing stops before the adapter's `search` is asked. Each is left to its
     * default when omitted, and a change takes effect at once: more at once starts what's waiting, less
     * lets what's under way finish, and fewer kept drops what's beyond them.
     */
    limits?: MediaManagerLimits;
    /**
     * Takes the `MediaManagerApi`, for going to a library or a group, showing an asset, searching,
     * selecting, choosing, uploading, listing again or moving the focus in, from outside.
     */
    apiRef?: Ref<MediaManagerApi<V>>;
    /**
     * What's selected, when the app keeps it, with `onChange`: every change is then only asked for, and
     * shows once it's passed back. Each is matched to its library by `section.id`. Pass back what
     * `onChange` handed over where you can: a choice made or copied by the app takes its `values` as
     * changed, so they stop following the form's `defaults`, as those of `defaultValue` do.
     */
    value?: readonly MediaChoice<V>[];
    /**
     * What's selected as it mounts, with what the app's form held for each, such as a product's
     * carousel being edited, in its order. Each is matched to its library by `section.id`.
     */
    defaultValue?: readonly MediaChoice<V>[];
    /**
     * Told everything selected as it changes, in the order set, each with what its form holds, so at
     * every key typed in a form: keep it quick. A pick found to be gone, its library or its listing no
     * longer having it, is told too; a new listing of an asset alone isn't. Any of `value`,
     * `defaultValue`, `onChange` and `onChoose` has the media manager take picks, with the selected column;
     * without `onChoose` there's no Choose, for picks that are part of a form of the app's, saved by
     * its own button, and a double click or Enter opens the asset.
     */
    onChange?: (choices: MediaChoice<V>[]) => void;
    /**
     * What the app's backend answered when the picks were saved, as it came, by its own keys, a
     * message or several each, as Laravel's validation errors are:
     * `{ "media.0.translations.en.title": ["The title field is required."] }`. Pass it all: only
     * the keys the app names are read, and the rest, the form's other fields' and the list's own
     * (`media`), are left for the app to show. Each field `MediaFields` draws finds its own by its
     * `errorKey`, made from the pick's place (``({ index }) => `media.${index}.loop` ``), shown
     * under it, a form of the app's reads them itself (`MediaPickFormParams.errors`), and each pick
     * finds its own by `choiceErrorKey`, with the pick's row in the selected column saying how many
     * there are to fix (`MediaPickForm.errorKeys`). The keys go by the order the app was handed the
     * picks in, at Choose (or, before any, the order as the errors came), so each pick keeps its own
     * as it's moved; one taken out takes them with it, and one added since has none. Pass the same
     * object for as long as they're the same.
     */
    errors?: FieldErrors;
    /**
     * Where a pick's own errors are in `errors`, about it as a whole rather than one of its fields,
     * such as "This video is still processing.": the backend's key for it, or its keys, made from
     * its place, ``({ index }) => [`media.${index}`, `media.${index}.id`]``. Its messages show at
     * the top of its details, above its form, and its row counts them as one more to fix.
     */
    choiceErrorKey?: (params: PropertyErrorKeyParams) => string | readonly string[];
    /**
     * The component's own text, for another language or other wording. Keys left out stay in
     * English, as `enUS` has them. Functions written inline are new each render and make every
     * tile render again, so keep those outside the component or memoize the object.
     */
    localeText?: Partial<MediaManagerLocaleText>;
    /**
     * The BCP 47 language tag, such as "de" or "fa-IR", that numbers, sizes and dates are written
     * in and names are matched by. The browser's language when omitted.
     */
    locale?: string;
    /** The root element, which fills the box it's placed in. */
    ref?: Ref<HTMLDivElement>;
    /**
     * Styles the root element, over its own, e.g. to size it. It fills its container by default,
     * and lays itself out by its own width (container queries), not the viewport's.
     */
    sx?: SxProps<Theme>;
}

interface MultiSectionProps<V> extends BaseProps<V> {
    /**
     * The libraries, in groups. Each holds one kind of asset, and is an independent root. What it
     * lists as entries of `kind: "folder"` are groups of it (collections, albums, seasons, to any
     * depth), which are gone into a level at a time, each listed through `list`.
     */
    sections: MediaSectionGroup[];
    section?: never;
}

interface SingleSectionProps<V> extends BaseProps<V> {
    /** The one library to show, with no list of libraries beside it. */
    section: MediaSection;
    sections?: never;
}

/**
 * Either `sections`, for several libraries to switch between, or a single `section`. Both may
 * change after mounting: the library shown goes back to the first when its section goes (asked for
 * through `onLocationChange` as "replace"), and what was picked in a library that's gone goes with it. `V` is the shape of what the app's form holds
 * for each pick (`pickForm`).
 */
export type MediaManagerProps<V = Record<string, unknown>> = MultiSectionProps<V> | SingleSectionProps<V>;

const NO_GROUPS: MediaSectionGroup[] = [];

// The root only establishes the container; a container can't match its own queries, so the
// visible frame is the child below it. The consumer's `sx` goes over it.
const rootSx = {
    containerType: "inline-size",
    containerName: MEDIA_CONTAINER,
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
} satisfies SxProps<Theme>;

/**
 * Libraries of media to look through and choose from, each holding one kind of asset: pictures as
 * square tiles, videos as wide ones, audio as rows, documents as pages, searched by name, each
 * opened in the library's place, shown by the app's previewers, with the properties its adapter
 * hands over. While the app takes a choice, what's selected is listed in a column beside them, put
 * in order there, each with the app's own form for this use of it. Files are uploaded into a
 * library taking them by its Upload button, a drop or a paste, asked first what its `uploadForm`
 * asks, and selected as they arrive while the app takes a choice. Built from the parts it shares
 * with `FileManager` (the adapter, the listing store, thumbnails, the properties panel, the upload
 * queue and panel), not from the file manager itself.
 */
const MediaManager = <V,>({
    adapter,
    sections: groupsProp,
    section: singleSection,
    multiple = false,
    maxChoices,
    canSelect,
    selectGroups = false,
    actions,
    onChoose,
    pickForm,
    properties,
    previewers,
    renderAsset,
    renderGroup,
    groupHeader,
    layout,
    defaultLayout,
    onLayoutChange,
    location,
    defaultLocation,
    onLocationChange,
    viewed,
    defaultViewed,
    onViewedChange,
    search,
    defaultSearch,
    onSearchChange,
    relistAfter = 0,
    limits,
    apiRef,
    value,
    defaultValue,
    onChange,
    errors = NO_ERRORS,
    choiceErrorKey,
    localeText,
    locale,
    ref,
    sx,
    ...rootAttributes
}: MediaManagerProps<V>) => {
    const localeValue = useLocaleValue(localeText, locale);
    const [store] = useState(createFolderStore);
    const [thumbnails] = useState(createThumbnailCache);
    const [propertiesCache] = useState(createPropertiesCache);
    // A library is listed again in the background as it's shown, as the file manager's folders are, once
    // its listing is `relistAfter` old.
    const data = useMemo(
        () => ({ store, adapter, thumbnails, relistAfter }),
        [store, adapter, thumbnails, relistAfter],
    );
    // The app's limits, each a number, so a new object of the same limits every render changes nothing.
    const thumbnailLimit = countLimit(limits?.thumbnails, 1);
    const keptThumbnails = countLimit(limits?.keptThumbnails, 0);
    const keptEntries = countLimit(limits?.keptEntries, 0);
    const rootRef = useRef<HTMLDivElement>(null);
    const handleRootRef = useForkRef(rootRef, ref);
    const direction = useTextDirection(rootRef);
    const rootStyle = useMemo(() => withSx(rootSx, sx), [sx]);

    // Set before the parts' own effects ask for anything as they mount.
    useLayoutEffect(() => store.setMaxKept(keptEntries), [store, keptEntries]);
    useLayoutEffect(
        () => thumbnails.setLimits(thumbnailLimit, keptThumbnails),
        [thumbnails, thumbnailLimit, keptThumbnails],
    );
    useEffect(() => () => store.abortAll(), [store]);
    useEffect(() => () => thumbnails.clear(), [thumbnails]);

    const groups = useMemo(
        () => (singleSection ? [{ id: singleSection.id, sections: [singleSection] }] : (groupsProp ?? NO_GROUPS)),
        [singleSection, groupsProp],
    );

    return (
        <LocaleContext value={localeValue}>
            <DirectionContext value={direction}>
                <DataContext value={data}>
                    <Box {...rootAttributes} ref={handleRootRef} sx={rootStyle}>
                        <MediaFrame
                            groups={groups}
                            adapter={adapter}
                            multiple={multiple}
                            maxChoices={maxChoices}
                            canSelect={canSelect as MediaFrameProps["canSelect"]}
                            selectGroups={selectGroups}
                            actions={actions as MediaFrameProps["actions"]}
                            // The frame keeps the app's values by their keys, not knowing their shape.
                            onChoose={onChoose as ((choices: MediaChoice[]) => void) | undefined}
                            pickForm={pickForm as MediaFrameProps["pickForm"]}
                            properties={properties}
                            previewers={previewers}
                            renderAsset={renderAsset}
                            renderGroup={renderGroup}
                            groupHeader={groupHeader}
                            layout={layout}
                            defaultLayout={defaultLayout}
                            onLayoutChange={onLayoutChange}
                            location={location}
                            defaultLocation={defaultLocation}
                            onLocationChange={onLocationChange}
                            viewed={viewed}
                            defaultViewed={defaultViewed}
                            onViewedChange={onViewedChange}
                            search={search}
                            defaultSearch={defaultSearch}
                            onSearchChange={onSearchChange}
                            uploadLimit={countLimit(limits?.uploads, 1)}
                            transferLimit={countLimit(limits?.transfers, 1)}
                            searchDelay={delayLimit(limits?.searchDelay)}
                            apiRef={apiRef as MediaFrameProps["apiRef"]}
                            value={value as readonly MediaChoice[] | undefined}
                            defaultValue={defaultValue as readonly MediaChoice[] | undefined}
                            onChange={onChange as ((choices: MediaChoice[]) => void) | undefined}
                            errors={errors}
                            choiceErrorKey={choiceErrorKey}
                            propertiesCache={propertiesCache}
                        />
                    </Box>
                </DataContext>
            </DirectionContext>
        </LocaleContext>
    );
};

export default MediaManager;
