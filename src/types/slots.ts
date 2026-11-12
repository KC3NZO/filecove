import type { ComponentType, HTMLAttributes } from "react";

import type { ActionContext } from "./action";
import type { FileEntry } from "./adapter";
import type { MediaSection } from "./media";
import type { FileManagerLocation } from "./navigation";
import type { SearchScope } from "./search";
import type { FolderRef, Section } from "./section";
import type { ViewMode } from "./view";

/**
 * Attributes an app adds to one of a component's parts through `slotProps`, as the element takes
 * them: a `className` (utility classes included), a `style`, `data-*` and `aria-*` attributes, an
 * `id`, a `title`, handlers. How they go with what the part sets itself:
 *
 * - `className` is added after the part's own classes, its stable `fm-…` name among them.
 * - `style` goes under the part's own: a property the part sets, as its place in a virtualized
 *   list or its width, stays the part's.
 * - A handler is called before the part's own handler for the same event, and one calling
 *   `event.preventDefault()` keeps the part's from running, as the root's handlers do.
 * - Anything else the part sets itself (its `role`, `tabIndex`, its `aria-*` and `data-*` state)
 *   stays the part's, so the keys, the focus and screen readers keep working.
 */
export type SlotAttributes = Omit<HTMLAttributes<HTMLElement>, "children" | "dangerouslySetInnerHTML"> & {
    [attribute: `data-${string}`]: string | number | boolean | undefined;
};

/**
 * `slotProps` of a part there are many of, such as an entry's row: the same attributes for each, or a
 * function giving each its own, by what `P` says of it, such as a class for shared files.
 */
export type SlotAttributesOf<P> = SlotAttributes | ((params: P) => SlotAttributes | undefined);

/** What a slot drawing a spinner in a state's place is handed. */
export interface SlotLoadingProps {
    /** "Loading" in the component's text (`localeText.loading`), to name a spinner by for screen readers. */
    label: string;
}

/** Where the content of a file manager is, as a slot drawn there is told. */
export interface FileManagerSlotPlace {
    /** The section of the open folder. */
    section: Section;
    /** The open folder's location: its section and the folders below the section's root. */
    location: FileManagerLocation;
    /** The open folder: the last of the trail, or the section's root, named by the section's label. */
    folder: FolderRef;
}

/** What `FileManagerSlots.empty` is handed. */
export interface FileManagerEmptyProps extends FileManagerSlotPlace {
    /** Whether the folder is a trash's root (`Section.trash`), which the file manager says is empty in its own words. */
    trash: boolean;
    /**
     * What the context menu's actions get for the folder's empty space (`target` "folder"), as
     * `FileManagerApi.actionContext()` returns it, so the state can act on the folder, as an Upload
     * button calling `context.upload` does, offered only where it is, as the menu's are. Null while
     * the folder's section is missing.
     */
    context: ActionContext | null;
}

/** What `FileManagerSlots.error` is handed. */
export interface FileManagerErrorProps extends FileManagerSlotPlace {
    /** What the adapter's `list` rejected with. */
    error: unknown;
    /** Lists the folder again, as the file manager's own Try again does. */
    retry: () => void;
}

/** What `FileManagerSlots.noResults` is handed. */
export interface FileManagerNoResultsProps {
    /** What's typed in the search field: as typed in a folder search, trimmed for a search everywhere. */
    query: string;
    /** What was searched: the open folder, or every section searched everywhere. */
    scope: SearchScope;
}

/** What `FileManagerSlots.sidebarFooter` is handed. */
export interface FileManagerSidebarFooterProps {
    /** The section open, or null while there's none, as while an app is still getting its sections. */
    section: Section | null;
    /** Where the content is, or null while there's no section. */
    location: FileManagerLocation | null;
}

/**
 * Parts of the app's own that `FileManager` draws, each a component (`slots`). The content's states,
 * `empty`, `noResults`, `error`, `loading` and `noSections`, are drawn in place of what the file
 * manager shows there, inside the box each takes in the content panel, which keeps its place, its
 * `fm-state` class and what screen readers are told of it: the folder's empty space is described by
 * it, and an error is an `alert`. Each is a component kept outside the app's own, as one made while
 * rendering starts over every time.
 */
export interface FileManagerSlots {
    /**
     * The open folder lists nothing, or only hidden entries while they don't show, or the trash's
     * root is empty: "Folder is empty" or "Trash is empty" by default.
     */
    empty?: ComponentType<FileManagerEmptyProps>;
    /**
     * A search found nothing: the open folder's, once all of it has been listed, or a search
     * everywhere's, once every section answered: "No results found" by default.
     */
    noResults?: ComponentType<FileManagerNoResultsProps>;
    /** The open folder couldn't be listed: "Couldn't open this folder", the adapter's message and Try again by default. */
    error?: ComponentType<FileManagerErrorProps>;
    /** Nothing to show yet, while a folder is listed or a search everywhere waits for its first results: a spinner by default. */
    loading?: ComponentType<SlotLoadingProps>;
    /** There's no section, as while an app is still getting its sections: "No sections to show" by default. */
    noSections?: ComponentType;
    /**
     * Drawn at the bottom of the sidebar, under its tree, which scrolls above it, as a storage meter
     * or a link to the app's settings is. Nothing is there by default.
     */
    sidebarFooter?: ComponentType<FileManagerSidebarFooterProps>;
}

