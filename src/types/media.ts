import type { AssetState, FileAdapter, FileEntry } from "./adapter";
import type { FilePreviewer } from "./previewer";
import type { PropertyDefinitionGroup } from "./property-definition";
import type { Section } from "./section";

/**
 * The one kind of asset a media manager's library holds, which only decides the shape of its
 * tiles: pictures square, videos wide with their length, audio as rows, documents as pages.
 */
export type MediaKind = "image" | "video" | "audio" | "document";

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
     * What's asked of files uploaded into this library, before they're sent, in groups: the
     * processing its backend offers, such as whether a video is streamed as HLS, or a picture made
     * smaller or turned into WebP or AVIF, by the app's own definitions, as a pick's fields are.
     * What they hold goes to the adapter's `upload` with every file sent together
     * (`UploadOptions.values`), which decides what they mean. Asked for once a batch, picked,
     * dropped or pasted, in the library's place, with `uploadDefaults` filled in; a function is
     * handed the files, to ask only what fits them, such as nothing for pictures already in
     * WebP. Without any for the files, they're sent at once.
     */
    uploadFields?: PropertyDefinitionGroup[] | ((files: readonly File[]) => PropertyDefinitionGroup[]);
    /** What the upload fields hold as they're shown, by their `field` keys: the backend's defaults. */
    uploadDefaults?: Readonly<Record<string, unknown>>;
    /**
     * Whether an asset of this library may be chosen, by the app's own rules, such as a stock photo
     * whose licence has run out: `true`, or `false`, or why not, in the app's language, which its
     * tile shows in place of its size. One that can't is still shown and opened, but isn't
     * selected, and one selected already, as given with `defaultValue`, holds Choose back until
     * it's taken out. An asset being processed (`FileEntry.processing`) can't be chosen either,
     * whatever this says. The app's backend still has the last word when it saves the picks.
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
 * what the app's fields hold for it (`values`). What's chosen may come from several libraries, such
 * as pictures and videos for a product's carousel, in the order set. An asset is known by its
 * library's adapter and its id, since ids are only unique within an adapter, so an app keeps
 * `section.id` with `asset.id` to find it again.
 */
export interface MediaChoice<V = Record<string, unknown>> {
    asset: FileEntry;
    section: MediaSection;
    /**
     * What the app's fields (`fields`) hold for this use of the asset, by their `field` keys, which
     * the media manager keeps with the pick and hands back. Empty until something is filled in, or
     * as given with `defaultValue`.
     */
    values: V;
}
