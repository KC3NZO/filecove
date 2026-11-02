import type { Dispatch, ReactNode, SetStateAction } from "react";

import type { AssetState, FileAdapter, FileEntry } from "./adapter";
import type { FilePreviewer } from "./previewer";
import type { FieldErrors, PropertyDefinitionGroup } from "./property-definition";
import type { Section } from "./section";

/**
 * The one kind of asset a media manager's library holds, which only decides the shape of its
 * tiles: pictures square, videos wide with their length, audio as rows, documents as pages.
 */
export type MediaKind = "image" | "video" | "audio" | "document";

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
}

/** What a library's upload form is handed (`MediaSection.uploadForm`). */
export interface MediaUploadFormParams extends MediaFormParams {
    /** The files about to be uploaded. */
    files: readonly File[];
}

/** What a library's process form is handed (`MediaSection.processForm`). */
export interface MediaProcessFormParams extends MediaFormParams {
    asset: FileEntry;
}

/** What a pick's form is handed (`MediaManager`'s `pickForm`). */
export interface MediaPickFormParams<V = Record<string, unknown>> extends MediaFormParams<V> {
    asset: FileEntry;
    /**
     * The pick's place in the order the app was handed the picks in, from 0, which the backend's
     * keys in `errors` go by.
     */
    index: number;
    /** The media manager's `errors`, as the app passed them; empty for a pick the backend never saw. */
    errors: FieldErrors;
}

/**
 * A form of the app's: what it holds as it's shown, and how it's drawn. `MediaFields` draws fields from
 * their definitions, for all of it or a part, and anything else the app likes can go around them or
 * in their place.
 */
export interface MediaForm<P extends { values: unknown } = MediaFormParams> {
    /** What it holds as it's shown. */
    defaults?: Partial<P["values"]>;
    /**
     * Draws it, each time what it holds changes, as a component of its own, so it may use hooks. Return
     * the app's own component as an element, `(form) => <VideoFields {...form} />`, defined outside
     * this function, or it would start over each time.
     */
    render(params: P): ReactNode;
}

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
     * How this library's assets are shown as one is opened, as its backend delivers them: an HLS
     * player for a backend handing over a manifest in `FileEntry.meta`, say. Asked before the media
     * manager's own `previewers`, in order; the asset's thumbnail when none accepts it. The media
     * manager plays nothing itself.
     */
    previewers?: FilePreviewer[];
    /**
     * What this library's assets show as one is opened, in groups: the app's definitions of the
     * values its adapter's `properties` hands over (`values`), as this backend's data has its own
     * shape, renditions with how far each is along, say. Used in place of the media manager's
     * `properties`; without either, the adapter's own groups show.
     */
    properties?: PropertyDefinitionGroup[];
    /**
     * What's asked of files uploaded into this library, before they're sent: the processing its
     * backend offers, such as whether a video is streamed as HLS, or a picture made smaller or turned
     * into WebP or AVIF. Handed the files, it returns the form for them, or `null` when there's
     * nothing to ask, as of pictures already in WebP, and they're sent at once. Shown once a batch,
     * picked, dropped or pasted, in the library's place. What it holds goes to the adapter's `upload`
     * with every file sent together (`UploadOptions.values`), which decides what it means.
     */
    uploadForm?(files: readonly File[]): MediaForm<MediaUploadFormParams> | null;
    /**
     * What can be asked of an asset already uploaded, from its view: anything its backend can make
     * of it or make again, such as a video's HLS, a picture's responsive sizes or a piece of audio's
     * transcript. Handed the asset, it returns the form for it, or `null` when nothing can be done
     * with it now, as for a video already being processed, and nothing is offered. What it holds goes
     * to the adapter's `process`, which decides what it means. Needs the adapter's `process`, and a
     * library that isn't `readOnly`.
     */
    processForm?(asset: FileEntry): MediaForm<MediaProcessFormParams> | null;
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

/** Assets being processed, followed through the adapter serving them (internal). */
export interface FollowedAssets {
    adapter: FileAdapter;
    entries: readonly FileEntry[];
}

/** How assets being processed stand, as their backends last said, by adapter and id (internal). */
export type AssetStates = ReadonlyMap<FileAdapter, ReadonlyMap<string, AssetState>>;

/**
 * Why an asset can't be chosen now (internal): its backend's work on it under way or failed
 * (`FileEntry.processing`), or its library refusing it (`MediaSection.selectable`), as its tile, its
 * row among those selected and its view show it, in one line, with a bar while it's processed.
 */
export interface AssetHold {
    status: "processing" | "failed" | "refused";
    /** How far along the processing is, from 0 to 1, when the backend says. */
    progress?: number;
    /** The line shown: what it's doing and how far along, that it failed, or why it's refused. */
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
 * `section.id` with `asset.id` to find it again.
 */
export interface MediaChoice<V = Record<string, unknown>> {
    asset: FileEntry;
    section: MediaSection;
    /**
     * What the app's form (`pickForm`) holds for this use of the asset, which the media manager keeps
     * with the pick and hands back. The form's `defaults` until something is changed, or as given
     * with `defaultValue`.
     */
    values: V;
}
