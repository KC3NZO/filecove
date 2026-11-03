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

import type { FileAdapter, FileEntry, MediaManagerLocaleText, MediaSection } from "../../types";

// The root element's own attributes, which go on it as they do on a MUI component's root.
type RootAttributes = Omit<ComponentPropsWithoutRef<"div">, "children">;

export interface MediaPickerProps extends RootAttributes {
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
     * Takes what's chosen, with the Choose button, a double click or Enter on an asset, each as it was
     * listed, `meta` and all: one asset, unless `multiple`. What's stored of it, and anything asked about
     * this use of it, are the app's, around the picker.
     */
    onChoose: (assets: FileEntry[]) => void;
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
    /** What's selected as it mounts, such as what the field it's picking for holds now. */
    defaultValue?: readonly FileEntry[];
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
 * the same parts, with nothing for managing a library: no list of libraries, no asset view, no selected
 * column, no forms for a pick, and nothing to delete, move or make a group with, so none of that needs
 * turning off. It has no dialog of its own, as a picker's place is the app's.
 */
const MediaPicker = ({
    adapter,
    section,
    onChoose,
    onCancel,
    multiple = false,
    maxChoices,
    allowUpload = false,
    defaultValue,
    localeText,
    locale,
    ref,
    sx,
    ...rootAttributes
}: MediaPickerProps) => {
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
                            onChoose={onChoose}
                            onCancel={onCancel}
                            multiple={multiple}
                            maxChoices={maxChoices}
                            allowUpload={allowUpload}
                            defaultValue={defaultValue}
                        />
                    </Box>
                </DataContext>
            </DirectionContext>
        </LocaleContext>
    );
};

export default MediaPicker;
