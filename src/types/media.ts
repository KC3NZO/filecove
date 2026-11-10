import type { Dispatch, ReactNode, SetStateAction } from "react";

import type { SxProps, Theme } from "@mui/material/styles";

import type { AssetState, FileAdapter, FileEntry } from "./adapter";
import type { IconSource } from "./icon";
import type { FilePreviewer } from "./previewer";
import type { FieldErrors, PropertyDefinitionGroup } from "./property-definition";
import type { FolderRef, Section } from "./section";

/**
 * The one kind of asset a media manager's library holds, which decides the shape of its tiles
 * (pictures square, videos wide with their length, audio square, documents as pages) and how it's
 * shown unless it says otherwise (`MediaSection.layouts`): audio as rows, the others as tiles.
 */
export type MediaKind = "image" | "video" | "audio" | "document";

/** How a library shows its assets: as tiles in a grid, or as rows in a list. */
export type MediaLayout = "grid" | "list";

/**
 * The layout the user is shown each library in, of those it offers (`MediaSection.layouts`), by its
 * `id`. A library left out, or set to one it doesn't offer, shows the first it offers.
 */
export type MediaLayouts = Readonly<Record<string, MediaLayout>>;

/**
 * What the app's form is handed each time it's drawn. The media manager keeps what it holds, and the
 * form changes it, so anything in it can follow anything else: a field off as another is unticked,
 * and what it held gone. What it holds is the app's, by its own keys, and the media manager never
 * reads it.
 */
export interface MediaFormParams<V = Record<string, unknown>> {
    /** What it holds now: its `defaults` until it's changed. */
    values: V;
    /** Puts other values in their place, all of them, or a function of those there, as React's own setter does. */
    setValues: Dispatch<SetStateAction<V>>;
    /** The library it's for. */
    section: MediaSection;
    /** That library's adapter, its own or the media manager's. */
    adapter: FileAdapter;
    /**
     * What's wrong with what it holds, by the backend's own keys, a message or several each: a pick's
     * as the app passed them (`MediaManager`'s `errors`), empty for a pick the backend never saw; an
     * upload's or a process form's as its refusal said (`MediaFormRefusal`), until it's sent again.
     * `MediaFields` shows each field's under it, by its `errorKey`.
     */
    errors: FieldErrors;
    /**
     * The place the keys in `errors` are made from: a pick's in the order the app was handed the
     * picks in, from 0; always 0 in an upload's or a process form, which are about one thing.
     */
    index: number;
}

/** What a library's upload form is handed (`MediaSection.uploadForm`). */
export interface MediaUploadFormParams<V = Record<string, unknown>> extends MediaFormParams<V> {
    /** The files about to be uploaded. */
    files: readonly File[];
    /** Whether its `validate` is being answered, while nothing in it should change. */
    sending: boolean;
}

/** What a library's process form is handed (`MediaSection.processForm`). */
export interface MediaProcessFormParams<V = Record<string, unknown>> extends MediaFormParams<V> {
    /**
     * The asset as it's listed now, a new object each time its backend's work moves on, so anything
     * loaded from it goes by `asset.id`.
     */
    asset: FileEntry;
    /** Whether it's being sent to the adapter's `process`, while nothing in it should change. */
    sending: boolean;
}

/** What a library's group form is asked for (`MediaSection.groupForm`). */
export interface MediaGroupTarget {
    /** The group being edited, or `null` for one being made. */
    group: FileEntry | null;
    /** The group it's in, or would be made in, `null` at the library's root. */
    parent: FileEntry | null;
}

/** What a library's group form is handed (`MediaSection.groupForm`). */
export interface MediaGroupFormParams<V = Record<string, unknown>> extends MediaFormParams<V>, MediaGroupTarget {
    /** The group again, or nothing for one being made, so `<MediaFields {...form} />` has it as its asset. */
    asset: FileEntry | undefined;
    /** Whether it's being sent to the adapter, while nothing in it should change. */
    sending: boolean;
}

