import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentPropsWithoutRef, Ref } from "react";

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
import MediaFrame from "./media-frame";

import type {
    FieldErrors,
    FileAdapter,
    FileEntry,
    FilePreviewer,
    MediaChoice,
    MediaManagerLocaleText,
    MediaSection,
    MediaSectionGroup,
    PropertyDefinitionGroup,
    PropertyErrorKeyParams,
} from "../../types";

// The root element's own attributes, which go on it as they do on a MUI component's root.
type RootAttributes = Omit<ComponentPropsWithoutRef<"div">, "children">;

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
     * Takes what's chosen, with the Choose button, a double click or Enter on an asset: each as it
     * was listed, `meta` and all, with the library it's from, whose `kind` says what it is, and what
     * the app's fields hold for it (`values`), in the order set in the selected column. Pass only
     * the libraries of the kinds the app takes. Without it there's no selected column, and the media
     * manager is a library to look through.
     */
    onChoose?: (choices: MediaChoice<V>[]) => void;
    /**
     * The app's own fields for each pick, for this use of the asset, by the asset and its library:
     * an alt text and a caption for a picture in a carousel, "Play on its own" for a video, a field
     * per language when the app has several, or none. They're the use's, not the backend's, so the
     * same library picked from elsewhere may ask for others. Each is a property's definition, as
     * `properties` are, editable unless it says otherwise. The media manager draws them in the
     * selected column as a pick's details are opened, keeps what's filled in with the pick by each
     * one's `field`, as it's moved and as other libraries are shown, and hands it back with
     * `onChoose` (`values`). Without it, picks have no details.
     */
    fields?: (asset: FileEntry, section: MediaSection) => PropertyDefinitionGroup[];
    /**
     * What an asset shows as it's opened, by the asset and its library, for the libraries without
     * `properties` of their own: the app's definitions of the values the adapter's `properties`
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
     * What's selected as it mounts, with what the app's fields held for each, such as a product's
     * carousel being edited, in its order. Each is matched to its library by `section.id`.
     */
    defaultValue?: readonly MediaChoice<V>[];
    /**
     * What the app's backend answered when the picks were saved, as it came, by its own keys, a
     * message or several each, as Laravel's validation errors are:
     * `{ "media.0.translations.en.title": ["The title field is required."] }`. Pass it all: only
     * the keys the app names are read, and the rest, the form's other fields' and the list's own
     * (`media`), are left for the app to show. Each of the app's fields finds its own by its
     * `errorKey`, made from the pick's place (``({ index }) => `media.${index}.loop` ``), shown
     * under it, and each pick its own by `choiceErrorKey`, with the pick's row in the selected
     * column saying how many there are to fix. The keys go by the order the app was handed the
     * picks in, at Choose (or, before any, the order as the errors came), so each pick keeps its own
     * as it's moved; one taken out takes them with it, and one added since has none. Pass the same
     * object for as long as they're the same.
     */
    errors?: FieldErrors;
    /**
     * Where a pick's own errors are in `errors`, about it as a whole rather than one of its fields,
     * such as "This video is still processing.": the backend's key for it, or its keys, made from
     * its place, ``({ index }) => [`media.${index}`, `media.${index}.id`]``. Its messages show at
     * the top of its details, above its fields, and its row counts them as one more to fix.
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
     * The libraries, in groups. Each holds one kind of asset, and is an independent root, listed
     * flat, folders left out.
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
 * change after mounting: the library shown goes back to the first when its section goes, and what
 * was picked in a library that's gone goes with it. `V` is the shape of what the app's fields hold
 * for each pick (`fields`), by their keys.
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
 * in order there, each with the app's own fields for this use of it. Files are uploaded into a
 * library taking them by its Upload button, a drop or a paste, asked first what its `uploadFields`
 * ask, and selected as they arrive while the app takes a choice. Built from the parts it shares
 * with `FileManager` (the adapter, the listing store, thumbnails, the properties panel, the upload
 * queue and panel), not from the file manager itself.
 */
const MediaManager = <V,>({
    adapter,
    sections: groupsProp,
    section: singleSection,
    multiple = false,
    onChoose,
    fields,
    properties,
    previewers,
    defaultValue,
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
    // Every library is listed again in the background as it's shown, as the file manager's folders are.
    const data = useMemo(() => ({ store, adapter, thumbnails, relistAfter: 0 }), [store, adapter, thumbnails]);
    const rootRef = useRef<HTMLDivElement>(null);
    const handleRootRef = useForkRef(rootRef, ref);
    const direction = useTextDirection(rootRef);
    const rootStyle = useMemo(() => withSx(rootSx, sx), [sx]);

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
                            // The frame keeps the app's values by their keys, not knowing their shape.
                            onChoose={onChoose as ((choices: MediaChoice[]) => void) | undefined}
                            fields={fields}
                            properties={properties}
                            previewers={previewers}
                            defaultValue={defaultValue as readonly MediaChoice[] | undefined}
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
