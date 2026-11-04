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
import { createThumbnailCache } from "../../store/thumbnail-cache";
import { MEDIA_CONTAINER } from "../../styles/media-layout";
import { withSx } from "../../styles/sx";
import PickerFrame from "./picker-frame";
import type { PickerFrameProps } from "./picker-frame";

import type {
    FileAdapter,
    FileEntry,
    MediaChoice,
    MediaManagerLocaleText,
    MediaPickerValue,
    MediaPickForm,
    MediaSection,
} from "../../types";

// The root element's own attributes, which go on it as they do on a MUI component's root.
type RootAttributes = Omit<ComponentPropsWithoutRef<"div">, "children" | "defaultValue" | "onChange">;

export interface MediaPickerProps<V = Record<string, unknown>> extends RootAttributes {
    /** Serves the library, unless it brings its own adapter. */
    adapter: FileAdapter;
    /**
     * The one library to pick from, the same object a `MediaManager` takes. Its `layouts`,
     * `renderAsset`, `renderGroup`, `groupHeader`, `selectable`, `acceptUploads` and `uploadForm` count
     * here too; what's for managing it, such as `createGroups`, `groupForm` and `processForm`, has no
     * place here and is left unread. Changing it, or its adapter, starts the picker afresh.
     */
    section: MediaSection;
    /**
     * Takes what's chosen, with the Choose button, a double click or Enter on an asset: each its `asset`
     * as it was listed, `meta` and all, and what `pickForm` holds for it (`values`), in the order set:
     * one, unless `multiple`. What's stored of it is the app's. Without it there's no Choose, for an app
     * taking what's selected as it changes (`onChange`), and a double click or Enter only selects.
     */
    onChoose?: (choices: MediaChoice<V>[]) => void;
    /**
     * What's asked of each pick for this use of it, such as a caption, or `null` for nothing, by the
     * form's shape the media manager's `pickForm` has. Passing it adds the selected column beside the
     * library, or over it where there's no room: what's selected, put in order with `multiple`, and each
     * one's form. Its `defaults` count from the moment it's picked and its `ready` holds Choose back;
     * the backend's `errors` have no place here, as what's picked is saved by the app's form around the
     * picker. Without it there's no column. Keep it outside the component, or memoized.
     */
    pickForm?: (asset: FileEntry, section: MediaSection) => MediaPickForm<V> | null;
    /** Puts a Cancel button beside Choose, for a picker in the app's own dialog. */
    onCancel?: () => void;
    /** Whether several can be chosen at once, in the order they were selected. One at a time when omitted. */
    multiple?: boolean;
    /** How many can be selected at once with `multiple`. No limit when omitted. */
    maxChoices?: number;
    /**
     * Whether files can be uploaded here, for when what's wanted isn't there yet, by an Upload button,
     * a drop or a paste, into the level open: off by default, as nothing else in a picker changes the
     * backend. It still needs the adapter's `upload` and a library taking them (`acceptUploads`, not
     * `readOnly`). The library's `uploadForm` is asked first, and each file is selected as it arrives,
     * holding Choose back while it's being processed. An upload under way is cancelled as the picker
     * goes.
     */
    allowUpload?: boolean;
    /** What's selected, when the app keeps it, with `onChange`: every change is then only asked for. */
    value?: readonly MediaPickerValue<V>[];
    /** What's selected as it mounts, such as what the field it's picking for holds now. */
    defaultValue?: readonly MediaPickerValue<V>[];
    /**
     * Told everything selected as it changes, in the order set, each with what its form holds, so at
     * every key typed in one. One found to be gone, no longer listed where it was picked, is told too; a
     * new listing of an asset alone isn't.
     */
    onChange?: (choices: MediaChoice<V>[]) => void;
    /** The component's own text, the media manager's. Keys left out stay in English, as `enUS` has them. */
    localeText?: Partial<MediaManagerLocaleText>;
    /** The BCP 47 language tag that numbers, sizes and dates are written in and names are matched by. */
    locale?: string;
    /** The root element, which fills the box it's placed in. */
    ref?: Ref<HTMLDivElement>;
    /** Styles the root element, over its own, e.g. to size it. It fills its container by default. */
    sx?: SxProps<Theme>;
}

// The root only establishes the container, as the media manager's does. The consumer's `sx` goes over it.
const rootSx = {
    containerType: "inline-size",
    containerName: MEDIA_CONTAINER,
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
} satisfies SxProps<Theme>;

// A number for each adapter, so changing it can start the frame afresh by its `key`.
const adapterNumbers = new WeakMap<FileAdapter, number>();
let adaptersNumbered = 0;

const numberOf = (adapter: FileAdapter) => {
    const known = adapterNumbers.get(adapter);

    if (known !== undefined) {
        return known;
    }

    adaptersNumbered += 1;
    adapterNumbers.set(adapter, adaptersNumbered);

    return adaptersNumbered;
};

/**
 * One library to find an asset in and choose it, for a field that points at an asset of another
 * library, such as a series' teaser or a video's poster: its assets and groups, a search by name, and,
 * when the app allows it, uploading what isn't there yet. It's a sibling of `MediaManager` built from
 * the same parts, with nothing for managing a library: no list of libraries, no asset view, and nothing
 * to delete, move or make a group with, so none of that needs turning off. With `pickForm`, what's
 * selected is listed beside the library, each with the app's form for this use of it. It has no dialog
 * of its own, as a picker's place is the app's.
 */
const MediaPicker = <V,>({
    adapter,
    section,
    onChoose,
    pickForm,
    onCancel,
    multiple = false,
    maxChoices,
    allowUpload = false,
    value,
    defaultValue,
    onChange,
    localeText,
    locale,
    ref,
    sx,
    ...rootAttributes
}: MediaPickerProps<V>) => {
    const localeValue = useLocaleValue(localeText, locale);
    const [store] = useState(createFolderStore);
    const [thumbnails] = useState(createThumbnailCache);
    // Listed again in the background as a level is shown, as the media manager's are.
    const data = useMemo(() => ({ store, adapter, thumbnails, relistAfter: 0 }), [store, adapter, thumbnails]);
    const rootRef = useRef<HTMLDivElement>(null);
    const handleRootRef = useForkRef(rootRef, ref);
    const direction = useTextDirection(rootRef);
    const rootStyle = useMemo(() => withSx(rootSx, sx), [sx]);

    useEffect(() => () => store.abortAll(), [store]);
    useEffect(() => () => thumbnails.clear(), [thumbnails]);

    return (
        <LocaleContext value={localeValue}>
            <DirectionContext value={direction}>
                <DataContext value={data}>
                    <Box {...rootAttributes} ref={handleRootRef} sx={rootStyle}>
                        <PickerFrame
                            key={`${numberOf(section.adapter ?? adapter)}/${section.id}/${section.rootId}`}
                            section={section}
                            adapter={section.adapter ?? adapter}
                            onChoose={onChoose as PickerFrameProps["onChoose"]}
                            pickForm={pickForm as PickerFrameProps["pickForm"]}
                            onCancel={onCancel}
                            multiple={multiple}
                            maxChoices={maxChoices}
                            allowUpload={allowUpload}
                            value={value as PickerFrameProps["value"]}
                            defaultValue={defaultValue as PickerFrameProps["defaultValue"]}
                            onChange={onChange as PickerFrameProps["onChange"]}
                        />
                    </Box>
                </DataContext>
            </DirectionContext>
        </LocaleContext>
    );
};

export default MediaPicker;
