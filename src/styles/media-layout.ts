/*
 * The media manager lays itself out from its own width, as the file manager does, through a named
 * container of its own, so one placed inside the other, or beside it, follows its own box.
 */

export const MEDIA_CONTAINER = "media-manager";

/** Room to dock the list of libraries beside the library; below it, the header's button lists them. */
export const mediaMedium = `@container ${MEDIA_CONTAINER} (min-width: 720px)`;
/** Room to dock the selected column beside the library too; below it, it's an overlay over it. */
export const mediaWide = `@container ${MEDIA_CONTAINER} (min-width: 1040px)`;

/** The asset view lays itself out from its own width, its picture beside its details or over them. */
export const MEDIA_ASSET_CONTAINER = "media-asset";
/** Room for the asset view's details beside its picture. */
export const assetWide = `@container ${MEDIA_ASSET_CONTAINER} (min-width: 680px)`;

/** The docked list of libraries' width, in px. */
export const LIBRARIES_WIDTH = 220;

/** The docked selected column's width, in px. */
export const CHOICES_WIDTH = 320;

/** The asset view's details' width beside its picture, in px. */
export const ASSET_DETAILS_WIDTH = 340;

/** The side of the square asked of the adapter for the asset view's picture, in rem. */
export const ASSET_PICTURE = 40;

/** How a library of tiles lays them out: their least width and their picture's shape. */
export interface TileLayout {
    /** The least width of a tile, in rem; the columns share what's left over. */
    min: number;
    /** The picture's width to its height, as CSS `aspect-ratio`. */
    ratio: string;
    /** The side of the square asked of the adapter's `thumbnail`, in rem, a little over the tile's. */
    thumbnail: number;
}

/**
 * Each kind shown as tiles: pictures square, videos as wide as a screen, documents as tall as a
 * page. Audio has rows instead (`AUDIO_ROW`).
 */
export const TILE_LAYOUTS: Record<"image" | "video" | "document", TileLayout> = {
    image: { min: 8.5, ratio: "1", thumbnail: 11 },
    video: { min: 13, ratio: "16 / 9", thumbnail: 17 },
    document: { min: 8.5, ratio: "3 / 4", thumbnail: 11 },
};

/** The side of an audio row's square, its cover or its icon, in rem. */
export const AUDIO_ROW = 2.75;

/** The side of a picture in the selected column, in rem. */
export const CHOICE_THUMBNAIL = 3;
