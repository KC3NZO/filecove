import type { FileEntry } from "./adapter";
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
export interface MediaSection extends Pick<Section, "id" | "label" | "icon" | "rootId" | "adapter" | "readOnly"> {
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