/** What a pick's form is handed (`MediaManager`'s `pickForm`). */
export interface MediaPickFormParams<V = Record<string, unknown>> extends MediaFormParams<V> {
    asset: FileEntry;
    /** Every pick as it stands now, this one too, in the order set, for rules across them. */
    choices: readonly MediaChoice<V>[];
    /** Changes what another pick's form holds, as `setValues` does this one's. */
    setChoiceValues: (choice: MediaChoice<V>, next: SetStateAction<V>) => void;
}

/**
 * What a form's own functions are handed: what it's drawn with, without what changes it, as they only
 * read it, and are asked of a pick's form while it isn't open too.
 */
export type MediaFormState<P> = Omit<P, "setValues" | "setChoiceValues">;

// A form's values with members it has to have start out with them, so `values` never promises
// what isn't there.
type FormDefaults<V> = {} extends V ? { defaults?: V } : { defaults: V };

/**
 * A form of the app's: what it holds as it's shown, how it's drawn, and whether it's ready to go.
 * `MediaFields` draws fields from their definitions, for all of it or a part, and anything else the
 * app likes can go around them or in their place.
 */
export type MediaForm<P extends { values: unknown } = MediaFormParams> = FormDefaults<P["values"]> & {
    /**
     * Draws it, each time what it holds changes, as a component of its own, so it may use hooks. Return
     * the app's own component as an element, `(form) => <VideoFields {...form} />`, defined outside
     * this function, or it would start over each time, which the console warns of.
     */
    render(params: P): ReactNode;
    /**
     * Whether what it holds can go on: `true`, or `false`, or why not, in the app's language. Until
     * it can, its button (Upload, Process or Choose) is held back, with why beside it, and a pick's row
     * says so too. Without it, it always can, the backend having the last word.
     */
    ready?(params: MediaFormState<P>): boolean | string;
};

/** A pick's form (`MediaManager`'s `pickForm`). */
export type MediaPickForm<V = Record<string, unknown>> = MediaForm<MediaPickFormParams<V>> & {
    /**
     * The backend's keys for the fields it has now, one entry a field, each a key or the keys of a field
     * holding several, made from `index` and what it holds, so what's gone from it isn't counted. Its row
     * in the selected column says how many of them have a message, while the form isn't open.
     */
    errorKeys?(params: MediaFormState<MediaPickFormParams<V>>): ReadonlyArray<string | readonly string[]>;
};

/** A library's upload form (`MediaSection.uploadForm`). */
export type MediaUploadForm<V = Record<string, unknown>> = MediaForm<MediaUploadFormParams<V>> & {
    /**
     * Asks the backend about what it holds as Upload is pressed, since the files go one by one in the
     * background after that, with the form gone. Rejecting keeps it open, saying why as `process`
     * does (`MediaFormRefusal`). Aborted when the user leaves meanwhile.
     */
    validate?(params: MediaFormState<MediaUploadFormParams<V>>, options: { signal: AbortSignal }): void | Promise<void>;
};

/** A library's process form (`MediaSection.processForm`). */
export type MediaProcessForm<V = Record<string, unknown>> = MediaForm<MediaProcessFormParams<V>>;

/** A library's group form (`MediaSection.groupForm`). */
export type MediaGroupForm<V = Record<string, unknown>> = MediaForm<MediaGroupFormParams<V>> & {
    /**
     * Its step's title, "New season" or "Edit “Season 1”", and for one being made, the name of the
     * header's button; "New group" and "Edit “name”" without it.
     */
    title?: string;
    /** Its main button; "Create" or "Save" without it. */
    submitLabel?: string;
    /**
     * What it starts from when editing, in place of `defaults`, such as what the adapter's `properties`
     * hands over or the app's own API: the form shows once it's answered, with Try again should it be
     * refused, as a listing rarely has all of what a form asks. Not asked for a group being made.
     */
    load?(
        params: { group: FileEntry; section: MediaSection; adapter: FileAdapter },
        options: { signal: AbortSignal },
    ): Promise<V>;
};

