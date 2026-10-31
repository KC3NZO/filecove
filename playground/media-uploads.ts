import type { PropertyDefinition, PropertyDefinitionGroup } from "../src";

// What this site's backend can do with files as they're uploaded, asked of each library's uploads
// before they're sent (`uploadFields`), as an app offers what its own backend's pipeline does. The
// media manager only draws them and hands what they hold to the adapter's `upload` (`values`);
// the playground's backend (`mocks/mock-media.ts`) acts on them.

/** The video qualities this site's backend can make, from the largest. */
export const QUALITIES = ["2160p", "1080p", "720p", "480p", "360p"];

// Pictures already in a format made for the web, which aren't turned into another.
const WEB_FORMATS = new Set(["image/webp", "image/avif"]);

const optimize: PropertyDefinition = {
    field: "optimize",
    label: "Optimize (strip metadata and compress)",
    type: "boolean",
};

const responsive: PropertyDefinition = {
    field: "responsive",
    label: "Make responsive sizes",
    type: "boolean",
};

const convert: PropertyDefinition = {
    field: "format",
    label: "Convert to",
    type: "string",
    options: [
        { value: "webp", label: "WebP" },
        { value: "avif", label: "AVIF" },
    ],
};

/**
 * A picture library's: optimizing, responsive sizes and another format, for raster pictures only,
 * so an SVG is sent at once; and no other format for pictures already in WebP or AVIF.
 */
export const imageUploadFields = (files: readonly File[]): PropertyDefinitionGroup[] => {
    const raster = files.filter((file) => file.type !== "image/svg+xml");

    if (raster.length === 0) {
        return [];
    }

    const converted = raster.every((file) => WEB_FORMATS.has(file.type));

    return [
        {
            id: "processing",
            title: "Processing",
            properties: converted ? [optimize, responsive] : [optimize, responsive, convert],
        },
    ];
};

export const imageUploadDefaults = { optimize: true, responsive: true, format: "webp" };

/** A video library's: streaming as HLS, in the qualities chosen, and poster frames. */
export const videoUploadFields: PropertyDefinitionGroup[] = [
    {
        id: "streaming",
        title: "Streaming",
        properties: [
            { field: "hls", label: "Stream as HLS (adaptive quality)", type: "boolean" },
            {
                field: "qualities",
                label: "Qualities",
                type: "string",
                multiple: true,
                options: QUALITIES.map((quality) => ({ value: quality, label: quality })),
            },
            { field: "posters", label: "Make poster frames", type: "boolean" },
        ],
    },
];

export const videoUploadDefaults = { hls: true, qualities: ["1080p", "720p", "480p"], posters: true };

/** An audio library's: evening out its loudness. */
export const audioUploadFields: PropertyDefinitionGroup[] = [
    {
        id: "processing",
        properties: [{ field: "normalize", label: "Normalize loudness", type: "boolean" }],
    },
];

export const audioUploadDefaults = { normalize: true };
