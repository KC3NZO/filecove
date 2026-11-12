import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentPropsWithoutRef, Ref } from "react";

import { DataContext } from "../../contexts/data-context";
import { LocaleContext } from "../../contexts/locale-context";
import { useForkRef } from "../../hooks/use-fork-ref";
import { useLocaleValue } from "../../hooks/use-locale";
import { useTextDirection } from "../../hooks/use-text-direction";
import { createFolderStore } from "../../store/folder-store";
import { createThumbnailCache } from "../../store/thumbnail-cache";
import { fmClasses } from "../../styles/classes";
import theme from "../../styles/theme.module.css";
import { cx } from "../../utils/cx";
import { countLimit, delayLimit } from "../../utils/limits";
import RootProviders from "../ui/root-providers";
import styles from "./media-picker.module.css";
import PickerFrame from "./picker-frame";
import type { PickerFrameProps } from "./picker-frame";

import type {
    FileAdapter,
    FileEntry,
    MediaChoice,
    MediaManagerLimits,
    MediaManagerLocaleText,
    MediaPickerValue,
    MediaPickForm,
    MediaPickerSlotProps,
    MediaPickerSlots,
    MediaSection,
} from "../../types";

// The root element's own attributes, which go on it as they are.
type RootAttributes = Omit<ComponentPropsWithoutRef<"div">, "children" | "defaultValue" | "onChange">;

export interface MediaPickerProps<V = Record<string, unknown>> extends RootAttributes {
    /** Serves the library, unless it brings its own adapter. */
    adapter: FileAdapter;
    /**
     * The one library to pick from, the same object a `MediaManager` takes. Its `layouts`,
     * `renderAsset`, `renderGroup`, `groupHeader`, `selectable`, `acceptUploads`, `uploadForm` and
     * `pickForm` count here too; what's for managing it, such as `createGroups`, `groupForm` and `processForm`, has no
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
     * picker. A library's own `pickForm` comes first. Without either there's no column. Keep it outside
     * the component, or memoized.
     */
    pickForm?: (asset: FileEntry, section: MediaSection) => MediaPickForm<V> | null;
    /** Puts a Cancel button beside Choose, for a picker in the app's own dialog. */
    onCancel?: () => void;
    /** Whether several can be chosen at once, in the order they were selected. One at a time when omitted. */
    multiple?: boolean;
    /** How many can be selected at once with `multiple`. No limit when omitted. */
    maxChoices?: number;
    /**
     * Whether an asset or group can be added, for this use of the picker, beside what's picked already,
     * as the media manager's `canSelect`: `true`, or `false`, or why not, in the app's language, which
     * its tile shows. `section` is the library given, so one function can serve a `MediaManager` too, and
     * `choices` are those before it, without it, in the order set, and none one at a time, as it would
     * replace them. Asked for everything shown as the picks change, so keep it quick, and outside the
     * component or memoized. A pick that breaks it, as given with `defaultValue`, says why and holds Choose
     * back until it's taken out. A library's own `selectable` is for what depends on the backend, and
     * one has to pass both.
     *
     * `trail` is the groups it's in, from the library's root, and each of `choices` has its own, so what's
     * inside a group picked, or a group with a pick inside it, can be refused, what that means being the
     * app's: nothing is refused for it otherwise. `trail` is unset for a pick given without one, whose
     * place isn't known.
     */
    canSelect?: (
        asset: FileEntry,
        section: MediaSection,
        choices: readonly MediaChoice<V>[],
        trail: readonly FileEntry[] | undefined,
    ) => boolean | string;
    /**
     * Whether groups can be selected and chosen as well as assets. A click on a group still goes in, so
     * one that can be has a check of its own, and Space does the same. `canSelect` and the library's
     * `selectable` decide per group, a plain `false` only leaving its check off. What's chosen hands it
     * back as listed, for the backend to expand. Off when omitted.
     */
    selectGroups?: boolean;
    /**
     * Whether files can be uploaded here, for when what's wanted isn't there yet, by an Upload button,
     * a drop or a paste, into the level open: off by default, as nothing else in a picker changes the
     * backend. It still needs the adapter's `upload` and a library taking them (`acceptUploads`, not
     * `readOnly`). The library's `uploadForm` is asked first, and each file is selected as it arrives,
     * holding Choose back while it's being processed. An upload under way is cancelled as the picker
     * goes.
     */
    allowUpload?: boolean;
    /**
     * The library's states drawn as the app's own components (`empty`, `noResults`, `error`,
     * `loading`), each in the box the picker's own takes. Keep them outside the app's component, as
     * one made while rendering starts over every time. See `MediaPickerSlots`.
     */
    slots?: MediaPickerSlots;
    /**
     * Attributes for the picker's parts, `header`, `chosen`, and `asset`, each asset's and group's
     * option, or a function giving each its own. What a part sets itself stays its own (see
     * `SlotAttributes`). Keep the object outside the app's component, or memoized.
     */
    slotProps?: MediaPickerSlotProps;
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
    /**
     * How old, in ms, a level's listing may be before showing it lists it again in the background, as
     * the media manager's `relistAfter`: 0, the default, every time; `Infinity` never.
     */
    relistAfter?: number;
    /**
     * How much it does at once and keeps, as the media manager's `limits`: uploads and thumbnails at once,
     * thumbnails and listings kept, and how long the typing stops before the adapter's `search` is asked;
     * `transfers` counts for nothing here. Each is its default when omitted, and a change takes effect at
     * once. The picker has stores of its own, so a media manager around it doesn't share them.
     */
    limits?: MediaManagerLimits;
    /** The component's own text, the media manager's. Keys left out stay in English, as `enUS` has them. */
    localeText?: Partial<MediaManagerLocaleText>;
    /** The BCP 47 language tag that numbers, sizes and dates are written in and names are matched by. */
    locale?: string;
    /** The root element, which fills the box it's placed in. */
    ref?: Ref<HTMLDivElement>;
    /** Styles the root element, over its own, e.g. to size it. It fills its container by default. */
    className?: string;
}