/**
 * What the adapter's `process` or `createGroup` or `updateGroup`, or an upload form's `validate`, rejects with: its `message` shows over
 * the form, and `errors`, the backend's by its own keys, under the fields their `errorKey`s name, as
 * Laravel's validation answers: `Object.assign(new Error(body.message), { errors: body.errors })`.
 */
export interface MediaFormRefusal extends Error {
    errors?: FieldErrors;
}

/**
 * What an app's `renderAsset` is handed for an asset in its library, each time it changes. Spread
 * onto `MediaTile` or `MediaRow`, it draws the asset as the media manager does.
 */
export interface MediaAssetParams {
    asset: FileEntry;
    /** Its library's kind. */
    kind: MediaKind;
    /** What it's drawn as now: a tile (`MediaTile`), or a row (`MediaRow`). */
    layout: MediaLayout;
    section: MediaSection;
    /** Its library's adapter, its own or the media manager's. */
    adapter: FileAdapter;
    /**
     * The URL of its picture, as the adapter's `thumbnail` gave it for the layout and the kind's size,
     * once it has loaded; null until then, and for an asset with none. Cached and asked for a few at a time, so
     * use this rather than asking the adapter.
     */
    thumbnail: string | null;
    selected: boolean;
    /**
     * Why it can't be chosen now, or the backend's work on it while it can. `MediaTile` and `MediaRow`
     * show it; under anything else, the media manager does.
     */
    hold: AssetHold | undefined;
    /**
     * Where it is below the level searched, the groups on the way, outermost first, while it's a
     * result of the adapter's `search` from further down. `MediaTile` and `MediaRow` show it; under
     * anything else, the media manager does.
     */
    trail?: readonly FolderRef[];
}

/**
 * The media manager's own look of an asset, `MediaTile` or `MediaRow`: what `renderAsset` hands over,
 * spread onto it, and what to change. Each part left out stays as it is, and `null` takes it away.
 */
export interface MediaAssetLookProps extends Pick<MediaAssetParams, "asset" | "kind" | "thumbnail" | "hold" | "trail"> {
    /** In place of its name. */
    title?: ReactNode;
    /**
     * The line under its name, in place of its size or its type and size. While it can't be chosen
     * or is being processed, why is said there instead (`hold`). `null` leaves the line empty, still
     * as tall, so every asset is drawn the same height.
     */
    detail?: ReactNode;
    /** Over a tile's picture, or at a row's end, in place of its length. */
    badge?: ReactNode;
    /** In place of its thumbnail or icon, in the same box. */
    picture?: ReactNode;
    /** Over the look's root. */
    sx?: SxProps<Theme>;
}

/** `renderAsset` as a library's assets draw with it, its section already in hand (internal). */
export type MediaAssetDraw = (params: Omit<MediaAssetParams, "section">) => ReactNode;

/**
 * A media manager's library: a section holding assets of one kind, as its adapter lists them under
 * `rootId`, its own adapter or the media manager's. Each is an independent root, with its own
 * backend's way of delivering what it holds, so how its assets are previewed is its own too
 * (`previewers`). The media manager trusts the listing, and doesn't sort files into kinds itself.
 */