/** What a function in `FileManagerSlotProps.entry` is handed for each row and tile. */
export interface FileManagerEntrySlotParams {
    /** The entry, as its folder's listing has it, or as a search found it. */
    entry: FileEntry;
    /** Whether it's a row of the list or a tile of the grid. */
    view: ViewMode;
    selected: boolean;
}

/**
 * Attributes for `FileManager`'s parts (`slotProps`), beside their stable class names (`fmClasses`):
 * see `SlotAttributes` for how they go with each part's own. Keep the object outside the app's
 * component, or memoized: a new `entry` draws every row and tile shown again.
 */
export interface FileManagerSlotProps {
    /** The sidebar, docked or as an overlay (`fm-sidebar`). */
    sidebar?: SlotAttributes;
    /** The header bar (`fm-header`). */
    header?: SlotAttributes;
    /** The content panel, holding the open folder or a search's results (`fm-content`). */
    content?: SlotAttributes;
    /** The properties panel, docked or as an overlay (`fm-properties`). */
    properties?: SlotAttributes;
    /**
     * Each entry's row in the list and tile in the grid, of a folder and of a search's results
     * (`fm-list-row`, `fm-grid-tile`), or a function giving each its own.
     */
    entry?: SlotAttributesOf<FileManagerEntrySlotParams>;
}

/** Where the assets of a media manager or picker are, as a slot drawn there is told. */
export interface MediaSlotPlace {
    /** The library shown. */
    section: MediaSection;
    /** The group open in it, or null at its root. */
    group: FileEntry | null;
}

/** What `MediaManagerSlots.empty` and `MediaPickerSlots.empty` are handed. */
export interface MediaEmptyProps extends MediaSlotPlace {
    /**
     * Uploads into the library or group shown as its Upload button does, the library's `uploadForm`
     * asked first, opening the browser's file picker; missing where it takes no files, or the picker
     * doesn't upload (`allowUpload`).
     */
    upload?: () => void;
}

/** What `MediaManagerSlots.noResults` and `MediaPickerSlots.noResults` are handed. */
export interface MediaNoResultsProps extends MediaSlotPlace {
    /** What's typed in the search field, as typed. */
    query: string;
}

/** What `MediaManagerSlots.error` and `MediaPickerSlots.error` are handed. */
export interface MediaErrorProps extends MediaSlotPlace {
    /** Why the library or its search failed, as the adapter said it, or nothing when it didn't. */
    message: string | undefined;
    /** Lists it, or searches it, again, as the media manager's own Try again does. */
    retry: () => void;
}

/**
 * The states of a media library that a `MediaPicker` draws as the app's own components (`slots`),
 * drawn inside the box each takes where the assets go, under an open group's header, which keeps
 * its `fm-state` class and what screen readers are told: an error is an `alert`. Each is a
 * component kept outside the app's own.
 */
export interface MediaPickerSlots {
    /** The library or group shown holds nothing: "Nothing here yet" by default. */
    empty?: ComponentType<MediaEmptyProps>;
    /** The search matched nothing: "No media matches" by default. */
    noResults?: ComponentType<MediaNoResultsProps>;
    /** It couldn't be listed or searched: the message and Try again by default. */
    error?: ComponentType<MediaErrorProps>;
    /** Nothing to show yet: a spinner by default. */
    loading?: ComponentType<SlotLoadingProps>;
}

/** `MediaManager`'s `slots`: the picker's, and what shows with no library to show. */
export interface MediaManagerSlots extends MediaPickerSlots {
    /** There's no library, as while an app is still getting them: "No libraries to show" by default. */
    noSections?: ComponentType;
}

/** What a function in `MediaManagerSlotProps.asset` is handed for each asset and group. */
export interface MediaAssetSlotParams {
    /** The asset or group, as its library lists it, or as a search found it. */
    asset: FileEntry;
    /** Its library. */
    section: MediaSection;
    selected: boolean;
}

/**
 * Attributes for `MediaPicker`'s parts (`slotProps`), beside their stable class names (`fmClasses`):
 * see `SlotAttributes` for how they go with each part's own. Keep the object outside the app's
 * component, or memoized: a new `asset` draws every asset shown again.
 */
export interface MediaPickerSlotProps {
    /** The header over the assets (`fm-media-header`). */
    header?: SlotAttributes;
    /** The column listing what's selected, docked or as an overlay (`fm-media-chosen`). */
    chosen?: SlotAttributes;
    /**
     * Each asset's and group's `option` (`fm-media-option`), around what `renderAsset` or the look
     * draws, or a function giving each its own.
     */
    asset?: SlotAttributesOf<MediaAssetSlotParams>;
}

/** `MediaManager`'s `slotProps`: the picker's, and the list of libraries. */
export interface MediaManagerSlotProps extends MediaPickerSlotProps {
    /** The list of libraries, docked or as a drawer (`fm-media-libraries`). */
    libraries?: SlotAttributes;
}