// A number for each adapter, so changing it can start the frame afresh by its `key`.
const NO_SLOTS: MediaPickerSlots = {};
const NO_SLOT_PROPS: MediaPickerSlotProps = {};

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
    canSelect,
    selectGroups = false,
    allowUpload = false,
    slots = NO_SLOTS,
    slotProps = NO_SLOT_PROPS,
    value,
    defaultValue,
    onChange,
    relistAfter = 0,
    limits,
    localeText,
    locale,
    ref,
    className,
    ...rootAttributes
}: MediaPickerProps<V>) => {
    const localeValue = useLocaleValue(localeText, locale);
    const [store] = useState(createFolderStore);
    const [thumbnails] = useState(createThumbnailCache);
    // Listed again in the background as a level is shown, as the media manager's are.
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

    // Set before the parts' own effects ask for anything as they mount.
    useLayoutEffect(() => store.setMaxKept(keptEntries), [store, keptEntries]);
    useLayoutEffect(
        () => thumbnails.setLimits(thumbnailLimit, keptThumbnails),
        [thumbnails, thumbnailLimit, keptThumbnails],
    );
    useEffect(() => () => store.abortAll(), [store]);
    useEffect(() => () => thumbnails.clear(), [thumbnails]);

    return (
        <LocaleContext value={localeValue}>
            <RootProviders direction={direction}>
                <DataContext value={data}>
                    <div {...rootAttributes} ref={handleRootRef} className={cx(theme.theme, theme.root, styles.root, fmClasses.mediaPicker, className)}>
                        <PickerFrame
                            key={`${numberOf(section.adapter ?? adapter)}/${section.id}/${section.rootId}`}
                            section={section}
                            adapter={section.adapter ?? adapter}
                            onChoose={onChoose as PickerFrameProps["onChoose"]}
                            pickForm={pickForm as PickerFrameProps["pickForm"]}
                            onCancel={onCancel}
                            multiple={multiple}
                            maxChoices={maxChoices}
                            canSelect={canSelect as PickerFrameProps["canSelect"]}
                            selectGroups={selectGroups}
                            allowUpload={allowUpload}
                            value={value as PickerFrameProps["value"]}
                            defaultValue={defaultValue as PickerFrameProps["defaultValue"]}
                            onChange={onChange as PickerFrameProps["onChange"]}
                            uploadLimit={countLimit(limits?.uploads, 1)}
                            searchDelay={delayLimit(limits?.searchDelay)}
                            slots={slots}
                            slotProps={slotProps}
                        />
                    </div>
                </DataContext>
            </RootProviders>
        </LocaleContext>
    );
};

export default MediaPicker;