export interface MediaSection
    extends Pick<Section, "id" | "label" | "icon" | "rootId" | "adapter" | "readOnly" | "acceptUploads"> {
    kind: MediaKind;
    /**
     * How this library may show its assets, the first as it starts: `["list"]` only as rows,
     * `["grid", "list"]` as tiles with a button in the header switching to rows. Without it, there's
     * no button, and audio shows as rows and the others as tiles. What the user switches to can be
     * kept across visits with `MediaManager`'s `layout` and `onLayoutChange`.
     */
    layouts?: readonly MediaLayout[];
    /**
     * How this library's assets are shown as one is opened, as its backend delivers them: an HLS
     * player for a backend handing over a manifest in `FileEntry.meta`, say. Asked before the media
     * manager's own `previewers`, in order; the asset's thumbnail when none accepts it. The media
     * manager plays nothing itself.
     */
    previewers?: FilePreviewer[];
    /**
     * What this library's assets, and its groups, show as one is opened, in groups of fields: the
     * app's definitions of the values its adapter's `properties` hands over (`values`), as this
     * backend's data has its own shape, renditions with how far each is along, say. One list for
     * all it holds, or a function of the entry, for what differs between them, as an album's fields
     * do from a track's (a group is an entry of `kind: "folder"`). Used in place of the media
     * manager's `properties`; without either, the adapter's own groups show.
     */
    properties?: PropertyDefinitionGroup[] | ((entry: FileEntry) => PropertyDefinitionGroup[]);
    /**
     * What's asked of each pick from this library, or `null` for nothing, for what comes with its
     * backend wherever it's picked: a stock photo's credit, say. Used in place of the media manager's
     * or the picker's `pickForm`, even when it returns `null`, so a library can ask nothing of its
     * picks; what's about one use belongs on that component's. Keep it outside the component, or
     * memoized.
     */
    // `any`, so a form of values of the app's own shape fits, as a library doesn't know their shape.
    pickForm?(asset: FileEntry): MediaPickForm<any> | null;
    /**
     * Draws this library's assets, in place of the media manager's `renderAsset` and its own look.
     * Return `MediaTile` or `MediaRow` with what to change, for a small change, or anything else, going
     * by `layout` if the library offers both. It
     * only draws: selecting, the keys, the check and the Open button at a tile's top corners or a
     * row's end stay the media manager's, as does why an asset can't be chosen, under what it draws,
     * so it's for showing, with no buttons or links of its own. May use hooks. Every asset of a
     * library, and every group, must be drawn the same height, whatever it holds: only the assets in or
     * near view are rendered, laid out in lines as tall as the first one rendered. Keep it outside the
     * component, or memoized, as a new function draws every asset again.
     */
    renderAsset?: (params: MediaAssetParams) => ReactNode;
    /**
     * Draws this library's groups (a collection, an album, a season: whatever it lists as an entry of
     * `kind: "folder"`), in place of the media manager's `renderGroup` and its own look, which is its
     * thumbnail if the adapter gives one, its name and how many it holds. It's handed the group as
     * `asset`, so `MediaTile` or `MediaRow` take what it's handed, with what to change, as they do in
     * `renderAsset`, and what's said there of drawing goes here too. What a group is, and what it
     * has of its own, such as a cover, is the app's: the media manager only goes into it.
     */
    renderGroup?: (params: MediaAssetParams) => ReactNode;
    /**
     * Draws what's above a group's contents while it's open, scrolling with them, such as an album's
     * cover and description: it's outside the list of assets, so it may have buttons and links of its
     * own, and may use hooks. Nothing without it. The group is as it was listed when it was opened,
     * `meta` and all.
     */
    groupHeader?: (group: FileEntry, section: MediaSection) => ReactNode;
    /**
     * Whether new groups can be made in this library, which puts New group in its header at the levels
     * that say so: one answer for all of them, or a function of the group open (`null` at the root),
     * for a backend whose albums hold no more groups, say. It asks only for a name, through the
     * adapter's `createFolder`, the group's details opening next where it has any, for the rest of what
     * the app defines. Off by default, as an adapter's `createFolder` doesn't say this library holds
     * groups, and a `readOnly` library never makes them. Moving a group goes by it too, so it can't go
     * where this says no; left out, moving asks nothing of it, and the backend has the say.
     */
    createGroups?: boolean | ((parent: FileEntry | null) => boolean);
    /**
     * What's asked of a group as it's made and edited, a form as `processForm` is, drawing anything and
     * holding what it likes under the app's own keys, so what a group has, a cover, a teaser, is the
     * app's: told which group and where, it returns the form, or `null` for none. Where there's one,
     * New group shows it (where `createGroups` says one can be made) and hands what it holds to the
     * adapter's `createGroup`, and a group's details have Edit, handing it to `updateGroup`. Without
     * one, New group asks only a name, through `createFolder`, and there's no Edit.
     */
    groupForm?: (target: MediaGroupTarget) => MediaGroupForm | null;
    /**
     * What's asked of files uploaded into this library, before they're sent: the processing its
     * backend offers, such as whether a video is streamed as HLS, or a picture made smaller or turned
     * into WebP or AVIF. Handed the files, it returns the form for them, or `null` when there's
     * nothing to ask, as of pictures already in WebP, and they're sent at once. Shown once a batch,
     * picked, dropped or pasted, in the library's place. What it holds goes to the adapter's `upload`
     * with every file sent together (`UploadOptions.values`), which decides what it means.
     */
    // `any`, so a form of values of the app's own shape fits, as a library doesn't know their shape.
    uploadForm?(files: readonly File[]): MediaUploadForm<any> | null;
    /**
     * What can be asked of an asset already uploaded, from its view: anything its backend can make
     * of it or make again, such as a video's HLS, a picture's responsive sizes or a piece of audio's
     * transcript. Handed the asset, it returns the form for it, or `null` when nothing can be done
     * with it now, as for a video already being processed, and nothing is offered. What it holds goes
     * to the adapter's `process`, which decides what it means. Needs the adapter's `process`, and a
     * library that isn't `readOnly`. Asked again as the asset changes, so an open form follows it, and
     * `null` by then holds Process back rather than closing what's being filled in.
     */
    // `any`, so a form of values of the app's own shape fits, as a library doesn't know their shape.
    processForm?(asset: FileEntry): MediaProcessForm<any> | null;
    /**
     * Whether an asset of this library may be chosen, by the app's own rules, such as a stock photo
     * whose licence has run out: `true`, or `false`, or why not, in the app's language, which its
     * tile shows in place of its size. One that can't is still shown and opened, but isn't
     * selected, and one selected already, as given with `defaultValue`, holds Choose back until
     * it's taken out. An asset being processed (`FileEntry.processing`) can't be chosen either, unless
     * it's `usable`, whatever this says. The app's backend still has the last word when it saves the
     * picks.
     */
    selectable?(entry: FileEntry): boolean | string;
}

