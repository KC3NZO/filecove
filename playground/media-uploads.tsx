import { MediaFields } from "../src";

import type { MediaForm, MediaUploadFormParams, PropertyDefinition } from "../src";

// What this site's backend can do with files as they're uploaded, asked of each library's uploads
// before they're sent (`uploadForm`), as an app offers what its own backend's pipeline does. The
// media manager only shows the form and hands what it holds to the adapter's `upload` (`values`);
// the playground's backend (`mocks/mock-media.ts`) acts on it.

type Values = Record<string, unknown>;

/** The video qualities this site's backend can make, from the largest. */
export const QUALITIES = ["2160p", "1080p", "720p", "480p", "360p"];

/** Those it makes unless it's told otherwise. */
const USUAL_QUALITIES = ["1080p", "720p", "480p"];

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

export const convert: PropertyDefinition = {
    field: "format",
    label: "Convert to",
    type: "string",
    options: [
        { value: "webp", label: "WebP" },
        { value: "avif", label: "AVIF" },
    ],
};

export const hls: PropertyDefinition = {
    field: "hls",
    label: "Stream as HLS (adaptive quality)",
    type: "boolean",
};

/** The qualities to make of a video, off without HLS, as nothing is made then. */
export const qualitiesWhile = (streaming: boolean): PropertyDefinition => ({
    field: "qualities",
    label: "Qualities",
    type: "string",
    multiple: true,
    disabled: !streaming,
    options: QUALITIES.map((quality) => ({ value: quality, label: quality })),
});

/**
 * What a video's form holds once HLS has been ticked or unticked: without it there are no renditions
 * to ask for, so what was asked of them goes, and the usual qualities come back with it.
 */
export const followingHls = (next: Values): Values => {
    if (next.hls) {
        return next.qualities === undefined ? { ...next, qualities: USUAL_QUALITIES } : next;
    }

    const { qualities: _qualities, remake: _remake, ...rest } = next;

    return rest;
};

/**
 * A picture library's: optimizing, responsive sizes and another format, for raster pictures only,
 * so an SVG is sent at once; and no other format for pictures already in WebP or AVIF.
 */
export const imageUploadForm = (files: readonly File[]): MediaForm<MediaUploadFormParams> | null => {
    const raster = files.filter((file) => file.type !== "image/svg+xml");

    if (raster.length === 0) {
        return null;
    }

    const converted = raster.every((file) => WEB_FORMATS.has(file.type));
    const groups = [
        {
            id: "processing",
            title: "Processing",
            properties: converted ? [optimize, responsive] : [optimize, responsive, convert],
        },
    ];

    return {
        defaults: converted ? { optimize: true, responsive: true } : { optimize: true, responsive: true, format: "webp" },
        render: (form) => <MediaFields {...form} groups={groups} />,
    };
};

/** A video library's fields: streaming as HLS, in the qualities chosen, and poster frames. */
const VideoUploadFields = (form: MediaUploadFormParams) => (
    <MediaFields
        {...form}
        setValues={(next) => form.setValues(followingHls(next))}
        groups={[
            {
                id: "streaming",
                title: "Streaming",
                properties: [
                    hls,
                    qualitiesWhile(!!form.values.hls),
                    { field: "posters", label: "Make poster frames", type: "boolean" },
                ],
            },
        ]}
    />
);

const videoUpload: MediaForm<MediaUploadFormParams> = {
    defaults: { hls: true, qualities: USUAL_QUALITIES, posters: true },
    render: (form) => <VideoUploadFields {...form} />,
};

export const videoUploadForm = () => videoUpload;

const audioGroups = [
    {
        id: "processing",
        properties: [{ field: "normalize", label: "Normalize loudness", type: "boolean" as const }],
    },
];

const audioUpload: MediaForm<MediaUploadFormParams> = {
    defaults: { normalize: true },
    render: (form) => <MediaFields {...form} groups={audioGroups} />,
};

/** An audio library's: evening out its loudness. */
export const audioUploadForm = () => audioUpload;