/** Which of the groups shown can be selected, and why those that say so can't (internal). */
export interface GroupPicks {
    checks: ReadonlySet<string>;
    refusals: ReadonlyMap<string, AssetHold>;
}

/**
 * What the frames ask of the grid of a level (internal): an asset or group to take the focus, by its
 * index, as only those in or near view are rendered; false for an index it doesn't show.
 */
export interface MediaGridHandle {
    focusAt: (index: number) => boolean;
}

/** Assets being processed, followed through the adapter serving them (internal). */
export interface FollowedAssets {
    adapter: FileAdapter;
    entries: readonly FileEntry[];
}

/** How assets being processed stand, as their backends last said, by adapter and id (internal). */
export type AssetStates = ReadonlyMap<FileAdapter, ReadonlyMap<string, AssetState>>;

/**
 * Why an asset can't be chosen now: its backend's work on it under way or failed
 * (`FileEntry.processing`), its library refusing it (`MediaSection.selectable`), the app refusing it
 * for this use (`canSelect`) or there being no room for it (`maxChoices`), or, once it's picked, its
 * form not ready (`MediaForm.ready`), as its tile, its row among those selected and its view show
 * it, in one line, with a bar while it's processed.
 */
export interface AssetHold {
    status: "processing" | "failed" | "refused" | "unfilled";
    /** How far along the processing is, from 0 to 1, when the backend says. */
    progress?: number;
    /** The line shown: what it's doing and how far along, that it failed, or why it's refused or unfilled. */
    text: string;
    /** Why it failed, as the backend said, for its description. */
    detail?: string;
}

/** Libraries shown together in the list of libraries, under an optional heading. */
export interface MediaSectionGroup {
    id: string;
    title?: string;
    sections: MediaSection[];
}

/**
 * An asset picked for this use: as it was listed, `meta` and all, the library it was picked in, and
 * what the app's form holds for it (`values`). What's chosen may come from several libraries, such
 * as pictures and videos for a product's carousel, in the order set. An asset is known by its
 * library's adapter and its id, since ids are only unique within an adapter, so an app keeps
 * `section.id` with `asset.id` to find it again. With `selectGroups`, `asset` may be a group, of
 * `kind: "folder"`, for the app's backend to expand.
 */
export interface MediaChoice<V = Record<string, unknown>> {
    asset: FileEntry;
    section: MediaSection;
    /**
     * What the app's form (`pickForm`) holds for this use of the asset, which the media manager keeps
     * with the pick and hands back, a copy of its own at Choose. The form's `defaults` as they are now
     * until something is changed, or as given with `defaultValue`.
     */
    values: V;
    /**
     * The groups it was picked among, from its library's root, none at its root, for a `canSelect` to
     * tell what's inside what. Handed over with it, so it's kept by giving a choice back as it is, and
     * unset for one given without it, whose place isn't known. Those a search went through hold only what
     * the adapter's trail gave.
     */
    trail?: readonly FileEntry[];
}

/** What an action of the app's in the media manager's header is told (`MediaAction`). */
export interface MediaActionContext<V = Record<string, unknown>> {
    /** The library shown. */
    section: MediaSection;
    /** What serves it: its own adapter, or else the media manager's. */
    adapter: FileAdapter;
    /** The group open, or nothing at the library's root. */
    group: FileEntry | null;
    /** The groups gone into from the library's root, to the one open; none at its root. */
    trail: readonly FileEntry[];
    /**
     * The asset or group shown in the library's place, with the groups it's in, which a search may have
     * found below those open; nothing while the library itself shows.
     */
    viewed: { entry: FileEntry; trail: readonly FileEntry[] } | null;
    /**
     * What's selected, of every library, in the order set, each with its own `section`, as `onChange`
     * hands it over: those that can't be chosen yet too, so what's done with them is the app's to check.
     * None while the media manager takes no picks.
     */
    choices: readonly MediaChoice<V>[];
    /**
     * Whether nothing can be changed where this is, the level open or what's `viewed`: the library is
     * `readOnly`, or the listing's or the group's `permissions` refuse writing. An action changing it can
     * hide with `visible: (context) => !context.readOnly`.
     */
    readOnly: boolean;
    /**
     * Lists again what's open, what a search found and what's `viewed`, after the action changed them
     * through the app's own API, in every library on this adapter.
     */
    refresh: () => void;
}

/**
 * One of the app's actions in the media manager's header, for what the component leaves to it, such as
 * reordering a group, or moving several at once.
 */
export interface MediaAction<V = Record<string, unknown>> {
    id: string;
    label: string;
    /** Shown as a button where there's room, a few at most; without one, it's in "More actions". */
    icon?: IconSource;
    /** Narrows when it's offered, e.g. to a group, or to one library. */
    visible?: (context: MediaActionContext<V>) => boolean;
    disabled?: (context: MediaActionContext<V>) => boolean;
    /**
     * Shown beside the label, e.g. "Alt+R", and bound to the keyboard while the focus is in the
     * media manager and not in a field. Written as `FileAction.shortcut` is, and a key something here
     * uses itself stays with it.
     */
    shortcut?: string;
    /** Styles it as destructive, for actions such as delete. */
    destructive?: boolean;
    onSelect: (context: MediaActionContext<V>) => void;
}

/** Actions shown together, divided from the next group by a rule in "More actions". */
export interface MediaActionGroup<V = Record<string, unknown>> {
    id: string;
    actions: readonly MediaAction<V>[];
}

/**
 * What a `MediaPicker` is given as selected. It has one library, so a pick needs no `section`, and what
 * `onChoose` and `onChange` hand over can be given back as it is. Without `values`, it holds the form's
 * `defaults`, and follows them until it's changed.
 */
export interface MediaPickerValue<V = Record<string, unknown>> {
    asset: FileEntry;
    values?: V;
    /** The groups it's among, from the library's root, as `MediaChoice.trail`; its place is unknown without it. */
    trail?: readonly FileEntry[];
}
